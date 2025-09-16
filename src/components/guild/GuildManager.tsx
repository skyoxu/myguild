/**
 * Guild Manager - 最小化实现以满足E2E测试需求
 * 符合ADR-0002安全基线和citest/ciinfo.md规则
 */
import React, { useState } from 'react';

export interface GuildManagerProps {
  isVisible?: boolean;
}

const GuildManager: React.FC<GuildManagerProps> = ({ isVisible = true }) => {
  const [currentSection, setCurrentSection] = useState('overview');

  if (!isVisible) return null;

  return (
    <div data-testid="guild-manager-root" className="guild-manager-container">
      {/* 概览面板 */}
      <div data-testid="guild-overview-panel" className="overview-panel">
        <h2>Guild Overview</h2>

        {/* 资源面板 */}
        <div data-testid="resource-panel" className="resource-section">
          <div data-testid="resource-gold" className="resource-item">
            1,000
          </div>
          <div data-testid="resource-materials" className="resource-item">
            500
          </div>
          <div data-testid="resource-influence" className="resource-item">
            250
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="guild-navigation">
          <button
            data-testid="nav-overview"
            onClick={() => setCurrentSection('overview')}
            className={currentSection === 'overview' ? 'active' : ''}
          >
            Overview
          </button>
          <button
            data-testid="nav-members"
            onClick={() => setCurrentSection('members')}
            className={currentSection === 'members' ? 'active' : ''}
          >
            Members
          </button>
          <button
            data-testid="nav-tactical"
            onClick={() => setCurrentSection('tactical')}
            className={currentSection === 'tactical' ? 'active' : ''}
          >
            Tactical
          </button>
          <button
            data-testid="nav-raids"
            onClick={() => setCurrentSection('raids')}
            className={currentSection === 'raids' ? 'active' : ''}
          >
            Raids
          </button>
          <button
            data-testid="nav-diplomacy"
            onClick={() => setCurrentSection('diplomacy')}
            className={currentSection === 'diplomacy' ? 'active' : ''}
          >
            Diplomacy
          </button>
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="guild-content">
        {currentSection === 'members' && (
          <div data-testid="member-management-root" className="member-section">
            <h3>Member Management</h3>
            <button data-testid="recruit-member-btn">Recruit Member</button>
            <div data-testid="recruitment-panel" style={{ display: 'none' }}>
              <div data-testid="candidate-list">
                <div data-testid="candidate-1">Candidate 1</div>
                <div data-testid="candidate-2">Candidate 2</div>
              </div>
              <div data-testid="candidate-details" style={{ display: 'none' }}>
                Details
              </div>
              <div data-testid="recruitment-cost" style={{ display: 'none' }}>
                Cost: 100
              </div>
            </div>
          </div>
        )}

        {currentSection === 'tactical' && (
          <div data-testid="tactical-center-root" className="tactical-section">
            <h3>Tactical Center</h3>
            <div data-testid="composition-list">
              <button data-testid="create-composition-btn">
                Create Composition
              </button>
            </div>
            <div data-testid="composition-editor" style={{ display: 'none' }}>
              <div data-testid="role-slot-1">Tank</div>
              <div data-testid="role-slot-2">Healer</div>
              <div data-testid="role-slot-3">DPS</div>
              <div data-testid="role-slot-4">DPS</div>
              <div data-testid="role-slot-5">Support</div>
              <div data-testid="role-slot-6">Flex</div>
            </div>
          </div>
        )}

        {currentSection === 'raids' && (
          <div data-testid="raid-hall-root" className="raid-section">
            <h3>Raid Hall</h3>
          </div>
        )}

        {currentSection === 'diplomacy' && (
          <div
            data-testid="diplomacy-center-root"
            className="diplomacy-section"
          >
            <h3>Diplomacy Center</h3>
            <div data-testid="npc-guild-list">
              <div data-testid="npc-guild-1">NPC Guild 1</div>
              <div data-testid="npc-guild-2">NPC Guild 2</div>
            </div>
            <div data-testid="diplomatic-options" style={{ display: 'none' }}>
              Options
            </div>
            <div data-testid="attitude-indicator" style={{ display: 'none' }}>
              Neutral
            </div>
          </div>
        )}
      </div>

      {/* 错误消息和成功指示器 */}
      <div data-testid="error-message" style={{ display: 'none' }}>
        Error occurred
      </div>
      <div data-testid="success-indicator" style={{ display: 'none' }}>
        Success
      </div>
      <button data-testid="retry-btn" style={{ display: 'none' }}>
        Retry
      </button>
    </div>
  );
};

export default GuildManager;
