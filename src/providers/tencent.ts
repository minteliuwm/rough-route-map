/**
 * Tencent Map provider
 */

import fetch from 'node-fetch';
import { MapProvider, Location, Point, TencentGeocodeResponse, TencentRegeoResponse, TencentRouteResponse } from '../types';

/**
 * Decode Tencent Map polyline (character-encoded format)
 */
export function decodeTencentPolyline(polylineStr: string): Point[] {
  const points: Point[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < polylineStr.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = polylineStr.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = polylineStr.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      lat: lat / 1e6,
      lng: lng / 1e6
    });
  }

  return points;
}

export function createProvider(apiKey: string): MapProvider {
  return {
    async geocode(cityName: string): Promise<Location> {
      const url = `https://apis.map.qq.com/ws/geocoder/v1/?address=${encodeURIComponent(cityName)}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json() as TencentGeocodeResponse;

      if (data.status !== 0) {
        throw new Error(`Geocoding failed [${cityName}]: ${data.message}`);
      }

      return {
        name: cityName,
        lng: data.result!.location.lng,
        lat: data.result!.location.lat
      };
    },

    async reverseGeocode(lat: number, lng: number): Promise<string> {
      const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json() as TencentRegeoResponse;

      if (data.status !== 0) {
        throw new Error(`Reverse geocoding failed [${lat},${lng}]: ${data.message}`);
      }

      const addr = data.result!.address_component;
      return addr.city || addr.district || addr.province || data.result!.address || '';
    },

    async getRoute(from: Point, to: Point, waypoints: Point[] = []): Promise<Point[]> {
      const fromStr = `${from.lat},${from.lng}`;
      const toStr = `${to.lat},${to.lng}`;
      const waypointsStr = waypoints.length > 0
        ? waypoints.map(w => `${w.lat},${w.lng}`).join(';')
        : '';

      let url = `https://apis.map.qq.com/ws/direction/v1/driving/?from=${fromStr}&to=${toStr}&key=${apiKey}`;
      if (waypointsStr) url += `&waypoints=${waypointsStr}`;

      const res = await fetch(url);
      const data = await res.json() as TencentRouteResponse;

      if (data.status !== 0) {
        throw new Error(`Route planning failed: ${data.message}`);
      }

      const route = data.result!.routes[0];
      const polyline: number[] = route.polyline;

      const points: Point[] = [];

      if (Array.isArray(polyline) && polyline.length >= 2) {
        let currentLat = polyline[0];
        let currentLng = polyline[1];

        points.push({ lat: currentLat, lng: currentLng });

        for (let i = 2; i < polyline.length; i += 2) {
          if (i + 1 < polyline.length) {
            currentLat += polyline[i] / 1e6;
            currentLng += polyline[i + 1] / 1e6;
            points.push({ lat: currentLat, lng: currentLng });
          }
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
