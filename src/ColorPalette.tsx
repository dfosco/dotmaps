import { LEGO_COLORS } from './colors';
import type { EditorAction } from './types';

interface ColorPaletteProps {
  activeColor: string;
  dispatch: React.Dispatch<EditorAction>;
}

export default function ColorPalette({ activeColor, dispatch }: ColorPaletteProps) {
  return (
    <div className="color-palette">
      <h3>Colors</h3>
      {!activeColor && <div className="color-placeholder">Select color</div>}
      <div className="color-grid">
        {LEGO_COLORS.map((c) => (
          <button
            key={c.hex}
            className={`color-swatch ${activeColor === c.hex ? 'active' : ''}`}
            style={{ backgroundColor: c.hex }}
            title={c.name}
            onClick={() => dispatch({ type: 'SET_COLOR', color: c.hex })}
          />
        ))}
      </div>
    </div>
  );
}
