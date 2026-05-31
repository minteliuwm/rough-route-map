/**
 * Drawing engine - SVG version (hand-drawn style rendering)
 *
 * No canvas library is used. All non-rough operations emit native SVG elements.
 */

import { Point, Location, CanvasPoint, CityMarkerOptions, RouteStyle } from './types';
import { RoughSVG, appendRough, createSVGNode, addRadialGradient, estimateTextWidth } from './svg-renderer';

// Re-export shared helpers
export { COLOR } from './drawing';
import { samplePoints, jitter } from './drawing';
export { samplePoints, jitter };

// ─── Color constants (mirrored from drawing.ts) ─────────────────────

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

// ─── 1. Background & Border ────────────────────────────────────────

export function drawPaperTextureSVG(
  svg: SVGSVGElement,
  defs: SVGDefsElement,
  width: number,
  height: number
): void {
  // Background
  svg.appendChild(
    createSVGNode(svg, 'rect', { width: '100%', height: '100%', fill: COLOR.bg }) as unknown as Node
  );

  // Vignette (warm darkening at edges)
  const vigId = addRadialGradient(
    svg, defs, '50%', '50%', '70%',
    [
      { offset: '0%', color: 'rgba(180,160,130,0)' },
      { offset: '100%', color: 'rgba(180,160,130,0.08)' }
    ]
  );
  svg.appendChild(
    createSVGNode(svg, 'rect', {
      width: '100%', height: '100%', fill: `url(#${vigId})`
    }) as unknown as Node
  );

  // Fiber streaks
  for (let i = 0; i < 40; i++) {
    const sx = Math.random() * width;
    const sy = Math.random() * height;
    const len = 20 + Math.random() * 60;
    const angle = Math.random() * Math.PI;
    svg.appendChild(
      createSVGNode(svg, 'line', {
        x1: sx, y1: sy,
        x2: sx + Math.cos(angle) * len,
        y2: sy + Math.sin(angle) * len,
        stroke: 'rgba(200,185,160,0.06)',
        'stroke-width': 0.5
      }) as unknown as Node
    );
  }
}

export function drawBorderSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  width: number,
  height: number
): void {
  const m = 15;

  appendRough(svg, rc.rectangle(m, m, width - m * 2, height - m * 2, {
    stroke: COLOR.outline, strokeWidth: 1.2, roughness: 2.5, bowing: 1.8, fill: 'none'
  }));

  appendRough(svg, rc.rectangle(m + 8, m + 8, width - (m + 8) * 2, height - (m + 8) * 2, {
    stroke: 'rgba(196, 184, 168, 0.4)', strokeWidth: 0.8, roughness: 1.5,
    bowing: 1.2, fill: 'none', strokeLineDash: [8, 6]
  }));

  const corners = [
    [m + 4, m + 4], [width - m - 4, m + 4],
    [m + 4, height - m - 4], [width - m - 4, height - m - 4]
  ];
  corners.forEach(([cx, cy]) => {
    appendRough(svg, rc.circle(cx, cy, 12, {
      stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5,
      fill: 'rgba(196, 184, 168, 0.2)', fillStyle: 'solid'
    }));
  });
}

// ─── 2. Map outline ─────────────────────────────────────────────────

export function drawPolygonSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
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

  appendRough(svg, rc.path(path, {
    fill: isMainland ? COLOR.outlineFillMainland : COLOR.outlineFill,
    fillStyle: 'hachure', hachureAngle: 60, hachureGap: 14,
    stroke: COLOR.outline + '73', strokeWidth: 0.6, roughness: 0.6, bowing: 0.3
  }));
}

// ─── 3. Routes ──────────────────────────────────────────────────────

