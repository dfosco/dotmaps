import configData from '../dotmaps.config.json';

export interface ConfigColor {
  id: number;
  name: string;
  hex: string;
  quantity: number;
}

export interface DotmapsConfig {
  basePlates: { size: [number, number]; quantity: number };
  fullPlate: { width: number; height: number };
  colors: ConfigColor[];
}

export const config = configData as DotmapsConfig;
