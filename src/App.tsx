import { useReducer, useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { editorReducer, createInitialState, createGrid } from './reducer';
import { imageToGrid, loadImageFile, getImageData, fixGridLimits, imageDataToBase64, base64ToImageData, DEFAULT_RENDER_OPTIONS } from './imageToGrid';
import type { RenderOptions } from './imageToGrid';
import { LEGO_COLORS } from './colors';
import { config } from './config';
import { loadTabs, saveTabs, loadFileData, saveFileData, deleteFileData, generateId, saveSourceImage, loadSourceImage, saveZoom, loadZoom } from './storage';
import type { TabsState } from './storage';
import CanvasEditor from './CanvasEditor';
import ColorPalette from './ColorPalette';
import Toolbar from './Toolbar';
import TabBar from './TabBar';
import './App.css';

// Full working area in dots (landscape and portrait)
const PLATE_W = config.fullPlate.width * config.basePlates.size[0];
const PLATE_H = config.fullPlate.height * config.basePlates.size[1];
const FULL_LONG = Math.max(PLATE_W, PLATE_H);
const FULL_SHORT = Math.min(PLATE_W, PLATE_H);
const CELL_SIZE = 16; // must match CanvasEditor

function computeFitZoom(gridW: number, gridH: number, container: HTMLElement | null): number {
  if (!container) return 1;
  const pad = 40; // 20px padding on each side
  const availW = container.clientWidth - pad;
  const availH = container.clientHeight - pad;
  const canvasW = gridW * CELL_SIZE;
  const canvasH = gridH * CELL_SIZE;
  return Math.max(0.25, Math.min(8, Math.min(availW / canvasW, availH / canvasH)));
}

function App() {
  const [tabsState, setTabsState] = useState<TabsState>(() => {
    const saved = loadTabs();
    if (saved) return saved;
    const id = generateId();
    return { tabs: [{ id, name: 'Untitled' }], activeTabId: id };
  });

  const [undoable, dispatch] = useReducer(editorReducer, undefined, () => {
    const fileData = loadFileData(tabsState.activeTabId);
    if (fileData) return createInitialState(fileData.width, fileData.height, fileData.grid);
    return createInitialState(PLATE_W, PLATE_H);
  });

  const state = undoable.present;

  const [zoom, setZoom] = useState(() => loadZoom(tabsState.activeTabId) ?? 1);
  const canvasAreaRef = useRef<HTMLElement>(null);
  const importedImageRef = useRef<{ data: ImageData; aspect: number } | null>(null);
  const [hasImportedImage, setHasImportedImage] = useState(false);
  const [resolution, setResolution] = useState(FULL_LONG);
  const [limitPieces, setLimitPieces] = useState(true);
  const currentTabRef = useRef(tabsState.activeTabId);
  const didInitialFit = useRef(false);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({ ...DEFAULT_RENDER_OPTIONS });
  const [showBasePlates, setShowBasePlates] = useState(false);

  // Fit zoom to view on initial mount (if no saved zoom)
  useEffect(() => {
    if (didInitialFit.current) return;
    didInitialFit.current = true;
    const saved = loadZoom(currentTabRef.current);
    if (saved) return; // respect saved zoom
    // Wait a frame for layout
    requestAnimationFrame(() => {
      const fit = computeFitZoom(state.width, state.height, canvasAreaRef.current);
      setZoom(fit);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save zoom whenever it changes
  useEffect(() => {
    saveZoom(currentTabRef.current, zoom);
  }, [zoom]);

  // Restore source image on initial load
  useEffect(() => {
    const savedImg = loadSourceImage(currentTabRef.current);
    if (savedImg) {
      setHasImportedImage(true);
      base64ToImageData(savedImg).then((data) => {
        importedImageRef.current = { data, aspect: data.width / data.height };
      }).catch(() => { /* corrupted data — ignore */ });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save tabs metadata
  useEffect(() => {
    saveTabs(tabsState);
  }, [tabsState]);

  // Auto-save file data
  useEffect(() => {
    saveFileData(currentTabRef.current, {
      grid: state.grid,
      width: state.width,
      height: state.height,
    });
  }, [state.grid, state.width, state.height]);

  // Tab operations
  const handleSelectTab = useCallback((id: string) => {
    if (id === currentTabRef.current) return;
    saveFileData(currentTabRef.current, {
      grid: state.grid,
      width: state.width,
      height: state.height,
    });
    const fileData = loadFileData(id);
    if (fileData) {
      dispatch({ type: 'LOAD_GRID', grid: fileData.grid, width: fileData.width, height: fileData.height });
    } else {
      dispatch({ type: 'LOAD_GRID', grid: createGrid(PLATE_W, PLATE_H), width: PLATE_W, height: PLATE_H });
    }
    currentTabRef.current = id;
    setTabsState(prev => ({ ...prev, activeTabId: id }));
    // Restore zoom or fit-to-view
    const savedZoom = loadZoom(id);
    if (savedZoom) {
      setZoom(savedZoom);
    } else {
      const fd = loadFileData(id);
      const gw = fd?.width ?? PLATE_W;
      const gh = fd?.height ?? PLATE_H;
      requestAnimationFrame(() => setZoom(computeFitZoom(gw, gh, canvasAreaRef.current)));
    }
    // Restore source image if saved
    const savedImg = loadSourceImage(id);
    if (savedImg) {
      setHasImportedImage(true);
      base64ToImageData(savedImg).then((data) => {
        importedImageRef.current = { data, aspect: data.width / data.height };
      });
    } else {
      setHasImportedImage(false);
      importedImageRef.current = null;
    }
  }, [state.grid, state.width, state.height]);

  const handleNewTab = useCallback(() => {
    saveFileData(currentTabRef.current, {
      grid: state.grid,
      width: state.width,
      height: state.height,
    });
    const id = generateId();
    dispatch({ type: 'LOAD_GRID', grid: createGrid(PLATE_W, PLATE_H), width: PLATE_W, height: PLATE_H });
    currentTabRef.current = id;
    setTabsState(prev => ({
      tabs: [...prev.tabs, { id, name: 'Untitled' }],
      activeTabId: id,
    }));
    setHasImportedImage(false);
    importedImageRef.current = null;
    requestAnimationFrame(() => setZoom(computeFitZoom(PLATE_W, PLATE_H, canvasAreaRef.current)));
  }, [state.grid, state.width, state.height]);

  const handleCloseTab = useCallback((id: string) => {
    setTabsState(prev => {
      const remaining = prev.tabs.filter(t => t.id !== id);

      if (remaining.length === 0) {
        const newId = generateId();
        dispatch({ type: 'LOAD_GRID', grid: createGrid(PLATE_W, PLATE_H), width: PLATE_W, height: PLATE_H });
        currentTabRef.current = newId;
        deleteFileData(id);
        return { tabs: [{ id: newId, name: 'Untitled' }], activeTabId: newId };
      }

      if (id === prev.activeTabId) {
        const idx = prev.tabs.findIndex(t => t.id === id);
        const newActive = remaining[Math.min(idx, remaining.length - 1)];
        const fileData = loadFileData(newActive.id);
        if (fileData) {
          dispatch({ type: 'LOAD_GRID', grid: fileData.grid, width: fileData.width, height: fileData.height });
        } else {
          dispatch({ type: 'LOAD_GRID', grid: createGrid(PLATE_W, PLATE_H), width: PLATE_W, height: PLATE_H });
        }
        currentTabRef.current = newActive.id;
        deleteFileData(id);
        return { tabs: remaining, activeTabId: newActive.id };
      }

      deleteFileData(id);
      return { ...prev, tabs: remaining };
    });
    setHasImportedImage(false);
    importedImageRef.current = null;
  }, []);

  const handleRenameTab = useCallback((id: string, name: string) => {
    setTabsState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => t.id === id ? { ...t, name } : t),
    }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'h':
          dispatch({ type: 'SET_TOOL', tool: 'hand' });
          break;
        case 'p':
          dispatch({ type: 'SET_TOOL', tool: 'pen' });
          break;
        case 'e':
          dispatch({ type: 'SET_TOOL', tool: 'eraser' });
          break;
        case 's':
          if (!(e.metaKey || e.ctrlKey)) {
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
        case '=':
        case '+':
          setZoom((z) => Math.min(8, z * 1.2));
          break;
        case '-':
          setZoom((z) => Math.max(0.25, z / 1.2));
          break;
        case '0':
          setZoom(1);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selection.cells.size]);

  const handleExport = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'dotmap.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(8, z * 1.2)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.25, z / 1.2)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  const handleImageUpload = useCallback(
    async (file: File) => {
      try {
        const img = await loadImageFile(file);
        const data = getImageData(img);
        const aspect = img.width / img.height;
        importedImageRef.current = { data, aspect };
        setHasImportedImage(true);
        setResolution(FULL_LONG);
        // Save source image as base64 (best-effort, may exceed quota)
        try {
          saveSourceImage(currentTabRef.current, imageDataToBase64(data));
        } catch {
          // localStorage quota exceeded — source image won't persist across refresh
        }
        // Pick landscape or portrait based on image aspect ratio
        const gw = aspect >= 1 ? FULL_LONG : FULL_SHORT;
        const gh = aspect >= 1 ? FULL_SHORT : FULL_LONG;
        let grid = imageToGrid(data, gw, gh, undefined, renderOptions);
        if (limitPieces) grid = fixGridLimits(grid);
        setLimitPieces(true);
        dispatch({ type: 'LOAD_GRID', grid, width: gw, height: gh });
        requestAnimationFrame(() => setZoom(computeFitZoom(gw, gh, canvasAreaRef.current)));
      } catch (err) {
        console.error('Image upload failed:', err);
        alert('Failed to load image.');
      }
    },
    [dispatch],
  );

  const handleResolutionChange = useCallback(
    (detailRes: number) => {
      const ref = importedImageRef.current;
      if (!ref) return;
      setResolution(detailRes);
      const gw = state.width;
      const gh = state.height;
      const grid = imageToGrid(ref.data, gw, gh, detailRes, renderOptions);
      dispatch({ type: 'LOAD_GRID', grid, width: gw, height: gh });
    },
    [dispatch, state.width, state.height],
  );

  const handleRenderOptionsChange = useCallback(
    (opts: RenderOptions) => {
      setRenderOptions(opts);
      const ref = importedImageRef.current;
      if (!ref) return;
      const gw = state.width;
      const gh = state.height;
      let grid = imageToGrid(ref.data, gw, gh, resolution < Math.max(gw, gh) ? resolution : undefined, opts);
      if (limitPieces) grid = fixGridLimits(grid);
      dispatch({ type: 'LOAD_GRID', grid, width: gw, height: gh });
    },
    [dispatch, state.width, state.height, resolution, limitPieces],
  );

  const handleRotate = useCallback((direction: 'cw' | 'ccw') => {
    dispatch({ type: 'ROTATE_GRID', direction });
  }, [dispatch]);

  const handleToggleLimits = useCallback((on: boolean) => {
    setLimitPieces(on);
    if (on) {
      const fixed = fixGridLimits(state.grid);
      dispatch({ type: 'LOAD_GRID', grid: fixed, width: state.width, height: state.height });
    }
  }, [state.grid, state.width, state.height, dispatch]);

  const handleExportList = useCallback(() => {
    const counts = new Map<string, number>();
    let totalDots = 0;
    for (let r = 0; r < state.height; r++) {
      for (let c = 0; c < state.width; c++) {
        const color = state.grid[r][c];
        if (color) {
          counts.set(color, (counts.get(color) ?? 0) + 1);
          totalDots++;
        }
      }
    }

    const [bpW, bpH] = config.basePlates.size;
    const basesNeeded = Math.ceil(
      (state.width * state.height) / (bpW * bpH),
    );

    const colorLookup = new Map(LEGO_COLORS.map((c) => [c.hex, c.name]));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    let md = `# Dotmaps Parts List\n\n`;
    md += `**Grid size:** ${state.width} × ${state.height}  \n`;
    md += `**Base plates (${bpW}×${bpH}):** ${basesNeeded}  \n`;
    md += `**Total dots:** ${totalDots}\n\n`;
    md += `## Pieces by Color\n\n`;
    md += `| Color | Hex | Count |\n`;
    md += `|-------|-----|-------|\n`;
    for (const [hex, count] of sorted) {
      const name = colorLookup.get(hex) ?? 'Custom';
      md += `| ${name} | \`${hex}\` | ${count} |\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.download = 'dotmap-parts.md';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [state.grid, state.width, state.height]);

  // Compute color overages against config quantities
  const colorOverages = useMemo(() => {
    const counts = new Map<string, number>();
    for (let r = 0; r < state.height; r++) {
      for (let c = 0; c < state.width; c++) {
        const color = state.grid[r][c];
        if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
      }
    }
    const overages: { name: string; hex: string; used: number; available: number }[] = [];
    for (const cc of config.colors) {
      const used = counts.get(cc.hex) ?? 0;
      if (used > cc.quantity) {
        overages.push({ name: cc.name, hex: cc.hex, used, available: cc.quantity });
      }
    }
    return overages;
  }, [state.grid, state.width, state.height]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🟡 Dotmaps</h1>
        <span className="subtitle">LEGO Dots Editor</span>
      </header>
      <TabBar
        tabs={tabsState.tabs}
        activeTabId={tabsState.activeTabId}
        onSelectTab={handleSelectTab}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onRenameTab={handleRenameTab}
      />
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
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onImageUpload={handleImageUpload}
            onExportList={handleExportList}
            hasImportedImage={hasImportedImage}
            resolution={resolution}
            onResolutionChange={handleResolutionChange}
            onRotate={handleRotate}
            canUndo={undoable.past.length > 0}
            canRedo={undoable.future.length > 0}
            onUndo={() => dispatch({ type: 'UNDO' })}
            onRedo={() => dispatch({ type: 'REDO' })}
            renderOptions={renderOptions}
            onRenderOptionsChange={handleRenderOptionsChange}
            showBasePlates={showBasePlates}
            onToggleBasePlates={setShowBasePlates}
          />
          <div className="toolbar-group">
            <label className="limit-toggle">
              <input
                type="checkbox"
                checked={limitPieces}
                onChange={(e) => handleToggleLimits(e.target.checked)}
              />
              Limit pieces
            </label>
          </div>
          {limitPieces && colorOverages.length > 0 && (
            <div className="color-warning">
              <strong>⚠ Dot limit exceeded:</strong>
              {colorOverages.map((o) => (
                <span key={o.hex} className="color-warning-item">
                  <span className="color-warning-swatch" style={{ backgroundColor: o.hex }} />
                  {o.name}: {o.used}/{o.available}
                </span>
              ))}
            </div>
          )}
        </aside>
        <main className="canvas-area" ref={canvasAreaRef}>
          <CanvasEditor state={state} dispatch={dispatch} zoom={zoom} onZoomChange={setZoom} showBasePlates={showBasePlates} />
        </main>
      </div>
    </div>
  );
}

export default App;
