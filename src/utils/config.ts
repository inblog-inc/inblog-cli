import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface InblogConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultJson?: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'inblog');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_FILE = '.inblogrc.json';

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getGlobalConfigPath(): string {
  return CONFIG_FILE;
}

export function getLocalConfigPath(): string | null {
  const localPath = path.resolve(LOCAL_CONFIG_FILE);
  return fs.existsSync(localPath) ? localPath : null;
}

export function readGlobalConfig(): InblogConfig {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function readLocalConfig(): InblogConfig {
  const localPath = path.resolve(LOCAL_CONFIG_FILE);
  if (!fs.existsSync(localPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Merged config: local overrides global.
 */
export function readConfig(): InblogConfig {
  const global = readGlobalConfig();
  const local = readLocalConfig();
  return { ...global, ...local };
}

export function writeGlobalConfig(config: InblogConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function setGlobalConfigValue(key: string, value: any): void {
  const config = readGlobalConfig();
  (config as any)[key] = value;
  writeGlobalConfig(config);
}

export function deleteGlobalConfigValue(key: string): void {
  const config = readGlobalConfig();
  delete (config as any)[key];
  writeGlobalConfig(config);
}
