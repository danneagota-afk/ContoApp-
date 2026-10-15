/* ContoApp Experience. Local preferences only; this file never writes financial balances. */
(() => {
  'use strict';
  const THEMES = Object.freeze({blue:['Blu',' #2594ff'],violet:['Viola','#a28aff'],jade:['Verde acqua','#28d7aa'],amber:['Oro','#f4b645']});
  const THEME_KEY='contoapp.theme.v1', HOME_KEY='contoapp.homeWidgets.v1', REMINDER_KEY='contoapp.reminder.v1';
  const $ = id => document.getElementById(id);
  const read = (key, fallback=null) => { try {const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;} catch {return fallback;} };
  const save = (key, value) => { try {localStorage.setItem(key,JSON.stringify(value));return true;} catch {return false;} };
  const plain = key => {try{return localStorage.getItem(key)||'';}catch{return '';} };
  const safeMonth = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const money = value => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(value);
  const element = (tag,cls='',label='') => {const el=document.createElement(tag);if(cls)el.className=cls;if(label)el.textContent=label;return el;};

  function currentTheme(){const v=plain(THEME_KEY);return Object.hasOwn(THEMES,v)?v:'blue';}
  function setTheme(theme){if(!Object.hasOwn(THEMES,theme))return;document.documentElement.dataset.accent=theme;try{localStorage.setItem(THEME_KEY,theme);}catch{};document.querySelectorAll('.app-theme-option').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.theme===theme)));}
  function modal(title){
    const dialog=element('dialog','app-settings-dialog');
    const body=element('div','app-settings-body');
    const head=element('div','app-settings-head'),h2=element('h2','',title),close=element('button','','×');
    close.type='button';close.setAttribute('aria-label','Chiudi');close.onclick=()=>dialog.close();
    head.append(h2,close);body.append(head);dialog.append(body);
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    return {dialog,body};
  }
  function themeSettings(){
    const {dialog,body}=modal('Aspetto di ContoApp');
    body.append(element('p','','Scegli il colore che preferisci: vale per tutte le pagine su questo dispositivo e non modifica nessun dato.'));
    const grid=element('div','app-theme-grid');
    for(const [key,[name,color]] of Object.entries(THEMES)){
      const btn=element('button','app-theme-option');btn.type='button';btn.dataset.theme=key;
      btn.setAttribute('aria-pressed',String(currentTheme()===key));
      const swatch=element('span','app-theme-swatch');swatch.style.setProperty('--swatch',color.trim());
      btn.append(swatch,document.createTextNode(name));btn.onclick=()=>setTheme(key);grid.append(btn);
    }
    body.append(grid);dialog.showModal();
  }
  function initThemeControl(){
    const nav=document.querySelector('.navbar');if(!nav)return;
    const button=element('button','app-settings-trigger','⚙ Aspetto');button.type='button';button.title='Personalizza i colori';button.setAttribute('aria-label','Aspetto e colori');
    button.addEventListener('click',themeSettings);
    const privacy=nav.querySelector('.privacy-toggle');if(privacy)privacy.before(button);else nav.append(button);
    setTheme(currentTheme());
  }
  const WIDGETS=[
    {id:'patrimonio',title:'Patrimonio, contanti e carta',selector:'.total-card',required:true},
    {id:'rapidi',title:'Pulsanti rapidi 20 € e 50 €',selector:'.grid'},
    {id:'aggiunta',title:'Aggiunta rapida',selector:'.extra-box:not(.withdrawal-box):not(.extra-savings-box)'},
    {id:'prelievi',title:'Prelievo patrimonio',selector:'.withdrawal-box'},
    {id:'extra',title:'Risparmi Extra',selector:'.extra-savings-box'}
  ];
  function initHomeCustomizer(){
    if(!document.body.classList.contains('page-index'))return;
    const main=document.querySelector('#view-portafoglio > main.main');if(!main)return;
    const entries=WIDGETS.map(item=>({...item,el:main.querySelector(item.selector)})).filter(x=>x.el);
    if(entries.length<4)return;
    let config=read(HOME_KEY,{});
    const sanitize=cfg=>({order:(Array.isArray(cfg?.order)?cfg.order:[]).filter((v,i,a)=>entries.some(e=>e.id===v)&&a.indexOf(v)===i).concat(entries.map(e=>e.id).filter(id=>!(Array.isArray(cfg?.order)?cfg.order:[]).includes(id))),hidden:(Array.isArray(cfg?.hidden)?cfg.hidden:[]).filter(id=>entries.some(e=>e.id===id)&&id!=='patrimonio')});
    function apply(){
      config=sanitize(config);
      for(const id of config.order){const entry=entries.find(e=>e.id===id);if(entry){main.append(entry.el);entry.el.classList.toggle('app-widget-hidden',config.hidden.includes(id));}}
    }
    apply();
    const open=$('home-customizer-open');if(!open)return;
    open.onclick=()=>{
      const {dialog,body}=modal('Personalizza la Home');
      body.append(element('p','','Puoi nascondere le sezioni che non usi e cambiare il loro ordine. La vista del patrimonio resta visibile per sicurezza.'));
      const list=element('div','app-settings-body');list.style.padding='0';list.style.gap='8px';body.append(list);
      function refresh(){
        list.replaceChildren();config=sanitize(config);
        config.order.forEach((id,index)=>{
          const item=entries.find(entry=>entry.id===id);if(!item)return;
          const row=element('div','app-widget-row'),label=element('label');const check=element('input');
          check.type='checkbox';check.checked=!config.hidden.includes(id);check.disabled=!!item.required;
          check.onchange=()=>{config.hidden=check.checked?config.hidden.filter(x=>x!==id):[...config.hidden,id];save(HOME_KEY,config);apply();};
          label.append(check,document.createTextNode(item.title));row.append(label);
          for(const [delta,symbol,name] of [[-1,'↑','Sposta su'],[1,'↓','Sposta giù']]){
            const button=element('button','',symbol);button.type='button';button.disabled=index+delta<0||index+delta>=config.order.length;button.setAttribute('aria-label',name+' '+item.title);
            button.onclick=()=>{const next=config.order.slice(),other=index+delta;[next[index],next[other]]=[next[other],next[index]];config.order=next;save(HOME_KEY,config);apply();refresh();};row.append(button);
          }list.append(row);
        });
      }
      refresh();const reset=element('button','home-customizer-open','Ripristina disposizione originale');reset.type='button';reset.onclick=()=>{config={};save(HOME_KEY,config);apply();refresh();};body.append(reset);dialog.showModal();
    };
  }
  function initMobileNavigation(){
    const nav=document.querySelector('.nav-links');if(!nav||document.body.classList.contains('page-login'))return;
    const icons={'index.html':'⌂','risparmi.html':'◎','analisi.html':'▥','viaggi.html':'✈'};
    nav.querySelectorAll('a.nav-link').forEach(anchor=>{
      const href=(anchor.getAttribute('href')||'').split('?')[0];
      if(icons[href]&&!anchor.querySelector('.app-mobile-nav-icon')){
        const icon=element('span','app-mobile-nav-icon',icons[href]);icon.setAttribute('aria-hidden','true');anchor.prepend(icon);
      }
    });
    if($('app-mobile-more-button'))return;
    const more=element('button','app-mobile-more','Altro');more.id='app-mobile-more-button';more.type='button';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','app-mobile-more-menu');
    more.prepend(element('span','app-mobile-nav-icon','•••'));
    nav.append(more);
    const menu=element('div','app-mobile-menu');menu.id='app-mobile-more-menu';menu.hidden=true;
    [['revolut.html','💳 Revolut'],['vinted.html','🛍 Vinted']].forEach(([href,label])=>{const link=element('a','',label);link.href=href;menu.append(link);});
    document.body.append(menu);
    function closeMenu(){menu.hidden=true;more.setAttribute('aria-expanded','false');}
    more.addEventListener('click',()=>{const next=menu.hidden;menu.hidden=!next;more.setAttribute('aria-expanded',String(next));});
    document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!more.contains(event.target))closeMenu();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
    if(document.body.classList.contains('page-index')){
      const add=element('button','app-mobile-add','+');add.type='button';add.title='Nuova entrata';add.setAttribute('aria-label','Vai alla nuova entrata');
      add.onclick=()=>{const field=$('add-money-input');if(!field)return;
        const wrapper=field.closest('.extra-box');if(wrapper?.classList.contains('app-widget-hidden')){wrapper.classList.remove('app-widget-hidden');}
        field.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>field.focus({preventScroll:true}),400);
      };
      document.body.append(add);
    }
  }
  function renderGoalOptions(){
    const select=$('saving-reminder-goal');if(!select)return;
    const selection=select.value;
    const names=[...document.querySelectorAll('#goals-container .goal-main h3')].map(el=>el.textContent.trim()).filter(Boolean);
    select.replaceChildren(new Option('Risparmio generale',''));
    [...new Set(names)].slice(0,70).forEach(name=>select.add(new Option(name.slice(0,120),name.slice(0,120))));
    const current=read(REMINDER_KEY,{});
    const value=selection||current?.goal||'';
    if([...select.options].some(o=>o.value===value))select.value=value;
  }
  function initReminderForm(){
    const form=$('saving-reminder-form');if(!form)return;
    const day=$('saving-reminder-day');for(let d=1;d<=31;d++)day.add(new Option(`Giorno ${d}`,String(d)));
    function display(){
      const data=read(REMINDER_KEY);const status=$('saving-reminder-status');const clear=$('saving-reminder-clear');
      if(data?.enabled){
        status.textContent=`Ogni mese, giorno ${data.day}: ${money(data.amount)}${data.goal?' per '+data.goal:''}. La scelta è salvata su questo dispositivo.`;
        clear.hidden=false;$('saving-reminder-amount').value=data.amount;day.value=String(data.day);
        renderGoalOptions();
      }else{status.textContent='Promemoria non impostato.';clear.hidden=true;}
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();const amount=Number($('saving-reminder-amount').value),d=Number(day.value),goal=$('saving-reminder-goal').value;
      if(!Number.isFinite(amount)||amount<1||amount>1000000||!Number.isInteger(d)||d<1||d>31){alert('Inserisci un importo valido e il giorno del mese.');return;}
      const success=save(REMINDER_KEY,{enabled:true,amount:Math.round(amount*100)/100,day:d,goal,createdAt:new Date().toISOString()});
      if(!success){alert('Il browser non permette di salvare il promemoria.');return;}
      display();maybeShowReminder();
    });
    $('saving-reminder-clear').onclick=()=>{try{localStorage.removeItem(REMINDER_KEY);}catch{};display();document.querySelector('.app-reminder-alert')?.remove();};
    const list=$('goals-container');if(list){const observer=new MutationObserver(()=>renderGoalOptions());observer.observe(list,{childList:true,subtree:false});}
    display();
  }
  function maybeShowReminder(){
    const cfg=read(REMINDER_KEY);if(!cfg||!cfg.enabled||!Number.isFinite(cfg.amount)||!Number.isInteger(cfg.day))return;
    const today = new Date();
    const day=Math.min(cfg.day,new Date(today.getFullYear(),today.getMonth()+1,0).getDate());
    if(today.getDate()<day||cfg.acknowledgedMonth===safeMonth(today)||document.querySelector('.app-reminder-alert'))return;
    // Defer until DOM is available, never show on public login page.
    if(document.body.classList.contains('page-login'))return;
    const panel=element('aside','app-reminder-alert');panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
    panel.append(element('strong','','◷ È il momento di risparmiare!'));
    panel.append(element('p','',`Questo mese volevi mettere da parte ${money(cfg.amount)}${cfg.goal?' per '+cfg.goal:''}. Il denaro non viene spostato automaticamente.`));
    const actions=element('div');const link=element('a','','Vai a Risparmi');link.href='risparmi.html';
    const done=element('button','','Ho visto');done.type='button';done.onclick=()=>{
      const latest=read(REMINDER_KEY);if(latest){latest.acknowledgedMonth=safeMonth(new Date());save(REMINDER_KEY,latest);}
      panel.remove();
    };
    actions.append(link,done);panel.append(actions);document.body.append(panel);
  }
  function init(){
    initThemeControl();initHomeCustomizer();initMobileNavigation();initReminderForm();maybeShowReminder();
    window.addEventListener('storage',event=>{
      if(event.key===THEME_KEY)setTheme(currentTheme());
      if(event.key===REMINDER_KEY){document.querySelector('.app-reminder-alert')?.remove();maybeShowReminder();}
    });
    window.addEventListener('focus',maybeShowReminder);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maybeShowReminder();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
