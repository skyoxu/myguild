/**
 * 璧勪骇棰勭儹锛堣交閲忕骇锛夛細鍦ㄧ┖闂插抚/鍙?rAF 涓€愭鎵ц
 * - 鐢ㄤ簬鍦ㄨ繘鍏ユ父鎴忓墠棰勭儹灏戦噺鍏抽敭璧勬簮锛屼笉寮曞叆 Phaser 渚濊禆
 */

export interface PreheatTask {
  run: () => Promise<void> | void;
  label?: string;
}

function nextIdle(): Promise<void> {
  if (typeof (window as any).requestIdleCallback === 'function') {
    return new Promise(resolve =>
      (window as any).requestIdleCallback(() => resolve())
    );
  }
  return new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export async function runPreheatQueue(tasks: PreheatTask[], budgetMs = 12) {
  for (const t of tasks) {
    const start = performance.now();
    await t.run();
    const spent = performance.now() - start;
    // 鑻ヨ秴杩囬绠楋紝绛夊緟鍒扮┖闂插啀缁х画
    if (spent > budgetMs) {
      await nextIdle();
    }
  }
}

/**
 * 绀轰緥锛氬浘鐗囬鐑紙浠呭綋璧勬簮瀛樺湪鏃舵湁鏁堬級
 */
export function preheatImages(urls: string[]): PreheatTask[] {
  return urls.map(u => ({
    label: `img:${u}`,
    run: () =>
      new Promise<void>(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = u;
      }),
  }));
}
