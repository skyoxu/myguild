/**
 * CloudEvent 基础接口定义
 * 基于 CloudEvents v1.0 规范实现
 * https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
 */

// CloudEvent 规范版本类型 - 严格限制为字面量 '1.0'
export type CloudEventSpecVersion = '1.0';

// CloudEvent 核心接口
export interface CloudEvent<T = any> {
  /**
   * CloudEvent 规范版本 - 必需
   * 必须是字面量 "1.0" - 符合 CloudEvents v1.0 规范
   */
  readonly specversion: CloudEventSpecVersion;

  /**
   * 事件唯一标识符 - 必需
   * 在同一个事件源中必须唯一
   */
  readonly id: string;

  /**
   * 事件源标识 - 必需
   * 标识事件的产生者，必须是有效的 URI-reference
   * @format uri-reference
   * 符合 CloudEvents v1.0 规范：必须是非空的 URI-reference，推荐使用绝对 URI
   * 示例: https://github.com/cloudevents, urn:uuid:..., /cloudevents/spec/pull/123
   */
  readonly source: string;

  /**
   * 事件类型 - 必需
   * 描述事件的分类，通常使用反向域名格式
   */
  readonly type: string;

  /**
   * 事件发生时间 - 可选
   * RFC3339 格式的时间戳
   */
  readonly time?: string;

  /**
   * 事件主题 - 可选
   * 描述事件相关的主体，通常是资源标识符
   */
  readonly subject?: string;

  /**
   * 数据内容类型 - 可选
   * 描述事件数据的媒体类型，如 "application/json"
   */
  readonly datacontenttype?: string;

  /**
   * 数据模式 - 可选
   * 描述事件数据结构的URI引用
   */
  readonly dataschema?: string;

  /**
   * 事件数据 - 可选
   * 事件携带的实际数据负载
   */
  readonly data?: T;

  /**
   * 扩展属性 - 可选
   * 自定义的事件属性，属性名必须符合 CloudEvents 规范
   */
  readonly [key: string]: any;
}

// CloudEvent 构建器基类
export abstract class CloudEventBuilder<T> {
  protected _specversion: CloudEventSpecVersion = '1.0';
  protected _id?: string;
  protected _source?: string;
  protected _type?: string;
  protected _time?: string;
  protected _subject?: string;
  protected _datacontenttype?: string;
  protected _dataschema?: string;
  protected _data?: T;
  protected _extensions: Record<string, any> = {};

  /**
   * 设置事件ID
   */
  withId(id: string): this {
    this._id = id;
    return this;
  }

  /**
   * 设置事件源
   */
  withSource(source: string): this {
    this._source = source;
    return this;
  }

  /**
   * 设置事件类型
   */
  withType(type: string): this {
    this._type = type;
    return this;
  }

  /**
   * 设置事件时间
   */
  withTime(time: string | Date): this {
    this._time = time instanceof Date ? time.toISOString() : time;
    return this;
  }

  /**
   * 设置事件主题
   */
  withSubject(subject: string): this {
    this._subject = subject;
    return this;
  }

  /**
   * 设置数据内容类型
   */
  withDataContentType(contentType: string): this {
    this._datacontenttype = contentType;
    return this;
  }

  /**
   * 设置数据模式
   */
  withDataSchema(schema: string): this {
    this._dataschema = schema;
    return this;
  }

  /**
   * 设置事件数据
   */
  withData(data: T): this {
    this._data = data;
    return this;
  }

  /**
   * 添加扩展属性
   */
  withExtension(key: string, value: any): this {
    // 验证扩展属性名称符合 CloudEvents 规范
    if (!this.isValidExtensionName(key)) {
      throw new Error(`Invalid extension attribute name: ${key}`);
    }
    this._extensions[key] = value;
    return this;
  }

  /**
   * 构建 CloudEvent
   */
  build(): CloudEvent<T> {
    // 验证必需字段
    this.validateRequiredFields();

    const event: CloudEvent<T> = {
      specversion: this._specversion,
      id: this._id!,
      source: this._source!,
      type: this._type!,
      ...(this._time && { time: this._time }),
      ...(this._subject && { subject: this._subject }),
      ...(this._datacontenttype && { datacontenttype: this._datacontenttype }),
      ...(this._dataschema && { dataschema: this._dataschema }),
      ...(this._data !== undefined && { data: this._data }),
      ...this._extensions,
    };

    return event;
  }

