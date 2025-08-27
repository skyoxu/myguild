import { InMemoryGuildRepo } from '../../infra/repo/memory/inmemory';
import type { Guild } from '../../shared/contracts';

export async function createGuildFlow(name: string) {
  const repo = new InMemoryGuildRepo();
  const g: Guild = await repo.create(name);
  return g;
}
