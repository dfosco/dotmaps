export type Tool = 'pen' | 'eraser' | 'select';

export type Cell = string | null; // hex color or null (empty)

export type Grid = Cell[][];

export interface Selection {
  cells: Set<string>; // "row,col" keys
}

export interface EditorState {
  grid: Grid;
  width: number;
  height: number;
  activeColor: string;
  activeTool: Tool;
  selection: Selection;
}

export interface UndoableState {
  present: EditorState;
  past: EditorState[];
  future: EditorState[];
}

export type EditorAction =
  | { type: 'PAINT'; row: number; col: number; color: string }
  | { type: 'ERASE'; row: number; col: number }
  | { type: 'SET_COLOR'; color: string }
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'SELECT_CELL'; row: number; col: number; additive: boolean }
  | { type: 'SELECT_RECT'; startRow: number; startCol: number; endRow: number; endCol: number; additive: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'RECOLOR_SELECTION'; color: string }
  | { type: 'DELETE_SELECTION' }
  | { type: 'RESIZE'; width: number; height: number }
  | { type: 'LOAD_GRID'; grid: Grid; width: number; height: number }
  | { type: 'ROTATE_GRID'; direction: 'cw' | 'ccw' }
  | { type: 'UNDO' }
  | { type: 'REDO' };
