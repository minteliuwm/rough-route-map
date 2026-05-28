/**
 * Canvas factory - abstracts canvas creation across different providers.
 *
 * Supported providers:
 *   - 'skia-canvas' (default) - uses the skia-canvas package
 *   - 'canvas' - uses the canvas (node-canvas) package
 */

import { CanvasProvider } from './types';

/** A minimal canvas wrapper that both providers satisfy */
export interface CanvasWrapper {
  /** The underlying canvas object (passed to rough.canvas()) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  /** The 2D rendering context */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any;
  /** Export the canvas to a PNG buffer */
  toBuffer(): Promise<Buffer>;
}

/**
 * Create a canvas instance using the specified provider.
 */
export function createCanvas(
  width: number,
  height: number,
  provider: CanvasProvider
): CanvasWrapper {
  if (provider === 'canvas') {
    return createNodeCanvas(width, height);
  }
  return createSkiaCanvas(width, height);
}

function createSkiaCanvas(width: number, height: number): CanvasWrapper {
   
  const { Canvas } = require('skia-canvas');
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');
  return {
    raw: canvas,
    ctx,
    toBuffer: () => canvas.toBuffer('png'),
  };
}

function createNodeCanvas(width: number, height: number): CanvasWrapper {
  let createCanvasFn: (w: number, h: number) => unknown;
  try {
     
    createCanvasFn = require('canvas').createCanvas;
  } catch {
    throw new Error(
      'The "canvas" package is not installed. ' +
      'Install it with: npm install canvas  (or yarn add canvas)'
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvas = createCanvasFn(width, height) as any;
  const ctx = canvas.getContext('2d');
  return {
    raw: canvas,
    ctx,
    toBuffer: () => Promise.resolve(canvas.toBuffer('image/png')),
  };
}
