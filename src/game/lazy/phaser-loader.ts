export async function loadPhaser() {
  const phaser = await import('phaser');
  return phaser;
}

export async function loadScene<T = any>(path: string): Promise<T> {
  const mod = await import(/* @vite-ignore */ path);
  return (mod as any).default || (mod as any);
}

export async function loadPhaserAndScene<T = any>(scenePath: string) {
  const [phaser, scene] = await Promise.all([
    loadPhaser(),
    loadScene<T>(scenePath),
  ]);
  return { phaser, scene } as const;
}
