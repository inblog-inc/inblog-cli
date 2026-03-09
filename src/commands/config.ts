import { Command } from 'commander';
import {
  readGlobalConfig,
  getGlobalConfigPath,
  getLocalConfigPath,
  setGlobalConfigValue,
  deleteGlobalConfigValue,
} from '../utils/config.js';
import { printJson, printDetail, printSuccess } from '../utils/output.js';
import { isJsonMode } from '../utils/client-factory.js';
import { handleError } from '../utils/errors.js';

export function registerConfigCommands(program: Command): void {
  const config = program.command('config').description('Manage CLI config (~/.config/inblog/config.json)');

  config
    .command('list')
    .description('Show all configuration values')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const cfg = readGlobalConfig();
        if (json) {
          printJson(cfg);
        } else {
          const entries = Object.entries(cfg);
          if (entries.length === 0) {
            console.log('No configuration set.');
          } else {
            printDetail(
              entries.map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]),
            );
          }
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .action(async function (this: Command, key: string) {
      const json = isJsonMode(this);
      try {
        const cfg = readGlobalConfig();
        const value = (cfg as any)[key];
        if (json) {
          printJson({ [key]: value ?? null });
        } else if (value === undefined) {
          console.log(`"${key}" is not set.`);
        } else {
          console.log(value);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async function (this: Command, key: string, value: string) {
      const json = isJsonMode(this);
      try {
        // Parse booleans and numbers
        let parsed: any = value;
        if (value === 'true') parsed = true;
        else if (value === 'false') parsed = false;
        else if (!isNaN(Number(value)) && value !== '') parsed = Number(value);

        setGlobalConfigValue(key, parsed);
        if (json) {
          printJson({ [key]: parsed });
        } else {
          printSuccess(`Set ${key} = ${parsed}`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });

  config
    .command('path')
    .description('Show configuration file paths')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      try {
        const globalPath = getGlobalConfigPath();
        const localPath = getLocalConfigPath();
        if (json) {
          printJson({ global: globalPath, local: localPath });
        } else {
          printDetail([
            ['Global', globalPath],
            ['Local', localPath ?? '(none)'],
          ]);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
