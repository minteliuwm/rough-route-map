/**
 * Drawing engine - hand-drawn style rendering (healing / journal aesthetic)
 *
 * Color palette (low-saturation, warm tone):
 *   - Background:  #F5EDE0 (warm cream)
 *   - Outline:     #C4B8A8 (light brown, subtle)
 *   - Traveled:    #E67C73 (coral red)
 *   - Remaining:   #87C9B8 (mint green)
 *   - Start:       #8FC5A0 (soft green)
 *   - Waypoint:    #7EB8D8 (soft blue)
 *   - Current:     #F0A868 (warm orange)
 *   - End:         #C87C7C (dusty rose)
 *   - Text:        #5D4E3C (warm dark brown)
 */

import { Point, Location, CanvasPoint, CityMarkerOptions, RouteStyle } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- roughjs has no type definitions
type RoughCanvas = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- skia-canvas has no type definitions
type CanvasContext = any;

// ─── Color constants ────────────────────────────────────────────────
const COLOR = {
  bg: '#F5EDE0',
  text: '#5D4E3C',
  outline: '#B8A999',
  outlineFill: 'rgba(245, 237, 224, 0.25)',
  outlineFillMainland: 'rgba(248, 242, 230, 0.4)',
  label: {
    bg: 'rgba(255, 252, 245, 0.92)',
    border: '#C4B8A8'
  },
  traveled: '#D9635A',
  remaining: '#87C9B8',
  start: '#8FC5A0',
  waypoint: '#7EB8D8',
  current: '#F0A868',
  end: '#C87C7C'
};

// ─── Helpers ────────────────────────────────────────────────────────

export function samplePoints(points: Point[], step: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

/** Random jitter for hand-drawn feel */
export function jitter(v: number, amount = 1.5): number {
  return v + (Math.random() - 0.5) * amount;
}

// ─── 1. Background & Border ────────────────────────────────────────

export function drawPaperTexture(ctx: CanvasContext, width: number, height: number): void {
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, width, height);

  // Fine grain noise
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i]     = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  // Warm vignette
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(180,160,130,0.08)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Fiber streaks
  ctx.strokeStyle = 'rgba(200,185,160,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 40; i++) {
    const sx = Math.random() * width;
    const sy = Math.random() * height;
    const len = 20 + Math.random() * 60;
    const angle = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    ctx.stroke();
  }
}

export function drawBorder(rc: RoughCanvas, ctx: CanvasContext, width: number, height: number): void {
  const m = 15;

  rc.rectangle(m, m, width - m * 2, height - m * 2, {
    stroke: COLOR.outline, strokeWidth: 1.2, roughness: 2.5, bowing: 1.8, fill: 'none'
  });

  rc.rectangle(m + 8, m + 8, width - (m + 8) * 2, height - (m + 8) * 2, {
    stroke: 'rgba(196, 184, 168, 0.4)', strokeWidth: 0.8, roughness: 1.5,
    bowing: 1.2, fill: 'none', strokeLineDash: [8, 6]
  });

  const corners = [
    [m + 4, m + 4], [width - m - 4, m + 4],
    [m + 4, height - m - 4], [width - m - 4, height - m - 4]
  ];
  corners.forEach(([cx, cy]) => {
    rc.circle(cx, cy, 12, {
      stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5,
      fill: 'rgba(196, 184, 168, 0.2)', fillStyle: 'solid'
    });
  });
}

// ─── 2. Map outline ─────────────────────────────────────────────────

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
    fill: isMainland ? COLOR.outlineFillMainland : COLOR.outlineFill,
    fillStyle: 'hachure', hachureAngle: 60, hachureGap: 14,
    stroke: COLOR.outline + '73', strokeWidth: 0.6, roughness: 0.6, bowing: 0.3
  });
}

// ─── 3. Routes ──────────────────────────────────────────────────────

/**
 * Traveled route: marker-pen bleed effect (wide translucent underlayer)
 * + hand-drawn brush strokes with width variation
 */
