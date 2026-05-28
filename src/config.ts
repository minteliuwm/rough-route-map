/**
 * Default configuration
 */

import { Config, UserConfig, RouteConfig, StyleConfig } from './types';

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
  output: './route-map.png'
};

export function mergeConfig(userConfig: UserConfig): Config {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    route: { ...DEFAULT_CONFIG.route, ...(userConfig.route || {}) } as RouteConfig,
    style: { ...DEFAULT_CONFIG.style, ...(userConfig.style || {}) } as StyleConfig
  };
}

export { DEFAULT_CONFIG };
