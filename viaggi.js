import { requireAuth } from './auth-guard.js';
import { readRevolutBankData, bankTransactions, formatEuro } from './bank-sync.js';
import { matchSpend, countryCandidates } from './travel-data.js';
import { COUNTRY_CODES } from './country-codes.js';
import { parseRevolutCSV } from './travel-csv.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, getIdToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app=initializeApp({apiKey:'AIzaSyDTYLxWmpTqJDsbrww39Rk7r72FC40xqkw',authDomain:'conto-corrente.firebaseapp.com',databaseURL:'https://conto-corrente-default-rtdb.europe-west1.firebasedatabase.app',projectId:'conto-corrente',appId:'1:138913358347:web:35a016a855be2597989d0e'});
const gate=await requireAuth(app);
const tripsRef=ref(getDatabase(app),'travel_journeys');
const $=id=>document.getElementById(id);
const names=new Intl.DisplayNames(['it'],{type:'region'});
const countryName=code=>{try{return names.of(code)||code;}catch{return code;}};
const flag=code=>/^[A-Z]{2}$/.test(code)?String.fromCodePoint(...[...code].map(c=>c.charCodeAt(0)+127397)):'🌍';
const dateLabel=s=>{if(!s)return '—';const d=new Date(s+'T12:00:00');return Number.isFinite(d.getTime())?d.toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'—';};
const isoDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
let trips=[],transactions=[],csvTransactions=[],bankReady=false,bankMessage='Caricamento dei movimenti Revolut…',busy=false,editing=null;

const sortedCodes=[...COUNTRY_CODES].sort((a,b)=>countryName(a).localeCompare(countryName(b),'it'));
$('trip-country').append(new Option('Seleziona il paese…',''));
for(const code of sortedCodes)$('trip-country').add(new Option(`${flag(code)} ${countryName(code)}`,code));

