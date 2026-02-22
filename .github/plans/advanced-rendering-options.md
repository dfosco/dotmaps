# Advanced Rendering Options — Accordion Panel

## Problem
The rendering algorithm has many hardcoded parameters (water gradient balance, saturation boost, coastline width, water classification threshold). Users need to fine-tune these per-image without editing code.

## Approach
Add a collapsible "Advanced Options" accordion section below the Image Resolution slider in `Toolbar.tsx`. Each option re-triggers `imageToGrid()` (like the resolution slider does). Options are passed via a new `RenderOptions` interface.

## Options

### 1. Water Depth (slider) — **user requested**
- Controls how dark/light the water gradient is overall
- Range: 0–100 (default 50). 0 = all water is light, 100 = all water is dark
- Internally shifts the `t` parameter: `t = baseTvalue + depthBias` where `depthBias = (50 - slider) / 100`
- Higher values push more cells toward black/dark blue; lower push toward light blue/turquoise

### 2. Include Black in Water (toggle) — **user requested**
- Default: ON
- When OFF, the water gradient becomes `[dark blue, dark blue, turquoise, light blue]` (black replaced by dark blue)
- Applies to both `imageToGrid` and `fixGridLimits`

### 3. Color Vibrancy (slider) — **suggested**
- Controls the saturation pre-boost factor for land color matching
- Range: 0–100 (default 60, which maps to the current 2.5× boost)
- 0 = no boost (1×, faithful to source → mostly white/sand), 100 = max boost (4×, vivid → more green/sage/orange/red)
- Maps linearly: `boostFactor = 1.0 + (slider / 100) * 3.0`

### 4. Coastline Width (slider) — **suggested**
- Controls how far light blue/turquoise extend from land into the ocean
- Range: 0–100 (default 70, matching current `0.7` landNorm weight)
- Adjusts the balance: `t = (1 - landNorm) * (slider/100) + (1 - edgeNorm) * (1 - slider/100)`
- Low values = coastline colors only at immediate shore; high = spread further out

### 5. Water Sensitivity (slider) — **suggested**
- Controls the threshold for classifying pixels as water vs land
- Range: 0–100 (default 50)
- Adjusts the lightness threshold, blue hue range, and saturation threshold in `isWaterPixel()`
- Low = fewer pixels classified as water (only clearly blue); high = more aggressive water detection

## Implementation

### Files to change

1. **`src/imageToGrid.ts`**
   - Add `export interface RenderOptions { waterDepth, includeBlackInWater, colorVibrancy, coastlineWidth, waterSensitivity }`
   - `imageToGrid()` accepts optional `RenderOptions` parameter
   - `fixGridLimits()` accepts optional `RenderOptions` (for black toggle)
   - Internal functions read from options with defaults

2. **`src/Toolbar.tsx`**
   - Add accordion `<details>/<summary>` element after the resolution slider
   - Render sliders + toggle for each option
   - New props: `renderOptions`, `onRenderOptionsChange`

3. **`src/App.tsx`**
   - Add `renderOptions` state (with defaults)
   - Pass to `imageToGrid()` and `fixGridLimits()` calls
   - Pass to Toolbar
   - Any option change re-runs `imageToGrid()` (like resolution change does)
   - Persist renderOptions in localStorage per-file (optional, nice-to-have)

4. **`src/App.css`**
   - Styles for the accordion header, open/closed state, slider labels

## UI Layout (under Image Resolution)

```
▸ Advanced Options          ← collapsed by default
──────────────────────────
▾ Advanced Options          ← expanded
  Water Depth       ████████░░  65
  ☑ Include Black in Water
  Color Vibrancy    ██████░░░░  60
  Coastline Width   ███████░░░  70
  Water Sensitivity █████░░░░░  50
```

## Notes
- Accordion uses native `<details>/<summary>` for simplicity and accessibility
- All sliders trigger re-render of the grid from the source image (not mutation of current grid)
- Options only visible when `hasImportedImage` is true (same as resolution slider)
- Default values reproduce the current hardcoded behavior exactly
