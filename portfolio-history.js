/* Storico giornaliero, separato dai saldi manuali e dai movimenti. */
export const SNAPSHOT_PATH = 'portfolio_snapshots_v1';
export function dayKey(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
export function cleanSnapshot(day, raw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !raw || typeof raw !== 'object') return null;
  const cash = Number(raw.cash), revolutEur = Number(raw.revolutEur), total = Number(raw.total);
  if (![cash, revolutEur, total].every(Number.isFinite)) return null;
  if (Math.abs((cash + revolutEur) - total) > 0.03) return null;
  return { day, cash, revolutEur, total, capturedAt: Number(raw.capturedAt) || 0 };
}
export function normalizeHistory(obj) {
  return Object.entries(obj || {})
    .map(([key, value]) => cleanSnapshot(key, value))
    .filter(Boolean)
    .sort((a, b) => a.day.localeCompare(b.day));
}
export function filterHistory(history, days, today = new Date()) {
  if (days === 'all') return history;
  const n = Number(days);
  if (![7, 30, 180, 365].includes(n)) return history;
  const threshold = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n + 1);
  const first = dayKey(threshold);
  return history.filter(point => point.day >= first);
}
export function snapshotValues(cash, bank, bankTimestamp, time = new Date()) {
  if (cash === null || cash === undefined || bank === null || bank === undefined || cash === '' || bank === '') return null;
  const a = Number(cash), b = Number(bank);
  if (![a, b].every(Number.isFinite) || !bankTimestamp || !Number.isFinite(Date.parse(bankTimestamp))) return null;
  // Never fabricate a bank balance when the session is offline or missing.
  const values = { cash: Math.round(a * 100) / 100, revolutEur: Math.round(b * 100) / 100 };
  return { ...values, total: Math.round((values.cash + values.revolutEur) * 100) / 100,
    capturedAt: time.getTime(), bankUpdatedAt: bankTimestamp, source: 'Contanti + Revolut EUR' };
}
// runTransaction must be Firebase's runTransaction; this path never mutates wallet_infinite_data.
export async function recordSnapshot(database, ref, runTransaction, cash, bank, bankTimestamp, time = new Date()) {
  const payload = snapshotValues(cash, bank, bankTimestamp, time);
  if (!payload) return false;
  const record = ref(database, `${SNAPSHOT_PATH}/${dayKey(time)}`);
  const result = await runTransaction(record, current => {
    const old = cleanSnapshot(dayKey(time), current);
    // At most one update/hour (also prevents high-frequency writes across tabs).
    if (old && payload.capturedAt - old.capturedAt < 60 * 60 * 1000) return;
    return payload;
  }, { applyLocally: false });
  return !!result.committed;
}
