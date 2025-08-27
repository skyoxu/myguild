export type SecurityEvent =
  | { type: 'security.csp.violation'; directive: string; url?: string }
  | { type: 'security.ipc.blocked'; channel: string };
