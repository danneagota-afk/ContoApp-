/** Analisi senza doppio conteggio. Solo flussi contanti manuali e Revolut EUR. */
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export function parseManualDate(dateStr,reference=new Date()) {
  const s=String(dateStr||'').trim().toLowerCase();
  const months=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  const full=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(full)return full[0];
  const slash=s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  const named=s.match(/^(\d{1,2})\s+([a-zàèéìòù]{3,})(?:\s+(\d{4}))?/);
  let d,m,y=reference.getFullYear(),hasYear=false;
  if(slash){d=Number(slash[1]);m=Number(slash[2])-1;if(slash[3]){y=Number(slash[3]);if(y<100)y+=2000;hasYear=true;}}
  else if(named){d=Number(named[1]);m=months.findIndex(x=>named[2].startsWith(x));if(named[3]){y=Number(named[3]);hasYear=true;}}
  else return '';
  const date=new Date(y,m,d);
  if(!(m>=0&&m<12&&date.getFullYear()===y&&date.getMonth()===m&&date.getDate()===d))return '';
  if(!hasYear && date>new Date(reference.getTime()+86400000))date.setFullYear(y-1);
  return iso(date);
}
export function toCashFlows(logs,reference=new Date()) {
  return logs.filter(l=>l&&(l.type==='add'||l.type==='sub')&&!/\b(carta|card)\b/i.test(String(l.source||'')))
    .map(l=>({source:'cash',date:parseManualDate(l.date,reference),amount:(l.type==='sub'?-1:1)*Math.abs(Number(l.val)),label:String(l.source||'Movimento manuale')}))
    .filter(l=>l.date&&Number.isFinite(l.amount)&&l.amount!==0);
}
export function toBankFlows(transactions){
  return (transactions||[]).filter(t=>String(t.currency).toUpperCase()==='EUR'&&!['PDNG','CNCL','RJCT','SCHD','HOLD'].includes(String(t.status||'').toUpperCase()))
    .map(t=>({source:'bank',date:String(t.date||'').slice(0,10),amount:Number(t.amount),label:String(t.description||'Revolut')}))
    .filter(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&Number.isFinite(t.amount)&&t.amount!==0);
}
export function calculatePeriod(view,year,month,reference=new Date()){
 const y=Number(year),m=Number(month);
 let start,end,labels=[],label='';
 if(view==='week'){
  const startDate=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate()-6);
  start=iso(startDate);end=iso(reference);
  for(let d=0;d<7;d++){const day=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+d);labels.push(day.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}));}
  label='Ultimi 7 giorni';
 }else if(view==='year'){
  start=`${y}-01-01`;end=`${y}-12-31`;labels=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];label=String(y);
 }else{
  const size=new Date(y,m+1,0).getDate();start=`${y}-${pad(m+1)}-01`;end=`${y}-${pad(m+1)}-${pad(size)}`;
  labels=Array.from({length:size},(_,i)=>String(i+1));label=`${new Date(y,m,1).toLocaleDateString('it-IT',{month:'long',year:'numeric'})}`;
 }
 const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00');
 const dayCount=Math.round((b-a)/86400000)+1;
 return {view,start,end,label,labels,dayCount};
}
export function aggregateFlows(flows,period){
 let income=0,expenses=0;const delta=Array(period.labels.length).fill(0);
 for(const t of flows){
  if(t.amount>=0)income+=t.amount;else expenses-=t.amount;
  const at=new Date(t.date+'T12:00:00');if(!Number.isFinite(at.getTime()))continue;
  let i;if(period.view==='year')i=at.getMonth();else if(period.view==='month')i=at.getDate()-1;
  else i=Math.round((at-new Date(period.start+'T12:00:00'))/86400000);
  if(i>=0&&i<delta.length)delta[i]+=t.amount;
 }
 let total=0;const points=delta.map(x=>Math.round((total+=x)*100)/100);
 return {income:Math.round(income*100)/100,expenses:Math.round(expenses*100)/100,points};
}
