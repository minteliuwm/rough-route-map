/**
 * Map provider factory
 */

import { MapProvider } from '../types';
import { createProvider as createTencentProvider } from './tencent';
import { createProvider as createAmapProvider } from './amap';

const providers: Record<string, (apiKey: string) => MapProvider> = {
  tencent: createTencentProvider,
  amap: createAmapProvider
};

/**
 * Create a map provider instance
 */
export function createProvider(name: string, apiKey: string): MapProvider {
  const factory = providers[name];
  if (!factory) {
    const supported = Object.keys(providers).join(', ');
    throw new Error(`Unsupported map provider: "${name}". Supported: ${supported}`);
  }
  return factory(apiKey);
}
