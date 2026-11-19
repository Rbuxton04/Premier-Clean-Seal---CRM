/**
 * The single active tool, SketchUp-style -- mutually exclusive. "select" is
 * also the pan tool. count/note/erase are Drawings Part 2 additions.
 *
 * There is deliberately no standalone "chain" tool: Part 1 briefly made
 * chain its own palette tool, but Part 2's brief explicitly lists the
 * shortcut scheme as "Ctrl+click chain (as now)" and assigns the bare "C"
 * key to the new Count tool instead -- so this reverts chain back to a
 * Ctrl+click modifier while drawing a Length (see drawIsChain in
 * measure-tool.tsx), freeing C for Count.
 */
export type ActiveTool = "select" | "length" | "calibrate" | "count" | "note" | "erase";
