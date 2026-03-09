import { InblogApiError } from '../sdk/client.js';
import { printError, printJson } from './output.js';
import { readSession } from './token-store.js';

/**
 * Check if active blog plan allows CLI usage (team or enterprise).
 * Exits with error if plan is insufficient.
 */
export function checkPlanOrExit(): void {
  const session = readSession();
  if (!session) return; // Not logged in — will fail at auth check anyway

  const plan = session.activeBlogPlan;
  if (plan === 'team' || plan === 'enterprise') return; // OK
  if (!plan) return; // No plan info cached — let the server decide

  printError(`CLI features require a Team plan or above. Current plan: ${plan}`);
  printError(`Upgrade: https://inblog.ai/dashboard/${session.activeBlogSubdomain || ''}/settings/billing`);
  process.exit(1);
}

/**
 * Handle errors in CLI commands.
 * In --json mode, outputs structured error JSON to stderr.
 * Otherwise prints human-friendly message.
 */
export function handleError(error: unknown, json: boolean = false): never {
  if (error instanceof InblogApiError) {
    if (json) {
      const errorObj = {
        error: true,
        status: error.status,
        code: error.code,
        title: error.title,
        detail: error.detail,
      };
      process.stderr.write(JSON.stringify(errorObj, null, 2) + '\n');
    } else {
      printError(`API Error (${error.status}): ${error.title}`);
      if (error.detail) {
        printError(`  ${error.detail}`);
      }
      if (error.code === 'SUBSCRIPTION_REQUIRED') {
        printError('  API access requires a paid plan. Upgrade at https://inblog.ai/dashboard/settings/billing');
      }
    }
    process.exit(2);
  }

  if (error instanceof Error) {
    if (json) {
      process.stderr.write(JSON.stringify({ error: true, message: error.message }, null, 2) + '\n');
    } else {
      printError(error.message);
    }
    process.exit(1);
  }

  printError('An unexpected error occurred');
  process.exit(1);
}

/**
 * Wrap an async command handler with error handling.
 */
export function withErrorHandler(
  fn: (...args: any[]) => Promise<void>,
  getJson: (...args: any[]) => boolean,
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error, getJson(...args));
    }
  };
}
