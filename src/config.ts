/**
 * Default configuration
 */

import { Config, UserConfig, RouteConfig, StyleConfig, LegendLabels } from './types';

const DEFAULT_LEGEND_LABELS: Required<LegendLabels> = {
  traveled: 'Traveled',
  remaining: 'Remaining'
};

const DEFAULT_CONFIG: Config = {
  width: 1200,
  height: 900,

  // Map provider ('tencent' | 'amap')
  mapProvider: 'tencent',

  // Map API Key
  apiKey: '',

  // Route
  route: {
    start: null,
    end: null,
    waypoints: []
  },

  // Current city
  currentCity: null,

  // Hand-drawn style
  style: {
    roughness: 1.5,
    bowing: 1.2,
    paperTexture: true
  },

  // Output file path
  output: './route-map.png',

  // Show route title at top
  showTitle: true,

  // Show legend
  showLegend: true,

  // Legend labels
  legendLabels: { ...DEFAULT_LEGEND_LABELS },

  // API concurrency (requests per second)
  concurrency: 5,

  // DPI scale factor
  dpi: 2,

  // Canvas provider
  canvasProvider: 'skia-canvas',

  // Output format
  format: 'png'
};

export function mergeConfig(userConfig: UserConfig): Config {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    route: { ...DEFAULT_CONFIG.route, ...(userConfig.route || {}) } as RouteConfig,
    style: { ...DEFAULT_CONFIG.style, ...(userConfig.style || {}) } as StyleConfig,
    legendLabels: { ...DEFAULT_LEGEND_LABELS, ...(userConfig.legendLabels || {}) }
  };
}

export { DEFAULT_CONFIG };