export function drawRouteSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint,
  style: RouteStyle
): void {
  const sampled = samplePoints(points, 5);

  // Layer 0: soft shadow
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    appendRough(svg, rc.line(
      from.x + 1.5, from.y + 1.5,
      to.x + 1.5, to.y + 1.5,
      { ...style, strokeWidth: style.strokeWidth * 1.8, stroke: '#5D4E3C12', roughness: style.roughness * 0.4 }
    ));
  }

  // Layer 1: marker bleed
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    appendRough(svg, rc.line(
      jitter(from.x, 0.8), jitter(from.y, 0.8),
      jitter(to.x, 0.8), jitter(to.y, 0.8),
      { ...style, strokeWidth: style.strokeWidth * 2.5, stroke: style.stroke + '20', roughness: style.roughness * 0.6 }
    ));
  }

  // Layer 2: main stroke
  for (let i = 0; i < sampled.length - 1; i++) {
    const from = project(sampled[i].lng, sampled[i].lat);
    const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
    appendRough(svg, rc.line(from.x, from.y, to.x, to.y, style));
    if (i % 3 === 0) {
      appendRough(svg, rc.line(
        jitter(from.x, 1.2), jitter(from.y, 1.2),
        jitter(to.x, 1.2), jitter(to.y, 1.2),
        { ...style, strokeWidth: style.strokeWidth * 0.4, stroke: style.stroke + '60' }
      ));
    }
  }
}

export function drawDashedRouteSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  points: Point[],
  project: (lng: number, lat: number) => CanvasPoint,
  style: RouteStyle
): void {
  const sampled = samplePoints(points, 4);

  // Layer 1: subtle glow
  for (let i = 0; i < sampled.length - 1; i += 3) {
    if (i + 1 < sampled.length) {
      const from = project(sampled[i].lng, sampled[i].lat);
      const to = project(sampled[i + 1].lng, sampled[i + 1].lat);
      appendRough(svg, rc.line(from.x, from.y, to.x, to.y, {
        ...style, strokeWidth: style.strokeWidth * 2, stroke: style.stroke + '20', roughness: style.roughness * 0.5
      }));
    }
  }

  // Layer 2: main dashed stroke
  for (let i = 0; i < sampled.length - 1; i += 3) {
    for (let j = 0; j < 2 && i + j + 1 < sampled.length; j++) {
      const idx = i + j;
      const from = project(sampled[idx].lng, sampled[idx].lat);
      const to = project(sampled[idx + 1].lng, sampled[idx + 1].lat);
      appendRough(svg, rc.line(from.x, from.y, to.x, to.y, style));
    }
  }
}

// ─── 4. Decorations ─────────────────────────────────────────────────

export function drawRouteDecorationsSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
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

    const g = createSVGNode(svg, 'g', { opacity: 0.3 });

    if (type === 'cloud') {
      g.appendChild(rc.circle(dx, dy, 10, { fill: '#D5E8F0', fillStyle: 'solid', stroke: 'none', roughness: 1.5 }) as unknown as Node);
      g.appendChild(rc.circle(dx + 5, dy - 3, 8, { fill: '#D5E8F0', fillStyle: 'solid', stroke: 'none', roughness: 1.5 }) as unknown as Node);
      g.appendChild(rc.circle(dx - 4, dy - 2, 7, { fill: '#D5E8F0', fillStyle: 'solid', stroke: 'none', roughness: 1.5 }) as unknown as Node);
    } else if (type === 'star') {
      const s = 4;
      const d = `M${dx},${dy - s} L${dx},${dy + s} M${dx - s},${dy} L${dx + s},${dy} M${dx - s * 0.7},${dy - s * 0.7} L${dx + s * 0.7},${dy + s * 0.7} M${dx + s * 0.7},${dy - s * 0.7} L${dx - s * 0.7},${dy + s * 0.7}`;
      g.appendChild(
        createSVGNode(svg, 'path', { d, stroke: '#F0D080', 'stroke-width': 1, fill: 'none' }) as unknown as Node
      );
    } else {
      g.appendChild(rc.circle(dx, dy, 4, { fill: '#C4B8A8', fillStyle: 'solid', stroke: 'none', roughness: 2 }) as unknown as Node);
      g.appendChild(rc.circle(dx + 4, dy + 3, 3, { fill: '#C4B8A8', fillStyle: 'solid', stroke: 'none', roughness: 2 }) as unknown as Node);
    }

    svg.appendChild(g as unknown as Node);
  }
}

