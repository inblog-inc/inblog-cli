import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Print JSON to stdout (for --json mode).
 */
export function printJson(data: any): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

/**
 * Print a styled table to stdout.
 */
export function printTable(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const table = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    table.push(row.map((cell) => (cell == null ? chalk.dim('—') : String(cell))));
  }
  console.log(table.toString());
}

/**
 * Print a key-value detail view.
 */
export function printDetail(entries: [string, any][]): void {
  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
  for (const [key, value] of entries) {
    const label = chalk.cyan(key.padEnd(maxKeyLen));
    const val = value == null ? chalk.dim('—') : String(value);
    console.log(`  ${label}  ${val}`);
  }
}

/**
 * Print success message.
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(message));
}

/**
 * Print warning message.
 */
export function printWarning(message: string): void {
  console.error(chalk.yellow(message));
}

/**
 * Print error message to stderr.
 */
export function printError(message: string): void {
  console.error(chalk.red(message));
}

/**
 * Truncate string for table display.
 */
export function truncate(str: string | null | undefined, maxLen: number = 50): string {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
