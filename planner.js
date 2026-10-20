import { requireAuth } from './auth-guard.js?v=20261020-planner-v1';
import { isoDate,validDate,dateAfter,nextTaskDate,shiftDuration,shiftEarnings,emptyPlanner,normalizePlanner,stats,money,icsCalendar } from './planner-core.js?v=20261020-pro-v1';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase,ref,onValue,runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const $=id=>document.getElementById(id);
const app=initializeApp({apiKey:'AIzaSyDTYLxWmpTqJDsbrww39Rk7r72FC40xqkw',authDomain:'conto-corrente.firebaseapp.com',databaseURL:'https://conto-corrente-default-rtdb.europe-west1.firebasedatabase.app',projectId:'conto-corrente',appId:'1:138913358347:web:35a016a855be2597989d0e'});
const gate=await requireAuth(app);
// Separato da wallet_infinite_data. Questo modulo NON legge/scrive né saldi né movimenti bancari.
const {getAuth}=await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
const currentUser=getAuth(app).currentUser;
const storeKey=`contoapp.planner.local.v1.${currentUser.uid}`;
const pendingKey=`contoapp.planner.unsynced.v1.${currentUser.uid}`;
const databaseRef=ref(getDatabase(app),`contoapp_planner_v1/${currentUser.uid}`);
const today=()=>isoDate();
let state=emptyPlanner(),syncMode='connecting',working=false,taskFilter='open',taskQuery='',shiftFilter='all',selectedDate=today(),cloudUnsubscribe=null;
const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const node=(tag,cls='',content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);return el;};
const fmtDate=(s,options={day:'numeric',month:'short'})=>validDate(s)?new Date(`${s}T12:00:00`).toLocaleDateString('it-IT',options):'Data non valida';
const peek=()=>{try{return normalizePlanner(JSON.parse(localStorage.getItem(storeKey)||'null'));}catch{return emptyPlanner();}};
const cache=()=>{try{localStorage.setItem(storeKey,JSON.stringify(state));return true;}catch{return false;}};
const announce=(msg)=>{const t=$('planner-toast');t.textContent=msg;t.hidden=false;clearTimeout(announce.timer);announce.timer=setTimeout(()=>t.hidden=true,4000);};
const clean=(s,max)=>String(s||'').trim().slice(0,max);
function modeLabel(){
 const light=$('planner-sync-lamp'),status=$('planner-sync-status'),help=$('planner-sync-help');light.classList.toggle('ok',syncMode==='cloud');light.classList.toggle('local',syncMode==='local');
 if(syncMode==='cloud'){status.textContent='Salvato nel cloud';help.textContent='Agenda sincronizzata con Firebase su questo account.';}
 else if(syncMode==='local'){status.textContent='Solo su questo dispositivo';help.textContent='Firebase non autorizza il nuovo percorso oppure sei offline. Esporta il calendario come backup.';}
 else {status.textContent='Caricamento agenda…';help.textContent='Nessuna modifica al patrimonio.';}
}
function initFields(){
 $('planner-task-due').value=today();$('planner-shift-date').value=today();$('planner-month').value=today().slice(0,7);
 $('planner-date-label').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · Organizza le priorità senza perdere di vista il lavoro.';
}
function updateSummary(){
 const x=stats(state,today());
 $('planner-due').textContent=String(x.dueToday);$('planner-week').textContent=String(x.dueWeek);
 $('planner-hours').textContent=`${x.monthHours.toLocaleString('it-IT')} h`;
 $('planner-earnings').textContent=money(x.monthEstimate);
 $('planner-task-count').textContent=`${x.pending} ${x.pending===1?'aperta':'aperte'}`;
 $('planner-shifts-count').textContent=`${state.shifts.length} ${state.shifts.length===1?'turno':'turni'}`;
}
function activeDateDescription(date){
 const tasks=state.tasks.filter(t=>t.due===date&&!t.done),shifts=state.shifts.filter(s=>s.date===date);
 const notes=[`${fmtDate(date,{weekday:'long',day:'numeric',month:'long'})}: ${tasks.length} ${tasks.length===1?'attività da fare':'attività da fare'}, ${shifts.length} ${shifts.length===1?'turno':'turni'}.`];
 for(const s of shifts.slice(0,2))notes.push(`${s.start}–${s.end} ${s.place||'Lavoro'}`);
 $('planner-day-details').textContent=notes.join('  ·  ');
}
function renderWeek(){
 const wrap=$('planner-week-strip');wrap.replaceChildren();const dow=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
 const dateObj=new Date(`${today()}T12:00:00`);const dayNum=(dateObj.getDay()+6)%7;dateObj.setDate(dateObj.getDate()-dayNum);
 const start=isoDate(dateObj);
 if(selectedDate<start||selectedDate>dateAfter(start,6)) selectedDate=today();
 for(let i=0;i<7;i++){
  const date=dateAfter(start,i),day=new Date(`${date}T12:00:00`),todo=state.tasks.filter(t=>t.due===date&&!t.done).length,shift=state.shifts.filter(s=>s.date===date).length;
  const btn=node('button','planner-day'+(date===selectedDate?' active':''));btn.type='button';btn.setAttribute('aria-pressed',String(date===selectedDate));btn.setAttribute('aria-label',`${fmtDate(date,{weekday:'long',day:'numeric',month:'long'})}, ${todo} attività, ${shift} turni`);
  btn.append(node('span','',dow[day.getDay()]),node('strong','',day.getDate()),node('em','',todo+shift?`${todo+shift} impegni`:'Libero'));
  btn.onclick=()=>{selectedDate=date;renderWeek();};wrap.append(btn);
 }
 activeDateDescription(selectedDate);
}
function renderTasks(){
 const list=$('planner-task-list');list.replaceChildren();const d=today(),last=dateAfter(d,6);
 const priorities={high:0,normal:1,low:2};
 let tasks=state.tasks.filter(t=>{
  if(taskQuery&&!`${t.title} ${t.category||''}`.toLocaleLowerCase('it').includes(taskQuery))return false;
  if(taskFilter==='open')return !t.done;
  if(taskFilter==='done')return !!t.done;
  if(taskFilter==='today')return !t.done&&t.due<=d;
  if(taskFilter==='week')return !t.done&&t.due<=last;
  return true;
 }).sort((a,b)=>(Number(a.done)-Number(b.done))||a.due.localeCompare(b.due)||(priorities[a.priority]??1)-(priorities[b.priority]??1));
 if(!tasks.length){list.append(node('p','planner-empty',taskFilter==='done'?'Nessuna attività completata.':taskFilter==='open'?'Tutto sotto controllo! Non hai attività aperte.':'Nessuna attività trovata per questo filtro.'));return;}
 for(const t of tasks){
  const card=node('article','planner-item'+(t.done?' completed':''));const input=node('input','planner-item-checkbox');input.type='checkbox';input.checked=!!t.done;input.setAttribute('aria-label',(t.done?'Riapri':'Completa')+' '+t.title);input.addEventListener('change',()=>setTaskDone(t.id,input.checked));
  const details=node('div');details.append(node('div','planner-item-title',t.title||'Attività'));
  const meta=node('div','planner-item-meta');meta.append(node('span','planner-tag',t.category||'Personale'),node('span','planner-tag',fmtDate(t.due,{day:'2-digit',month:'short',year:'numeric'})));
  if(!t.done&&t.due<d)meta.append(node('span','planner-tag overdue','In ritardo'));
  if(t.done)meta.append(node('span','planner-tag done','Completata'));
  if(t.priority==='high')meta.append(node('span','planner-tag high','Priorità alta'));
  if(t.repeat==='weekly'||t.repeat==='monthly')meta.append(node('span','planner-tag',t.repeat==='weekly'?'Ogni settimana':'Ogni mese'));
  details.append(meta);
  const actions=node('div','planner-item-actions');actions.append(actionButton('Modifica',()=>editTask(t)),actionButton('Elimina',()=>removeTask(t.id),'danger'));
  details.append(actions);card.append(input,details);list.append(card);
 }
}
function actionButton(label,cb,cls=''){const b=node('button',cls,label);b.type='button';b.onclick=cb;return b;}
function renderShifts(){
 const list=$('planner-shift-list');list.replaceChildren();const chosenMonth=$('planner-month').value||today().slice(0,7),filtered=state.shifts.filter(s=>s.date.startsWith(chosenMonth));
 const totals={hours:filtered.reduce((n,s)=>n+(shiftDuration(s)||0),0),earnings:filtered.reduce((n,s)=>n+(shiftEarnings(s)||0),0),paid:filtered.filter(s=>s.status==='paid').reduce((n,s)=>n+(shiftEarnings(s)||0),0)};
 $('planner-month-count').textContent=String(filtered.length);$('planner-month-hours').textContent=`${Number(totals.hours.toFixed(2)).toLocaleString('it-IT')} h`;
 $('planner-month-value').textContent=money(totals.earnings);$('planner-month-paid').textContent=money(totals.paid);
 const shifts=filtered.filter(s=>shiftFilter==='all'||(s.status||'planned')===shiftFilter).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
 if(!shifts.length){list.append(node('p','planner-empty','Nessun turno in questo mese con il filtro selezionato.'));return;}
 for(const s of shifts){
  const card=node('article','planner-item');const mark=node('div','planner-tag',s.status==='paid'?'✓':s.status==='done'?'●':'◷');mark.style.marginTop='4px';const details=node('div');
  details.append(node('div','planner-item-title',s.place||'Lavoro'));
  const meta=node('div','planner-item-meta');meta.append(node('span','planner-tag',fmtDate(s.date,{weekday:'short',day:'numeric',month:'short'})),node('span','planner-tag',`${s.start} – ${s.end}`),node('span','planner-tag',`${shiftDuration(s)?.toLocaleString('it-IT')} ore nette`),node('span','planner-tag',`${Number(s.breakMinutes)||0} min pausa`));
  const badge=node('span','planner-tag'+(s.status==='paid'?' done':''),s.status==='paid'?'Segnato pagato':s.status==='done'?'Svolto':'Da svolgere');meta.append(badge);details.append(meta);
  const pay=node('div','planner-item-title planner-money',`Stima: ${money(shiftEarnings(s))} · ${money(s.rate)}/h`);pay.style.marginTop='9px';details.append(pay);
  if(s.note)details.append(node('p','',s.note));
  const actions=node('div','planner-item-actions');
  if(s.status!=='planned')actions.append(actionButton('Da svolgere',()=>changeShiftStatus(s.id,'planned')));
  if(s.status!=='done')actions.append(actionButton('Svolto',()=>changeShiftStatus(s.id,'done')));
  if(s.status!=='paid')actions.append(actionButton('Segna pagato',()=>changeShiftStatus(s.id,'paid')));
  actions.append(actionButton('Modifica',()=>editShift(s)),actionButton('Elimina',()=>removeShift(s.id),'danger'));
  details.append(actions);card.append(mark,details);list.append(card);
 }
}
function render(){modeLabel();updateSummary();renderWeek();renderTasks();renderShifts();}
async function mutate(modify,success){
 if(working)return;working=true;
 const original=structuredClone(state);let next;
 try {next=normalizePlanner(modify(structuredClone(state)));}
 catch(err){working=false;announce(err?.message||'Non posso salvare questo elemento.');return;}
 state=next;render();const locallySaved=cache();
 if(syncMode==='cloud'){
  try{
   const result=await runTransaction(databaseRef,current=>normalizePlanner(modify(normalizePlanner(current))),{applyLocally:false});
   if(!result.committed)throw Error('Operazione annullata');
   state=normalizePlanner(result.snapshot.val());cache();syncMode='cloud';try{localStorage.removeItem(pendingKey);}catch{}announce(success);render();
  }catch(error){syncMode='local';try{localStorage.setItem(pendingKey,'1');}catch{}if(cloudUnsubscribe){cloudUnsubscribe();cloudUnsubscribe=null;}
   announce(locallySaved?'Firebase non disponibile: modifica salvata solo qui.':'Attenzione: impossibile salvare! Esporta il calendario.');render();
  }
 }else{if(!locallySaved){state=original;announce('Salvataggio locale non disponibile.');}else announce(success+' · solo dispositivo');render();}
 working=false;
}
function setTaskDone(taskId,done){
 mutate(data=>{
  const t=data.tasks.find(x=>x.id===taskId);if(!t)return data;
  t.done=done;t.completedAt=done?new Date().toISOString():'';
  const next=done?nextTaskDate(t):'';
  if(next&&data.tasks.length<500&&!data.tasks.some(x=>x.repeatParent===t.id&&x.due===next)){
   data.tasks.push({...t,id:id(),due:next,done:false,completedAt:'',repeatParent:t.id,createdAt:new Date().toISOString()});
  }
  return data;
 },done?'Attività completata':'Attività riaperta');
}
function editTask(t){$('planner-task-id').value=t.id;$('planner-task-title').value=t.title||'';$('planner-task-due').value=t.due;$('planner-task-category').value=t.category||'Personale';$('planner-task-priority').value=t.priority||'normal';$('planner-task-repeat').value=t.repeat||'none';$('planner-task-save').textContent='Salva modifica';$('planner-task-cancel').hidden=false;$('attivita').scrollIntoView({behavior:'smooth'});$('planner-task-title').focus();}
function clearTaskForm(){$('planner-task-form').reset();$('planner-task-id').value='';$('planner-task-due').value=today();$('planner-task-save').textContent='Salva attività';$('planner-task-cancel').hidden=true;}
$('planner-task-cancel').onclick=clearTaskForm;
$('planner-task-form').addEventListener('submit',event=>{
 event.preventDefault();const title=clean($('planner-task-title').value,110),due=$('planner-task-due').value,category=$('planner-task-category').value,priority=$('planner-task-priority').value,repeat=$('planner-task-repeat').value,taskId=$('planner-task-id').value;
 if(!title||!validDate(due)){announce('Inserisci attività e data corrette.');return;}
 if(!['Lavoro','Personale','Soldi','Viaggi','Altro'].includes(category)||!['normal','high','low'].includes(priority)||!['none','weekly','monthly'].includes(repeat))return;
 const updated={title,due,category,priority,repeat};
 void mutate(data=>{if(taskId){const prev=data.tasks.find(x=>x.id===taskId);if(!prev)return data;Object.assign(prev,updated);}else{if(data.tasks.length>=500)throw Error('Massimo 500 attività. Elimina le vecchie.');data.tasks.push({...updated,id:id(),done:false,createdAt:new Date().toISOString()});}return data;},taskId?'Attività aggiornata':'Attività aggiunta');clearTaskForm();
});
function removeTask(taskId){if(!confirm('Eliminare questa attività dall’agenda?'))return;void mutate(data=>{data.tasks=data.tasks.filter(t=>t.id!==taskId);return data;},'Attività eliminata');}
function updateEstimate(){const shift={start:$('planner-shift-start').value,end:$('planner-shift-end').value,breakMinutes:Number($('planner-shift-break').value),rate:Number($('planner-shift-rate').value)};
 const hours=shiftDuration(shift),pay=shiftEarnings(shift);$('planner-shift-preview').textContent=pay===null?'—':money(pay);$('planner-shift-hours-preview').textContent=hours===null?'Orari o pausa non validi':`${hours.toLocaleString('it-IT')} ore nette · senza accredito automatico`;
}
for(const f of ['planner-shift-start','planner-shift-end','planner-shift-break','planner-shift-rate'])$(f).addEventListener('input',updateEstimate);
function editShift(s){$('planner-shift-id').value=s.id;$('planner-shift-place').value=s.place;$('planner-shift-date').value=s.date;$('planner-shift-start').value=s.start;$('planner-shift-end').value=s.end;$('planner-shift-break').value=s.breakMinutes||0;$('planner-shift-rate').value=s.rate;$('planner-shift-note').value=s.note||'';$('planner-shift-save').textContent='Salva modifica';$('planner-shift-cancel').hidden=false;updateEstimate();$('turni').scrollIntoView({behavior:'smooth'});$('planner-shift-place').focus();}
function clearShiftForm(){$('planner-shift-form').reset();$('planner-shift-id').value='';$('planner-shift-date').value=today();$('planner-shift-rate').value=state.settings.rate;$('planner-shift-save').textContent='Programma turno';$('planner-shift-cancel').hidden=true;updateEstimate();}
$('planner-shift-cancel').onclick=clearShiftForm;
$('planner-shift-form').addEventListener('submit',event=>{
 event.preventDefault();const shiftId=$('planner-shift-id').value,place=clean($('planner-shift-place').value,90),date=$('planner-shift-date').value,start=$('planner-shift-start').value,end=$('planner-shift-end').value,breakMinutes=Number($('planner-shift-break').value),rate=Number($('planner-shift-rate').value),note=clean($('planner-shift-note').value,180);
 const updated={place,date,start,end,breakMinutes,rate,note};
 if(!place||!validDate(date)||shiftDuration(updated)===null||shiftEarnings(updated)===null||rate>10000){announce('Controlla data, orario, pausa e paga.');return;}
 void mutate(data=>{if(shiftId){const prev=data.shifts.find(x=>x.id===shiftId);if(!prev)return data;Object.assign(prev,updated);}else{if(data.shifts.length>=500)throw Error('Massimo 500 turni.');data.shifts.push({...updated,id:id(),status:'planned',createdAt:new Date().toISOString()});}data.settings.rate=rate;return data;},shiftId?'Turno aggiornato':'Turno programmato');
 $('planner-month').value=date.slice(0,7);clearShiftForm();
});
function changeShiftStatus(shiftId,status){
 if(status==='paid'&&!confirm('Confermi che questo turno è stato pagato? È solo un contrassegno: NON accredita soldi sul patrimonio.'))return;
 void mutate(data=>{const s=data.shifts.find(x=>x.id===shiftId);if(s)s.status=status;return data;},status==='paid'?'Turno segnato come pagato':'Stato del turno aggiornato');
}
function removeShift(shiftId){if(!confirm('Eliminare il turno programmato? Non verrà modificato alcun movimento finanziario.'))return;void mutate(data=>{data.shifts=data.shifts.filter(s=>s.id!==shiftId);return data;},'Turno eliminato');}
$('planner-jump-today').onclick=()=>{selectedDate=today();renderWeek();};
document.querySelectorAll('[data-task-filter]').forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll('[data-task-filter]').forEach(n=>n.classList.toggle('active',n===b));renderTasks();});
$('planner-task-search').addEventListener('input',e=>{taskQuery=e.target.value.trim().toLocaleLowerCase('it');renderTasks();});
$('planner-month').onchange=renderShifts;$('planner-shift-status-filter').onchange=e=>{shiftFilter=e.target.value;renderShifts();};
function downloadText(content,filename,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('planner-backup').onclick=()=>{downloadText(JSON.stringify({app:'ContoApp',kind:'planner-backup',exportedAt:new Date().toISOString(),data:state},null,2),`ContoApp-agenda-backup-${today()}.json`,'application/json;charset=utf-8');announce('Backup Agenda esportato sul dispositivo.');};
$('planner-restore').onclick=()=>$('planner-file').click();
$('planner-file').onchange=async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{
  if(file.size>2000000)throw Error('Il backup supera 2 MB.');
  const raw=JSON.parse(await file.text());
  if(raw?.app!=='ContoApp'||raw?.kind!=='planner-backup'||!raw?.data||!Array.isArray(raw.data.tasks)||!Array.isArray(raw.data.shifts))throw Error('Non è un backup valido dell’Agenda.');
  if(raw.data.tasks.length>500||raw.data.shifts.length>500)throw Error('Troppi elementi nel backup.');
  const imported=normalizePlanner(raw.data);
  if(!confirm(`Vuoi importare ${imported.tasks.length} attività e ${imported.shifts.length} turni? Gli elementi con lo stesso ID non saranno duplicati. Il patrimonio non viene modificato.`))return;
  await mutate(current=>{
   const tasks=new Set(current.tasks.map(t=>t.id));const shifts=new Set(current.shifts.map(t=>t.id));
   current.tasks.push(...imported.tasks.filter(t=>!tasks.has(t.id)).slice(0,Math.max(0,500-current.tasks.length)));
   current.shifts.push(...imported.shifts.filter(s=>!shifts.has(s.id)).slice(0,Math.max(0,500-current.shifts.length)));
   return current;
  },'Backup importato e unito all’Agenda');
 }catch(err){announce(err?.message||'Non riesco a leggere il file.');}
};
$('planner-export-calendar').onclick=()=>{
 const content=icsCalendar(state);const blob=new Blob([content],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ContoApp-agenda-${today()}.ics`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);announce('Calendario esportato. Contiene i dettagli delle tue attività e dei tuoi turni.');
};
initFields();updateEstimate();state=peek();render();
let loaded=false;
let pendingLocal=false;try{pendingLocal=localStorage.getItem(pendingKey)==='1';}catch{}
if(pendingLocal){syncMode='local';gate.ready();render();announce('Agenda locale non sincronizzata: conserva un backup del Calendario.');}
else try{
 cloudUnsubscribe=onValue(databaseRef,snapshot=>{
  if(syncMode==='local')return;
  const data=snapshot.val();state=normalizePlanner(data);syncMode='cloud';cache();render();
  if(!loaded){loaded=true;gate.ready();clearShiftForm();}
 },err=>{
  if(syncMode==='cloud'||syncMode==='connecting'){
   syncMode='local';state=peek();render();if(!loaded){loaded=true;gate.ready();}announce('Agenda in modalità locale: controlla le autorizzazioni Firebase.');
  }
 });
}catch(err){syncMode='local';gate.ready();render();}
window.addEventListener('storage',event=>{if(event.key===storeKey&&syncMode==='local'){state=peek();render();}});
window.addEventListener('online',()=>{if(syncMode==='local'){announce('Connessione tornata: ricarica l’Agenda per riprovare a sincronizzare.');}});
