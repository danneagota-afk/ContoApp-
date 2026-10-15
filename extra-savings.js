/* Funzioni pure per i risparmi extra: conserva i movimenti storici, senza duplicare contanti o Revolut. */
export const roundCents = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function validMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 10_000_000 && Math.abs(Math.round(number * 100) - number * 100) < 1e-7 ? roundCents(number) : null;
}
export function normalizeExtraLogs(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(log => log && typeof log === 'object' && Number.isFinite(Number(log.val)))
    .map(log => ({...log, val: roundCents(log.val)}));
}
export function extraTotals(logs) {
  const all = normalizeExtraLogs(logs);
  const deposited = roundCents(all.reduce((s, l) => s + Math.max(0, l.val), 0));
  const withdrawn = roundCents(all.reduce((s, l) => s + Math.max(0, -l.val), 0));
  return { deposited, withdrawn, balance: roundCents(deposited - withdrawn), count: all.length };
}
export function parseExtraDay(log) {
  // Non inventare l'anno delle vecchie registrazioni che contengono solo gg/mm.
  if (/^\d{4}-\d\d-\d\d$/.test(log.dateISO || '') && !Number.isNaN(Date.parse(`${log.dateISO}T12:00:00`))) return log.dateISO;
  if (typeof log.createdAt === 'number' && Number.isFinite(log.createdAt)) return new Date(log.createdAt).toLocaleDateString('sv-SE');
  return null;
}
export function filterExtraLogs(logs, {type='all',query='',month='all'} = {}) {
  const q=String(query).trim().toLocaleLowerCase('it');
  return normalizeExtraLogs(logs).filter(l => {
    if (type==='deposits' && l.val<=0) return false;
    if (type==='withdrawals' && l.val>=0) return false;
    const day=parseExtraDay(l);
    if (month==='undated' && day!==null) return false;
    if (month!=='all' && month!=='undated' && (!day || !day.startsWith(month))) return false;
    return !q || String(l.reason || '').toLocaleLowerCase('it').includes(q) || String(l.date || '').toLowerCase().includes(q);
  });
}
export function newExtraLog(amount,reason,type='deposit',now=new Date()) {
  const money=validMoney(amount);
  if (money === null) throw Error('Inserisci un importo positivo valido (massimo due decimali).');
  const name=String(reason || '').trim().slice(0, 120);
  if (!name) throw Error('Inserisci il motivo del movimento.');
  if (!['deposit','withdrawal'].includes(type)) throw Error('Tipo di operazione non valido.');
  const day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  return {id:now.getTime()*1000+Math.floor(Math.random()*1000), val:type==='deposit'?money:-money, reason:name, date:now.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}), dateISO:day, createdAt:now.getTime()};
}
