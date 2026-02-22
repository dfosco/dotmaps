import type { EditorState, EditorAction, Grid, UndoableState } from './types';
import { config } from './config';

const MAX_UNDO = 100;
const BLACK_HEX = config.colors.find(c => c.name === 'black')?.hex ?? '#000000';

// Actions that modify the grid and should be undoable
const UNDOABLE_ACTIONS = new Set([
  'PAINT', 'ERASE', 'RECOLOR_SELECTION', 'DELETE_SELECTION',
  'RESIZE', 'LOAD_GRID', 'ROTATE_GRID',
]);

export function createGrid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

export function createInitialState(width = 48, height = 48, grid?: Grid): UndoableState {
  const present: EditorState = {
    grid: grid ?? createGrid(width, height),
    width,
    height,
    activeColor: '',
    activeTool: 'hand',
    selection: { cells: new Set() },
  };
  return { present, past: [], future: [] };
}

function coreReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'PAINT': {
      const { row, col, color } = action;
      if (row < 0 || row >= state.height || col < 0 || col >= state.width) return state;
      // Painting with black = erasing (black is absence of dot)
      const value = color === BLACK_HEX ? null : color;
      if (state.grid[row][col] === value) return state;
      const grid = state.grid.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
      );
      return { ...state, grid };
    }
    case 'ERASE': {
      const { row, col } = action;
      if (row < 0 || row >= state.height || col < 0 || col >= state.width) return state;
      if (state.grid[row][col] === null) return state;
      const grid = state.grid.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? null : c)) : r
      );
      return { ...state, grid };
    }
    case 'SET_COLOR':
      return { ...state, activeColor: action.color };
    case 'SET_TOOL':
      return { ...state, activeTool: action.tool, selection: { cells: new Set() } };
    case 'SELECT_CELL': {
      const key = `${action.row},${action.col}`;
      const cells = action.additive ? new Set(state.selection.cells) : new Set<string>();
      if (cells.has(key)) {
        cells.delete(key);
      } else {
        cells.add(key);
      }
      return { ...state, selection: { cells } };
    }
    case 'SELECT_RECT': {
      const { startRow, startCol, endRow, endCol, additive } = action;
      const minR = Math.min(startRow, endRow);
      const maxR = Math.max(startRow, endRow);
      const minC = Math.min(startCol, endCol);
      const maxC = Math.max(startCol, endCol);
      const cells = additive ? new Set(state.selection.cells) : new Set<string>();
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          cells.add(`${r},${c}`);
        }
      }
      return { ...state, selection: { cells } };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selection: { cells: new Set() } };
    case 'RECOLOR_SELECTION': {
      const grid = state.grid.map((r, ri) =>
        r.map((c, ci) => (state.selection.cells.has(`${ri},${ci}`) ? action.color : c))
      );
      return { ...state, grid, selection: { cells: new Set() } };
    }
    case 'DELETE_SELECTION': {
      const grid = state.grid.map((r, ri) =>
        r.map((c, ci) => (state.selection.cells.has(`${ri},${ci}`) ? null : c))
      );
      return { ...state, grid, selection: { cells: new Set() } };
    }
    case 'RESIZE': {
      const { width, height } = action;
      const grid = createGrid(width, height);
      for (let r = 0; r < Math.min(height, state.height); r++) {
        for (let c = 0; c < Math.min(width, state.width); c++) {
          grid[r][c] = state.grid[r][c];
        }
      }
      return { ...state, grid, width, height, selection: { cells: new Set() } };
    }
    case 'LOAD_GRID':
      return {
        ...state,
        grid: action.grid,
        width: action.width,
        height: action.height,
        selection: { cells: new Set() },
      };
    case 'ROTATE_GRID': {
      const { width: oldW, height: oldH, grid: oldGrid } = state;
      const newW = oldH;
      const newH = oldW;
      const grid = createGrid(newW, newH);
      for (let r = 0; r < oldH; r++) {
        for (let c = 0; c < oldW; c++) {
          if (action.direction === 'cw') {
            grid[c][oldH - 1 - r] = oldGrid[r][c];
          } else {
            grid[oldW - 1 - c][r] = oldGrid[r][c];
          }
        }
      }
      return { ...state, grid, width: newW, height: newH, selection: { cells: new Set() } };
    }
    default:
      return state;
  }
}

export function editorReducer(undoable: UndoableState, action: EditorAction): UndoableState {
  if (action.type === 'UNDO') {
    if (undoable.past.length === 0) return undoable;
    const previous = undoable.past[undoable.past.length - 1];
    return {
      past: undoable.past.slice(0, -1),
      present: previous,
      future: [undoable.present, ...undoable.future],
    };
  }

  if (action.type === 'REDO') {
    if (undoable.future.length === 0) return undoable;
    const next = undoable.future[0];
    return {
      past: [...undoable.past, undoable.present],
      present: next,
      future: undoable.future.slice(1),
    };
  }

  if (action.type === 'STROKE_START') {
    return { ...undoable, strokeAnchor: undoable.present };
  }

  if (action.type === 'STROKE_END') {
    if (!undoable.strokeAnchor) return undoable;
    if (undoable.present === undoable.strokeAnchor) {
      return { ...undoable, strokeAnchor: undefined };
    }
    return {
      past: [...undoable.past.slice(-MAX_UNDO + 1), undoable.strokeAnchor],
      present: undoable.present,
      future: [],
      strokeAnchor: undefined,
    };
  }

  const newPresent = coreReducer(undoable.present, action);
  if (newPresent === undoable.present) return undoable;

  if (UNDOABLE_ACTIONS.has(action.type)) {
    // During a stroke, accumulate changes without individual undo entries
    if (undoable.strokeAnchor) {
      return { ...undoable, present: newPresent };
    }
    return {
      past: [...undoable.past.slice(-MAX_UNDO + 1), undoable.present],
      present: newPresent,
      future: [],
    };
  }

  return { ...undoable, present: newPresent };
}
