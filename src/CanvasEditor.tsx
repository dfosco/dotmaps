import { useRef, useEffect, useCallback } from 'react';
import { config } from './config';
import type { EditorState, EditorAction, Tool } from './types';

const CELL_SIZE = 16;
const DOT_RADIUS = 6;
const BG_COLOR = '#2C2C2C';
const GRID_COLOR = '#3A3A3A';
const SELECTION_COLOR = 'rgba(255, 255, 100, 0.5)';
const SELECTION_STROKE = 'rgba(255, 255, 100, 0.9)';
const PLATE_GAP = 4;
const PLATE_BG = '#222230';
const PLATE_BORDER = '#555';
const PLATE_LABEL_COLOR = '#666';

const [PLATE_W, PLATE_H] = config.basePlates.size;

interface CanvasEditorProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showBasePlates: boolean;
}

// Compute pixel offset for a grid cell accounting for plate gaps
function cellToPixel(col: number, row: number, showPlates: boolean): { px: number; py: number } {
  if (!showPlates) return { px: col * CELL_SIZE, py: row * CELL_SIZE };
  const plateCol = Math.floor(col / PLATE_W);
  const plateRow = Math.floor(row / PLATE_H);
  return {
    px: col * CELL_SIZE + plateCol * PLATE_GAP,
    py: row * CELL_SIZE + plateRow * PLATE_GAP,
  };
}

function canvasDims(gridW: number, gridH: number, showPlates: boolean): { w: number; h: number } {
  if (!showPlates) return { w: gridW * CELL_SIZE, h: gridH * CELL_SIZE };
  const platesX = Math.ceil(gridW / PLATE_W);
  const platesY = Math.ceil(gridH / PLATE_H);
  return {
    w: gridW * CELL_SIZE + (platesX - 1) * PLATE_GAP,
    h: gridH * CELL_SIZE + (platesY - 1) * PLATE_GAP,
  };
}

function cellFromMouse(
  canvas: HTMLCanvasElement,
  e: React.MouseEvent | MouseEvent,
  width: number,
  height: number,
  showPlates: boolean,
): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  let col: number, row: number;
  if (showPlates) {
    const plateStepX = PLATE_W * CELL_SIZE + PLATE_GAP;
    const plateStepY = PLATE_H * CELL_SIZE + PLATE_GAP;
    const plateCol = Math.floor(x / plateStepX);
    const plateRow = Math.floor(y / plateStepY);
    const localX = x - plateCol * plateStepX;
    const localY = y - plateRow * plateStepY;
    if (localX >= PLATE_W * CELL_SIZE || localY >= PLATE_H * CELL_SIZE) return null; // in gap
    col = plateCol * PLATE_W + Math.floor(localX / CELL_SIZE);
    row = plateRow * PLATE_H + Math.floor(localY / CELL_SIZE);
  } else {
    col = Math.floor(x / CELL_SIZE);
    row = Math.floor(y / CELL_SIZE);
  }
  if (row < 0 || row >= height || col < 0 || col >= width) return null;
  return { row, col };
}

