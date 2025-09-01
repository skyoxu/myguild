-- 业务指标数据表初始化脚本
-- 用于支持Release Health Gate的业务指标收集
-- 运行: sqlite3 ./data/app.db < scripts/db/init-business-metrics-tables.sql

-- 用户注册事件表
CREATE TABLE IF NOT EXISTS user_registration_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    status TEXT CHECK(status IN ('success', 'failed', 'abandoned')),
    error_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    registration_type TEXT DEFAULT 'standard'
);

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_registration_created_at ON user_registration_events(created_at);
CREATE INDEX IF NOT EXISTS idx_registration_status ON user_registration_events(status);

-- 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    duration_seconds INTEGER,
    user_agent TEXT,
    platform TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_session_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_start_time ON user_sessions(start_time);

-- 游戏会话表
CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    game_mode TEXT,
    level_reached INTEGER,
    score INTEGER,
    achievements_unlocked INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_game_session_start_time ON game_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_game_session_user ON game_sessions(user_id);

-- 功能使用事件表
CREATE TABLE IF NOT EXISTS feature_usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    action_type TEXT CHECK(action_type IN ('view', 'click', 'complete', 'error')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON格式存储额外数据
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at ON feature_usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_feature_usage_name ON feature_usage_events(feature_name);

-- 应用错误表
CREATE TABLE IF NOT EXISTS application_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    error_type TEXT NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    severity TEXT CHECK(severity IN ('info', 'warning', 'error', 'fatal')),
    context TEXT, -- JSON格式的错误上下文
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_error_created_at ON application_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_error_severity ON application_errors(severity);

-- 应用事件表（用于计算错误率分母）
CREATE TABLE IF NOT EXISTS application_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON格式存储事件数据
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_app_event_created_at ON application_events(created_at);
CREATE INDEX IF NOT EXISTS idx_app_event_type ON application_events(event_type);

-- 页面加载事件表
CREATE TABLE IF NOT EXISTS page_load_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    page_name TEXT NOT NULL,
    load_time_ms INTEGER NOT NULL,
    dom_ready_ms INTEGER,
    first_paint_ms INTEGER,
    largest_contentful_paint_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    connection_type TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_page_load_created_at ON page_load_events(created_at);
CREATE INDEX IF NOT EXISTS idx_page_load_time ON page_load_events(load_time_ms);

-- 插入一些示例数据用于测试
-- 用户注册事件示例数据
INSERT OR IGNORE INTO user_registration_events (user_id, status, created_at) VALUES 
('user_001', 'success', datetime('now', '-2 hours')),
('user_002', 'success', datetime('now', '-4 hours')),
('user_003', 'failed', datetime('now', '-6 hours')),
('user_004', 'success', datetime('now', '-8 hours')),
('user_005', 'success', datetime('now', '-12 hours'));

-- 用户会话示例数据
INSERT OR IGNORE INTO user_sessions (user_id, session_id, start_time, end_time) VALUES 
('user_001', 'session_001', datetime('now', '-2 hours'), datetime('now', '-1 hours')),
('user_002', 'session_002', datetime('now', '-1 day'), datetime('now', '-1 day', '+2 hours')),
('user_003', 'session_003', datetime('now', '-2 days'), datetime('now', '-2 days', '+1 hours')),
('user_004', 'session_004', datetime('now', '-3 days'), datetime('now', '-3 days', '+3 hours')),
('user_001', 'session_005', datetime('now', '-1 hours'), datetime('now', '-30 minutes'));

-- 游戏会话示例数据
INSERT OR IGNORE INTO game_sessions (user_id, session_id, start_time, end_time, game_mode, score) VALUES 
('user_001', 'session_001', datetime('now', '-2 hours'), datetime('now', '-2 hours', '+45 minutes'), 'adventure', 1500),
('user_002', 'session_002', datetime('now', '-1 day'), datetime('now', '-1 day', '+30 minutes'), 'puzzle', 800),
('user_003', 'session_003', datetime('now', '-2 days'), datetime('now', '-2 days', '+20 minutes'), 'arcade', 2200),
('user_001', 'session_005', datetime('now', '-1 hours'), datetime('now', '-1 hours', '+25 minutes'), 'adventure', 1200);

-- 功能使用事件示例数据
INSERT OR IGNORE INTO feature_usage_events (user_id, feature_name, action_type, created_at) VALUES 
('user_001', 'new_feature_1', 'view', datetime('now', '-2 hours')),
('user_002', 'new_feature_1', 'click', datetime('now', '-4 hours')),
('user_001', 'new_feature_2', 'complete', datetime('now', '-6 hours')),
('user_003', 'new_feature_1', 'view', datetime('now', '-8 hours'));

-- 应用错误示例数据
INSERT OR IGNORE INTO application_errors (user_id, error_type, error_message, severity, created_at) VALUES 
('user_002', 'NetworkError', 'Connection timeout', 'error', datetime('now', '-30 minutes')),
('user_003', 'ValidationError', 'Invalid input format', 'warning', datetime('now', '-2 hours'));

-- 应用事件示例数据
INSERT OR IGNORE INTO application_events (user_id, event_type, event_name, created_at) VALUES 
('user_001', 'user_action', 'button_click', datetime('now', '-30 minutes')),
('user_002', 'user_action', 'page_view', datetime('now', '-45 minutes')),
('user_003', 'user_action', 'game_start', datetime('now', '-1 hours')),
('user_001', 'user_action', 'feature_usage', datetime('now', '-90 minutes')),
('user_004', 'user_action', 'settings_change', datetime('now', '-2 hours'));

-- 页面加载事件示例数据
INSERT OR IGNORE INTO page_load_events (user_id, page_name, load_time_ms, created_at) VALUES 
('user_001', 'game_lobby', 2100, datetime('now', '-30 minutes')),
('user_002', 'profile_page', 1800, datetime('now', '-45 minutes')),
('user_003', 'game_level_1', 2800, datetime('now', '-1 hours')),
('user_001', 'settings', 1200, datetime('now', '-90 minutes'));

-- 验证表创建
SELECT 'Tables created successfully:';
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_events' OR name LIKE '%_sessions';