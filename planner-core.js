/* ContoApp Planner / calcoli puri, nessun accesso a denaro o banca. */
export const money = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
export function isoDate(d=new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))) return false;
  const d = new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime()) && isoDate(d) === value;
};
export function dateAfter(date, days) {
  if (!validDate(date)) return '';
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate()+days);return isoDate(d);
}
export function monthAfter(date) {
  if(!validDate(date)) return '';
  const d=new Date(`${date}T12:00:00`);
  const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return isoDate(d);
}
export function nextTaskDate(task) {
  return task?.repeat==='weekly'?dateAfter(task.due,7):task?.repeat==='monthly'?monthAfter(task.due):'';
}
export function shiftDuration(s) {
  const from=String(s?.start||''),to=String(s?.end||'');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(to))return null;
  const start=Number(from.slice(0,2))*60+Number(from.slice(3));
  let end=Number(to.slice(0,2))*60+Number(to.slice(3));
  if(end<=start)end+=1440;
  const duration=end-start;
  const pause=Number(s.breakMinutes??0);
  if(!Number.isFinite(pause)||pause<0||pause>=duration||duration>1440)return null;
  return Math.round((duration-pause)/60*100)/100;
}
export function shiftEarnings(s){const hours=shiftDuration(s),rate=Number(s?.rate);return hours===null||!Number.isFinite(rate)||rate<0||rate>10000?null:Math.round(hours*rate*100)/100;}
export function emptyPlanner(){return {version:1,tasks:[],shifts:[],settings:{rate:10}};}
export function normalizePlanner(value) {
  const source=value&&typeof value==='object'?value:{};
  const tasks=Array.isArray(source.tasks)?source.tasks.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&validDate(x.due)).slice(-500):[];
  const shifts=Array.isArray(source.shifts)?source.shifts.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&validDate(x.date)&&shiftDuration(x)!==null).slice(-500):[];
  const rate=Number(source.settings?.rate);
  return {version:1,tasks,shifts,settings:{rate:Number.isFinite(rate)&&rate>0&&rate<=10000?rate:10}};
}
export function stats(data,today=isoDate()) {
  const tasks=(data?.tasks||[]),shifts=(data?.shifts||[]),weekEnd=dateAfter(today,6);
  const pending=tasks.filter(t=>!t.done),dueToday=pending.filter(t=>t.due<=today),dueWeek=pending.filter(t=>t.due>today&&t.due<=weekEnd),completed=tasks.filter(t=>t.done).length;
  const month=today.slice(0,7),monthShifts=shifts.filter(s=>s.date.startsWith(month));
  const futureShifts=shifts.filter(s=>s.date>=today&&s.status==='planned').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  return {pending:pending.length,dueToday:dueToday.length,dueWeek:dueWeek.length,completed,monthShifts:monthShifts.length,
    monthHours:Math.round(monthShifts.reduce((n,s)=>n+(shiftDuration(s)||0),0)*100)/100,
    monthEstimate:Math.round(monthShifts.reduce((n,s)=>n+(shiftEarnings(s)||0),0)*100)/100,
    monthPaid:Math.round(monthShifts.filter(s=>s.status==='paid').reduce((n,s)=>n+(shiftEarnings(s)||0),0)*100)/100,
    futureShifts};
}
export function icsCalendar(data) {
  const escaping=t=>String(t||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c);
  const utc=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ContoApp//Agenda privata//IT','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  const dtstamp=utc(new Date());
  for(const s of data?.shifts||[]){
    if(!validDate(s.date)||shiftDuration(s)===null)continue;
    const start=new Date(`${s.date}T${s.start}:00`),end=new Date(`${s.date}T${s.end}:00`);
    if(end<=start)end.setDate(end.getDate()+1);
    out.push('BEGIN:VEVENT',`UID:${escaping(s.id)}@contoapp`,`DTSTAMP:${dtstamp}`,`DTSTART:${utc(start)}`,`DTEND:${utc(end)}`,`SUMMARY:${escaping('Turno · '+(s.place||'Lavoro'))}`,`DESCRIPTION:${escaping(`Pausa ${s.breakMinutes||0} min · Stima ${money(shiftEarnings(s))} · ${s.note||''}`)}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT30M','DESCRIPTION:Turno di lavoro tra 30 minuti','END:VALARM','END:VEVENT');
  }
  for(const t of data?.tasks||[]){
    if(!validDate(t.due)||t.done)continue;
    const next=dateAfter(t.due,1).replaceAll('-','');
    out.push('BEGIN:VEVENT',`UID:${escaping(t.id)}@contoapp`,`DTSTAMP:${dtstamp}`,`DTSTART;VALUE=DATE:${t.due.replaceAll('-','')}`,`DTEND;VALUE=DATE:${next}`,`SUMMARY:${escaping(t.title||'Attività')}`,`DESCRIPTION:${escaping((t.category||'Personale')+' · '+(t.note||''))}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-P1D','DESCRIPTION:Attività in scadenza','END:VALARM','END:VEVENT');
  }
  return out.concat('END:VCALENDAR','').join('\r\n');
}
