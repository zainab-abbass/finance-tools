/* ============================================================
   Customer Economics Simulator — model + UI
   Depends on: Chart.js
   Revenue & profit lifetime value, CLV:CAC, payback, with
   retention/growth economics. Business-model presets.
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const PRESETS={
    subscription:{label:'Subscription / recurring',freq:'monthly',arpc:450,gm:80,net:22,svc:12,churn:10,upsell:3,price:3,referral:4,cac:3000},
    service:{label:'Service business',freq:'quarterly',arpc:6000,gm:55,net:18,svc:18,churn:18,upsell:4,price:3,referral:6,cac:7000},
    retail:{label:'Retail',freq:'monthly',arpc:180,gm:45,net:8,svc:4,churn:28,upsell:2,price:2,referral:5,cac:200},
    healthcare:{label:'Healthcare',freq:'quarterly',arpc:1500,gm:62,net:16,svc:16,churn:12,upsell:3,price:4,referral:7,cac:2500},
    project:{label:'Project-based',freq:'annually',arpc:60000,gm:38,net:14,svc:14,churn:30,upsell:4,price:3,referral:8,cac:9000},
    custom:{label:'Custom'}
  };

  const S={
    model:'subscription', freq:'monthly',
    arpc:450, gm:80, net:22, svc:12, churn:10, upsell:3, price:3, referral:4, cac:3000,
    sym:'AED ', locale:'en-AE'
  };

  const PPY={monthly:12,quarterly:4,annually:1,onetime:1};
  const FREQ_LABEL={monthly:'month',quarterly:'quarter',annually:'year',onetime:'one-time'};

  /* ---- formatting ---- */
  function money(v){
    const a=Math.abs(v); let x=v,s='';
    if(a>=1e9){x=v/1e9;s='B';} else if(a>=1e6){x=v/1e6;s='M';} else if(a>=1e3){x=v/1e3;s='K';}
    const dp=s?(Math.abs(x)>=100?0:1):0;
    return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;
  }
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);

  /* ---- model ---- */
  function runModel(o){
    const oneTime=o.freq==='onetime';
    const annualRev=o.arpc*PPY[o.freq];
    const c=o.churn/100, g=(o.upsell+o.price)/100, refMult=1+o.referral/100;
    const H=oneTime?1:15;
    const contribM=Math.max(0,(o.gm-o.svc))/100, netM=o.net/100;
    let revLTV=0, cum=0; const cumRev=[],cumProf=[];
    for(let t=1;t<=H;t++){
      const rev_t=annualRev*Math.pow(1+(oneTime?0:g),t-1);
      const surv=oneTime?1:Math.pow(1-c,t-1);
      cum+=rev_t*surv; revLTV+=rev_t*surv;
      if(t<=5){cumRev.push(cum*refMult); cumProf.push(cum*netM*refMult);}
    }
    while(cumRev.length<5){cumRev.push(cumRev[cumRev.length-1]); cumProf.push(cumProf[cumProf.length-1]);}
    revLTV*=refMult;
    const profLTV=revLTV*netM;
    const monthlyContrib=annualRev*contribM/12;
    const payback=monthlyContrib>0?o.cac/monthlyContrib:null;
    const ratio=o.cac>0?profLTV/o.cac:null;
    const annualVal=annualRev*netM;
    return {annualRev,revLTV,profLTV,payback,ratio,annualVal,cumRev,cumProf,lifeyrs:oneTime?1:(c>0?1/c:99)};
  }

  let cValue,cChurn,cCac;
  function compute(){
    const r=runModel(S);
    $('kRevLTV').textContent=money(r.revLTV);
    $('kProfLTV').textContent=money(r.profLTV);
    $('kRatio').textContent=r.ratio==null?'—':r.ratio.toFixed(1)+'x';
    $('kPayback').textContent=r.payback==null?'—':r.payback.toFixed(1);
    $('kAnnual').textContent=money(r.annualVal);

    // retention impact: value gained per 1-point churn reduction
    const lower=runModel(Object.assign({},S,{churn:Math.max(0,S.churn-1)}));
    const ret=lower.profLTV-r.profLTV;
    $('kRetention').textContent=money(ret);

    buildInsight(r);
    drawCharts(r);
    buildTable(r);
  }

  function buildInsight(r){
    const parts=[];
    parts.push(`Each customer generates <b>${moneyFull(r.revLTV)}</b> in lifetime revenue and <b>${moneyFull(r.profLTV)}</b> in lifetime profit.`);
    if(S.freq!=='onetime' && S.churn>2){
      const d=runModel(Object.assign({},S,{churn:S.churn-2}));
      const lift=(d.profLTV/r.profLTV-1)*100;
      if(lift>0.5) parts.push(`Reducing churn from <b>${S.churn}%</b> to <b>${(S.churn-2)}%</b> would increase customer value by about <b>${lift.toFixed(0)}%</b>.`);
    }
    if(r.ratio!=null){
      const tag = r.ratio>=5?'strong':(r.ratio>=3?'healthy':(r.ratio>=1?'thin but positive':'unprofitable'));
      parts.push(`The current Profit LTV : CAC ratio is <b>${r.ratio.toFixed(1)}x</b>, indicating <b>${tag}</b> acquisition economics.`);
    }
    if(S.freq!=='onetime'){
      const pr=runModel(Object.assign({},S,{price:S.price+5}));
      parts.push(`Adding 5 points to the annual price increase would lift lifetime revenue value to <b>${moneyFull(pr.revLTV)}</b>.`);
    }
    if(r.payback!=null) parts.push(`Acquisition cost is recovered in roughly <b>${r.payback.toFixed(1)} months</b>.`);
    $('insBody').innerHTML=parts.join(' ');
    const f=$('insFlag');
    if(r.ratio==null){f.className='ins-flag neutral';f.textContent='Set a CAC';}
    else if(r.ratio>=3){f.className='ins-flag good';f.textContent='Healthy unit economics';}
    else if(r.ratio>=1){f.className='ins-flag neutral';f.textContent='Acceptable — watch CAC';}
    else {f.className='ins-flag warn';f.textContent='CAC exceeds value';}
  }

  /* ---- charts ---- */
  const GOLD='#B8932B', GOLD_BRIGHT='#D4AF37', GREEN='#2E8B57', RED='#C0563F', GREY='#9a958c', INK='#0d0d0d';
  const baseOpts=(yFmt)=>({
    responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{
      backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',
      padding:11,cornerRadius:8,titleFont:{family:'Arial'},bodyFont:{family:'Arial'},
      callbacks:{label:c=>' '+c.dataset.label+': '+(yFmt?yFmt(c.parsed.y):c.parsed.y)}
    }},
    scales:{
      x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10}}},
      y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt?yFmt(v):v}}
    }
  });

  function drawCharts(r){
    // 1. cumulative value over time (rev + profit)
    const yl=['Year 1','Year 2','Year 3','Year 4','Year 5'];
    const valData={labels:yl,datasets:[
      {label:'Cumulative revenue',data:r.cumRev,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:3,pointBackgroundColor:GOLD,tension:.25,fill:true},
      {label:'Cumulative profit',data:r.cumProf,borderColor:GREEN,backgroundColor:'transparent',borderWidth:2.4,pointRadius:3,pointBackgroundColor:GREEN,tension:.25,fill:false}
    ]};
    cValue=upd(cValue,'cValue','line',valData,baseOpts(money));

    // 2. churn sensitivity (profit LTV at 5/10/15%)
    const ch=[5,10,15].map(x=>runModel(Object.assign({},S,{churn:x})).profLTV);
    const churnData={labels:['5% churn','10% churn','15% churn'],datasets:[
      {label:'Profit LTV',data:ch,backgroundColor:[GREEN,GOLD,RED],borderRadius:5}
    ]};
    cChurn=upd(cChurn,'cChurn','bar',churnData,baseOpts(money));

    // 3. CAC vs CLV
    const cacData={labels:['CAC','Profit LTV'],datasets:[
      {label:'',data:[S.cac,r.profLTV],backgroundColor:[RED,GOLD],borderRadius:5}
    ]};
    const o3=baseOpts(money); o3.plugins.tooltip.callbacks.label=c=>' '+moneyFull(c.parsed.y);
    cCac=upd(cCac,'cCac','bar',cacData,o3);
  }
  function upd(ch,id,type,data,options){ if(ch){ch.data=data;ch.options=options;ch.update();return ch;} return new Chart($(id),{type,data,options}); }

  function buildTable(r){
    let h='';
    for(let i=0;i<5;i++){
      const yr=r.cumRev[i], yp=r.cumProf[i];
      h+=`<tr><td>Year ${i+1}</td><td class="val">${moneyFull(yr)}</td><td>${moneyFull(yp)}</td></tr>`;
    }
    $('yearBody').innerHTML=h;
  }

  /* ---- wiring ---- */
  const FIELDS=['arpc','gm','net','svc','upsell','price','referral','cac'];
  function syncFields(){
    FIELDS.forEach(f=>{ if($(f)) $(f).value=S[f]; });
    $('churn').value=S.churn;
    $('lifespan').value=(S.churn>0?(100/S.churn).toFixed(1):'');
    [...$('freqSeg').children].forEach(b=>b.classList.toggle('active',b.dataset.f===S.freq));
    $('curSym').textContent=S.sym.trim()||S.sym; fitPrefix();
  }
  function readFields(){
    FIELDS.forEach(f=>{ const el=$(f); if(el){ const v=+el.value; S[f]=isNaN(v)?0:v; } });
    const [sym,loc]=$('currency').value.split('|'); S.sym=sym; S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readFields));
  $('currency').addEventListener('input',readFields);

  // churn <-> lifespan two-way
  $('churn').addEventListener('input',()=>{ S.churn=Math.max(0,+$('churn').value||0); $('lifespan').value=(S.churn>0?(100/S.churn).toFixed(1):''); compute(); });
  $('lifespan').addEventListener('input',()=>{ const L=+$('lifespan').value||0; S.churn=L>0?+(100/L).toFixed(2):0; $('churn').value=S.churn; compute(); });

  // frequency
  $('freqSeg').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return;
    [...$('freqSeg').children].forEach(x=>x.classList.remove('active')); b.classList.add('active');
    S.freq=b.dataset.f; compute(); });

  // model chips
  $('modelChips').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return;
    [...$('modelChips').children].forEach(x=>x.classList.remove('active')); b.classList.add('active');
    S.model=b.dataset.model;
    const p=PRESETS[S.model];
    if(S.model!=='custom'){ Object.assign(S,{freq:p.freq,arpc:p.arpc,gm:p.gm,net:p.net,svc:p.svc,churn:p.churn,upsell:p.upsell,price:p.price,referral:p.referral,cac:p.cac}); syncFields(); }
    compute();
  });

  $('reset').addEventListener('click',()=>{
    Object.assign(S,{model:'subscription',freq:'monthly',arpc:450,gm:80,net:22,svc:12,churn:10,upsell:3,price:3,referral:4,cac:3000,sym:'AED ',locale:'en-AE'});
    $('currency').value='AED |en-AE';
    [...$('modelChips').children].forEach(x=>x.classList.toggle('active',x.dataset.model==='subscription'));
    syncFields(); compute();
  });

  syncFields(); compute(); fitPrefix();
})();