export function drawAmbientDecorationsSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  width: number,
  height: number
): void {
  const g = createSVGNode(svg, 'g', { opacity: 0.2 });

  // Small sun in upper-right area
  const sx = width * 0.82 + (Math.random() - 0.5) * 40;
  const sy = height * 0.12 + (Math.random() - 0.5) * 20;
  g.appendChild(rc.circle(sx, sy, 16, {
    fill: '#F8E8A0', fillStyle: 'solid', stroke: '#F0D060',
    strokeWidth: 1.5, roughness: 2
  }) as unknown as Node);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const r1 = 12;
    const r2 = 18 + Math.random() * 4;
    g.appendChild(rc.line(
      sx + Math.cos(a) * r1, sy + Math.sin(a) * r1,
      sx + Math.cos(a) * r2, sy + Math.sin(a) * r2,
      { stroke: '#F0D060', strokeWidth: 1.2, roughness: 2 }
    ) as unknown as Node);
  }

  // Floating clouds
  const cloudPositions = [
    { x: width * 0.15, y: height * 0.1 },
    { x: width * 0.6, y: height * 0.08 }
  ];
  cloudPositions.forEach(({ x, y }) => {
    g.appendChild(rc.circle(x, y, 14, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 }) as unknown as Node);
    g.appendChild(rc.circle(x + 8, y - 4, 11, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 }) as unknown as Node);
    g.appendChild(rc.circle(x - 6, y - 2, 10, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 }) as unknown as Node);
    g.appendChild(rc.circle(x + 14, y - 1, 9, { fill: '#E8EFF5', fillStyle: 'solid', stroke: 'none', roughness: 1.8 }) as unknown as Node);
  });

  // Tiny heart in lower-left
  const hx = width * 0.08;
  const hy = height * 0.88;
  const heartPath = `M${hx},${hy + 3} C${hx - 5},${hy - 3} ${hx - 9},${hy + 3} ${hx},${hy + 9} C${hx + 9},${hy + 3} ${hx + 5},${hy - 3} ${hx},${hy + 3}`;
  g.appendChild(
    createSVGNode(svg, 'path', { d: heartPath, fill: '#E8A0A0' }) as unknown as Node
  );

  svg.appendChild(g as unknown as Node);
}

// ─── 5. City markers ────────────────────────────────────────────────

function drawHouseIconSVG(rc: RoughSVG, svg: SVGSVGElement, x: number, y: number, color: string): void {
  const s = 10;
  appendRough(svg, rc.line(x - s, y, x, y - s * 1.2, { stroke: color, strokeWidth: 2, roughness: 1.5 }));
  appendRough(svg, rc.line(x, y - s * 1.2, x + s, y, { stroke: color, strokeWidth: 2, roughness: 1.5 }));
  appendRough(svg, rc.rectangle(x - s * 0.7, y, s * 1.4, s, {
    stroke: color, strokeWidth: 1.5, roughness: 1.2,
    fill: color + '30', fillStyle: 'solid'
  }));
  appendRough(svg, rc.rectangle(x - 2, y + 3, 4, s - 3, {
    stroke: color, strokeWidth: 1, roughness: 1, fill: color + '50', fillStyle: 'solid'
  }));
}

function drawCarIconSVG(rc: RoughSVG, svg: SVGSVGElement, x: number, y: number, color: string): void {
  // Pulsing glow rings with opacity
  appendRough(svg, rc.circle(x, y, 72, {
    fill: color, fillStyle: 'solid', stroke: 'none', roughness: 2.5
  }), 0.07);
  appendRough(svg, rc.circle(x, y, 52, {
    fill: color, fillStyle: 'solid', stroke: 'none', roughness: 2.2
  }), 0.12);
  appendRough(svg, rc.circle(x, y, 36, {
    fill: color, fillStyle: 'solid', stroke: 'none', roughness: 2
  }), 0.2);

  // Car body
  appendRough(svg, rc.rectangle(x - 13, y - 5, 26, 12, {
    stroke: color, strokeWidth: 2, roughness: 1.3,
    fill: color + '60', fillStyle: 'solid'
  }));
  // Roof
  appendRough(svg, rc.rectangle(x - 8, y - 12, 16, 8, {
    stroke: color, strokeWidth: 1.8, roughness: 1.2,
    fill: color + '40', fillStyle: 'solid'
  }));
  // Windshield
  appendRough(svg, rc.rectangle(x - 5, y - 10, 10, 5, {
    stroke: 'none', strokeWidth: 0, roughness: 0.8,
    fill: 'rgba(255,255,255,0.5)', fillStyle: 'solid'
  }));
  // Wheels
  appendRough(svg, rc.circle(x - 8, y + 8, 6, { fill: COLOR.text, fillStyle: 'solid', stroke: 'none', roughness: 1.5 }));
  appendRough(svg, rc.circle(x + 8, y + 8, 6, { fill: COLOR.text, fillStyle: 'solid', stroke: 'none', roughness: 1.5 }));
  // Headlights
  appendRough(svg, rc.circle(x + 13, y, 3, { fill: '#FFF4C0', fillStyle: 'solid', stroke: 'none', roughness: 1 }));
}

