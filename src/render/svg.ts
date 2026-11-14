// Small SVG builders shared by the render modules.

/** A gradient stop: position 0 to 1, colour, and opacity (default 1). */
export type GradientStop = readonly [at: number, color: string, opacity?: number];

/** SVG of a top-to-bottom linear gradient filling `width` x `height`. */
export const verticalGradient = (width: number, height: number, stops: readonly GradientStop[]): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           ${stops.map(([at, color, opacity = 1]) => `<stop offset="${at}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}
         </linearGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
     </svg>`,
  );
