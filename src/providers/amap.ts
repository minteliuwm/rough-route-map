/**
 * Amap (Gaode) Map provider
 */

import fetch from 'node-fetch';
import { MapProvider, Location, Point, AmapGeocodeResponse, AmapRegeoResponse, AmapRouteResponse, AmapRouteStep } from '../types';

export function createProvider(apiKey: string): MapProvider {
  return {
    async geocode(cityName: string): Promise<Location> {
      const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(cityName)}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json() as AmapGeocodeResponse;

      if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
        throw new Error(`Geocoding failed [${cityName}]: ${data.info || 'No results'}`);
      }

      const location = data.geocodes[0].location.split(',');
      return {
        name: cityName,
        lng: parseFloat(location[0]),
        lat: parseFloat(location[1])
      };
    },

    async reverseGeocode(lat: number, lng: number): Promise<string> {
      const url = `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json() as AmapRegeoResponse;

      if (data.status !== '1' || !data.regeocode) {
        throw new Error(`Reverse geocoding failed [${lat},${lng}]: ${data.info || 'Unknown error'}`);
      }

      const addr = data.regeocode.addressComponent;
      return addr.city || addr.district || addr.province || data.regeocode.formatted_address || '';
    },

    async getRoute(from: Point, to: Point, waypoints: Point[] = []): Promise<Point[]> {
      const origin = `${from.lng},${from.lat}`;
      const destination = `${to.lng},${to.lat}`;
      const waypointsStr = waypoints.length > 0
        ? waypoints.map(w => `${w.lng},${w.lat}`).join(';')
        : '';

      let url = `https://restapi.amap.com/v3/direction/driving?origin=${origin}&destination=${destination}&key=${apiKey}`;
      if (waypointsStr) url += `&waypoints=${waypointsStr}`;

      const res = await fetch(url);
      const data = await res.json() as AmapRouteResponse;

      if (data.status !== '1' || !data.route) {
        throw new Error(`Route planning failed: ${data.info || 'Unknown error'}`);
      }

      const steps: AmapRouteStep[] = data.route.paths[0].steps;
      const points: Point[] = [];

      for (const step of steps) {
        const coords = (step.polyline as string).split(';');
        for (const coord of coords) {
          const [lng, lat] = coord.split(',').map(Number);
          points.push({ lat, lng });
        }
      }

      if (points.length === 0) {
        throw new Error('Failed to parse route data');
      }

      console.log(`Route contains ${points.length} points`);
      return points;
    }
  };
}
