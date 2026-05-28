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

## Install

```bash
npm install rough-route-map
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
| `mapProvider` | string | `'tencent'` | Map provider (`'tencent'` \| `'amap'`) |
| `apiKey` | string | - | Map API Key **(required)** |
| `route.start` | object | - | Start location **(required)** |
| `route.end` | object | - | End location **(required)** |
| `route.waypoints` | object[] | `[]` | Waypoint locations |
| `currentCity` | object | `null` | Current location (splits traveled/remaining) |
| `width` | number | `1200` | Canvas width |
| `height` | number | `900` | Canvas height |
| `style.roughness` | number | `1.5` | Hand-drawn roughness |
| `style.bowing` | number | `1.2` | Line bowing |
| `style.paperTexture` | boolean | `true` | Paper texture background |
| `output` | string | `'./route-map.png'` | Output path (empty string to skip file saving) |

### Location object

Each location (`start`, `end`, waypoints, `currentCity`) is an object:

```js
{ name?: string, lat?: number, lng?: number }
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

## Examples

### Node.js

```bash
node examples/node/generate.js
```

## Prerequisites

- Node.js >= 14
- A map API key from one of the supported providers:
  - [Tencent Map](https://lbs.qq.com/dev/console/application/mine)
  - [Amap (Gaode)](https://console.amap.com/dev/key/app)

## Project Structure

```
rough-route-map/
├── src/
│   ├── index.js        # Package entry - exports generateMap()
│   ├── config.js       # Default config and mergeConfig()
│   ├── geo.js          # Projection, bounds, closest point
│   ├── api.js          # Common API utilities (GeoJSON)
│   ├── drawing.js      # Canvas rendering (texture, polygons, routes, markers, legend)
│   └── providers/
│       ├── index.js    # Provider factory
│       ├── tencent.js  # Tencent Map provider
│       └── amap.js     # Amap (Gaode) provider
├── examples/
│   └── node/
│       └── generate.js
├── package.json
├── .gitignore
└── .npmignore
```

## License

MIT
