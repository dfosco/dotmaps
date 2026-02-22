import { useRef } from 'react';
import { config } from './config';
import type { Tool, EditorAction, Selection } from './types';

interface ToolbarProps {
  activeTool: Tool;
  activeColor: string;
  selection: Selection;
  width: number;
  height: number;
  dispatch: React.Dispatch<EditorAction>;
  onExport: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onImageUpload: (file: File) => void;
  onExportList: () => void;
  hasImportedImage: boolean;
  resolution: number;
  onResolutionChange: (maxDim: number) => void;
  onRotate: (direction: 'cw' | 'ccw') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function Toolbar({
  activeTool,
  activeColor,
  selection,
  width,
  height,
  dispatch,
  onExport,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onImageUpload,
  onExportList,
  hasImportedImage,
  resolution,
  onResolutionChange,
  onRotate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolbarProps) {
  const hasSelection = selection.cells.size > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <h3>Tools</h3>
        <div className="tool-buttons">
          <button
            className={activeTool === 'hand' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_TOOL', tool: 'hand' })}
            title="Hand / Pan (H)"
          >
            ✋ Hand
          </button>
          <button
            className={activeTool === 'pen' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_TOOL', tool: 'pen' })}
            title="Pen (P)"
          >
            🖊️ Pen
          </button>
          <button
            className={activeTool === 'eraser' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_TOOL', tool: 'eraser' })}
            title="Eraser (E)"
          >
            🧹 Eraser
          </button>
          <button
            className={activeTool === 'select' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_TOOL', tool: 'select' })}
            title="Select (S)"
          >
            ⬚ Select
          </button>
        </div>
      </div>

      <div className="toolbar-group">
        <h3>History</h3>
        <div className="undo-redo-controls">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">↩ Undo</button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">↪ Redo</button>
        </div>
      </div>

      {hasSelection && (
        <div className="toolbar-group">
          <h3>Selection ({selection.cells.size})</h3>
          <div className="tool-buttons">
            <button
              onClick={() => dispatch({ type: 'RECOLOR_SELECTION', color: activeColor })}
              title="Recolor selected dots"
            >
              🎨 Recolor
            </button>
            <button
              onClick={() => dispatch({ type: 'DELETE_SELECTION' })}
              title="Delete selected dots"
            >
              🗑️ Delete
            </button>
            <button
              onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
              title="Clear selection"
            >
              ✕ Deselect
            </button>
          </div>
        </div>
      )}

      <div className="toolbar-group">
        <h3>Grid Size</h3>
        <div className="grid-size-controls">
          <label>
            W:
            <input
              type="number"
              min={1}
              max={256}
              value={width}
              onChange={(e) => {
                const val = Math.max(1, Math.min(256, parseInt(e.target.value) || 1));
                dispatch({ type: 'RESIZE', width: val, height });
              }}
            />
          </label>
          <label>
            H:
            <input
              type="number"
              min={1}
              max={256}
              value={height}
              onChange={(e) => {
                const val = Math.max(1, Math.min(256, parseInt(e.target.value) || 1));
                dispatch({ type: 'RESIZE', width, height: val });
              }}
            />
          </label>
        </div>
      </div>

      <div className="toolbar-group">
        <h3>Rotate</h3>
        <div className="rotate-controls">
          <button onClick={() => onRotate('ccw')} title="Rotate left 90°">↺ Left</button>
          <button onClick={() => onRotate('cw')} title="Rotate right 90°">↻ Right</button>
        </div>
      </div>

      <div className="toolbar-group">
        <h3>Zoom</h3>
        <div className="zoom-controls">
          <button onClick={onZoomOut} title="Zoom out (-)">−</button>
          <span className="zoom-level" onClick={onZoomReset} title="Reset zoom (0)">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={onZoomIn} title="Zoom in (+)">+</button>
        </div>
      </div>

      <div className="toolbar-group">
        <h3>File</h3>
        <div className="tool-buttons">
          <button onClick={onExport} title="Export as PNG">📷 Export PNG</button>
          <button onClick={onExportList} title="Export parts list as Markdown">📋 Export List</button>
          <button onClick={() => fileInputRef.current?.click()} title="Import image as dots">🖼️ Import Image</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {hasImportedImage && (
        <div className="toolbar-group">
          <h3>Image Resolution</h3>
          <div className="resolution-controls">
            <input
              type="range"
              min={4}
              max={Math.max(
                config.fullPlate.width * config.basePlates.size[0],
                config.fullPlate.height * config.basePlates.size[1],
              )}
              value={resolution}
              onChange={(e) => onResolutionChange(parseInt(e.target.value))}
            />
            <span className="resolution-label">{resolution}px</span>
          </div>
        </div>
      )}
    </div>
  );
}
