import { useReducer, useCallback, useEffect } from 'react';
import { editorReducer, createInitialState } from './reducer';
import CanvasEditor from './CanvasEditor';
import ColorPalette from './ColorPalette';
import Toolbar from './Toolbar';
import './App.css';

const STORAGE_KEY = 'dotmaps-save';

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => createInitialState());

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key.toLowerCase()) {
        case 'p':
          dispatch({ type: 'SET_TOOL', tool: 'pen' });
          break;
        case 'e':
          dispatch({ type: 'SET_TOOL', tool: 'eraser' });
          break;
        case 's':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSave();
          } else {
            dispatch({ type: 'SET_TOOL', tool: 'select' });
          }
          break;
        case 'delete':
        case 'backspace':
          if (state.selection.cells.size > 0) {
            dispatch({ type: 'DELETE_SELECTION' });
          }
          break;
        case 'escape':
          dispatch({ type: 'CLEAR_SELECTION' });
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selection.cells.size]);

  const handleSave = useCallback(() => {
    const data = { grid: state.grid, width: state.width, height: state.height };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    alert('Saved!');
  }, [state.grid, state.width, state.height]);

  const handleLoad = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert('No saved data found.');
      return;
    }
    try {
      const data = JSON.parse(raw);
      dispatch({ type: 'LOAD_GRID', grid: data.grid, width: data.width, height: data.height });
    } catch {
      alert('Failed to load saved data.');
    }
  }, []);

  const handleExport = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'dotmap.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🟡 Dotmaps</h1>
        <span className="subtitle">LEGO Dots Editor</span>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <ColorPalette activeColor={state.activeColor} dispatch={dispatch} />
          <Toolbar
            activeTool={state.activeTool}
            activeColor={state.activeColor}
            selection={state.selection}
            width={state.width}
            height={state.height}
            dispatch={dispatch}
            onExport={handleExport}
            onSave={handleSave}
            onLoad={handleLoad}
          />
        </aside>
        <main className="canvas-area">
          <CanvasEditor state={state} dispatch={dispatch} />
        </main>
      </div>
    </div>
  );
}

export default App;
