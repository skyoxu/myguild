/**
 * 测试专用Member仓库实现
 */

import { TestRepository } from './TestRepository';
import type {
  GuildMember,
  MemberId,
  GuildId,
  IMemberRepository,
  MemberRole,
  MemberState,
  RelationshipMap,
} from '../../contracts/guild-manager-chunk-001';

export class TestMemberRepository
  extends TestRepository<GuildMember, MemberId>
  implements IMemberRepository
{
  async findByGuildId(guildId: GuildId): Promise<GuildMember[]> {
    const allMembers = await this.findAll();
    return allMembers.filter(member => member.guildId === guildId);
  }

  async findByRole(role: MemberRole): Promise<GuildMember[]> {
    const allMembers = await this.findAll();
    return allMembers.filter(member => member.role === role);
  }

  async findByState(state: MemberState): Promise<GuildMember[]> {
    const allMembers = await this.findAll();
    return allMembers.filter(member => member.currentState === state);
  }

  async updateState(id: MemberId, newState: MemberState): Promise<void> {
    await this.update(id, { currentState: newState } as Partial<GuildMember>);
  }

  async updateRelationships(
    id: MemberId,
    relationships: RelationshipMap
  ): Promise<void> {
    await this.update(id, { relationships } as Partial<GuildMember>);
  }
}
