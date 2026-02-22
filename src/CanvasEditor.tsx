import { useRef, useEffect, useCallback } from 'react';
import type { EditorState, EditorAction, Tool } from './types';

const CELL_SIZE = 16;
const DOT_RADIUS = 6;
const BG_COLOR = '#2C2C2C';
const GRID_COLOR = '#3A3A3A';
const SELECTION_COLOR = 'rgba(255, 255, 100, 0.5)';
const SELECTION_STROKE = 'rgba(255, 255, 100, 0.9)';

interface CanvasEditorProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

function cellFromMouse(
  canvas: HTMLCanvasElement,
  e: React.MouseEvent | MouseEvent,
  width: number,
  height: number
): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  if (row < 0 || row >= height || col < 0 || col >= width) return null;
  return { row, col };
}

export default function CanvasEditor({ state, dispatch }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const selectStart = useRef<{ row: number; col: number } | null>(null);
  const selectCurrent = useRef<{ row: number; col: number } | null>(null);

  const { grid, width, height, activeColor, activeTool, selection } = state;

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = width * CELL_SIZE;
    const h = height * CELL_SIZE;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= height; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(w, r * CELL_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= width; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, h);
      ctx.stroke();
    }

    // Dots
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const color = grid[r][c];
        if (color) {
          const cx = c * CELL_SIZE + CELL_SIZE / 2;
          const cy = r * CELL_SIZE + CELL_SIZE / 2;
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
      const cx = cs * CELL_SIZE + CELL_SIZE / 2;
      const cy = rs * CELL_SIZE + CELL_SIZE / 2;
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
      const x1 = Math.min(s.col, e.col) * CELL_SIZE;
      const y1 = Math.min(s.row, e.row) * CELL_SIZE;
      const x2 = (Math.max(s.col, e.col) + 1) * CELL_SIZE;
      const y2 = (Math.max(s.row, e.row) + 1) * CELL_SIZE;
      ctx.strokeStyle = SELECTION_STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
    }
  }, [grid, width, height, activeTool, selection]);

  useEffect(() => {
    draw();
  }, [draw]);

  const applyTool = useCallback(
    (row: number, col: number, tool: Tool, color: string) => {
      if (tool === 'pen') {
        dispatch({ type: 'PAINT', row, col, color });
      } else if (tool === 'eraser') {
        dispatch({ type: 'ERASE', row, col });
      }
    },
    [dispatch]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cell = cellFromMouse(canvas, e, width, height);
      if (!cell) return;

      if (activeTool === 'select') {
        selectStart.current = cell;
        selectCurrent.current = cell;
        if (!e.shiftKey) {
          dispatch({ type: 'CLEAR_SELECTION' });
        }
      } else {
        isPainting.current = true;
        applyTool(cell.row, cell.col, activeTool, activeColor);
      }
    },
    [activeTool, activeColor, width, height, dispatch, applyTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cell = cellFromMouse(canvas, e, width, height);
      if (!cell) return;

      if (activeTool === 'select' && selectStart.current) {
        selectCurrent.current = cell;
        draw();
      } else if (isPainting.current) {
        applyTool(cell.row, cell.col, activeTool, activeColor);
      }
    },
    [activeTool, activeColor, width, height, applyTool, draw]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
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
      isPainting.current = false;
    },
    [activeTool, dispatch]
  );

  const handleMouseLeave = useCallback(() => {
    isPainting.current = false;
    if (selectStart.current) {
      selectStart.current = null;
      selectCurrent.current = null;
      draw();
    }
  }, [draw]);

  const canvasWidth = width * CELL_SIZE;
  const canvasHeight = height * CELL_SIZE;

  const cursorStyle =
    activeTool === 'pen'
      ? 'crosshair'
      : activeTool === 'eraser'
        ? 'pointer'
        : 'default';

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        cursor: cursorStyle,
        imageRendering: 'pixelated',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 80px)',
        objectFit: 'contain',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
