import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Returns the Electron main process entry path (absolute path).
 * Prioritizes environment variable ELECTRON_MAIN_PATH; otherwise falls back to dist-electron/electron/main.js.
 */
export function getElectronEntry(): string {
  const hinted = process.env.ELECTRON_MAIN_PATH;
  if (hinted && hinted.trim().length > 0) {
    return resolve(process.cwd(), hinted);
  }
  return resolve(process.cwd(), 'dist-electron', 'electron', 'main.js');
}

/**
 * Asserts that the entry path exists; throws error if not, prompting to build first or configure environment variable correctly.
 */
export function assertElectronEntry(): string {
  const entry = getElectronEntry();
  if (!existsSync(entry)) {
    throw new Error(
      `Electron entry not found: ${entry}. Please run \"npm run build\" first ` +
        `or set ELECTRON_MAIN_PATH to a valid path (e.g. dist-electron/electron/main.js).`
    );
  }
  return entry;
}