export function drawRoute(
  rc: RoughCanvas,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint,
  style: RouteStyle
): void {
  const sampled = samplePoints(points, 5);

  // Layer 0: soft shadow for depth
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    rc.line(
      from.x + 1.5, from.y + 1.5,
      to.x + 1.5, to.y + 1.5,
      { ...style, strokeWidth: style.strokeWidth * 1.8, stroke: '#5D4E3C12', roughness: style.roughness * 0.4 }
    );
  }

  // Layer 1: marker bleed / highlight glow (wide, very translucent)
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    rc.line(
      jitter(from.x, 0.8), jitter(from.y, 0.8),
      jitter(to.x, 0.8), jitter(to.y, 0.8),
      { ...style, strokeWidth: style.strokeWidth * 2.5, stroke: style.stroke + '20', roughness: style.roughness * 0.6 }
    );
  }

  // Layer 2: main stroke
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    rc.line(from.x, from.y, to.x, to.y, style);
    // Brush width variation every few segments
    if (i % 3 === 0) {
      rc.line(
        jitter(from.x, 1.2), jitter(from.y, 1.2),
        jitter(to.x, 1.2), jitter(to.y, 1.2),
        { ...style, strokeWidth: style.strokeWidth * 0.4, stroke: style.stroke + '60' }
      );
    }
  }
}

/**
 * Remaining route: lowered opacity for a draft-sketch look
 */
export function drawDashedRoute(
  rc: RoughCanvas,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint,
  style: RouteStyle
): void {
  const sampled = samplePoints(points, 4);

  // Layer 1: subtle glow underlayer for visibility
  for (let i = 0; i < sampled.length - 1; i += 3) {
    if (i + 1 < sampled.length) {
      const from = project(sampled[i].lng, sampled[i].lat);
      const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
      rc.line(from.x, from.y, to.x, to.y, {
        ...style, strokeWidth: style.strokeWidth * 2, stroke: style.stroke + '20', roughness: style.roughness * 0.5
      });
    }
  }

  // Layer 2: main dashed stroke (long dash, long gap)
  for (let i = 0; i < sampled.length - 1; i += 3) {
    // Draw 2 segments, skip 1 (longer dash rhythm)
    for (let j = 0; j < 2 && i + j + 1 < sampled.length; j++) {
      const idx = i + j;
      const from = project(sampled[idx].lng, sampled[idx].lat);
      const to = project(sampled[idx + 1].lng, sampled[idx + 1].lat);
      rc.line(from.x, from.y, to.x, to.y, style);
    }
  }
}

/**
 * Decorations along the route (clouds, stars, footprints)
 */
export function drawRouteDecorations(
  rc: RoughCanvas,
  ctx: CanvasContext,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint
): void {
  const sampled = samplePoints(points, Math.max(20, Math.floor(points.length / 8)));
  const decorations = ['cloud', 'star', 'dot'] as const;

  for (let i = 1; i < sampled.length - 1; i++) {
    const { x, y } = project(sampled[i].lng, sampled[i].lat);
    const type = decorations[i % decorations.length];
    const ox = (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 12);
    const oy = (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 8);
    const dx = x + ox;
    const dy = y + oy;

    ctx.globalAlpha = 0.3;

    if (type === 'cloud') {
      rc.circle(dx, dy, 10, { fill: '#D5E8F0', fillStyle: 'solid', stroke: 'none', roughness: 1.5 });
      rc.circle(dx + 5, dy - 3, 8, { fill: '#D5E8F0', fillStyle: 'solid', stroke: 'none', roughness: 1.5 });
      rc.circle(dx - 4, dy - 2, 7, { fill: '#D5E8F0', fillStyle: 'solid', stroke: 'none', roughness: 1.5 });
    } else if (type === 'star') {
      const s = 4;
      ctx.strokeStyle = '#F0D080';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy - s); ctx.lineTo(dx, dy + s);
      ctx.moveTo(dx - s, dy); ctx.lineTo(dx + s, dy);
      ctx.moveTo(dx - s * 0.7, dy - s * 0.7); ctx.lineTo(dx + s * 0.7, dy + s * 0.7);
      ctx.moveTo(dx + s * 0.7, dy - s * 0.7); ctx.lineTo(dx - s * 0.7, dy + s * 0.7);
      ctx.stroke();
    } else {
      rc.circle(dx, dy, 4, { fill: '#C4B8A8', fillStyle: 'solid', stroke: 'none', roughness: 2 });
      rc.circle(dx + 4, dy + 3, 3, { fill: '#C4B8A8', fillStyle: 'solid', stroke: 'none', roughness: 2 });
    }

    ctx.globalAlpha = 1.0;
  }
}

