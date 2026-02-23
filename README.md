# 🟡 Dotmaps

A visual editor for building pixel-art maps using LEGO Dots on base plates.

**[Open Dotmaps →](https://dfosco.github.io/dotmaps/)**

## What it does

Import an image and Dotmaps converts it into a dot grid using a constrained palette of 11 physical colors on 16×16 base plates. The algorithm is map-aware — it detects water and land masses, applies a dithered depth gradient to oceans, and uses saturation-boosted color matching for land areas.

## Features

- **Image import** with automatic landscape/portrait detection
- **Map-aware color algorithm** — water gradient (black → dark blue → turquoise → light blue), land color matching with saturation boost, ice/snow detection
- **Dot quantity limits** — toggle to enforce available piece counts with priority-based global distribution
- **Advanced rendering options** — water depth, color vibrancy, coastline width, water sensitivity, black in water toggle
- **Base plates overlay** — visualize 16×16 plate boundaries with numbered labels
- **Tabs** with auto-save to localStorage
- **Undo/redo** with stroke batching (⌘Z / ⌘⇧Z)
- **Hand/pan tool**, pen, eraser, rectangle select
- **Zoom** — fit-to-view on load, Ctrl+scroll, persisted per tab
- **Export** — PNG, parts list (Markdown), project file (.dotmap.json)
- **Import** — images (any format) and .dotmap.json project files

## Configuration

Edit `dotmaps.config.json` to change available colors, quantities, and base plate layout:

```json
{
  "basePlates": { "size": [16, 16], "quantity": 40 },
  "fullPlate": { "width": 8, "height": 5 },
  "colors": [
    { "id": 1, "name": "white", "hex": "#EAECE7", "quantity": 3064 },
    ...
  ]
}
```

## Development

```bash
npm install
npm run dev      # dev server at localhost:5173
npm run build    # production build to dist/
```

Built with React, TypeScript, Vite, and Canvas API.
