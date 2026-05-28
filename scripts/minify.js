/**
 * Post-build script: minify all JS files in dist/ with terser
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const DIST = path.resolve(__dirname, '../dist');

async function minifyFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const result = await minify(code, {
    compress: {
      dead_code: true,
      drop_console: false
    },
    mangle: {
      toplevel: false  // preserve module exports
    },
    output: {
      comments: false
    }
  });
  if (result.code) {
    fs.writeFileSync(filePath, result.code);
  }
}

async function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(full);
    } else if (entry.name.endsWith('.js')) {
      await minifyFile(full);
      console.log(`Minified: ${path.relative(DIST, full)}`);
    }
  }
}

walkDir(DIST).then(() => console.log('Done.'));