export default function CanvasEditor({ state, dispatch, zoom, onZoomChange, showBasePlates }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const selectStart = useRef<{ row: number; col: number } | null>(null);
  const selectCurrent = useRef<{ row: number; col: number } | null>(null);

  const { grid, width, height, activeColor, activeTool, selection } = state;

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dims = canvasDims(width, height, showBasePlates);
    canvas.width = dims.w;
    canvas.height = dims.h;

    // Background
    ctx.fillStyle = showBasePlates ? '#111118' : BG_COLOR;
    ctx.fillRect(0, 0, dims.w, dims.h);

    if (showBasePlates) {
      // Draw plate backgrounds
      const platesX = Math.ceil(width / PLATE_W);
      const platesY = Math.ceil(height / PLATE_H);
      let plateNum = 1;
      for (let py = 0; py < platesY; py++) {
        for (let px = 0; px < platesX; px++) {
          const ox = px * (PLATE_W * CELL_SIZE + PLATE_GAP);
          const oy = py * (PLATE_H * CELL_SIZE + PLATE_GAP);
          const pw = Math.min(PLATE_W, width - px * PLATE_W) * CELL_SIZE;
          const ph = Math.min(PLATE_H, height - py * PLATE_H) * CELL_SIZE;
          ctx.fillStyle = PLATE_BG;
          ctx.fillRect(ox, oy, pw, ph);
          ctx.strokeStyle = PLATE_BORDER;
          ctx.lineWidth = 1;
          ctx.strokeRect(ox + 0.5, oy + 0.5, pw - 1, ph - 1);
          // Plate number label
          ctx.fillStyle = PLATE_LABEL_COLOR;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(plateNum++), ox + pw / 2, oy + ph / 2);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const { px, py } = cellToPixel(c, r, showBasePlates);
        ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
      }
    }

    // Dots
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const color = grid[r][c];
        if (color) {
          const { px, py } = cellToPixel(c, r, showBasePlates);
          const cx = px + CELL_SIZE / 2;
          const cy = py + CELL_SIZE / 2;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Selection highlights
    for (const key of selection.cells) {
      const [rs, cs] = key.split(',').map(Number);
      const { px, py } = cellToPixel(cs, rs, showBasePlates);
      const cx = px + CELL_SIZE / 2;
      const cy = py + CELL_SIZE / 2;
      ctx.fillStyle = SELECTION_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, DOT_RADIUS + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = SELECTION_STROKE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Drag-select rectangle preview
    if (activeTool === 'select' && selectStart.current && selectCurrent.current) {
      const s = selectStart.current;
      const e = selectCurrent.current;
      const p1 = cellToPixel(Math.min(s.col, e.col), Math.min(s.row, e.row), showBasePlates);
      const p2 = cellToPixel(Math.max(s.col, e.col), Math.max(s.row, e.row), showBasePlates);
      ctx.strokeStyle = SELECTION_STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(p1.px, p1.py, p2.px + CELL_SIZE - p1.px, p2.py + CELL_SIZE - p1.py);
      ctx.setLineDash([]);
    }
  }, [grid, width, height, activeTool, selection, showBasePlates]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Ctrl/Cmd + wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        onZoomChange(Math.max(0.25, Math.min(8, zoom * factor)));
      }
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [zoom, onZoomChange]);

  const applyTool = useCallback(
    (row: number, col: number, tool: Tool, color: string) => {
      if (tool === 'pen') {
        if (!color) return; // no color selected
        dispatch({ type: 'PAINT', row, col, color });
      } else if (tool === 'eraser') {
        dispatch({ type: 'ERASE', row, col });
      }
    },
    [dispatch]
  );

  const getScrollContainer = useCallback(() => {
    return canvasRef.current?.closest('.canvas-area') as HTMLElement | null;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (activeTool === 'hand') {
        isPanning.current = true;
        const container = getScrollContainer();
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container?.scrollLeft ?? 0,
          scrollTop: container?.scrollTop ?? 0,
        };
        return;
      }

      const cell = cellFromMouse(canvas, e, width, height, showBasePlates);
      if (!cell) return;

      if (activeTool === 'select') {
        selectStart.current = cell;
        selectCurrent.current = cell;
        if (!e.shiftKey) {
          dispatch({ type: 'CLEAR_SELECTION' });
        }
      } else {
        isPainting.current = true;
        dispatch({ type: 'STROKE_START' });
        applyTool(cell.row, cell.col, activeTool, activeColor);
      }
    },
    [activeTool, activeColor, width, height, dispatch, applyTool, getScrollContainer, showBasePlates]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current && panStart.current) {
        const container = getScrollContainer();
        if (container) {
          container.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
          container.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
        }
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const cell = cellFromMouse(canvas, e, width, height, showBasePlates);
      if (!cell) return;

      if (activeTool === 'select' && selectStart.current) {
        selectCurrent.current = cell;
        draw();
      } else if (isPainting.current) {
        applyTool(cell.row, cell.col, activeTool, activeColor);
      }
    },
    [activeTool, activeColor, width, height, applyTool, draw, getScrollContainer, showBasePlates]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current) {
        isPanning.current = false;
        panStart.current = null;
        return;
      }

      if (activeTool === 'select' && selectStart.current && selectCurrent.current) {
        const s = selectStart.current;
        const c = selectCurrent.current;
        if (s.row === c.row && s.col === c.col) {
          dispatch({ type: 'SELECT_CELL', row: s.row, col: s.col, additive: e.shiftKey });
        } else {
          dispatch({
            type: 'SELECT_RECT',
            startRow: s.row,
            startCol: s.col,
            endRow: c.row,
            endCol: c.col,
            additive: e.shiftKey,
          });
        }
        selectStart.current = null;
        selectCurrent.current = null;
      }
      if (isPainting.current) {
        isPainting.current = false;
        dispatch({ type: 'STROKE_END' });
      }
    },
    [activeTool, dispatch]
  );

  const handleMouseLeave = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
    }
    if (isPainting.current) {
      isPainting.current = false;
      dispatch({ type: 'STROKE_END' });
    }
    if (selectStart.current) {
      selectStart.current = null;
      selectCurrent.current = null;
      draw();
    }
  }, [draw, dispatch]);

  const dims = canvasDims(width, height, showBasePlates);

  const cursorStyle =
    activeTool === 'hand'
      ? (isPanning.current ? 'grabbing' : 'grab')
      : activeTool === 'pen'
        ? 'crosshair'
        : activeTool === 'eraser'
          ? 'pointer'
          : 'default';

  return (
    <canvas
      ref={canvasRef}
      width={dims.w}
      height={dims.h}
      style={{
        cursor: cursorStyle,
        imageRendering: 'pixelated',
        width: dims.w * zoom,
        height: dims.h * zoom,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
