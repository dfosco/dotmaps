# Fix: Water Banding & Land Diagonal Hatching

## Problems

### 1. Water: dark-light-dark-light banding
The water gradient uses `Math.floor(t * 4)` which creates hard concentric band boundaries. When `fixGridLimits` reassigns excess turquoise/light blue, interleaving within these hard bands creates visible dark-light-dark-light alternation instead of smooth black → dark blue → turquoise → light blue.

### 2. Land: diagonal stripe artifacts
The `fixGridLimits` land priority uses a linear golden-ratio hash:
```
priority = (pos.row * PHI + pos.col * PHI * PHI) % 1
```
This is a linear function of row/col, producing perfectly diagonal lines of equal priority. Sorting and keeping the top N creates visible diagonal stripes.

## Fixes (all in `src/imageToGrid.ts`)

### Fix 1: Dithered water gradient
Replace `Math.floor(t * 4)` with positional noise dithering:
- `tScaled = t * 3` (maps 0–1 → 0–3 for 4 gradient stops)
- `lower = floor(tScaled)`, `upper = min(3, lower+1)`, `frac = tScaled - lower`
- Deterministic 2D hash of (x,y) to pick: `hash < frac ? upper : lower`
- Result: smooth organic transitions instead of hard rings

Apply in both `imageToGrid()` and `fixGridLimits()`.

### Fix 2: Non-linear 2D hash for land
Replace golden-ratio linear hash with integer hash (no visible spatial pattern).
Apply in `fixGridLimits()` land priority and water jitter.

## Scope
Single file: `src/imageToGrid.ts` — add `hash2d()`, update water gradient selection in both functions, replace land priority hash.
