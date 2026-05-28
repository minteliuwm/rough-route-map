/**
 * Geographic utilities - coordinate projection and bounds calculation
 */

import { Point, Bounds, CanvasPoint } from './types';

export function mercator(lng: number, lat: number, bounds: Bounds, width: number, height: number): CanvasPoint {
  const { minLng, maxLng, minLat, maxLat } = bounds;
  const x = (lng - minLng) / (maxLng - minLng) * width;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * height;
  return { x, y };
}

export function calculateBounds(points: Point[]): Bounds {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  points.forEach(p => {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  });

  const margin = 0.15;
  const lngRange = maxLng - minLng;
  const latRange = maxLat - minLat;

  return {
    minLng: minLng - lngRange * margin,
    maxLng: maxLng + lngRange * margin,
    minLat: minLat - latRange * margin,
    maxLat: maxLat + latRange * margin
  };
}

export function findClosestPointIndex(points: Point[], target: Point): number {
  let minDist = Infinity;
  let index = 0;
  points.forEach((p, i) => {
    const dist = Math.pow(p.lng - target.lng, 2) + Math.pow(p.lat - target.lat, 2);
    if (dist < minDist) {
      minDist = dist;
      index = i;
    }
  });
  return index;
}
