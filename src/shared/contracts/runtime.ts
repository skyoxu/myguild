/**
 * Runtime performance contracts for dual-loop coordination
 * Supports React UI + Phaser Game loop with 60fps≈16.7ms frame budget
 *
 * ADR References: ADR-0001, ADR-0005
 * Base-Clean: Uses placeholders for domain-specific terms
 */

// Core frame budget management interface
export interface FrameBudget {
  /** Total frame budget in milliseconds (16.7ms for 60fps) */
  totalMs: 16.7;

  /** Time allocation per subsystem */
  allocated: {
    phaser: number; // Phaser rendering allocation (typical: 8-10ms)
    react: number; // React update allocation (typical: 3-4ms)
    events: number; // Event processing allocation (typical: 2-3ms)
    gc: number; // GC and other overhead (typical: 2-3ms)
  };

  /** Remaining budget for current frame */
  remaining: number;

  /** Whether frame budget was exceeded */
  overrun: boolean;

  /** Frame identifier for tracking */
  frameId: number;
}

// Frame budget manager interface
export interface FrameBudgetManager {
  /** Allocate time budget for a subsystem */
  allocate(
    subsystem: 'react' | 'phaser' | 'events' | 'gc',
    timeMs: number
  ): boolean;

  /** Get remaining frame budget */
  getRemainingBudget(): number;

  /** Register callback for budget exceeded events */
  onBudgetExceeded(callback: (subsystem: string) => void): void;

  /** Get current frame budget state */
  getCurrentBudget(): FrameBudget;

  /** Reset frame budget for new frame */
  resetFrame(): void;
}

// Event processing latency budget
export interface EventLatencyBudget {
  /** Maximum UI event processing time (target: 30ms) */
  uiEventMaxMs: 30;

  /** Maximum game event processing time (target: 50ms) */
  gameEventMaxMs: 50;

  /** Current TP95 latency measurement */
  currentTP95: number;

  /** Current event queue length */
  queueLength: number;

  /** Whether backpressure control is active */
  backpressureActive: boolean;
}

// Performance degradation event
export interface DegradeEvent {
  /** Source performance state */
  from: 'normal' | 'degraded' | 'critical' | 'emergency';

  /** Target performance state */
  to: 'normal' | 'degraded' | 'critical' | 'emergency';

  /** Trigger that caused the degradation */
  trigger:
    | 'frame_overrun'
    | 'event_latency'
    | 'memory_pressure'
    | 'gc_pressure';

  /** Event timestamp */
  timestamp: number;

  /** Performance metrics at time of degradation */
  metrics: {
    currentFPS: number;
    eventTP95: number;
    memoryUsageMB: number;
    gcFrequency: number;
  };
}

// Performance state enumeration
export type PerformanceState = 'normal' | 'degraded' | 'critical' | 'emergency';

// Event priority levels
export type EventPriority = 'immediate' | 'high' | 'normal' | 'low';

// Game event interface
export interface GameEvent {
  id: string;
  type: string;
  priority: EventPriority;
  payload: unknown;
  timestamp: number;
  deadline?: number; // Optional deadline for time-sensitive events
}

// Performance metrics snapshot
export interface PerformanceMetrics {
  frameTime: number; // Current frame time in ms
  eventLatency: number; // Current event processing latency
  memoryUsageMB: number; // Current memory usage in MB
  gcFrequency: number; // GC events per second
  queueLength: number; // Event queue length
}

// Performance thresholds configuration
export interface PerformanceThresholds {
  normal: {
    maxFrameTime: number; // Default: 16ms
    maxEventLatency: number; // Default: 30ms
    maxMemoryMB: number; // Default: 512MB
  };
  degraded: {
    maxFrameTime: number; // Default: 20ms
    maxEventLatency: number; // Default: 40ms
    maxMemoryMB: number; // Default: 768MB
  };
  critical: {
    maxFrameTime: number; // Default: 25ms
    maxEventLatency: number; // Default: 50ms
    maxMemoryMB: number; // Default: 1024MB
  };
  emergency: {
    maxFrameTime: number; // Default: 33ms
    maxEventLatency: number; // Default: 100ms
    maxMemoryMB: number; // Default: 1536MB
  };
}

// Factory functions for creating default instances
export function createFrameBudget(): FrameBudget {
  return {
    totalMs: 16.7,
    allocated: {
      phaser: 8, // Default Phaser allocation
      react: 4, // Default React allocation
      events: 2, // Default event processing allocation
      gc: 2.7, // Default GC/overhead allocation
    },
    remaining: 16.7,
    overrun: false,
    frameId: 0,
  };
}

export function createEventLatencyBudget(): EventLatencyBudget {
  return {
    uiEventMaxMs: 30,
    gameEventMaxMs: 50,
    currentTP95: 0,
    queueLength: 0,
    backpressureActive: false,
  };
}

export function createPerformanceThresholds(): PerformanceThresholds {
  return {
    normal: { maxFrameTime: 16, maxEventLatency: 30, maxMemoryMB: 512 },
    degraded: { maxFrameTime: 20, maxEventLatency: 40, maxMemoryMB: 768 },
    critical: { maxFrameTime: 25, maxEventLatency: 50, maxMemoryMB: 1024 },
    emergency: { maxFrameTime: 33, maxEventLatency: 100, maxMemoryMB: 1536 },
  };
}

// Utility type guards
export function isFrameOverrun(budget: FrameBudget): boolean {
  return budget.overrun || budget.remaining < 0;
}

export function isEventLatencyExceeded(
  budget: EventLatencyBudget,
  eventType: 'ui' | 'game'
): boolean {
  const maxLatency =
    eventType === 'ui' ? budget.uiEventMaxMs : budget.gameEventMaxMs;
  return budget.currentTP95 > maxLatency;
}

export function shouldDegradeState(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds,
  currentState: PerformanceState
): PerformanceState {
  // Check if we need to degrade further
  if (
    currentState === 'normal' &&
    (metrics.frameTime > thresholds.normal.maxFrameTime ||
      metrics.eventLatency > thresholds.normal.maxEventLatency ||
      metrics.memoryUsageMB > thresholds.normal.maxMemoryMB)
  ) {
    return 'degraded';
  }

  if (
    currentState === 'degraded' &&
    (metrics.frameTime > thresholds.degraded.maxFrameTime ||
      metrics.eventLatency > thresholds.degraded.maxEventLatency ||
      metrics.memoryUsageMB > thresholds.degraded.maxMemoryMB)
  ) {
    return 'critical';
  }

  if (
    currentState === 'critical' &&
    (metrics.frameTime > thresholds.critical.maxFrameTime ||
      metrics.eventLatency > thresholds.critical.maxEventLatency ||
      metrics.memoryUsageMB > thresholds.critical.maxMemoryMB)
  ) {
    return 'emergency';
  }

  return currentState;
}

// Constants for runtime configuration
export const RUNTIME_CONSTANTS = {
  TARGET_FPS: 60,
  FRAME_BUDGET_MS: 16.7,
  DEFAULT_SAMPLING_RATE: 1.0,
  MIN_SAMPLING_RATE: 0.1,
  MAX_EVENT_QUEUE_SIZE: 1000,
  BACKPRESSURE_THRESHOLD_MS: 50,
  GC_PRESSURE_THRESHOLD: 20, // GC events per second
  MEMORY_WARNING_THRESHOLD_MB: 768,
  MEMORY_CRITICAL_THRESHOLD_MB: 1024,
} as const;
