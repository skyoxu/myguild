/**
 * 测试专用Guild仓库实现
 */

import { TestRepository } from './TestRepository';
import type {
  Guild,
  GuildId,
  IGuildRepository,
  ResourceState,
  GuildStatus,
} from '../../contracts/guild-manager-chunk-001';

export class TestGuildRepository
  extends TestRepository<Guild, GuildId>
  implements IGuildRepository
{
  async findByLevel(minLevel: number): Promise<Guild[]> {
    const allGuilds = await this.findAll();
    return allGuilds.filter(guild => guild.level >= minLevel);
  }

  async findByStatus(status: GuildStatus): Promise<Guild[]> {
    const allGuilds = await this.findAll();
    return allGuilds.filter(guild => guild.status === status);
  }

  async updateResources(id: GuildId, resources: ResourceState): Promise<void> {
    await this.update(id, { resources } as Partial<Guild>);
  }

  async incrementTurn(id: GuildId): Promise<number> {
    const guild = await this.findById(id);
    if (!guild) {
      throw new Error(`Guild with id ${id} not found`);
    }

    const newTurnNumber = guild.currentTurn + 1;
    await this.update(id, { currentTurn: newTurnNumber } as Partial<Guild>);
    return newTurnNumber;
  }
}
