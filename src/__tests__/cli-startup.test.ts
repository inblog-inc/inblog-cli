import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = resolve(rootDir, 'dist/bin/inblog.mjs');

describe('built CLI', () => {
  it('starts with its ESM-only dependencies', () => {
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    const output = execFileSync(process.execPath, [cliPath, '--help'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(output).toContain('CLI for managing inblog.ai blog content');
  });
});
