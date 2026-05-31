/**
 * Node.js example - Generate a hand-drawn style route map
 *
 * Usage:
 *   1. Replace apiKey with your map API key
 *   2. node examples/node/generate.js
 *
 * To generate SVG instead of PNG, add `format: 'svg'` to the config.
 */

const { generateMap } = require("../../dist");

async function main() {
  // ─── PNG output (default) ────────────────────────────────
  const pngBuffer = await generateMap({
    mapProvider: "tencent", // 'tencent' | 'amap'
    apiKey: "YOUR_API_KEY",

    route: {
      start: { name: "杭州" },
      end: { name: "洛阳" },
      waypoints: [
        { name: "黄山" },
        { name: "景德镇" },
        { lat: 30.5928, lng: 114.3055 }, // Wuhan by coordinates
      ],
    },

    currentCity: { name: "武汉" },

    width: 1200,
    height: 600,

    style: {
      roughness: 1.5,
      bowing: 1.2,
      paperTexture: true,
    },

    output: "./examples/node/route-map.png",
  });

  console.log(`PNG done. Size: ${(pngBuffer.length / 1024).toFixed(1)} KB`);

  // ─── SVG output ──────────────────────────────────────────
  const svgBuffer = await generateMap({
    mapProvider: "tencent",
    apiKey: "CCTBZ-3BOHQ-4XC57-GE52J-AAIDS-NWB3P",

    route: {
      start: { name: "杭州" },
      end: { name: "洛阳" },
      waypoints: [
        { name: "黄山" },
        { name: "景德镇" },
        { lat: 30.5928, lng: 114.3055 },
      ],
    },

    currentCity: { name: "武汉" },

    width: 1200,
    height: 900,

    style: {
      roughness: 1.5,
      bowing: 1.2,
      paperTexture: true,
    },

    format: "svg",
    output: "./examples/node/route-map.svg",
  });

  console.log(`SVG done. Size: ${(svgBuffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
