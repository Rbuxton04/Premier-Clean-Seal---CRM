/** The single active tool, SketchUp-style -- mutually exclusive, replacing the old separate "Chain mode" toggle + Ctrl+click modifier. "select" is also the pan tool once panning lands in Step 3. count/note/erase are disabled placeholders for Part 2. */
export type ActiveTool = "select" | "length" | "chain" | "calibrate";
