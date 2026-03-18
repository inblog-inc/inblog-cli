import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { printJson, printSuccess, printWarning } from '../utils/output.js';
import { isJsonMode } from '../utils/client-factory.js';
import { handleError } from '../utils/errors.js';

declare const __PKG_VERSION__: string;

const PKG_NAME = '@inblog/cli';

async function fetchLatestVersion(): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/${PKG_NAME}/latest`);
  if (!response.ok) {
    throw new Error(`Failed to check latest version: HTTP ${response.status}`);
  }
  const data: any = await response.json();
  return data.version;
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update @inblog/cli to the latest version')
    .option('--check', 'Only check for updates without installing')
    .action(async function (this: Command) {
      const json = isJsonMode(this);
      const checkOnly = this.opts().check;
      try {
        const currentVersion = __PKG_VERSION__;
        const latestVersion = await fetchLatestVersion();

        if (currentVersion === latestVersion) {
          if (json) {
            printJson({ current: currentVersion, latest: latestVersion, upToDate: true });
          } else {
            printSuccess(`Already on the latest version (${currentVersion}).`);
          }
          return;
        }

        if (checkOnly) {
          if (json) {
            printJson({ current: currentVersion, latest: latestVersion, upToDate: false });
          } else {
            console.log(`Current: ${currentVersion}`);
            console.log(`Latest:  ${latestVersion}`);
            console.log(`\nRun \`inblog update\` to upgrade.`);
          }
          return;
        }

        if (!json) {
          console.log(`Updating ${PKG_NAME} ${currentVersion} → ${latestVersion}...`);
        }

        execSync(`npm install -g ${PKG_NAME}@latest`, { stdio: json ? 'pipe' : 'inherit' });

        if (json) {
          printJson({ current: currentVersion, latest: latestVersion, updated: true });
        } else {
          printSuccess(`Updated to ${latestVersion}.`);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
