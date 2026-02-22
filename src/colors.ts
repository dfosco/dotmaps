import { config } from './config';

// Colors sourced from dotmaps.config.json
export const LEGO_COLORS: { name: string; hex: string }[] = config.colors.map((c) => ({
  name: c.name,
  hex: c.hex,
}));