/**
 * Ambient decorations in empty areas (small sun, clouds, hearts)
 */
export function drawAmbientDecorations(
  rc: RoughCanvas,
  ctx: CanvasContext,
  width: number,
  height: number
): void {
  ctx.globalAlpha = 0.2;

  // Small sun in upper-right area
  const sx = width * 0.82 + (Math.random() - 0.5) * 40;
  const sy = height * 0.12 + (Math.random() - 0.5) * 20;
  rc.circle(sx, sy, 16, {
    fill: '#F8E8A0', fillStyle: 'solid', stroke: '#F0D060',
    strokeWidth: 1.5, roughness: 2
  });
  // Sun rays
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const r1 = 12;
    const r2 = 18 + Math.random() * 4;
    rc.line(
      sx + Math.cos(a) * r1, sy + Math.sin(a) * r1,
      sx + Math.cos(a) * r2, sy + Math.sin(a) * r2,
      { stroke: '#F0D060', strokeWidth: 1.2, roughness: 2 }
    );
  }

  // A couple floating clouds in empty corners
  const cloudPositions = [
    { x: width * 0.15, y: height * 0.1 },
    { x: width * 0.6, y: height * 0.08 }
  ];
  cloudPositions.forEach(({ x, y }) => {
    rc.circle(x, y, 14, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 });
    rc.circle(x + 8, y - 4, 11, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 });
    rc.circle(x - 6, y - 2, 10, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 });
    rc.circle(x + 14, y - 1, 9, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 });
  });

  // Tiny heart in lower-left
  const hx = width * 0.08;
  const hy = height * 0.88;
  ctx.fillStyle = '#E8A0A0';
  ctx.beginPath();
  ctx.moveTo(hx, hy + 3);
  ctx.bezierCurveTo(hx - 5, hy - 3, hx - 9, hy + 3, hx, hy + 9);
  ctx.bezierCurveTo(hx + 9, hy + 3, hx + 5, hy - 3, hx, hy + 3);
  ctx.fill();

  ctx.globalAlpha = 1.0;
}

// ─── 4. City markers (hand-drawn icons) ─────────────────────────────

/** Hand-drawn house icon (start) */
function drawHouseIcon(rc: RoughCanvas, ctx: CanvasContext, x: number, y: number, color: string): void {
  const s = 10;
  rc.line(x - s, y, x, y - s * 1.2, { stroke: color, strokeWidth: 2, roughness: 1.5 });
  rc.line(x, y - s * 1.2, x + s, y, { stroke: color, strokeWidth: 2, roughness: 1.5 });
  rc.rectangle(x - s * 0.7, y, s * 1.4, s, {
    stroke: color, strokeWidth: 1.5, roughness: 1.2,
    fill: color + '30', fillStyle: 'solid'
  });
  rc.rectangle(x - 2, y + 3, 4, s - 3, {
    stroke: color, strokeWidth: 1, roughness: 1, fill: color + '50', fillStyle: 'solid'
  });
}

/**
 * Hand-drawn car icon (current) - ENHANCED: larger, with glow ring
 */
