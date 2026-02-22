import type { Tool, EditorAction, Selection } from './types';

interface ToolbarProps {
  activeTool: Tool;
  activeColor: string;
  selection: Selection;
  width: number;
  height: number;
  dispatch: React.Dispatch<EditorAction>;
  onExport: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export default function Toolbar({
  activeTool,
  activeColor,
  selection,
  width,
  height,
  dispatch,
  onExport,
  onSave,
  onLoad,
}: ToolbarProps) {
  const hasSelection = selection.cells.size > 0;

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <h3>Tools</h3>
        <div className="tool-buttons">
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
        <h3>File</h3>
        <div className="tool-buttons">
          <button onClick={onSave} title="Save to browser">💾 Save</button>
          <button onClick={onLoad} title="Load from browser">📂 Load</button>
          <button onClick={onExport} title="Export as PNG">📷 Export PNG</button>
        </div>
      </div>
    </div>
  );
}
