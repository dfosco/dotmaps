import { config } from './config';

// Colors sourced from dotmaps.config.json — excludes black (not a physical dot)
export const LEGO_COLORS: { name: string; hex: string }[] = config.colors
  .filter((c) => c.name !== 'black')
  .map((c) => ({ name: c.name, hex: c.hex }));

