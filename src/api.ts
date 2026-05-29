/**
 * Common API utilities (provider-independent)
 */

import fetch from 'node-fetch';

import { GeoJSONFeatureCollection } from './types';

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

let chinaGeoJSONCache: GeoJSONFeatureCollection | null = null;

export async function getChinaGeoJSON(): Promise<GeoJSONFeatureCollection> {
  if (chinaGeoJSONCache) {
    return chinaGeoJSONCache;
  }

  try {
    const url = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
    const res = await fetch(url);
    const data = await res.json() as GeoJSONFeatureCollection;
    chinaGeoJSONCache = data;
    return data;
  } catch {
    console.warn('Failed to load online map data, using simplified outline');
    const fallback: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: 'China' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [73, 53], [135, 53], [135, 18], [73, 18], [73, 53]
          ]]
        }
      }]
    };
    chinaGeoJSONCache = fallback;
    return fallback;
  }
}
