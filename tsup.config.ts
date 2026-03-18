import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig([
  {
    entry: ['bin/inblog.ts'],
    outDir: 'dist/bin',
    format: ['cjs'],
    target: 'node18',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    clean: true,
    sourcemap: true,
    define: {
      '__PKG_VERSION__': JSON.stringify(pkg.version),
    },
  },
  {
    entry: ['src/sdk/index.ts'],
    outDir: 'dist/sdk',
    format: ['esm', 'cjs'],
    target: 'node18',
    platform: 'node',
    dts: true,
    sourcemap: true,
  },
]);