function drawCarIcon(rc: RoughCanvas, ctx: CanvasContext, x: number, y: number, color: string): void {
  // Pulsing glow ring (warm orange halo) - wide & soft
  ctx.globalAlpha = 0.07;
  rc.circle(x, y, 72, {
    fill: color, fillStyle: 'solid', stroke: 'none', roughness: 2.5
  });
  ctx.globalAlpha = 0.12;
  rc.circle(x, y, 52, {
    fill: color, fillStyle: 'solid', stroke: 'none', roughness: 2.2
  });
  ctx.globalAlpha = 0.2;
  rc.circle(x, y, 36, {
    fill: color, fillStyle: 'solid', stroke: 'none', roughness: 2
  });
  ctx.globalAlpha = 1.0;

  // Car body (slightly larger)
  rc.rectangle(x - 13, y - 5, 26, 12, {
    stroke: color, strokeWidth: 2, roughness: 1.3,
    fill: color + '60', fillStyle: 'solid'
  });
  // Roof
  rc.rectangle(x - 8, y - 12, 16, 8, {
    stroke: color, strokeWidth: 1.8, roughness: 1.2,
    fill: color + '40', fillStyle: 'solid'
  });
  // Windshield highlight
  rc.rectangle(x - 5, y - 10, 10, 5, {
    stroke: 'none', strokeWidth: 0, roughness: 0.8,
    fill: 'rgba(255,255,255,0.5)', fillStyle: 'solid'
  });
  // Wheels
  rc.circle(x - 8, y + 8, 6, { fill: COLOR.text, fillStyle: 'solid', stroke: 'none', roughness: 1.5 });
  rc.circle(x + 8, y + 8, 6, { fill: COLOR.text, fillStyle: 'solid', stroke: 'none', roughness: 1.5 });
  // Headlights
  rc.circle(x + 13, y, 3, { fill: '#FFF4C0', fillStyle: 'solid', stroke: 'none', roughness: 1 });
}

/** Hand-drawn flag icon (end) */
function drawFlagIcon(rc: RoughCanvas, ctx: CanvasContext, x: number, y: number, color: string): void {
  rc.line(x, y + 12, x, y - 12, { stroke: COLOR.text, strokeWidth: 1.8, roughness: 1.2 });
  const flagPath = `M ${x} ${y - 12} L ${x + 14} ${y - 6} L ${x} ${y}`;
  rc.path(flagPath, {
    stroke: color, strokeWidth: 1.5, roughness: 1.3,
    fill: color + '50', fillStyle: 'solid'
  });
  rc.circle(x, y + 12, 4, { fill: COLOR.text, fillStyle: 'solid', stroke: 'none', roughness: 1 });
}

/** Hand-drawn dot icon (waypoint) */
function drawDotIcon(rc: RoughCanvas, x: number, y: number, color: string): void {
  rc.circle(x, y, 16, {
    fill: color + '50', fillStyle: 'solid',
    stroke: color, strokeWidth: 2, roughness: 1.5
  });
  rc.circle(x, y, 6, {
    fill: '#FFFCF5', fillStyle: 'solid', stroke: 'none', roughness: 0.8
  });
}

export function drawCityMarker(
  rc: RoughCanvas,
  ctx: CanvasContext,
  city: Location,
  project: (lng: number, lat: number) => CanvasPoint,
  options: CityMarkerOptions
): void {
  const { x, y } = project(city.lng, city.lat);
  const { type, color, label } = options;

  // Draw type-specific icon
  switch (type) {
    case 'start':
      drawHouseIcon(rc, ctx, x, y, color);
      break;
    case 'current':
      drawCarIcon(rc, ctx, x, y, color);
      break;
    case 'end':
      drawFlagIcon(rc, ctx, x, y, color);
      break;
    default:
      drawDotIcon(rc, x, y, color);
  }

  // Label with lead line
  const text = city.name + (label ? ` (${label})` : '');
  if (!text.trim()) return;

  ctx.font = 'bold 14px "Comic Sans MS", "PingFang SC", "Microsoft YaHei", sans-serif';
  const textWidth = ctx.measureText(text).width;

  // Offset label further for current (has glow ring) to avoid overlap
  const labelOffset = type === 'current' ? 32 : 22;
  const bx = x + labelOffset;
  const by = y - 26;
  const bw = textWidth + 24;
  const bh = 26;

  // Lead line from icon to label
  ctx.strokeStyle = COLOR.label.border;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + (type === 'current' ? 16 : 12), y - 8);
  ctx.lineTo(bx + 2, by + bh / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cloud-like label background
  rc.rectangle(bx, by, bw, bh, {
    fill: COLOR.label.bg, fillStyle: 'solid',
    stroke: COLOR.label.border, strokeWidth: 1,
    roughness: 1.2, bowing: 1.5
  });

  // Text
  ctx.fillStyle = COLOR.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 12, by + bh / 2);
}