function node(name,cls,text){const el=document.createElement(name);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function quiet(message){const p=node('p','travel-empty',message);return p;}
function effectiveTx(){
 const found=new Set(transactions.map(t=>[t.date,t.amount,t.currency,String(t.description||'').trim().toLowerCase()].join('|')));
 return transactions.concat(csvTransactions.filter(t=>!found.has([t.date,t.amount,t.currency,String(t.description||'').trim().toLowerCase()].join('|'))));
}
function sumSpent(t){return matchSpend(t,effectiveTx(),trips);}
function render(){
  const countries=new Map();
  for(const trip of trips){countries.set(trip.country,(countries.get(trip.country)||0)+1);}
  $('travel-countries').textContent=String(countries.size);
  $('travel-count').textContent=String(trips.length);
  $('travel-count-text').textContent=`${trips.length} ${trips.length===1?'tappa salvata':'tappe salvate'}`;
  const countryWrap=$('travel-country-list');countryWrap.replaceChildren();
  for(const [code,count] of [...countries].sort((a,b)=>countryName(a[0]).localeCompare(countryName(b[0]),'it'))){
    const badge=node('div','travel-country');badge.append(node('span','travel-flag',flag(code)),node('span','travel-country-name',countryName(code)),node('span','travel-country-count',`${count} ${count===1?'tappa':'tappe'}`));countryWrap.append(badge);
  }
  if(!countries.size)countryWrap.append(quiet('Non hai ancora confermato paesi visitati. Aggiungi la prima tappa per iniziare.'));
  const container=$('travel-journeys');container.replaceChildren();
  let total=0,any=false;
  for(const trip of [...trips].sort((a,b)=>b.start.localeCompare(a.start))){
    const m=sumSpent(trip);
    const row=node('article','travel-journey');
    const head=node('div','travel-journey-head');
    const icon=node('span','travel-journey-flag',flag(trip.country));
    const meta=node('div','travel-journey-meta');meta.append(node('h3','',trip.city?`${trip.city} · ${countryName(trip.country)}`:countryName(trip.country)),node('p','',`${dateLabel(trip.start)} — ${dateLabel(trip.end)}`));
    head.append(icon,meta);
    const actions=node('div','travel-journey-actions');
    const edit=node('button','','Modifica');edit.type='button';edit.setAttribute('aria-label',`Modifica tappa ${countryName(trip.country)}`);edit.onclick=()=>openDialog(trip);
    const del=node('button','travel-danger','Elimina');del.type='button';del.setAttribute('aria-label',`Elimina tappa ${countryName(trip.country)}`);del.onclick=()=>deleteTrip(trip);
    actions.append(edit,del);head.append(actions);row.append(head);
    const info=node('div','travel-trip-spend');
    if(!bankReady&&!csvTransactions.length){info.append(node('strong','','Spese Revolut non disponibili'),node('small','','Collega o aggiorna Revolut per stimare le uscite del periodo.'));}
    else if(m.state==='not-covered'){info.append(node('strong','','Non disponibili'),node('small','','Periodo fuori dalla finestra del Worker (circa 30 giorni). Importa un CSV Revolut per consultare dati storici, se disponibile.'));}
    else{
      const currencyBreakdown=Object.entries(m.currencies||{}).sort(([a],[b])=>a.localeCompare(b)).map(([currency,amount])=>{try{return new Intl.NumberFormat('it-IT',{style:'currency',currency}).format(amount);}catch{return amount+' '+currency;}}).join(' · ');
      info.append(node('strong','travel-money',currencyBreakdown||'—'),node('small','',`${m.count} addebiti nel periodo · ${m.state==='partial'?'periodo parzialmente coperto':m.state==='imported-history'?'include estratti CSV locali':'dati disponibili, non geolocalizzati'}${m.unassigned?` · ${m.unassigned} esclusi per sovrapposizione`:''}`));
      if(m.count){total+=m.amount;if(m.amount>0)any=true;}
    }
    row.append(info);
    if(trip.extra>0)row.append(node('p','travel-extra-note',`Spese aggiuntive dichiarate: ${formatEuro(trip.extra)} (non sommate automaticamente a Revolut)`));
    if(trip.note)row.append(node('p','travel-memory',trip.note));
    container.append(row);
  }
  if(!trips.length)container.append(quiet('Nessuna tappa salvata. Premi “Aggiungi una tappa”: puoi inserire anche viaggi passati.'));
  $('travel-total').textContent=(bankReady||csvTransactions.length)&&any?formatEuro(total):'—';
  $('travel-total-help').textContent=(bankReady||csvTransactions.length)?'Somma degli addebiti EUR identificati per date senza sovrapposizioni · non è una conferma del paese':'Dato disponibile dopo il collegamento bancario';
  $('travel-bank-status').textContent=bankMessage;
  const suggestions=$('travel-suggestions');suggestions.replaceChildren();
  const proposed=bankReady||csvTransactions.length?countryCandidates(effectiveTx(),trips,'IT'):[];
  if(!proposed.length){suggestions.append(quiet((bankReady||csvTransactions.length)?'Nessun paese ricavabile in modo attendibile dalle informazioni bancarie disponibili. Puoi sempre aggiungere una tappa manualmente.':'In attesa di eventuali dati geografici bancari.'));}
  for(const s of proposed){
    const suggestion=node('div','travel-suggestion');
    suggestion.append(node('span','travel-flag',flag(s.country)),node('div','',`${countryName(s.country)} · ${s.count} pagamenti, ${dateLabel(s.start)}–${dateLabel(s.end)}`));
    const b=node('button','','Verifica e aggiungi');b.onclick=()=>openDialog({country:s.country,city:s.city,start:s.start,end:s.end,note:'',extra:0});
    suggestion.append(b);suggestions.append(suggestion);
  }
}
function openDialog(trip=null){
  editing=trip?.id||null;
  $('trip-dialog-title').textContent=editing?'Modifica tappa':'Nuova tappa';
  $('trip-country').value=trip?.country||'';
  $('trip-city').value=trip?.city||'';
  $('trip-start').value=trip?.start||'';
  $('trip-end').value=trip?.end||'';
  $('trip-note').value=trip?.note||'';
  $('trip-extra').value=trip?.extra||'';
  $('trip-error').textContent='';$('trip-save').disabled=false;
  $('trip-dialog').showModal();
}
function closeDialog(){$('trip-dialog').close();}
async function deleteTrip(trip){
  if(busy||!confirm(`Eliminare la tappa “${trip.city||countryName(trip.country)}”? I dati Revolut e il patrimonio non verranno cancellati.`))return;
  busy=true;try{await set(tripsRef,trips.filter(t=>t.id!==trip.id));}catch{alert('Impossibile eliminare la tappa. Riprova.');}finally{busy=false;}
}
$('trip-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const country=$('trip-country').value,start=$('trip-start').value,end=$('trip-end').value;
  const extra=Number($('trip-extra').value||0);
  if(!COUNTRY_CODES.includes(country)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end){$('trip-error').textContent='Seleziona un paese e inserisci date valide (inizio prima della fine).';return;}
  if(!Number.isFinite(extra)||extra<0||extra>10000000){$('trip-error').textContent='Importo aggiuntivo non valido.';return;}
  const updated={id:editing||crypto.randomUUID(),country,city:$('trip-city').value.trim().slice(0,70),start,end,note:$('trip-note').value.trim().slice(0,350),extra:Math.round(extra*100)/100};
  const others=trips.filter(t=>t.id!==editing);
  if(others.length>=200){$('trip-error').textContent='Limite di 200 tappe raggiunto.';return;}
  const newList=[...others,updated];
  busy=true;$('trip-save').disabled=true;
  try{await set(tripsRef,newList);closeDialog();}catch{$('trip-error').textContent='Salvataggio non riuscito. Controlla connessione e autorizzazione Firebase.';}
  finally{busy=false;$('trip-save').disabled=false;}
});
$('new-trip').onclick=()=>openDialog();$('trip-close').onclick=closeDialog;$('trip-cancel').onclick=closeDialog;
$('trip-dialog').addEventListener('click',event=>{if(event.target===$('trip-dialog'))closeDialog();});
onValue(tripsRef,snapshot=>{const value=snapshot.val();trips=Array.isArray(value)?value.filter(t=>t&&t.id&&COUNTRY_CODES.includes(t.country)&&t.start&&t.end):[];gate.ready();render();},err=>gate.error(err));
async function refresh(){
  $('travel-refresh').disabled=true;
  try{
    const user=getAuth(app).currentUser;if(!user)throw Error('Accedi di nuovo a ContoApp.');
    const payload=await readRevolutBankData(await getIdToken(user));
    transactions=bankTransactions(payload,1500);
    bankReady=true;
    bankMessage=`Revolut: ${transactions.length} movimenti disponibili · ultimo aggiornamento ${payload.updated_at?new Date(payload.updated_at).toLocaleString('it-IT'):'non specificato'}${payload.cached?' · dati in cache':''}`;
  }catch(e){bankReady=false;transactions=[];bankMessage=`Revolut non disponibile: ${e?.message||'verifica il collegamento'}`;}
  finally{$('travel-refresh').disabled=false;render();}
}
$('travel-refresh').onclick=refresh;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
window.addEventListener('online',refresh);
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh();},5*60*1000);

$('travel-csv-input').addEventListener('change',async e=>{
 const files=[...e.target.files];let count=0;
 for(const file of files){
  try{if(file.size>6000000)throw Error('File oltre 6 MB.');
   const rows=parseRevolutCSV(await file.text());csvTransactions.push(...rows.map(row=>({...row,imported:true})));count+=rows.length;
  }catch(err){$('travel-import-status').textContent=`Non riesco a leggere ${file.name}: ${err?.message||'formato non valido'}`;}
 }
 if(count)$('travel-import-status').textContent=`${csvTransactions.length} movimenti storici caricati solo in questa sessione. Nessun file è stato inviato o salvato. Controlla possibili duplicati.`;
 e.target.value='';render();
});
$('travel-clear-csv').onclick=()=>{csvTransactions=[];$('travel-import-status').textContent='Storico CSV svuotato dal browser.';render();};
