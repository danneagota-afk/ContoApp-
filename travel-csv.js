/* Lettura CSV Revolut 100% locale e temporanea. Nessuna trasmissione né salvataggio Firebase. */
function decodeRows(input,sep){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){if(c==='"'&&input[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
  else if(c==='"')quoted=true;
  else if(c===sep){row.push(field);field='';}
  else if(c==='\n'){row.push(field.replace(/\r$/,''));field='';if(row.some(x=>x.trim()))rows.push(row);row=[];}
  else field+=c;
 }
 row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
function dateValue(s){
 const v=String(s||'').trim();
 const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(iso)return iso[0];
 const eu=v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
 if(eu)return `${eu[3]}-${eu[2].padStart(2,'0')}-${eu[1].padStart(2,'0')}`;
 return '';
}
function numeric(v){
 const cleaned=String(v??'').trim().replace(/[€£$\s]/g,'');
 if(!cleaned)return NaN;
 const ci=cleaned.lastIndexOf(','),dt=cleaned.lastIndexOf('.');
 const n=ci>dt?cleaned.replace(/\./g,'').replace(',','.'):cleaned.replace(/,/g,'');
 return Number(n);
}
export function parseRevolutCSV(text){
 if(typeof text!=='string'||text.length>6000000)throw Error('Il file è troppo grande (limite 6 MB).');
 const first=text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0];
 const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=decodeRows(text.replace(/^\uFEFF/,''),sep);
 if(rows.length<2)return [];
 const headers=rows.shift().map(h=>h.toLowerCase().replace(/[\s_\-/]+/g,'').trim());
 const idx=(...names)=>headers.findIndex(h=>names.includes(h));
 const di=idx('completeddate','bookingdate','date','starteddate','transactiondate','data','datadicompletamento');
 const ai=idx('amount','importo','transactionamount');
 const cu=idx('currency','valuta');
 const ti=idx('description','descrizione','merchant','name','merchantname','beneficiary');
 const si=idx('state','status','stato');
 const co=idx('merchantcountry','transactioncountry','merchantlocationcountry','paesecommerciante');
 const city=idx('merchantcity','merchantlocationcity','cittàcommerciante');
 if(di<0||ai<0||cu<0)throw Error('CSV non riconosciuto: servono almeno data, importo e valuta.');
 return rows.slice(0,20000).map(v=>{
  const amount=numeric(v[ai]);const state=(v[si]||'').toUpperCase();
  return {date:dateValue(v[di]),amount,currency:String(v[cu]||'').trim().toUpperCase(),
   description:String(v[ti]||'Movimento importato').slice(0,220),status:state.includes('PENDING')?'PDNG':state.includes('REVERT')?'RJCT':'BOOK',
   country: /^[A-Z]{2}$/.test(String(v[co]||'').trim().toUpperCase())?String(v[co]).toUpperCase():'',
   city:String(v[city]||'').slice(0,70)};
 }).filter(t=>t.date&&Number.isFinite(t.amount)&&/^[A-Z]{3}$/.test(t.currency)&&t.amount!==0);
}
