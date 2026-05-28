/**
 * rough-route-map
 * Hand-drawn style route map generator
 */

const { Canvas } = require('skia-canvas');
const rough = require('roughjs');
import * as fs from 'fs';

import { mergeConfig } from './config';
import { mercator, calculateBounds, findClosestPointIndex } from './geo';
import { sleep, getChinaGeoJSON } from './api';
import { createProvider } from './providers';
import {
  drawPaperTexture,
  drawPolygon,
  drawRoute,
  drawDashedRoute,
  drawCityMarker,
  drawLegend
} from './drawing';
import { UserConfig, Location, LocationInput, MapProvider } from './types';

/**
 * Check if a location object has valid coordinates
 */
function hasCoordinates(loc: LocationInput): boolean {
  return typeof loc.lat === 'number' && typeof loc.lng === 'number';
}

/**
 * Resolve a location object to { name, lat, lng }.
 * If lat/lng are provided, use them directly.
 * If only name is provided, geocode it.
 */
async function resolveLocation(
  loc: LocationInput | null | undefined,
  provider: MapProvider
): Promise<Location | null> {
  if (!loc) return null;

  if (hasCoordinates(loc)) {
    return { name: loc.name || '', lat: loc.lat!, lng: loc.lng! };
  }

  if (loc.name) {
    return await provider.geocode(loc.name);
  }

  return null;
}

/**
 * Generate a hand-drawn style route map
 */
export async function generateMap(userConfig: UserConfig): Promise<Buffer> {
  const config = mergeConfig(userConfig);

  if (!config.apiKey) {
    throw new Error('Missing apiKey. Please provide a map API key.');
  }
  if (!config.route.start || !config.route.end) {
    throw new Error('Missing route.start or route.end');
  }

  const provider = createProvider(config.mapProvider, config.apiKey);

  const canvas = new Canvas(config.width, config.height);
  const ctx = canvas.getContext('2d');
  const rc = rough.canvas(canvas);

  // Paper texture background
  if (config.style.paperTexture) {
    drawPaperTexture(ctx, config.width, config.height);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.width, config.height);
  }

  // Resolve start city (required - throw on failure)
  const startCity = await resolveLocation(config.route.start, provider);
  if (!startCity) {
    throw new Error('Failed to resolve start location. Provide name or lat/lng.');
  }
  await sleep(200);

  // Resolve end city (required - throw on failure)
  const endCity = await resolveLocation(config.route.end, provider);
  if (!endCity) {
    throw new Error('Failed to resolve end location. Provide name or lat/lng.');
  }
  await sleep(200);

  // Resolve waypoints (skip on failure)
  const waypointCities: Location[] = [];
  for (const w of config.route.waypoints) {
    await sleep(200);
    try {
      const resolved = await resolveLocation(w, provider);
      if (resolved) {
        waypointCities.push(resolved);
      } else {
        console.warn('Skipping waypoint: no name or coordinates provided');
      }
    } catch (e: any) {
      console.warn(`Skipping waypoint: ${e.message}`);
    }
  }

  // Resolve current city (required - throw on failure)
  await sleep(200);
  let currentCity: Location;
  if (config.currentCity) {
    const resolved = await resolveLocation(config.currentCity, provider);
    if (!resolved) {
      throw new Error('Failed to resolve currentCity. Provide name or lat/lng.');
    }
    currentCity = resolved;
  } else {
    currentCity = startCity;
  }

  // Fetch route
  await sleep(300);
  const routePoints = await provider.getRoute(startCity, endCity, waypointCities);

  // Calculate bounds and projection
  const allPoints = [...routePoints, startCity, ...waypointCities, endCity, currentCity];
  const bounds = calculateBounds(allPoints);
  const project = (lng: number, lat: number) => mercator(lng, lat, bounds, config.width, config.height);

  // Draw China outline
  try {
    const chinaGeoJSON = await getChinaGeoJSON();
    chinaGeoJSON.features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates;
      const type = feature.geometry.type;

      if (type === 'Polygon') {
        drawPolygon(rc, coords[0], project, feature.properties.name === 'China');
      } else if (type === 'MultiPolygon') {
        coords.forEach((polygon: number[][][]) => drawPolygon(rc, polygon[0], project, false));
      }
    });
  } catch (e: any) {
    console.warn('Outline drawing failed:', e.message);
  }

  // Draw route (traveled / remaining)
  const currentIndex = findClosestPointIndex(routePoints, currentCity);

  const traveled = routePoints.slice(0, currentIndex + 1);
  if (traveled.length > 1) {
    drawRoute(rc, traveled, project, {
      stroke: '#E74C3C',
      strokeWidth: 4,
      roughness: config.style.roughness,
      bowing: config.style.bowing
    });
  }

  const remaining = routePoints.slice(currentIndex);
  if (remaining.length > 1) {
    drawDashedRoute(rc, remaining, project, {
      stroke: '#95A5A6',
      strokeWidth: 3,
      roughness: config.style.roughness * 1.2,
      bowing: config.style.bowing
    });
  }

  // Draw city markers
  const startLabel = startCity.name || 'Start';
  drawCityMarker(rc, ctx, startCity, project, { type: 'start', color: '#27AE60', label: startLabel });

  waypointCities.forEach(city => {
    const isCurrent = city.name === currentCity.name;
    drawCityMarker(rc, ctx, city, project, {
      type: isCurrent ? 'current' : 'waypoint',
      color: isCurrent ? '#F39C12' : '#3498DB',
      label: isCurrent ? 'Current' : ''
    });
  });

  const endLabel = endCity.name || 'End';
  drawCityMarker(rc, ctx, endCity, project, { type: 'end', color: '#E74C3C', label: endLabel });

  // Title
  ctx.font = 'bold 32px "Comic Sans MS", "PingFang SC", sans-serif';
  ctx.fillStyle = '#2C3E50';
  ctx.textAlign = 'center';
  const cityNames = [
    startCity.name || 'Start',
    ...waypointCities.map(c => c.name || '...'),
    endCity.name || 'End'
  ];
  const title = cityNames.join(' > ');
  ctx.fillText(title, config.width / 2, 50);

  // Legend
  drawLegend(ctx, config.width - 200, config.height - 100);

  // Generate buffer
  const buffer = await canvas.toBuffer('png');

  // Save to file if output path is specified
  if (config.output) {
    fs.writeFileSync(config.output, buffer);
    console.log(`Saved: ${config.output}`);
  }

  return buffer;
}

// Re-export sub-modules for advanced usage
export * as geo from './geo';
export * as api from './api';
export * as drawing from './drawing';
export * as config from './config';
export * as providers from './providers';
export * from './types';
