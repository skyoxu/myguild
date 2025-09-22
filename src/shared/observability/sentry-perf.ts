/**
 *  Sentry Performance
 * -  Sentry
 * -  '@sentry/electron/renderer'
 */

export type Txn = { finish: () => void };

export async function startTransaction(
  name: string,
  op: string = 'task'
): Promise<Txn> {
  try {
    const Sentry = await import('@sentry/electron/renderer');
    const txn = (Sentry as any).startTransaction?.({ name, op });
    (Sentry as any)
      .getCurrentHub?.()
      .configureScope?.((scope: any) => scope.setSpan?.(txn));
    return {
      finish: () => {
        try {
          txn?.finish?.();
        } catch {}
      },
    };
  } catch {
    // no-op when Sentry not available
    return { finish: () => {} };
  }
}