function drawFlagIconSVG(rc: RoughSVG, svg: SVGSVGElement, x: number, y: number, color: string): void {
  appendRough(svg, rc.line(x, y + 12, x, y - 12, { stroke: COLOR.text, strokeWidth: 1.8, roughness: 1.2 }));
  const flagPath = `M ${x} ${y - 12} L ${x + 14} ${y - 6} L ${x} ${y}`;
  appendRough(svg, rc.path(flagPath, {
    stroke: color, strokeWidth: 1.5, roughness: 1.3,
    fill: color + '50', fillStyle: 'solid'
  }));
  appendRough(svg, rc.circle(x, y + 12, 4, { fill: COLOR.text, fillStyle: 'solid', stroke: 'none', roughness: 1 }));
}

function drawDotIconSVG(rc: RoughSVG, svg: SVGSVGElement, x: number, y: number, color: string): void {
  appendRough(svg, rc.circle(x, y, 16, {
    fill: color + '50', fillStyle: 'solid',
    stroke: color, strokeWidth: 2, roughness: 1.5
  }));
  appendRough(svg, rc.circle(x, y, 6, {
    fill: '#FFFCF5', fillStyle: 'solid', stroke: 'none', roughness: 0.8
  }));
}

export function drawCityMarkerSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  city: Location,
  project: (lng: number, lat: number) => CanvasPoint,
  options: CityMarkerOptions
): void {
  const { x, y } = project(city.lng, city.lat);
  const { type, color } = options;

  switch (type) {
    case 'start':
      drawHouseIconSVG(rc, svg, x, y, color);
      break;
    case 'current':
      drawCarIconSVG(rc, svg, x, y, color);
      break;
    case 'end':
      drawFlagIconSVG(rc, svg, x, y, color);
      break;
    default:
      drawDotIconSVG(rc, svg, x, y, color);
  }

  // Label
  const text = city.name;
  if (!text.trim()) return;

  const fontSize = 14;
  const textWidth = estimateTextWidth(text, fontSize);
  const labelOffset = type === 'current' ? 32 : 22;
  const bx = x + labelOffset;
  const by = y - 26;
  const bw = textWidth + 24;
  const bh = 26;

  // Lead line
  svg.appendChild(
    createSVGNode(svg, 'line', {
      x1: x + (type === 'current' ? 16 : 12),
      y1: y - 8,
      x2: bx + 2,
      y2: by + bh / 2,
      stroke: COLOR.label.border,
      'stroke-width': 0.8,
      'stroke-dasharray': '3,3'
    }) as unknown as Node
  );

  // Label background
  appendRough(svg, rc.rectangle(bx, by, bw, bh, {
    fill: COLOR.label.bg, fillStyle: 'solid',
    stroke: COLOR.label.border, strokeWidth: 1,
    roughness: 1.2, bowing: 1.5
  }));

  // Text
  const textEl = createSVGNode(svg, 'text', {
    x: bx + 12,
    y: by + bh / 2 + 1,
    fill: COLOR.text,
    'font-family': '"Comic Sans MS", "PingFang SC", "Microsoft YaHei", sans-serif',
    'font-size': fontSize,
    'font-weight': 'bold',
    'dominant-baseline': 'middle'
  });
  textEl.textContent = text;
  svg.appendChild(textEl as unknown as Node);
}

// ─── 6. Title banner ────────────────────────────────────────────────