  /**
   * 验证必需字段
   */
  protected validateRequiredFields(): void {
    if (!this._id) throw new Error('CloudEvent id is required');
    if (!this._source) throw new Error('CloudEvent source is required');
    if (!this._type) throw new Error('CloudEvent type is required');
  }

  /**
   * 验证扩展属性名称
   */
  protected isValidExtensionName(name: string): boolean {
    // CloudEvents 扩展属性名称规则：
    // - 必须是小写字母和数字
    // - 可以包含连字符，但不能以连字符开头或结尾
    // - 长度在1-20个字符之间
    const regex = /^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$/;
    return regex.test(name);
  }
}

// 通用 CloudEvent 构建器
export class GenericCloudEventBuilder<T = any> extends CloudEventBuilder<T> {
  static create<T = any>(): GenericCloudEventBuilder<T> {
    return new GenericCloudEventBuilder<T>();
  }

  /**
   * 从现有 CloudEvent 创建构建器
   */
  static fromEvent<T>(event: CloudEvent<T>): GenericCloudEventBuilder<T> {
    const builder = new GenericCloudEventBuilder<T>();

    builder._specversion = event.specversion;
    builder._id = event.id;
    builder._source = event.source;
    builder._type = event.type;

    if (event.time) builder._time = event.time;
    if (event.subject) builder._subject = event.subject;
    if (event.datacontenttype) builder._datacontenttype = event.datacontenttype;
    if (event.dataschema) builder._dataschema = event.dataschema;
    if (event.data !== undefined) builder._data = event.data;

    // 复制扩展属性
    Object.keys(event).forEach(key => {
      if (
        ![
          'specversion',
          'id',
          'source',
          'type',
          'time',
          'subject',
          'datacontenttype',
          'dataschema',
          'data',
        ].includes(key)
      ) {
        builder._extensions[key] = event[key];
      }
    });

    return builder;
  }
}

