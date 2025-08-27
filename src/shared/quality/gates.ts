export interface SloGate {
  key: 'crash_free' | 'tp95' | 'coverage';
  threshold: number;
  source: 'sentry' | 'benchmark' | 'coverage';
  window?: '7d' | '30d' | 'release';
  blockOnFail: boolean;
}

export const GATES: SloGate[] = [
  {
    key: 'crash_free',
    threshold: 99.5,
    source: 'sentry',
    window: '30d',
    blockOnFail: true,
  },
  {
    key: 'tp95',
    threshold: 50,
    source: 'benchmark',
    window: '7d',
    blockOnFail: false,
  },
  {
    key: 'coverage',
    threshold: 90,
    source: 'coverage',
    window: 'release',
    blockOnFail: true,
  },
];
