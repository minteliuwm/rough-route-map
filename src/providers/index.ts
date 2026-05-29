/**
 * Map provider factory
 */

import { MapProvider, Location, Point } from '../types';
import { createProvider as createTencentProvider } from './tencent';
import { createProvider as createAmapProvider } from './amap';

const providers: Record<string, (apiKey: string) => MapProvider> = {
  tencent: createTencentProvider,
  amap: createAmapProvider
};

/** Simple in-memory cache to avoid repeated geocoding / route API calls */
function wrapWithCache(provider: MapProvider): MapProvider {
  const geoCache = new Map<string, Location>();
  const reverseCache = new Map<string, string>();
  const routeCache = new Map<string, Point[]>();

  return {
    async geocode(cityName: string): Promise<Location> {
      const cached = geoCache.get(cityName);
      if (cached) return cached;
      const result = await provider.geocode(cityName);
      geoCache.set(cityName, result);
      return result;
    },

    async reverseGeocode(lat: number, lng: number): Promise<string> {
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = reverseCache.get(key);
      if (cached) return cached;
      const result = await provider.reverseGeocode(lat, lng);
      reverseCache.set(key, result);
      return result;
    },

    async getRoute(from: Point, to: Point, waypoints: Point[] = []): Promise<Point[]> {
      const wpKey = waypoints.map(w => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join(';');
      const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}[${wpKey}]`;
      const cached = routeCache.get(key);
      if (cached) return cached;
      const result = await provider.getRoute(from, to, waypoints);
      routeCache.set(key, result);
      return result;
    }
  };
}

/**
 * Create a map provider instance
 */
export function createProvider(name: string, apiKey: string): MapProvider {
  const factory = providers[name];
  if (!factory) {
    const supported = Object.keys(providers).join(', ');
    throw new Error(`Unsupported map provider: "${name}". Supported: ${supported}`);
  }
  return wrapWithCache(factory(apiKey));
}
