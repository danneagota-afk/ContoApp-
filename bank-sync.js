/** ContoApp — dati bancari SOLTANTO in lettura. Nessuna scrittura su Firebase.
 *  Il Worker conserva i dati in cache fino a 30 minuti: non sono valori tick-by-tick.
 */
export const BANK_API = 'https://contoapp-revolut.dan-neagota.workers.dev';
export const formatEuro = value => new Intl.NumberFormat('it-IT', {style:'currency',currency:'EUR'}).format(value);

export function extractEurBalance(response) {
  if (!response || !Array.isArray(response.accounts)) {
    return { available:false, reason:'Risposta bancaria non valida.' };
  }
  const accounts = response.accounts.filter(x => x && x.account?.currency === 'EUR');
  if (!accounts.length) return { available:false, reason:'Nessun conto Revolut in EUR trovato.' };
  const alreadySeen = new Set();
  let total = 0;
  let count = 0;
  for (const entry of accounts) {
    const uid = entry.account.uid;
    const key = `${uid || entry.account.identifier || count}|EUR`;
    if (alreadySeen.has(key)) continue;
    alreadySeen.add(key);
    const balances = Array.isArray(entry.balances) ? entry.balances : [];
    // CLAV (closing available) is preferable; ITAV is an alternative available balance.
    const chosen = balances.find(b => b.type === 'CLAV' && b.currency === 'EUR') ||
      balances.find(b => b.type === 'ITAV' && b.currency === 'EUR');
    if (!chosen || chosen.amount === null || chosen.amount === undefined ||
        !Number.isFinite(Number(chosen.amount))) {
      return {available:false,reason:'Il saldo disponibile di uno dei conti EUR non è stato comunicato.'};
    }
    total += Number(chosen.amount);
    count++;
  }
  if (!count) return {available:false,reason:'Saldo EUR non disponibile.'};
  return {available:true, balance:Math.round(total*100)/100, count};
}

export function bankTransactions(response) {
  if (!response || !Array.isArray(response.accounts)) return [];
  const items = [];
  for (const entry of response.accounts) {
    for (const tx of entry.transactions || []) {
      const amount = Number(tx.amount);
      if (!Number.isFinite(amount)) continue;
      items.push({
        description: String(tx.description || 'Movimento Revolut').slice(0,220),
        date: String(tx.date || ''),
        amount,
        currency: String(tx.currency || entry.account?.currency || 'EUR'),
        account: String(entry.account?.name || 'Revolut'),
        status: String(tx.status || '')
      });
    }
  }
  return items.sort((a,b) => b.date.localeCompare(a.date)).slice(0,75);
}

export async function readRevolutBankData(idToken, fetcher=fetch) {
  if (!idToken || typeof idToken !== 'string') throw Error('Sessione scaduta: accedi nuovamente a ContoApp.');
  let response;
  try {
    response = await fetcher(`${BANK_API}/api/revolut/data`, {
      method:'GET',
      headers:{ Authorization:`Bearer ${idToken}` },
      cache:'no-store'
    });
  } catch {
    throw Error('Impossibile raggiungere Revolut. Verifica la connessione.');
  }
  let payload;
  try { payload = await response.json(); } catch { throw Error('Risposta non valida del server bancario.'); }
  if (!response.ok) {
    if (response.status===404) throw Error('Collega Revolut dalla sezione dedicata.');
    if (response.status===409) throw Error('Autorizzazione scaduta: rinnova il collegamento Revolut.');
    throw Error(typeof payload?.error === 'string' ? payload.error : `Errore bancario ${response.status}.`);
  }
  return payload;
}
