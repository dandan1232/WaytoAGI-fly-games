export interface RecordData { stars: number; clean: number; residents: number; elapsed: number; rescues: number; height: number }
const KEY = 'karcher-flight-best-v1';
export function loadBest(): RecordData | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value || !['stars','clean','residents','elapsed','rescues','height'].every(k => Number.isFinite(value[k]) && value[k] >= 0)) return null;
    if (value.stars > 3 || value.clean > 100 || value.residents > 4) return null;
    return value;
  } catch { return null; }
}
export function saveBest(record: RecordData): { best: RecordData; saved: boolean } {
  const old = loadBest();
  const a = [record.stars, record.clean, record.residents, -record.elapsed], b = old ? [old.stars, old.clean, old.residents, -old.elapsed] : [];
  let better = !old;
  for (let i = 0; old && i < a.length; i++) { if (a[i] !== b[i]) { better = a[i] > b[i]; break; } }
  const best = better ? record : old!;
  try { localStorage.setItem(KEY, JSON.stringify(best)); return { best, saved: true }; } catch { return { best, saved: false }; }
}
