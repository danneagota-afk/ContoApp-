/** Pure client-side matching; never treats a payment as proof of presence. */
const validDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!Number.isNaN(Date.parse(s+'T12:00:00'));
export function matchSpend(trip,transactions,allTrips,reference=new Date()){
 const periodStart=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate()-30).toISOString().slice(0,10);
 if(!validDay(trip.start)||!validDay(trip.end))return {state:'invalid',amount:0,count:0,unassigned:0,currencies:{}};
 const importedRange=(transactions||[]).some(tx=>tx.imported&&tx.date>=trip.start&&tx.date<=trip.end);
 if((trip.end<periodStart&&!importedRange)||trip.start>reference.toISOString().slice(0,10))return {state:'not-covered',amount:0,count:0,unassigned:0,currencies:{}};
 const partial=trip.start<periodStart;
 let count=0,unassigned=0,amount=0;const currencies={};
 for(const tx of transactions||[]){
  if(!validDay(tx.date)||tx.date<trip.start||tx.date>trip.end||Number(tx.amount)>=0||!/^[A-Z]{3}$/.test(String(tx.currency).toUpperCase()))continue;
  if(['PDNG','CNCL','RJCT','SCHD','HOLD'].includes(String(tx.status).toUpperCase()))continue;
  const overlapping=(allTrips||[]).filter(t=>t.start<=tx.date&&t.end>=tx.date);
  if(overlapping.length!==1 || overlapping[0].id!==trip.id){unassigned++;continue;}
  if(String(tx.currency).toUpperCase()==='EUR')amount+=Math.abs(Number(tx.amount));
  const c=String(tx.currency).toUpperCase();currencies[c]=(currencies[c]||0)+Math.abs(Number(tx.amount));count++;
 }
 return {state:importedRange?'imported-history':partial?'partial':'period-only',amount:Math.round(amount*100)/100,count,unassigned,currencies};
}
export function countryCandidates(transactions,journeys=[],home='IT'){
 const groups=new Map();
 for(const tx of transactions||[]){
  const country=String(tx.country||'').toUpperCase();
  if(!/^[A-Z]{2}$/.test(country)||country===home||!validDay(tx.date)||Number(tx.amount)>=0)continue;
  if(journeys.some(t=>t.country===country&&t.start<=tx.date&&t.end>=tx.date))continue;
  const group=groups.get(country)||{country,dates:[],count:0,amountEUR:0,city:''};
  group.dates.push(tx.date);group.count++;
  if(tx.currency==='EUR')group.amountEUR+=Math.abs(Number(tx.amount)||0);
  if(!group.city&&tx.city)group.city=tx.city;
  groups.set(country,group);
 }
 return [...groups.values()].map(x=>({...x,start:x.dates.sort()[0],end:x.dates[x.dates.length-1]})).sort((a,b)=>b.count-a.count);
}
