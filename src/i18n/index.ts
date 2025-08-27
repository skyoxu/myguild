type Dict = Record<string, string>;
const zh: Dict = { 'app.title': '我的游戏', 'guild.create': '创建公会' };
const en: Dict = { 'app.title': 'My Game', 'guild.create': 'Create Guild' };

let current: 'zh' | 'en' = 'zh';
export function setLocale(l: 'zh' | 'en') {
  current = l;
}
export function t(key: string): string {
  return (current === 'zh' ? zh : en)[key] ?? key;
}
