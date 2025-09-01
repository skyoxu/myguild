/**
 * CloudEvents 1.0 运行时验证器
 * 确保事件符合最新标准规范
 */

import type { CloudEvent } from '../contracts/cloudevents-core';
import type { GuildManagerEventType } from '../contracts/guild-manager-chunk-001';

interface CloudEventValidationError {
  field: string;
  message: string;
  received?: unknown;
}

export class CloudEventValidator {
  private static readonly REQUIRED_FIELDS: (keyof CloudEvent)[] = [
    'specversion',
    'id',
    'source',
    'type',
  ];

  private static readonly VALID_SPEC_VERSION = '1.0';

  private static readonly GUILD_MANAGER_EVENT_TYPES: GuildManagerEventType[] = [
    'io.vitegame.gm.guild.turn.started',
    'io.vitegame.gm.guild.turn.phase_changed',
    'io.vitegame.gm.guild.turn.completed',
    'io.vitegame.gm.member.state_changed',
    'io.vitegame.gm.member.relationship_updated',
    'io.vitegame.gm.decision.created',
    'io.vitegame.gm.decision.resolved',
    'io.vitegame.gm.event.triggered',
    'io.vitegame.gm.ai.action_executed',
    'io.vitegame.gm.workpanel.data_updated',
  ];

  /**
   * 验证CloudEvent是否符合1.0标准
   */
  static validate(event: unknown): {
    isValid: boolean;
    errors: CloudEventValidationError[];
  } {
    const errors: CloudEventValidationError[] = [];

    if (!event || typeof event !== 'object') {
      return {
        isValid: false,
        errors: [
          {
            field: 'root',
            message: 'Event must be an object',
            received: event,
          },
        ],
      };
    }

    const cloudEvent = event as Partial<CloudEvent>;

    // 检查必需字段
    for (const field of this.REQUIRED_FIELDS) {
      if (!cloudEvent[field]) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          received: cloudEvent[field],
        });
      }
    }

    // 验证specversion
    if (
      cloudEvent.specversion &&
      cloudEvent.specversion !== this.VALID_SPEC_VERSION
    ) {
      errors.push({
        field: 'specversion',
        message: `Invalid spec version. Expected '${this.VALID_SPEC_VERSION}'`,
        received: cloudEvent.specversion,
      });
    }

    // 验证事件类型
    if (
      cloudEvent.type &&
      !this.GUILD_MANAGER_EVENT_TYPES.includes(
        cloudEvent.type as GuildManagerEventType
      )
    ) {
      errors.push({
        field: 'type',
        message: `Unknown event type. Must be one of: ${this.GUILD_MANAGER_EVENT_TYPES.join(', ')}`,
        received: cloudEvent.type,
      });
    }

    // 验证source格式
    if (cloudEvent.source && !this.isValidSource(cloudEvent.source)) {
      errors.push({
        field: 'source',
        message: 'Invalid source format. Must be a valid URI',
        received: cloudEvent.source,
      });
    }

    // 验证时间戳格式
    if (cloudEvent.time && !this.isValidTimestamp(cloudEvent.time)) {
      errors.push({
        field: 'time',
        message: 'Invalid timestamp format. Must be RFC 3339',
        received: cloudEvent.time,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证source字段格式
   */
  private static isValidSource(source: string): boolean {
    try {
      new URL(source);
      return true;
    } catch {
      // 允许URI-reference格式 (如 "gm://turn-system")
      return /^[a-z][a-z0-9+.-]*:\/\/[\w-]+$/.test(source);
    }
  }

  /**
   * 验证时间戳格式 (RFC 3339)
   */
  private static isValidTimestamp(time: string): boolean {
    const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!rfc3339Regex.test(time)) return false;

    const date = new Date(time);
    return !isNaN(date.getTime());
  }

  /**
   * 创建标准CloudEvent
   */
  static createEvent(
    type: GuildManagerEventType,
    source: string,
    data?: unknown,
    options?: {
      id?: string;
      time?: string;
      subject?: string;
      datacontenttype?: string;
    }
  ): CloudEvent {
    return {
      specversion: this.VALID_SPEC_VERSION,
      id: options?.id || this.generateId(),
      source,
      type,
      time: options?.time || new Date().toISOString(),
      ...(data && { data }),
      ...(options?.subject && { subject: options.subject }),
      ...(options?.datacontenttype && {
        datacontenttype: options.datacontenttype,
      }),
    };
  }

  /**
   * 生成事件ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 创建验证装饰器用于事件处理器
   */
  static validateEventHandler<T extends CloudEvent>(
    handler: (event: T) => Promise<unknown>
  ) {
    return async (event: unknown): Promise<unknown> => {
      const validation = this.validate(event);

      if (!validation.isValid) {
        const errorMsg = validation.errors
          .map(err => `${err.field}: ${err.message}`)
          .join('; ');
        throw new Error(`CloudEvent validation failed: ${errorMsg}`);
      }

      return handler(event as T);
    };
  }
}

// 类型守卫
export function isValidCloudEvent(event: unknown): event is CloudEvent {
  return CloudEventValidator.validate(event).isValid;
}
