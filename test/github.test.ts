import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGithubProvider } from "../src/data/github.ts";

// These tests pre-seed the cache directory, so they never touch the network.
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "github-provider-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const seed = (name: string, content: string | object) =>
  Bun.write(join(dir, name), typeof content === "string" ? content : JSON.stringify(content));

const table = {
  char_001_test: {
    name: "测试",
    appellation: "Тест",
    rarity: "TIER_5",
    profession: "SNIPER",
    isNotObtainable: false,
    itemObtainApproach: "招募寻访",
  },
};

test("getOperators parses the cached table and takes nameEn from the EN names", async () => {
  await seed("character_table.json", table);
  await seed("character_names_en.json", { char_001_test: "Test" });
  const operators = await createGithubProvider({ cacheDir: dir }).getOperators();
  expect(operators.char_001_test).toMatchObject({ name: "测试", nameEn: "Test", rarity: 5, profession: "SNIPER", inHeadhunting: true });
});

test("nameEn falls back to appellation when the EN names can't be loaded, and isn't retried straight away", async () => {
  await seed("character_table.json", table);
  await seed("character_names_en.json", "{ not json");
  const provider = createGithubProvider({ cacheDir: dir });
  expect((await provider.getOperators()).char_001_test!.nameEn).toBe("Тест");

  await seed("character_names_en.json", { char_001_test: "Test" });
  expect((await provider.getOperators()).char_001_test!.nameEn).toBe("Тест");
});

test("a failed load is not remembered: fixing the cache makes the next call work", async () => {
  await seed("character_table.json", "{ not json");
  const provider = createGithubProvider({ cacheDir: dir });
  await expect(provider.getOperators()).rejects.toThrow();

  await seed("character_table.json", table);
  await seed("character_names_en.json", {});
  expect(Object.keys(await provider.getOperators())).toEqual(["char_001_test"]);
});

test("getPortrait picks the elite 2 file from the cached listing", async () => {
  await seed("charportraits.json", { tree: [{ path: "char_001_test_1.png" }, { path: "char_001_test_2.png" }] });
  await seed("portraits/char_001_test_2.png", "elite2");
  const bytes = await createGithubProvider({ cacheDir: dir }).getPortrait("char_001_test");
  expect(new TextDecoder().decode(bytes)).toBe("elite2");
});

test("a truncated portrait listing is an error", async () => {
  await seed("charportraits.json", { tree: [], truncated: true });
  await expect(createGithubProvider({ cacheDir: dir }).getPortrait("char_001_test")).rejects.toThrow("truncated");
});

test("tiers without a panel image return undefined without a request", async () => {
  expect(await createGithubProvider({ cacheDir: dir }).getPanelImage(6)).toBeUndefined();
});
