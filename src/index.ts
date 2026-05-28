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
  drawBorder,
  drawPolygon,
  drawRoute,
  drawDashedRoute,
  drawRouteDecorations,
  drawAmbientDecorations,
  drawCityMarker,
  drawTitle,
  drawLegend,
  COLOR
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
    let name = loc.name || '';
    // Reverse geocode to get city name if not provided
    if (!name) {
      try {
        name = await provider.reverseGeocode(loc.lat!, loc.lng!);
      } catch {
        console.warn(`Reverse geocoding failed for [${loc.lat},${loc.lng}], name will be empty`);
      }
    }
    return { name, lat: loc.lat!, lng: loc.lng! };
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
  if (!config.route.start) {
    throw new Error('Missing route.start');
  }

  const provider = createProvider(config.mapProvider, config.apiKey);

  const canvas = new Canvas(config.width, config.height);
  const ctx = canvas.getContext('2d');
  const rc = rough.canvas(canvas);

  // Paper texture background
  if (config.style.paperTexture) {
    drawPaperTexture(ctx, config.width, config.height);
  } else {
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, config.width, config.height);
  }

  // Torn-paper decorative border
  drawBorder(rc, ctx, config.width, config.height);

  // Ambient decorations (sun, clouds, heart in empty areas)
  drawAmbientDecorations(rc, ctx, config.width, config.height);

  // Resolve start city (required - throw on failure)
  const startCity = await resolveLocation(config.route.start, provider);
  if (!startCity) {
    throw new Error('Failed to resolve start location. Provide name or lat/lng.');
  }
  await sleep(200);

  // Resolve end city (optional)
  let endCity: Location | null = null;
  if (config.route.end) {
    endCity = await resolveLocation(config.route.end, provider);
    if (!endCity) {
      throw new Error('Failed to resolve end location. Provide name or lat/lng.');
    }
    await sleep(200);
  }

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
  const routeEnd = endCity || waypointCities[waypointCities.length - 1] || currentCity;
  const routePoints = await provider.getRoute(startCity, routeEnd, waypointCities.filter(c => c !== routeEnd));

  // Calculate bounds and projection
  const allPoints = [...routePoints, startCity, ...waypointCities, currentCity, ...(endCity ? [endCity] : [])];
  const bounds = calculateBounds(allPoints, currentCity);
  const padding = {
    top: config.showTitle ? 70 : 15,
    bottom: config.showLegend ? 110 : 15,
    left: 15,
    right: 15
  };
  const project = (lng: number, lat: number) => mercator(lng, lat, bounds, config.width, config.height, padding);

  // Draw China outline (subtle, light strokes)
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

  // Draw route (traveled / remaining) with healing-style colors
  const currentIndex = findClosestPointIndex(routePoints, currentCity);

  const traveled = routePoints.slice(0, currentIndex + 1);
  if (traveled.length > 1) {
    drawRoute(rc, traveled, project, {
      stroke: COLOR.traveled,
      strokeWidth: 4,
      roughness: config.style.roughness,
      bowing: config.style.bowing
    });
  }

  const remaining = routePoints.slice(currentIndex);
  if (remaining.length > 1) {
    drawDashedRoute(rc, remaining, project, {
      stroke: COLOR.remaining,
      strokeWidth: 3,
      roughness: config.style.roughness * 1.2,
      bowing: config.style.bowing
    });
  }

  // Route decorations (clouds, stars, footprints)
  drawRouteDecorations(rc, ctx, routePoints, project);

  // Draw city markers with themed icons
  drawCityMarker(rc, ctx, startCity, project, {
    type: 'start', color: COLOR.start, label: ''
  });

  // Check if a city is the current location (by coordinate proximity)
  const isCurrentCity = (city: Location): boolean => {
    const dist = Math.pow(city.lat - currentCity.lat, 2) + Math.pow(city.lng - currentCity.lng, 2);
    return dist < 0.001; // ~0.03 degree tolerance
  };

  waypointCities.forEach(city => {
    if (isCurrentCity(city)) return; // skip, will draw as current separately
    drawCityMarker(rc, ctx, city, project, {
      type: 'waypoint', color: COLOR.waypoint, label: ''
    });
  });

  if (endCity) {
    drawCityMarker(rc, ctx, endCity, project, {
      type: 'end', color: COLOR.end, label: ''
    });
  }

  // Always draw current city marker on top (car icon)
  if (!isCurrentCity(startCity) && !(endCity && isCurrentCity(endCity))) {
    drawCityMarker(rc, ctx, currentCity, project, {
      type: 'current', color: COLOR.current, label: ''
    });
  }

  // Title in hand-drawn banner
  if (config.showTitle) {
    const cityNames = [
      startCity.name || 'Start',
      ...waypointCities.map(c => c.name || '...'),
      ...(endCity ? [endCity.name || 'End'] : [])
    ];
    const title = cityNames.join(' > ');
    drawTitle(rc, ctx, title, config.width);
  }

  // Legend card
  if (config.showLegend) {
    drawLegend(rc, ctx, config.width - 185, config.height - 95, config.legendLabels);
  }

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
