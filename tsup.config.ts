import { defineConfig } from 'tsup';

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
