/* Simulazioni esplicite, non consulenza o rendimenti garantiti. Nessun dato finanziario salvato qui. */
export function historicalMonthlyTrend(records) {
  const usable=(Array.isArray(records)?records:[]).filter(p=>p && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && Number.isFinite(Number(p.total)))
    .sort((a,b)=>a.day.localeCompare(b.day));
  if (usable.length < 4) return null;
  const first=usable[0],last=usable[usable.length-1];
  const duration=(new Date(`${last.day}T12:00:00`) - new Date(`${first.day}T12:00:00`))/86400000;
  if (!Number.isFinite(duration) || duration < 14) return null;
  const monthly=(Number(last.total)-Number(first.total))*30.4375/duration;
  if (!Number.isFinite(monthly)) return null;
  return {monthly:Math.round(monthly*100)/100,days:Math.round(duration),observations:usable.length};
}
export function forecastPatrimony(current, contribution, horizon=12) {
  const initial=Number(current),month=Number(contribution);
  if (![initial,month].every(Number.isFinite) || Math.abs(month)>1_000_000 || Math.abs(initial)>1_000_000_000) return null;
  if (![3,6,12].includes(Number(horizon))) return null;
  const spread=Math.max(50,Math.abs(month)*0.35);
  const result=[];
  for(let step=0;step<=horizon;step++) {
    const round=v=>Math.round(v*100)/100;
    result.push({month:step,prudent:round(initial+(month-spread)*step),base:round(initial+month*step),optimistic:round(initial+(month+spread)*step)});
  }
  return {initial,monthly:month,spread,points:result};
}
