/* Pannello Home in sola lettura: non modifica mai patrimonio, turni o attività. */
import { normalizePlanner,stats,isoDate } from './planner-core.js?v=20261020-pro-v1';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth,onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase,ref,onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
const summary=document.getElementById('home-agenda-status');
if(summary){
  const render=value=>{
    const x=stats(normalizePlanner(value),isoDate());
    const next=x.futureShifts[0];
    const shift=next?` · Prossimo turno: ${next.date.slice(8,10)}/${next.date.slice(5,7)} alle ${next.start}`:'';
    summary.textContent=`${x.dueToday} ${x.dueToday===1?'attività urgente':'attività urgenti'} · ${x.dueWeek} nei prossimi giorni${shift}`;
  };
  const app=getApps()[0]||initializeApp({apiKey:'AIzaSyDTYLxWmpTqJDsbrww39Rk7r72FC40xqkw',authDomain:'conto-corrente.firebaseapp.com',databaseURL:'https://conto-corrente-default-rtdb.europe-west1.firebasedatabase.app',projectId:'conto-corrente',storageBucket:'conto-corrente.firebasestorage.app',messagingSenderId:'138913358347',appId:'1:138913358347:web:35a016a855be2597989d0e',measurementId:'G-RRNLFRELW0'});
  onAuthStateChanged(getAuth(app),user=>{
    if(!user)return;
    let cache=null;try{cache=JSON.parse(localStorage.getItem(`contoapp.planner.local.v1.${user.uid}`)||'null');}catch{}
    render(cache);
    try{if(localStorage.getItem(`contoapp.planner.unsynced.v1.${user.uid}`)==='1')return;}catch{}
    onValue(ref(getDatabase(app),`contoapp_planner_v1/${user.uid}`),snap=>render(snap.val()),()=>render(cache));
  });
}
