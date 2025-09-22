'use strict';
/**
 * Main-process only observability integration (no renderer imports).
 * Keeps API surface for main initialization and system/business metrics.
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.DEFAULT_MONITORING_CONFIG_MAIN =
  exports.integrateObservabilityMetrics =
  exports.sendDatabaseAlert =
  exports.startSystemMetricsCollection =
  exports.reportSystemMetrics =
  exports.reportBattleRoundTimeMain =
  exports.reportLevelLoadTimeMain =
  exports.sendBusinessMetric =
  exports.initSentryMain =
    void 0;
exports.initializeMainProcessMonitoring = initializeMainProcessMonitoring;
exports.initializeCompleteMonitoring = initializeCompleteMonitoring;
// Re-exports from main side
var sentry_main_1 = require('./sentry-main');
Object.defineProperty(exports, 'initSentryMain', {
  enumerable: true,
  get: function () {
    return sentry_main_1.initSentryMain;
  },
});
Object.defineProperty(exports, 'sendBusinessMetric', {
  enumerable: true,
  get: function () {
    return sentry_main_1.sendBusinessMetric;
  },
});
Object.defineProperty(exports, 'reportLevelLoadTimeMain', {
  enumerable: true,
  get: function () {
    return sentry_main_1.reportLevelLoadTimeMain;
  },
});
Object.defineProperty(exports, 'reportBattleRoundTimeMain', {
  enumerable: true,
  get: function () {
    return sentry_main_1.reportBattleRoundTimeMain;
  },
});
Object.defineProperty(exports, 'reportSystemMetrics', {
  enumerable: true,
  get: function () {
    return sentry_main_1.reportSystemMetrics;
  },
});
Object.defineProperty(exports, 'startSystemMetricsCollection', {
  enumerable: true,
  get: function () {
    return sentry_main_1.startSystemMetricsCollection;
  },
});
Object.defineProperty(exports, 'sendDatabaseAlert', {
  enumerable: true,
  get: function () {
    return sentry_main_1.sendDatabaseAlert;
  },
});
Object.defineProperty(exports, 'integrateObservabilityMetrics', {
  enumerable: true,
  get: function () {
    return sentry_main_1.integrateObservabilityMetrics;
  },
});
exports.DEFAULT_MONITORING_CONFIG_MAIN = {
  enableMainProcess: true,
  enableReleaseHealth: true,
  enableSystemMetrics: true,
};
/** Initialize main-process observability */
async function initializeMainProcessMonitoring(config = {}) {
  const finalConfig = { ...exports.DEFAULT_MONITORING_CONFIG_MAIN, ...config };
  try {
    let ok = true;
    // 1) Sentry (main)
    if (finalConfig.enableMainProcess) {
      const { initSentryMain } = await Promise.resolve().then(() =>
        __importStar(require('./sentry-main'))
      );
      const ready = await initSentryMain();
      if (!ready) ok = false;
    }
    // 2) Release Health (main)
    if (finalConfig.enableReleaseHealth) {
      const { releaseHealthManager } = await Promise.resolve().then(() =>
        __importStar(require('./release-health'))
      );
      releaseHealthManager.initializeReleaseHealth();
    }
    // 3) System metrics collection
    if (finalConfig.enableSystemMetrics) {
      const { startSystemMetricsCollection } = await Promise.resolve().then(
        () => __importStar(require('./sentry-main'))
      );
      startSystemMetricsCollection();
    }
    return ok;
  } catch (err) {
    console.error('[main-observability] initialization error:', err);
    return false;
  }
}
/** Initialize complete flow from main (renderer init is done in renderer entry) */
async function initializeCompleteMonitoring(config = {}) {
  const mainResult = await initializeMainProcessMonitoring(config);
  return { main: mainResult, renderer: false };
}
