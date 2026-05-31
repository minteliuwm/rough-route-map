/**
 * Node.js example - Generate a hand-drawn style route map in SVG format
 *
 * Usage:
 *   1. Replace apiKey with your map API key
 *   2. node examples/node/generate-svg.js
 */

const { generateMap } = require("../../dist");

async function main() {
  console.log("Generating SVG route map...");

  const svgBuffer = await generateMap({
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

    format: "svg", // Specify SVG format
    output: "./examples/node/route-map.svg",
  });

  console.log(
    `SVG generated successfully! Size: ${(svgBuffer.length / 1024).toFixed(1)} KB`,
  );
  console.log("Saved to: examples/node/route-map.svg");
}

main().catch((err) => {
  console.error("Failed to generate SVG:", err.message);
  process.exit(1);
});
