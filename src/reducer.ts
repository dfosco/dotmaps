import type { EditorState, EditorAction, Grid } from './types';

export function createGrid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

export function createInitialState(width = 48, height = 48): EditorState {
  return {
    grid: createGrid(width, height),
    width,
    height,
    activeColor: '#CB1220', // Bright Red
    activeTool: 'pen',
    selection: { cells: new Set() },
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'PAINT': {
      const { row, col, color } = action;
      if (row < 0 || row >= state.height || col < 0 || col >= state.width) return state;
      const grid = state.grid.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? color : c)) : r
      );
      return { ...state, grid };
    }
    case 'ERASE': {
      const { row, col } = action;
      if (row < 0 || row >= state.height || col < 0 || col >= state.width) return state;
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
      // Copy existing data
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
    default:
      return state;
  }
}
