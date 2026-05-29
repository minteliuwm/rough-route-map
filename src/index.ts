/**
 * rough-route-map
 * Hand-drawn style route map generator
 */

const rough = require('roughjs');
import * as fs from 'fs';
import { performance } from 'perf_hooks';

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

  const t0 = performance.now();
  const label = loc.name || (hasCoordinates(loc) ? `[${loc.lat},${loc.lng}]` : 'unknown');

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
    console.log(`    ↳ Resolve "${label}": ${Math.round(performance.now() - t0)}ms`);
    return { name, lat: loc.lat!, lng: loc.lng! };
  }

  if (loc.name) {
    const result = await provider.geocode(loc.name);
    console.log(`    ↳ Resolve "${label}": ${Math.round(performance.now() - t0)}ms`);
    return result;
  }

  return null;
}

/**
 * Check if two location inputs refer to the same place.
 * Matches by name or by coordinate proximity.
 */
function isSameLocationInput(
  a: LocationInput | null | undefined,
  b: LocationInput | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a.name && b.name) return a.name === b.name;
  if (typeof a.lat === 'number' && typeof a.lng === 'number' &&
      typeof b.lat === 'number' && typeof b.lng === 'number') {
    return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
  }
  return false;
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

/** Simple performance timer for analyzing map generation steps */
class PerfTimer {
  private startTime: number;
  private marks: Array<{ label: string; duration: number }> = [];
  private currentLabel: string | null = null;
  private currentStart = 0;

  constructor() {
    this.startTime = performance.now();
  }

  start(label: string): void {
    this.currentLabel = label;
    this.currentStart = performance.now();
  }

  end(): void {
    if (this.currentLabel !== null) {
      const duration = Math.round(performance.now() - this.currentStart);
      this.marks.push({ label: this.currentLabel, duration });
      console.log(`  ⏱ ${this.currentLabel}: ${duration}ms`);
      this.currentLabel = null;
    }
  }

  step(label: string): void {
    this.end();
    this.start(label);
  }

  summary(): void {
    const total = Math.round(performance.now() - this.startTime);
    console.log('\n📊 Performance Summary');
    console.log('─'.repeat(56));
    console.log(`  Total Time: ${total}ms`);
    for (const m of this.marks) {
      const pct = total > 0 ? ((m.duration / total) * 100).toFixed(1) : '0.0';
      const barLen = Math.min(20, Math.round(Number(pct) / 2));
      const bar = barLen > 0 ? '█'.repeat(barLen) : '░';
      console.log(`  ${m.label.padEnd(22)} ${m.duration.toString().padStart(5)}ms  ${pct.padStart(5)}%  ${bar}`);
    }
    console.log('─'.repeat(56));

    const tips: string[] = [];
    const resolve = this.marks.find(m => m.label === 'Resolve locations');
    const buffer = this.marks.find(m => m.label === 'Generate image buffer');
    const outline = this.marks.find(m => m.label === 'Draw China outline');

    if (resolve && resolve.duration > 500) {
      tips.push('地理编码耗时较长，建议传入 lat/lng 减少 geocoding，或提高 concurrency');
    }
    if (buffer && buffer.duration > 500) {
      tips.push('图像编码耗时较长，建议降低 dpi（如 1）来减少 canvas 像素量');
    }
    if (outline && outline.duration > 100) {
      tips.push('中国轮廓绘制耗时较长，如不需要可设置 showChinaOutline: false 跳过');
    }

    if (tips.length > 0) {
      console.log('\n💡 Optimization Tips');
      tips.forEach(t => console.log(`   • ${t}`));
    }
  }
}

/**
 * Generate a hand-drawn style route map
 */
export async function generateMap(userConfig: UserConfig): Promise<Buffer> {
  const perf = new PerfTimer();
  perf.start('Initialize & setup');

  const config = mergeConfig(userConfig);

  if (!config.apiKey) {
    throw new Error('Missing apiKey. Please provide a map API key.');
  }
  if (!config.route.start) {
    throw new Error('Missing route.start');
  }

  const provider = createProvider(config.mapProvider, config.apiKey);

  const dpi = config.dpi;
  const canvasWrapper = createCanvas(config.width * dpi, config.height * dpi, config.canvasProvider);
  const ctx = canvasWrapper.ctx;
  ctx.scale(dpi, dpi);
  const rc = rough.canvas(canvasWrapper.raw);

  perf.step('Draw background & decorations');

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

  perf.step('Resolve locations');

  // Resolve start, end, and waypoints first (these are the critical path)
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
    )
  ];

  const locationResults = await rateLimited(locationTasks, config.concurrency);

  const startCity = locationResults[0]!;
  const endCity = locationResults[1];
  const waypointCities: Location[] = locationResults.slice(2).filter((c): c is Location => c !== null);

  // Resolve currentCity with deduplication: reuse result if it matches start/end/waypoint
  let currentCity: Location;
  if (!config.currentCity) {
    currentCity = startCity;
  } else if (isSameLocationInput(config.currentCity, config.route.start)) {
    currentCity = startCity;
    console.log(`    ↳ Reuse start location as currentCity`);
  } else if (config.route.end && isSameLocationInput(config.currentCity, config.route.end)) {
    currentCity = endCity || startCity;
    console.log(`    ↳ Reuse end location as currentCity`);
  } else {
    const wpIndex = config.route.waypoints.findIndex(w => isSameLocationInput(config.currentCity, w));
    if (wpIndex >= 0 && locationResults[2 + wpIndex]) {
      currentCity = locationResults[2 + wpIndex] as Location;
      console.log(`    ↳ Reuse waypoint[${wpIndex}] as currentCity`);
    } else {
      const result = await resolveLocation(config.currentCity, provider);
      if (!result) throw new Error('Failed to resolve currentCity. Provide name or lat/lng.');
      currentCity = result;
    }
  }

  perf.step('Fetch route');

  const routeEnd = endCity || waypointCities[waypointCities.length - 1] || currentCity;
  const routePoints = await provider.getRoute(startCity, routeEnd, waypointCities.filter(c => c !== routeEnd));

  perf.step('Calculate bounds & projection');

  const allPoints = [...routePoints, startCity, ...waypointCities, currentCity, ...(endCity ? [endCity] : [])];
  const bounds = calculateBounds(allPoints, currentCity);
  const padding = {
    top: config.showTitle ? 70 : 15,
    bottom: config.showLegend ? 110 : 15,
    left: 15,
    right: 15
  };
  const project = (lng: number, lat: number) => mercator(lng, lat, bounds, config.width, config.height, padding);

  if (config.showChinaOutline) {
    perf.step('Draw China outline');

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
  }

  perf.step('Draw route & decorations');

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
      strokeWidth: 3.5,
      roughness: config.style.roughness * 1.2,
      bowing: config.style.bowing
    });
  }

  // Route decorations (clouds, stars, footprints)
  drawRouteDecorations(rc, ctx, routePoints, project);

  perf.step('Draw city markers');

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

  perf.step('Draw title & legend');

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

  perf.step('Generate image buffer');

  // Generate buffer
  const buffer = await canvasWrapper.toBuffer();

  perf.step('Save file');

  // Save to file if output path is specified
  if (config.output) {
    fs.writeFileSync(config.output, buffer);
    console.log(`Saved: ${config.output}`);
  }

  perf.end();
  perf.summary();

  return buffer;
}

// Re-export sub-modules for advanced usage
export * as geo from './geo';
export * as api from './api';
export * as drawing from './drawing';
export * as config from './config';
export * as providers from './providers';
export * from './types';
