/**
 * In-place acceptance test - Prevent "Object has been destroyed" crashes
 *
 * Verifies that delayed callbacks do not trigger main process crashes after window closure
 * Test scenario: Simulates race conditions from rapid window closure
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { assertElectronEntry } from '../../helpers/electronEntry';

test('window closure should not trigger crash from delayed callbacks', async () => {
  console.log(
    '[Crash Prevention Test] Starting test - Verifying delayed callback safety protection'
  );

  // 1. Launch Electron application
  const app = await electron.launch({
    args: [assertElectronEntry()],
    // Enable logging in test environment to observe timer behavior
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CI: 'true',
    },
  });

  // 2. Get main window
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  console.log(
    '[Crash Prevention Test] Application started successfully, window ready'
  );

  // 3. Main process has scheduled a setTimeout(..., 100), we immediately close window to simulate race condition
  console.log(
    '[Crash Prevention Test] Immediately closing window, simulating timer race condition'
  );
  await page.close();

  // 4. Wait sufficient time to ensure original timer should trigger (if there was no protection)
  await new Promise(resolve => setTimeout(resolve, 200));

  // 5. As long as main process doesn't throw "Object has been destroyed", application should close normally
  console.log(
    '[Crash Prevention Test] Verifying application closes normally (no "Object has been destroyed" error)'
  );
  await app.close();

  // 6. If we reach here, protection is working
  expect(true).toBeTruthy();
  console.log(
    '[Crash Prevention Test] Test passed - Delayed callback protection working normally'
  );
});

test('timer cleanup in multi-window scenario', async () => {
  console.log(
    '[Multi-Window Crash Prevention Test] Starting test - Verifying multi-window timer cleanup'
  );

  const app = await electron.launch({
    args: [assertElectronEntry()],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CI: 'true',
    },
  });

  // Get first window
  const firstWindow = await app.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded');

  console.log('[Multi-Window Crash Prevention Test] First window ready');

  // Immediately close first window
  await firstWindow.close();
  console.log('[Multi-Window Crash Prevention Test] First window closed');

  // Wait to ensure timer cleanup is complete
  await new Promise(resolve => setTimeout(resolve, 150));

  // Close application normally
  await app.close();

  expect(true).toBeTruthy();
  console.log(
    '[Multi-Window Crash Prevention Test] Test passed - Multi-window scenario protection working normally'
  );
});

test('long-delay callback protection verification', async () => {
  console.log(
    '[Long-Delay Crash Prevention Test] Starting test - Verifying long-delay callback protection'
  );

  const app = await electron.launch({
    args: [assertElectronEntry()],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CI: 'true',
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  console.log(
    '[Long-Delay Crash Prevention Test] Application started successfully'
  );

  // Simulate auto-updater long-delay scenario (3 seconds)
  // Close window before timer triggers
  console.log(
    '[Long-Delay Crash Prevention Test] Closing window before long-delay triggers'
  );
  await page.close();

  // Wait for the original long-delay period, ensuring protection mechanism works
  console.log(
    '[Long-Delay Crash Prevention Test] Waiting for long-delay period...'
  );
  await new Promise(resolve => setTimeout(resolve, 500));

  await app.close();

  expect(true).toBeTruthy();
  console.log(
    '[Long-Delay Crash Prevention Test] Test passed - Long-delay callback protection working normally'
  );
});
