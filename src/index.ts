/**
 * rough-route-map
 * Hand-drawn style route map generator
 */

const rough = require('roughjs');
import * as fs from 'fs';

import { mergeConfig } from './config';
import { createCanvas } from './canvas-factory';
import { mercator, calculateBounds, findClosestPointIndex } from './geo';
import { getChinaGeoJSON } from './api';
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
  COLOR as CANVAS_COLOR
} from './drawing';
import {
  drawPaperTextureSVG,
  drawBorderSVG,
  drawPolygonSVG,
  drawRouteSVG,
  drawDashedRouteSVG,
  drawRouteDecorationsSVG,
  drawAmbientDecorationsSVG,
  drawCityMarkerSVG,
  drawTitleSVG,
  drawLegendSVG,
  COLOR as SVG_COLOR
} from './drawing-svg';
import { createSVG } from './svg-renderer';
import { UserConfig, Location, LocationInput, MapProvider, Config, Point } from './types';

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
 * Execute async tasks with rate limiting (max N per second).
 */
async function rateLimited<T>(tasks: (() => Promise<T>)[], perSecond: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += perSecond) {
    const batch = tasks.slice(i, i + perSecond);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
    // Wait for the rest of the 1-second window if more batches remain
    if (i + perSecond < tasks.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return results;
}

// ─── Shared data preparation ────────────────────────────────────────

interface MapData {
  startCity: Location;
  endCity: Location | null;
  waypointCities: Location[];
  currentCity: Location;
  routePoints: Point[];
  project: (lng: number, lat: number) => { x: number; y: number };
}

async function prepareMapData(config: Config): Promise<MapData> {
  const provider = createProvider(config.mapProvider, config.apiKey);

  // Resolve all locations with rate limiting
  const locationTasks: (() => Promise<Location | null>)[] = [
    () => resolveLocation(config.route.start, provider).then(r => {
      if (!r) throw new Error('Failed to resolve start location. Provide name or lat/lng.');
      return r;
    }),
    () => config.route.end
      ? resolveLocation(config.route.end, provider).then(r => {
          if (!r) throw new Error('Failed to resolve end location. Provide name or lat/lng.');
          return r;
        })
      : Promise.resolve(null),
    ...config.route.waypoints.map(w => () =>
      resolveLocation(w, provider).catch((e: unknown) => {
        console.warn(`Skipping waypoint: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      })
    ),
    () => config.currentCity
      ? resolveLocation(config.currentCity, provider).then(r => {
          if (!r) throw new Error('Failed to resolve currentCity. Provide name or lat/lng.');
          return r;
        })
      : Promise.resolve(null)
  ];

  const locationResults = await rateLimited(locationTasks, config.concurrency);

  const startCity = locationResults[0]!;
  const endCity = locationResults[1];
  const waypointCities: Location[] = locationResults.slice(2, -1).filter((c): c is Location => c !== null);
  const currentCity: Location = locationResults[locationResults.length - 1] || startCity;

  // Fetch route
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

  return { startCity, endCity, waypointCities, currentCity, routePoints, project };
}

// ─── Canvas renderer ────────────────────────────────────────────────

async function renderCanvas(config: Config, data: MapData): Promise<Buffer> {
  const { startCity, endCity, waypointCities, currentCity, routePoints, project } = data;

  const dpi = config.dpi;
  const canvasWrapper = createCanvas(config.width * dpi, config.height * dpi, config.canvasProvider);
  const ctx = canvasWrapper.ctx;
  ctx.scale(dpi, dpi);
  const rc = rough.canvas(canvasWrapper.raw);

  // Paper texture background
  if (config.style.paperTexture) {
    drawPaperTexture(ctx, config.width, config.height);
  } else {
    ctx.fillStyle = CANVAS_COLOR.bg;
    ctx.fillRect(0, 0, config.width, config.height);
  }

  // Torn-paper decorative border
  drawBorder(rc, ctx, config.width, config.height);

  // Ambient decorations (sun, clouds, heart in empty areas)
  drawAmbientDecorations(rc, ctx, config.width, config.height);

  // Draw China outline (subtle, light strokes)
  try {
    const chinaGeoJSON = await getChinaGeoJSON();
    chinaGeoJSON.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      const type = feature.geometry.type;

      if (type === 'Polygon') {
        drawPolygon(rc, coords[0] as number[][], project, feature.properties.name === 'China');
      } else if (type === 'MultiPolygon') {
        (coords as number[][][][]).forEach((polygon) => drawPolygon(rc, polygon[0], project, false));
      }
    });
  } catch (e: unknown) {
    console.warn('Outline drawing failed:', e instanceof Error ? e.message : String(e));
  }

  // Draw route (traveled / remaining) with healing-style colors
  const currentIndex = findClosestPointIndex(routePoints, currentCity);

  const traveled = routePoints.slice(0, currentIndex + 1);
  if (traveled.length > 1) {
    drawRoute(rc, traveled, project, {
      stroke: CANVAS_COLOR.traveled,
      strokeWidth: 4,
      roughness: config.style.roughness,
      bowing: config.style.bowing
    });
  }

  const remaining = routePoints.slice(currentIndex);
  if (remaining.length > 1) {
    drawDashedRoute(rc, remaining, project, {
      stroke: CANVAS_COLOR.remaining,
      strokeWidth: 3.5,
      roughness: config.style.roughness * 1.2,
      bowing: config.style.bowing
    });
  }

  // Route decorations (clouds, stars, footprints)
  drawRouteDecorations(rc, ctx, routePoints, project);

  // Draw city markers with themed icons
  drawCityMarker(rc, ctx, startCity, project, {
    type: 'start', color: CANVAS_COLOR.start, label: ''
  });

  const isCurrentCity = (city: Location): boolean => {
    const dist = Math.pow(city.lat - currentCity.lat, 2) + Math.pow(city.lng - currentCity.lng, 2);
    return dist < 0.001;
  };

  waypointCities.forEach(city => {
    if (isCurrentCity(city)) return;
    drawCityMarker(rc, ctx, city, project, {
      type: 'waypoint', color: CANVAS_COLOR.waypoint, label: ''
    });
  });

  if (endCity) {
    drawCityMarker(rc, ctx, endCity, project, {
      type: 'end', color: CANVAS_COLOR.end, label: ''
    });
  }

  if (!isCurrentCity(startCity) && !(endCity && isCurrentCity(endCity))) {
    drawCityMarker(rc, ctx, currentCity, project, {
      type: 'current', color: CANVAS_COLOR.current, label: ''
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

  const buffer = await canvasWrapper.toBuffer();

  if (config.output) {
    const outputPath = config.output.replace(/\.svg$/, '.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved: ${outputPath}`);
  }

  return buffer;
}

// ─── SVG renderer ───────────────────────────────────────────────────

async function renderSVG(config: Config, data: MapData): Promise<Buffer> {
  const { startCity, endCity, waypointCities, currentCity, routePoints, project } = data;

  const svgWrapper = createSVG(config.width, config.height);
  const svg = svgWrapper.svg;
  const defs = svgWrapper.defs;
  const rc = svgWrapper.rc;

  // Paper texture background
  if (config.style.paperTexture) {
    drawPaperTextureSVG(svg, defs, config.width, config.height);
  } else {
    const bg = svg.ownerDocument!.createElementNS('http://www.w3.org/2000/svg', 'rect') as unknown as SVGElement;
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', SVG_COLOR.bg);
    svg.appendChild(bg as unknown as Node);
  }

  // Torn-paper decorative border
  drawBorderSVG(rc, svg, config.width, config.height);

  // Ambient decorations
  drawAmbientDecorationsSVG(rc, svg, config.width, config.height);

  // Draw China outline
  try {
    const chinaGeoJSON = await getChinaGeoJSON();
    chinaGeoJSON.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      const type = feature.geometry.type;

      if (type === 'Polygon') {
        drawPolygonSVG(rc, svg, coords[0] as number[][], project, feature.properties.name === 'China');
      } else if (type === 'MultiPolygon') {
        (coords as number[][][][]).forEach((polygon) => drawPolygonSVG(rc, svg, polygon[0], project, false));
      }
    });
  } catch (e: unknown) {
    console.warn('Outline drawing failed:', e instanceof Error ? e.message : String(e));
  }

  // Draw route
  const currentIndex = findClosestPointIndex(routePoints, currentCity);

  const traveled = routePoints.slice(0, currentIndex + 1);
  if (traveled.length > 1) {
    drawRouteSVG(rc, svg, traveled, project, {
      stroke: SVG_COLOR.traveled,
      strokeWidth: 4,
      roughness: config.style.roughness,
      bowing: config.style.bowing
    });
  }

  const remaining = routePoints.slice(currentIndex);
  if (remaining.length > 1) {
    drawDashedRouteSVG(rc, svg, remaining, project, {
      stroke: SVG_COLOR.remaining,
      strokeWidth: 3.5,
      roughness: config.style.roughness * 1.2,
      bowing: config.style.bowing
    });
  }

  // Route decorations
  drawRouteDecorationsSVG(rc, svg, routePoints, project);

  // City markers
  drawCityMarkerSVG(rc, svg, startCity, project, {
    type: 'start', color: SVG_COLOR.start, label: ''
  });

  const isCurrentCity = (city: Location): boolean => {
    const dist = Math.pow(city.lat - currentCity.lat, 2) + Math.pow(city.lng - currentCity.lng, 2);
    return dist < 0.001;
  };

  waypointCities.forEach(city => {
    if (isCurrentCity(city)) return;
    drawCityMarkerSVG(rc, svg, city, project, {
      type: 'waypoint', color: SVG_COLOR.waypoint, label: ''
    });
  });

  if (endCity) {
    drawCityMarkerSVG(rc, svg, endCity, project, {
      type: 'end', color: SVG_COLOR.end, label: ''
    });
  }

  if (!isCurrentCity(startCity) && !(endCity && isCurrentCity(endCity))) {
    drawCityMarkerSVG(rc, svg, currentCity, project, {
      type: 'current', color: SVG_COLOR.current, label: ''
    });
  }

  // Title
  if (config.showTitle) {
    const cityNames = [
      startCity.name || 'Start',
      ...waypointCities.map(c => c.name || '...'),
      ...(endCity ? [endCity.name || 'End'] : [])
    ];
    const title = cityNames.join(' > ');
    drawTitleSVG(rc, svg, title, config.width);
  }

  // Legend
  if (config.showLegend) {
    drawLegendSVG(rc, svg, config.width - 185, config.height - 95, config.legendLabels);
  }

  const buffer = svgWrapper.toBuffer();

  if (config.output) {
    const outputPath = config.output.replace(/\.png$/, '.svg');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved: ${outputPath}`);
  }

  return buffer;
}

// ─── Public API ─────────────────────────────────────────────────────

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

  // Check optional dependencies before starting
  if (config.format === 'svg') {
    try {
      require('@xmldom/xmldom');
    } catch {
      throw new Error(
        'For SVG output, "@xmldom/xmldom" is required. ' +
        'Install it with: npm install @xmldom/xmldom  (or yarn add @xmldom/xmldom)'
      );
    }
  } else {
    // Check for canvas dependencies
    let hasCanvas = false;
    try {
      require('skia-canvas');
      hasCanvas = true;
    } catch {
      try {
        require('canvas');
        hasCanvas = true;
      } catch {
        // no canvas available
      }
    }
    if (!hasCanvas) {
      throw new Error(
        'For PNG output, either "skia-canvas" or "canvas" is required. ' +
        'Install one with:\n' +
        '  npm install skia-canvas  (or yarn add skia-canvas)\n' +
        '  or\n' +
        '  npm install canvas  (or yarn add canvas)'
      );
    }
  }

  const data = await prepareMapData(config);

  if (config.format === 'svg') {
    return renderSVG(config, data);
  }
  return renderCanvas(config, data);
}

// Re-export sub-modules for advanced usage
export * as geo from './geo';
export * as api from './api';
export * as drawing from './drawing';
export * as drawingSvg from './drawing-svg';
export * as config from './config';
export * as providers from './providers';
export * from './types';
