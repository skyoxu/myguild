export type TickFn = (dt: number) => void | Promise<void>;

export class GameLoop {
  private running = false;
  private last = 0;
  private rafId: any = null;
  private update: TickFn;
  private onError?: (err: unknown) => void;

  constructor(update: TickFn, onError?: (err: unknown) => void) {
    this.update = update;
    this.onError = onError;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const step = async (t: number) => {
      if (!this.running) return;
      const dt = t - this.last;
      this.last = t;
      try {
        await this.update(dt);
      } catch (e) {
        this.onError?.(e);
      }
      this.rafId = setTimeout(() => step(performance.now()), 16); // 约 60fps
    };
    step(this.last);
  }
  stop() {
    this.running = false;
    if (this.rafId) clearTimeout(this.rafId);
  }
}
