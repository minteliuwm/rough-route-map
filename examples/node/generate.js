/**
 * Node.js example - Generate a hand-drawn style route map
 *
 * Usage:
 *   1. Replace apiKey with your map API key
 *   2. node examples/node/generate.js
 */

const { generateMap } = require('../../dist');

async function main() {
  const buffer = await generateMap({
    mapProvider: 'tencent',  // 'tencent' | 'amap'
    apiKey: 'YOUR_API_KEY',

    route: {
      start: { name: '杭州' },
      end: { name: '洛阳' },
      waypoints: [
        { name: '黄山' },
        { name: '景德镇' },
        { lat: 30.5928, lng: 114.3055 }  // Wuhan by coordinates
      ]
    },

    currentCity: { name: '武汉' },

    // Optional: custom canvas size
    width: 1200,
    height: 900,

    // Optional: custom hand-drawn style
    style: {
      roughness: 1.5,
      bowing: 1.2,
      paperTexture: true
    },

    output: './examples/node/route-map.png'
  });

  console.log(`Done. Image size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
