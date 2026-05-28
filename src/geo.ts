/**
 * Geographic utilities - coordinate projection and bounds calculation
 */

import { Point, Bounds, CanvasPoint } from './types';

export function mercator(
  lng: number, lat: number, bounds: Bounds,
  width: number, height: number,
  padding: { top?: number; bottom?: number; left?: number; right?: number } = {}
): CanvasPoint {
  const { minLng, maxLng, minLat, maxLat } = bounds;
  const pt = padding.top || 0;
  const pb = padding.bottom || 0;
  const pl = padding.left || 0;
  const pr = padding.right || 0;
  const drawW = width - pl - pr;
  const drawH = height - pt - pb;
  const x = pl + (lng - minLng) / (maxLng - minLng) * drawW;
  const y = pt + (1 - (lat - minLat) / (maxLat - minLat)) * drawH;
  return { x, y };
}

export function calculateBounds(points: Point[], center?: Point | null): Bounds {
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

  const bounds: Bounds = {
    minLng: minLng - lngRange * margin,
    maxLng: maxLng + lngRange * margin,
    minLat: minLat - latRange * margin,
    maxLat: maxLat + latRange * margin
  };

  // Shift bounds so that the center point is closer to the middle of the viewport
  if (center) {
    const bW = bounds.maxLng - bounds.minLng;
    const bH = bounds.maxLat - bounds.minLat;
    const midLng = (bounds.minLng + bounds.maxLng) / 2;
    const midLat = (bounds.minLat + bounds.maxLat) / 2;

    // How far the center point is from the bounds center
    const offsetLng = center.lng - midLng;
    const offsetLat = center.lat - midLat;

    // Shift up to 30% of bounds range toward center point
    const maxShiftRatio = 0.3;
    const shiftLng = Math.max(-bW * maxShiftRatio, Math.min(bW * maxShiftRatio, offsetLng));
    const shiftLat = Math.max(-bH * maxShiftRatio, Math.min(bH * maxShiftRatio, offsetLat));

    bounds.minLng += shiftLng;
    bounds.maxLng += shiftLng;
    bounds.minLat += shiftLat;
    bounds.maxLat += shiftLat;

    // Expand bounds to ensure all original points are still visible (with margin)
    points.forEach(p => {
      if (p.lng < bounds.minLng + lngRange * margin * 0.5) {
        bounds.minLng = p.lng - lngRange * margin;
      }
      if (p.lng > bounds.maxLng - lngRange * margin * 0.5) {
        bounds.maxLng = p.lng + lngRange * margin;
      }
      if (p.lat < bounds.minLat + latRange * margin * 0.5) {
        bounds.minLat = p.lat - latRange * margin;
      }
      if (p.lat > bounds.maxLat - latRange * margin * 0.5) {
        bounds.maxLat = p.lat + latRange * margin;
      }
    });
  }

  return bounds;
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