export function drawTitleSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  title: string,
  canvasWidth: number
): void {
  const bw = Math.min(title.length * 22 + 80, canvasWidth - 100);
  const bh = 48;
  const bx = (canvasWidth - bw) / 2;
  const by = 12;

  // Banner ribbon
  appendRough(svg, rc.rectangle(bx, by, bw, bh, {
    fill: 'rgba(255, 252, 245, 0.9)', fillStyle: 'solid',
    stroke: COLOR.outline, strokeWidth: 1.2, roughness: 1.8, bowing: 1.5
  }));

  // Ribbon tails
  const tailW = 12;
  appendRough(svg, rc.line(bx, by + bh / 2, bx - tailW, by + bh * 0.3, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 }));
  appendRough(svg, rc.line(bx, by + bh / 2, bx - tailW, by + bh * 0.7, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 }));
  appendRough(svg, rc.line(bx + bw, by + bh / 2, bx + bw + tailW, by + bh * 0.3, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 }));
  appendRough(svg, rc.line(bx + bw, by + bh / 2, bx + bw + tailW, by + bh * 0.7, { stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5 }));

  // Small map icon
  const iconX = (canvasWidth - bw) / 2 + 18;
  const iconY = by + bh / 2;
  appendRough(svg, rc.circle(iconX, iconY, 8, {
    fill: COLOR.traveled + '40', fillStyle: 'solid',
    stroke: COLOR.traveled, strokeWidth: 1, roughness: 1.5
  }));

  // Title text
  const textEl = createSVGNode(svg, 'text', {
    x: canvasWidth / 2 + 8,
    y: by + bh / 2 + 2,
    fill: COLOR.text,
    'font-family': '"Comic Sans MS", "Rounded Mplus 1c", "PingFang SC", sans-serif',
    'font-size': 22,
    'font-weight': 600,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle'
  });
  textEl.textContent = title;
  svg.appendChild(textEl as unknown as Node);
}

// ─── 7. Legend card ─────────────────────────────────────────────────

export function drawLegendSVG(
  rc: RoughSVG,
  svg: SVGSVGElement,
  x: number,
  y: number,
  labels: { traveled: string; remaining: string } = { traveled: 'Traveled', remaining: 'Remaining' }
): void {
  const cardW = 150;
  const cardH = 70;

  appendRough(svg, rc.rectangle(x, y, cardW, cardH, {
    fill: 'rgba(255, 252, 245, 0.9)', fillStyle: 'solid',
    stroke: COLOR.outline, strokeWidth: 1, roughness: 1.5, bowing: 1.2
  }));

  const lx = x + 15;
  const ly = y + 20;

  // Traveled: coral line with bleed
  appendRough(svg, rc.line(lx, ly, lx + 25, ly, {
    stroke: COLOR.traveled + '25', strokeWidth: 8, roughness: 1
  }));
  appendRough(svg, rc.line(lx, ly, lx + 25, ly, {
    stroke: COLOR.traveled, strokeWidth: 3, roughness: 1.5
  }));

  const t1 = createSVGNode(svg, 'text', {
    x: lx + 35, y: ly + 4,
    fill: COLOR.text,
    'font-family': '"Comic Sans MS", "PingFang SC", sans-serif',
    'font-size': 13,
    'dominant-baseline': 'middle'
  });
  t1.textContent = labels.traveled;
  svg.appendChild(t1 as unknown as Node);

  // Remaining: mint dashed
  appendRough(svg, rc.line(lx, ly + 28, lx + 12, ly + 28, {
    stroke: COLOR.remaining + '90', strokeWidth: 2.5, roughness: 1.5
  }));
  appendRough(svg, rc.line(lx + 16, ly + 28, lx + 25, ly + 28, {
    stroke: COLOR.remaining + '90', strokeWidth: 2.5, roughness: 1.5
  }));

  const t2 = createSVGNode(svg, 'text', {
    x: lx + 35, y: ly + 32,
    fill: COLOR.text,
    'font-family': '"Comic Sans MS", "PingFang SC", sans-serif',
    'font-size': 13,
    'dominant-baseline': 'middle'
  });
  t2.textContent = labels.remaining;
  svg.appendChild(t2 as unknown as Node);
}
