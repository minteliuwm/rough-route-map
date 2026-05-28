# rough-route-map

[中文文档](./README.zh-CN.md)

Hand-drawn style route map generator for Node.js, powered by [Rough.js](https://roughjs.com/) and [Skia Canvas](https://github.com/nicknisi/skia-canvas).

## Features

- **Hand-drawn rendering** - Rough.js gives every line a pen-on-paper feel
- **Real driving routes** - Fetches actual routes via map APIs (Tencent Map, Amap)
- **Multiple map providers** - Supports Tencent Map and Amap (Gaode), extensible for more
- **Flexible location input** - Use city names, coordinates, or both
- **Trip progress** - Solid lines for traveled segments, dashed for remaining
- **China map outline** - Auto-loads province boundaries as a base layer
- **Paper texture** - Optional noise-based paper background
- **Decorative elements** - Ambient decorations (sun, clouds, hearts) and route decorations (stars, footprints)
- **Title & legend** - Auto-generated route title banner and legend card
- **DPI scaling** - Configurable scale factor for high-resolution output

## Install

```bash
npm install rough-route-map
# or
yarn add rough-route-map
```

## Quick Start

```js
const { generateMap } = require('rough-route-map');

const buffer = await generateMap({
  mapProvider: 'tencent',  // 'tencent' | 'amap'
  apiKey: 'YOUR_API_KEY',
  route: {
    start: { name: 'Hangzhou' },
    end: { name: 'Luoyang' },
    waypoints: [
      { name: 'Huangshan' },
      { name: 'Jingdezhen' },
      { lat: 30.5928, lng: 114.3055 }  // Wuhan by coordinates
    ]
  },
  currentCity: { name: 'Wuhan' },
  output: './route-map.png'
});
```

## API

### `generateMap(config): Promise<Buffer>`

Returns a PNG image buffer.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mapProvider` | `string` | `'tencent'` | Map provider (`'tencent'` \| `'amap'`) |
| `apiKey` | `string` | - | Map API Key **(required)** |
| `route.start` | `LocationInput` | - | Start location **(required)** |
| `route.end` | `LocationInput` | - | End location **(required)** |
| `route.waypoints` | `LocationInput[]` | `[]` | Waypoint locations |
| `currentCity` | `LocationInput` | `null` | Current location (splits traveled/remaining) |
| `width` | `number` | `1200` | Canvas width (px) |
| `height` | `number` | `900` | Canvas height (px) |
| `style.roughness` | `number` | `1.5` | Hand-drawn roughness |
| `style.bowing` | `number` | `1.2` | Line bowing |
| `style.paperTexture` | `boolean` | `true` | Paper texture background |
| `showTitle` | `boolean` | `true` | Show route title at top |
| `showLegend` | `boolean` | `true` | Show legend card |
| `legendLabels.traveled` | `string` | `'Traveled'` | Legend label for traveled segments |
| `legendLabels.remaining` | `string` | `'Remaining'` | Legend label for remaining segments |
| `concurrency` | `number` | `5` | Max API requests per second |
| `dpi` | `number` | `2` | DPI scale factor for output clarity |
| `output` | `string` | `'./route-map.png'` | Output path (empty string to skip file saving) |

### Location object

Each location (`start`, `end`, waypoints, `currentCity`) is a `LocationInput`:

```ts
interface LocationInput {
  name?: string;
  lat?: number;
  lng?: number;
}
```

| Scenario | Behavior |
|----------|----------|
| `lat` + `lng` provided | Use coordinates directly, skip geocoding |
| Only `name` provided | Geocode the name to get coordinates |
| Both provided | Use `lat` + `lng`, keep `name` for display |
| `start` / `end` / `currentCity` fails to resolve | Throws an error |
| Waypoint fails to resolve | Skipped with a warning |

### Sub-module exports

For advanced usage, individual modules are available:

```js
const { geo, api, drawing, config, providers } = require('rough-route-map');

// Create a provider directly
const { createProvider } = require('rough-route-map/providers');
const provider = createProvider('amap', 'YOUR_KEY');
const coords = await provider.geocode('Beijing');
```

Available sub-modules:

| Module | Import path | Description |
|--------|-------------|-------------|
| `geo` | `rough-route-map/geo` | Mercator projection, bounds calculation, closest-point search |
| `api` | `rough-route-map/api` | GeoJSON boundary data fetching |
| `drawing` | `rough-route-map/drawing` | Canvas rendering (texture, polygons, routes, markers, legend) |
| `config` | `rough-route-map/config` | Default config and `mergeConfig()` |
| `providers` | `rough-route-map/providers` | Map provider factory and implementations |
| `types` | `rough-route-map/types` | TypeScript type definitions |

## Examples

### Node.js

```bash
# 1. Replace apiKey in examples/node/generate.js
# 2. Run:
yarn example
# or
yarn build:dev && node examples/node/generate.js
```

## Prerequisites

- Node.js >= 14
- A map API key from one of the supported providers:
  - [Tencent Map](https://lbs.qq.com/dev/console/application/mine)
  - [Amap (Gaode)](https://console.amap.com/dev/key/app)

## Development

```bash
# Install dependencies
yarn install

# Build (compile + minify)
yarn build

# Build without minification
yarn build:dev

# Lint
yarn lint
yarn lint:fix

# Run example
yarn example
```

## Project Structure

```
rough-route-map/
├── src/
│   ├── index.ts        # Package entry - exports generateMap()
│   ├── types.ts        # TypeScript type definitions
│   ├── config.ts       # Default config and mergeConfig()
│   ├── geo.ts          # Projection, bounds, closest point
│   ├── api.ts          # Common API utilities (GeoJSON)
│   ├── drawing.ts      # Canvas rendering (texture, polygons, routes, markers, legend)
│   └── providers/
│       ├── index.ts    # Provider factory
│       ├── tencent.ts  # Tencent Map provider
│       └── amap.ts     # Amap (Gaode) provider
├── examples/
│   └── node/
│       └── generate.js
├── dist/               # Compiled output
├── package.json
└── README.md
```

## License

MIT