// CloudEvent 验证器
export class CloudEventValidator {
  /**
   * 验证 CloudEvent 是否符合规范
   */
  static validate<T>(event: CloudEvent<T>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证必需字段
    if (!event.specversion) {
      errors.push('specversion is required');
    } else if (event.specversion !== '1.0') {
      errors.push(
        `Invalid specversion: ${event.specversion}. CloudEvents v1.0 compliant producers MUST use "1.0"`
      );
    }

    if (!event.id) {
      errors.push('id is required');
    } else if (typeof event.id !== 'string' || event.id.trim().length === 0) {
      errors.push('id must be a non-empty string');
    }

    if (!event.source) {
      errors.push('source is required');
    } else if (
      typeof event.source !== 'string' ||
      event.source.trim().length === 0
    ) {
      errors.push('source must be a non-empty string');
    } else if (!this.isValidURIReference(event.source)) {
      errors.push(
        'source must be a valid URI-reference according to CloudEvents v1.0 specification'
      );
    }

    if (!event.type) {
      errors.push('type is required');
    } else if (
      typeof event.type !== 'string' ||
      event.type.trim().length === 0
    ) {
      errors.push('type must be a non-empty string');
    }

    // 验证可选字段格式
    if (event.time) {
      if (!this.isValidRFC3339Timestamp(event.time)) {
        errors.push('time must be a valid RFC3339 timestamp');
      }
    }

    if (event.datacontenttype) {
      if (!this.isValidMediaType(event.datacontenttype)) {
        errors.push('datacontenttype must be a valid media type');
      }
    }

    if (event.dataschema) {
      if (!this.isValidURI(event.dataschema)) {
        errors.push('dataschema must be a valid URI');
      }
    }

    // 验证扩展属性
    Object.keys(event).forEach(key => {
      if (!this.isReservedAttribute(key) && !this.isValidExtensionName(key)) {
        errors.push(`Invalid extension attribute name: ${key}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证是否为有效的 RFC3339 时间戳
   */
  private static isValidRFC3339Timestamp(timestamp: string): boolean {
    try {
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) && timestamp === date.toISOString();
    } catch {
      return false;
    }
  }

  /**
   * 验证是否为有效的媒体类型
   */
  private static isValidMediaType(mediaType: string): boolean {
    // 简化的媒体类型验证
    const regex =
      /^[a-zA-Z][a-zA-Z0-9][a-zA-Z0-9!#$&\-\^]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^]*$/;
    return regex.test(mediaType);
  }

  /**
   * 验证是否为有效的 URI
   */
  private static isValidURI(uri: string): boolean {
    try {
      new URL(uri);
      return true;
    } catch {
      // 如果不是绝对 URI，尝试作为相对 URI 验证
      return uri.trim().length > 0;
    }
  }

  /**
   * 验证是否为有效的 URI-reference (CloudEvents v1.0 规范)
   * URI-reference 包括绝对 URI 和相对 URI 引用
   */
  private static isValidURIReference(uriRef: string): boolean {
    if (!uriRef || uriRef.trim().length === 0) {
      return false;
    }

    const trimmed = uriRef.trim();

    try {
      // 尝试作为绝对 URI 解析
      new URL(trimmed);
      return true;
    } catch {
      // 如果不是绝对 URI，验证作为相对 URI-reference
      // URI-reference 规范较为复杂，这里进行基本验证
      // 不能包含空格、换行符等控制字符
      if (/[\s\n\r\t]/.test(trimmed)) {
        return false;
      }

      // 基本的相对 URI 格式检查
      // 允许路径形式 (如 /path, path/to/resource)
      // 允许 URN 形式 (如 urn:uuid:...)
      return trimmed.length > 0 && !trimmed.includes(' ');
    }
  }

  /**
   * 验证是否为保留属性
   */
  private static isReservedAttribute(name: string): boolean {
    const reserved = [
      'specversion',
      'id',
      'source',
      'type',
      'time',
      'subject',
      'datacontenttype',
      'dataschema',
      'data',
    ];
    return reserved.includes(name);
  }

  /**
   * 验证扩展属性名称
   */
  private static isValidExtensionName(name: string): boolean {
    const regex = /^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$/;
    return regex.test(name);
  }
}

// 验证结果接口
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// CloudEvent 实用工具
export class CloudEventUtils {
  /**
   * 生成唯一事件 ID
   */
  static generateId(prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return prefix
      ? `${prefix}-${timestamp}-${random}`
      : `${timestamp}-${random}`;
  }

  /**
   * 获取当前时间的 RFC3339 格式
   */
  static getCurrentTime(): string {
    return new Date().toISOString();
  }

  /**
   * 克隆 CloudEvent
   */
  static clone<T>(event: CloudEvent<T>): CloudEvent<T> {
    return JSON.parse(JSON.stringify(event));
  }

  /**
   * 比较两个 CloudEvent 是否相等
   */
  static equals<T>(event1: CloudEvent<T>, event2: CloudEvent<T>): boolean {
    return JSON.stringify(event1) === JSON.stringify(event2);
  }

  /**
   * 提取事件的元数据（不包含数据部分）
   */
  static extractMetadata<T>(event: CloudEvent<T>): Omit<CloudEvent<T>, 'data'> {
    const { data, ...metadata } = event;
    return metadata;
  }

  /**
   * 序列化 CloudEvent 为 JSON
   */
  static toJSON<T>(event: CloudEvent<T>): string {
    return JSON.stringify(event, null, 2);
  }

  /**
   * 从 JSON 反序列化 CloudEvent
   */
  static fromJSON<T>(json: string): CloudEvent<T> {
    try {
      const event = JSON.parse(json) as CloudEvent<T>;
      const validationResult = CloudEventValidator.validate(event);

      if (!validationResult.isValid) {
        throw new Error(
          `Invalid CloudEvent: ${validationResult.errors.join(', ')}`
        );
      }

      return event;
    } catch (error) {
      throw new Error(`Failed to parse CloudEvent from JSON: ${error}`);
    }
  }
}
