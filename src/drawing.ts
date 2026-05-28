/**
 * Drawing engine - hand-drawn style rendering
 */

import { Point, Location, CanvasPoint, CityMarkerOptions, RouteStyle } from './types';

// roughjs and skia-canvas don't have great TS types, use any for canvas/rc
type RoughCanvas = any;
type CanvasContext = any;

function samplePoints(points: Point[], step: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

export function drawPaperTexture(ctx: CanvasContext, width: number, height: number): void {
  ctx.fillStyle = '#FAF3E8';
  ctx.fillRect(0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

export function drawPolygon(
  rc: RoughCanvas,
  coordinates: number[][],
  project: (lng: number, lat: number) => CanvasPoint,
  isMainland: boolean
): void {
  if (!coordinates || coordinates.length < 3) return;

  let path = '';
  coordinates.forEach((coord, i) => {
    const { x, y } = project(coord[0], coord[1]);
    path += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
  });
  path += 'Z';

  rc.path(path, {
    fill: isMainland ? 'rgba(255, 248, 220, 0.4)' : 'rgba(240, 230, 210, 0.3)',
    fillStyle: 'hachure',
    hachureAngle: 60,
    hachureGap: 10,
    stroke: '#8B7355',
    strokeWidth: 1.5,
    roughness: 1.0,
    bowing: 0.5
  });
}

export function drawRoute(
  rc: RoughCanvas,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint,
  style: RouteStyle
): void {
  const sampled = samplePoints(points, 5);
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    rc.line(from.x, from.y, to.x, to.y, style);
  }
}

export function drawDashedRoute(
  rc: RoughCanvas,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint,
  style: RouteStyle
): void {
  const sampled = samplePoints(points, 5);
  for (let i = 0; i < sampled.length - 1; i += 2) {
    if (i + 1 < sampled.length) {
      const from = project(sampled[i].lng, sampled[i].lat);
      const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
      rc.line(from.x, from.y, to.x, to.y, style);
    }
  }
}

export function drawCityMarker(
  rc: RoughCanvas,
  ctx: CanvasContext,
  city: Location,
  project: (lng: number, lat: number) => CanvasPoint,
  options: CityMarkerOptions
): void {
  const { x, y } = project(city.lng, city.lat);
  const { color, label } = options;

  rc.circle(x, y, 24, {
    fill: color,
    fillStyle: 'solid',
    stroke: '#2C3E50',
    strokeWidth: 2.5,
    roughness: 1.2
  });

  rc.circle(x, y, 8, {
    fill: '#FFFFFF',
    fillStyle: 'solid',
    stroke: 'none',
    roughness: 0.5
  });

  const text = city.name + (label ? ` (${label})` : '');
  ctx.font = 'bold 16px "Comic Sans MS", "PingFang SC", "Microsoft YaHei", sans-serif';
  const textWidth = ctx.measureText(text).width;

  rc.rectangle(x + 20, y - 20, textWidth + 20, 28, {
    fill: 'rgba(255, 255, 255, 0.9)',
    fillStyle: 'solid',
    stroke: '#2C3E50',
    strokeWidth: 1.5,
    roughness: 0.8
  });

  ctx.fillStyle = '#2C3E50';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 30, y - 6);
}

export function drawLegend(ctx: CanvasContext, x: number, y: number): void {
  ctx.font = '14px "Comic Sans MS", "PingFang SC", sans-serif';
  ctx.fillStyle = '#2C3E50';
  ctx.textAlign = 'left';

  // Traveled
  ctx.strokeStyle = '#E74C3C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 30, y);
  ctx.stroke();
  ctx.fillText('Traveled', x + 40, y + 4);

  // Remaining
  ctx.strokeStyle = '#95A5A6';
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y + 25);
  ctx.lineTo(x + 30, y + 25);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText('Remaining', x + 40, y + 29);
}
