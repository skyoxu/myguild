export type AppState = 'boot' | 'loading' | 'running' | 'paused' | 'error';

export class StateMachine {
  private state: AppState = 'boot';
  get current() {
    return this.state;
  }
  transition(next: AppState) {
    const allowed: Record<AppState, AppState[]> = {
      boot: ['loading', 'error'],
      loading: ['running', 'error'],
      running: ['paused', 'error'],
      paused: ['running', 'error'],
      error: ['boot'],
    };
    if (!allowed[this.state].includes(next))
      throw new Error(`Invalid transition ${this.state} -> ${next}`);
    this.state = next;
  }
}
