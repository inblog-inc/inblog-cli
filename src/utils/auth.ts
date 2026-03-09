import { readConfig, readGlobalConfig, writeGlobalConfig } from './config.js';

/**
 * Resolve API key from multiple sources (priority order):
 * 1. --api-key CLI flag
 * 2. INBLOG_API_KEY env var
 * 3. .inblogrc.json (project local)
 * 4. ~/.config/inblog/config.json (global)
 */
export function resolveApiKey(flagValue?: string): string | undefined {
  if (flagValue) return flagValue;
  if (process.env.INBLOG_API_KEY) return process.env.INBLOG_API_KEY;
  const config = readConfig();
  return config.apiKey;
}

/**
 * Save API key to global config.
 */
export function saveApiKey(apiKey: string): void {
  const config = readGlobalConfig();
  config.apiKey = apiKey;
  writeGlobalConfig(config);
}

/**
 * Remove API key from global config.
 */
export function clearApiKey(): void {
  const config = readGlobalConfig();
  delete config.apiKey;
  writeGlobalConfig(config);
}
