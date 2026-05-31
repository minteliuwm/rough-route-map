/**
 * SVG renderer - creates SVG DOM using @xmldom/xmldom for headless Node.js usage.
 *
 * No canvas library is used. Rough.js SVG mode generates hand-drawn primitives
 * as native SVG elements.
 */

const rough = require('roughjs');

/** Lazy-loaded xmldom modules */
let _DOMImplementation: any;
let _XMLSerializer: any;

function getXmlDom() {
  if (!_DOMImplementation || !_XMLSerializer) {
    try {
      const xmldom = require('@xmldom/xmldom');
      _DOMImplementation = xmldom.DOMImplementation;
      _XMLSerializer = xmldom.XMLSerializer;
    } catch {
      throw new Error(
        'The "@xmldom/xmldom" package is not installed. ' +
        'Install it with: npm install @xmldom/xmldom  (or yarn add @xmldom/xmldom)'
      );
    }
  }
  return { DOMImplementation: _DOMImplementation, XMLSerializer: _XMLSerializer };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Minimal SVG wrapper for drawing operations */
export interface SVGWrapper {
  /** The root SVG element */
  svg: SVGSVGElement;
  /** The <defs> container for gradients / patterns */
  defs: SVGDefsElement;
  /** Rough.js SVG renderer */
  rc: RoughSVG;
  /** Serialize to SVG XML string */
  toString(): string;
  /** Serialize to UTF-8 Buffer */
  toBuffer(): Buffer;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RoughSVG = any;

let _idCounter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create an SVG wrapper with the given dimensions.
 */
export function createSVG(width: number, height: number): SVGWrapper {
  const { DOMImplementation, XMLSerializer } = getXmlDom();
  const impl = new DOMImplementation();
  const doc = impl.createDocument(SVG_NS, 'svg', null);
  const svg = doc.documentElement as unknown as SVGSVGElement;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const defs = doc.createElementNS(SVG_NS, 'defs') as unknown as SVGDefsElement;
  svg.appendChild(defs as unknown as Node);

  const rc = rough.svg(svg);

  return {
    svg,
    defs,
    rc,
    toString() {
      const serializer = new XMLSerializer();
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg as unknown as Node);
    },
    toBuffer() {
      return Buffer.from(this.toString(), 'utf-8');
    }
  };
}

/** Append a rough.js node to the SVG, optionally wrapping with opacity. */
export function appendRough(
  svg: SVGSVGElement,
  node: SVGElement,
  opacity?: number
): void {
  if (opacity !== undefined && opacity < 0.99) {
    const doc = svg.ownerDocument;
    const g = doc!.createElementNS(SVG_NS, 'g') as unknown as SVGElement;
    g.setAttribute('opacity', String(opacity));
    g.appendChild(node as unknown as Node);
    svg.appendChild(g as unknown as Node);
  } else {
    svg.appendChild(node as unknown as Node);
  }
}

/** Create a plain SVG element. */
export function createSVGNode(
  svg: SVGSVGElement,
  tag: string,
  attrs: Record<string, string | number>
): SVGElement {
  const doc = svg.ownerDocument;
  const el = doc!.createElementNS(SVG_NS, tag) as unknown as SVGElement;
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/** Add a radial gradient to <defs> and return its url id. */
export function addRadialGradient(
  svg: SVGSVGElement,
  defs: SVGDefsElement,
  cx: string,
  cy: string,
  r: string,
  stops: { offset: string; color: string }[]
): string {
  const id = uniqueId('rg');
  const grad = createSVGNode(svg, 'radialGradient', { id, cx, cy, r });
  for (const s of stops) {
    const stop = createSVGNode(svg, 'stop', { offset: s.offset, 'stop-color': s.color });
    grad.appendChild(stop as unknown as Node);
  }
  defs.appendChild(grad as unknown as Node);
  return id;
}

/** Estimate text width for layout (no DOM layout engine in Node). */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    // CJK chars are roughly square; Latin chars are ~0.55x fontSize
    width += char.charCodeAt(0) > 127 ? fontSize : fontSize * 0.55;
  }
  return width;
}