// ─── 5. Title banner ────────────────────────────────────────────────

export function drawTitle(
  rc: RoughCanvas,
  ctx: CanvasContext,
  title: string,
  canvasWidth: number
): void {
  const bw = Math.min(title.length * 22 + 80, canvasWidth - 100);
  const bh = 48;
  const bx = (canvasWidth - bw) / 2;
  const by = 12;

  // Banner ribbon
  rc.rectangle(bx, by, bw, bh, {
    fill: 'rgba(255, 252, 245, 0.9)', fillStyle: 'solid',
    stroke: COLOR.outline, strokeWidth: 1.2, roughness: 1.8, bowing: 1.5
  });

  // Ribbon tails
  const tailW = 12;
  rc.line(bx, by + bh / 2, bx - tailW, by + bh * 0.3, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 });
  rc.line(bx, by + bh / 2, bx - tailW, by + bh * 0.7, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 });
  rc.line(bx + bw, by + bh / 2, bx + bw + tailW, by + bh * 0.3, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 });
  rc.line(bx + bw, by + bh / 2, bx + bw + tailW, by + bh * 0.7, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 });

  // Small map icon before title
  const iconX = (canvasWidth - bw) / 2 + 18;
  const iconY = by + bh / 2;
  rc.circle(iconX, iconY, 8, {
    fill: COLOR.traveled + '40', fillStyle: 'solid',
    stroke: COLOR.traveled, strokeWidth: 1, roughness: 1.5
  });

  // Title text (rounded, friendly font style)
  ctx.font = '600 22px "Comic Sans MS", "Rounded Mplus 1c", "PingFang SC", sans-serif';
  ctx.fillStyle = COLOR.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvasWidth / 2 + 8, by + bh / 2);
}

// ─── 6. Legend card ─────────────────────────────────────────────────

export function drawLegend(
  rc: RoughCanvas,
  ctx: CanvasContext,
  x: number,
  y: number,
  labels: { traveled: string; remaining: string } = { traveled: 'Traveled', remaining: 'Remaining' }
): void {
  const cardW = 150;
  const cardH = 70;

  rc.rectangle(x, y, cardW, cardH, {
    fill: 'rgba(255, 252, 245, 0.9)', fillStyle: 'solid',
    stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5, bowing: 1.2
  });

  const lx = x + 15;
  const ly = y + 20;

  ctx.font = '13px "Comic Sans MS", "PingFang SC", sans-serif';
  ctx.fillStyle = COLOR.text;
  ctx.textAlign = 'left';

  // Traveled: coral line with bleed
  rc.line(lx, ly, lx + 25, ly, {
    stroke: COLOR.traveled + '25', strokeWidth: 8, roughness: 1
  });
  rc.line(lx, ly, lx + 25, ly, {
    stroke: COLOR.traveled, strokeWidth: 3, roughness: 1.5
  });
  ctx.fillText(labels.traveled, lx + 35, ly + 4);

  // Remaining: mint dashed with lower opacity
  rc.line(lx, ly + 28, lx + 12, ly + 28, {
    stroke: COLOR.remaining + '90', strokeWidth: 2.5, roughness: 1.5
  });
  rc.line(lx + 16, ly + 28, lx + 25, ly + 28, {
    stroke: COLOR.remaining + '90', strokeWidth: 2.5, roughness: 1.5
  });
  ctx.fillText(labels.remaining, lx + 35, ly + 32);
}

export { COLOR };
