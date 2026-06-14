/* ============================================================
   CFO Cash Runway & Survival Simulator — model + UI
   Depends on: Chart.js
   Monthly 36-month cash model with working-capital engine.
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const M = 36;

  const PRESETS = {
    0:{name:'Conservative', revMult:0.80, expMult:1.10, payMult:1.00},
    1:{name:'Expected',     revMult:1.00, expMult:1.00, payMult:1.00},
    2:{name:'Aggressive growth', revMult:1.25, expMult:1.00, payMult:1.15}
  };

  const S = {
    cash:2000000, ar:1500000, credit:1000000,
    revenue:1000000, opex:650000, payroll:520000,
    growth:0.5, infl:0.3, payg:0.4, newHire:0, eventAmt:0, eventMonth:6,
    cosPct:45, dsoC:60, dsoT:45, dpoC:30, dpoT:45, dioC:45, dioT:30,
    sym:'AED ', locale:'en-AE',
    scen:1
  };

  /* ---- formatting ---- */
  function money(v){
    const a=Math.abs(v); let x=v,s='';
    if(a>=1e9){x=v/1e9;s='B';} else if(a>=1e6){x=v/1e6;s='M';} else if(a>=1e3){x=v/1e3;s='K';}
    const dp = s ? (Math.abs(x)>=100?0:1) : 0;
    return (v<0?'-':'') + S.sym + Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp}) + s;
  }
  const moneyFull = v => (v<0?'-':'') + S.sym + Math.abs(Math.round(v)).toLocaleString(S.locale);
  const lerp = (a,b,t)=>a+(b-a)*Math.min(t,1);

  /* ---- the model ---- */
  function runModel(o){
    const p = PRESETS[o.scen];
    const gm=o.growth/100, infl=o.infl/100, payg=o.payg/100, cos=o.cosPct/100;
    const R0=o.revenue*p.revMult, P0=o.payroll*p.payMult, O0=o.opex*p.expMult;
    const Inv0=o.dioC/30*cos*R0, AP0=o.dpoC/30*cos*R0;
    let nwcPrev=o.ar+Inv0-AP0;
    let cash=o.cash;
    const out={cash:[],ncf:[],rev:[],pay:[],opex:[],wc:[],minCash:Infinity,minMonth:0,breakeven:null,
               totRev:0,totPay:0,totOpex:0,totWC:0,totEvent:0};
    for(let t=1;t<=M;t++){
      const ramp=Math.min(t/12,1);
      const dso=lerp(o.dsoC,o.dsoT,ramp), dio=lerp(o.dioC,o.dioT,ramp), dpo=lerp(o.dpoC,o.dpoT,ramp);
      const rev=R0*Math.pow(1+gm,t-1);
      const pay=P0*Math.pow(1+payg,t-1)+o.newHire;
      const op=O0*Math.pow(1+infl,t-1);
      const opCash=rev-pay-op;
      const cogs=cos*rev;
      const nwc=dso/30*rev + dio/30*cogs - dpo/30*cogs;
      const dNWC=nwc-nwcPrev; nwcPrev=nwc;
      const event=(t===o.eventMonth)?o.eventAmt:0;
      const ncf=opCash-dNWC+event;
      cash+=ncf;
      out.cash.push(cash); out.ncf.push(ncf); out.rev.push(rev); out.pay.push(pay); out.opex.push(op); out.wc.push(-dNWC);
      if(cash<out.minCash){out.minCash=cash;out.minMonth=t;}
      if(out.breakeven===null && opCash>=0) out.breakeven=t;
      if(t<=12){out.totRev+=rev;out.totPay+=pay;out.totOpex+=op;out.totWC+=(-dNWC);out.totEvent+=event;}
    }
    const floor=-o.credit;
    out.runway=null;
    for(let t=1;t<=M;t++){
      if(out.cash[t-1]<floor){
        const before=(t===1)?o.cash:out.cash[t-2];
        out.runway=(t-1)+(before-floor)/(before-out.cash[t-1]); break;
      }
    }
    let min24=Infinity; for(let t=1;t<=24;t++) min24=Math.min(min24,out.cash[t-1]);
    out.funding=Math.max(0, -min24-o.credit);
    return out;
  }

  let cCash,cScen,cWf;
  function compute(){
    const exp=runModel(S);

    // KPIs
    $('kRunway').textContent = exp.runway==null ? '36 + mo' : exp.runway.toFixed(1);
    $('kRunwaySub').textContent = exp.runway==null ? 'sustainable across horizon' : 'months of liquidity';
    $('kBreakeven').textContent = exp.breakeven==null ? 'Beyond 36 mo' : 'Month '+exp.breakeven;
    $('kMinCash').textContent = money(exp.minCash);
    $('kMinCashSub').textContent = 'low point · Month '+exp.minMonth;
    $('kFunding').textContent = exp.funding<=0 ? 'None' : money(exp.funding);
    $('kFundingSub').textContent = exp.funding<=0 ? 'covered for 24 mo' : 'to sustain 24 mo';

    buildInsight(exp);
    drawCharts(exp);
    buildTable(exp);
  }

  /* ---- executive insight ---- */
  function buildInsight(exp){
    const parts=[];
    // 1 runway
    if(exp.runway==null) parts.push(`At current assumptions the business stays liquid across the full 3-year horizon — cash runway is not the binding constraint.`);
    else parts.push(`At current assumptions, cash runway is projected at <b>${exp.runway.toFixed(1)} months</b>.`);

    // 2 debtor sensitivity
    const noImp=runModel(Object.assign({},S,{dsoT:S.dsoC}));
    const rNow=exp.runway==null?M:exp.runway, rNo=noImp.runway==null?M:noImp.runway;
    const dRun=rNow-rNo;
    if(S.dsoT<S.dsoC && dRun>0.2)
      parts.push(`Tightening debtor days from <b>${S.dsoC}</b> to <b>${S.dsoT}</b> extends runway by roughly <b>${dRun.toFixed(1)} months</b> by releasing cash trapped in receivables.`);

    // 3 payroll shock
    const pay10=runModel(Object.assign({},S,{payroll:S.payroll*1.1}));
    if(pay10.runway!=null)
      parts.push(`A 10% rise in payroll without matching revenue would cut runway to about <b>${pay10.runway.toFixed(1)} months</b>.`);

    // 4 trough / funding
    if(exp.runway!=null) parts.push(`The lowest projected cash position is <b>${moneyFull(exp.minCash)}</b> in <b>Month ${exp.minMonth}</b>.`);
    if(exp.funding>0) parts.push(`To stay solvent through 24 months, approximately <b>${moneyFull(exp.funding)}</b> of additional capital would be needed beyond the existing facility.`);

    $('insBody').innerHTML = parts.join(' ');
    const flag=$('insFlag');
    if(exp.runway!=null && exp.runway<12){flag.className='ins-flag warn';flag.textContent='Runway under 12 months';}
    else if(exp.runway!=null && exp.runway<24){flag.className='ins-flag neutral';flag.textContent='Monitor closely';}
    else {flag.className='ins-flag good';flag.textContent='Liquidity resilient';}
  }

  /* ---- charts ---- */
  const GOLD='#B8932B', GOLD_BRIGHT='#D4AF37', GREY='#9a958c', GREEN='#2E8B57', RED='#C0563F', INK='#0d0d0d';
  const baseOpts=(yFmt,xLabel)=>({
    responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{
      backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',
      padding:11,cornerRadius:8,titleFont:{family:'Arial'},bodyFont:{family:'Arial'},
      callbacks:{label:c=>' '+c.dataset.label+': '+(yFmt?yFmt(c.parsed.y):c.parsed.y)}
    }},
    scales:{
      x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},maxRotation:0,autoSkip:true,maxTicksLimit:12}},
      y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt?yFmt(v):v}}
    }
  });
  const mLabels=Array.from({length:M},(_,i)=>'M'+(i+1));

  function drawCharts(exp){
    // 1. cash balance + credit floor
    const floorLine=new Array(M).fill(-S.credit);
    const cashData={labels:mLabels,datasets:[
      {label:'Cash balance',data:exp.cash,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.14)',borderWidth:3,pointRadius:0,tension:.25,fill:true,pointHoverRadius:5},
      {label:'Credit floor',data:floorLine,borderColor:RED,borderWidth:1.4,borderDash:[6,4],pointRadius:0,fill:false}
    ]};
    cCash=upd(cCash,'cCash','line',cashData,baseOpts(money));

    // 2. scenario comparison
    const c0=runModel(Object.assign({},S,{scen:0})).cash;
    const c1=runModel(Object.assign({},S,{scen:1})).cash;
    const c2=runModel(Object.assign({},S,{scen:2})).cash;
    const scenData={labels:mLabels,datasets:[
      {label:'Aggressive',data:c2,borderColor:GREEN,borderWidth:2,pointRadius:0,tension:.25,fill:false},
      {label:'Expected',data:c1,borderColor:GOLD,borderWidth:2.6,pointRadius:0,tension:.25,fill:false},
      {label:'Conservative',data:c0,borderColor:RED,borderWidth:2,pointRadius:0,tension:.25,fill:false}
    ]};
    cScen=upd(cScen,'cScen','line',scenData,baseOpts(money));

    // 3. waterfall — cumulative year 1
    const start=S.cash;
    const afterRev=start+exp.totRev+exp.totEvent;
    const afterPay=afterRev-exp.totPay;
    const afterOpex=afterPay-exp.totOpex;
    const end=afterOpex+exp.totWC;
    const wfData={labels:['Start cash','+ Revenue','– Payroll','– Opex','± Working cap.','End (M12)'],datasets:[{
      label:'',
      data:[[0,start],[start,afterRev],[afterPay,afterRev],[afterOpex,afterPay],
            exp.totWC>=0?[afterOpex,end]:[end,afterOpex],[0,end]],
      backgroundColor:[GOLD,GREEN,RED,RED, exp.totWC>=0?GREEN:RED, GOLD_BRIGHT],borderRadius:3
    }]};
    const wfOpts=baseOpts(money);
    const wfVals=[start,exp.totRev+exp.totEvent,exp.totPay,exp.totOpex,exp.totWC,end];
    wfOpts.plugins.tooltip.callbacks.label=c=>' '+moneyFull(wfVals[c.dataIndex]);
    cWf=upd(cWf,'cWf','bar',wfData,wfOpts);
  }
  function upd(ch,id,type,data,options){ if(ch){ch.data=data;ch.options=options;ch.update();return ch;} return new Chart($(id),{type,data,options}); }

  function buildTable(exp){
    const rows=[6,12,18,24,36];
    let html='';
    rows.forEach(m=>{
      const i=m-1;
      html+=`<tr><td>Month ${m}</td><td>${moneyFull(exp.rev[i])}</td>`+
            `<td class="${exp.ncf[i]>=0?'up':'down'}">${moneyFull(exp.ncf[i])}</td>`+
            `<td class="${exp.cash[i]>=0?'val':'down'}">${moneyFull(exp.cash[i])}</td></tr>`;
    });
    $('monthBody').innerHTML=html;
  }

  /* ---- wiring ---- */
  const FIELDS=['cash','ar','credit','revenue','opex','payroll','growth','infl','payg','newHire','eventAmt','eventMonth','cosPct','dsoC','dpoC','dioC'];
  const SLIDERS=['dsoT','dpoT','dioT'];
  function readInputs(){
    FIELDS.forEach(f=>{ const el=$(f); if(el){ const v=+el.value; S[f]= (f==='eventMonth')?Math.round(v||0):(isNaN(v)?0:v);} });
    SLIDERS.forEach(f=>{ S[f]=+$(f).value; const b=$(f+'val'); if(b) b.textContent=$(f).value+'d'; });
    const [sym,loc]=$('currency').value.split('|'); S.sym=sym; S.locale=loc;
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  SLIDERS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);

  function applyScenario(i){
    S.scen=i; $('scenName').textContent=PRESETS[i].name;
    [...$('scenTicks').children].forEach((s,k)=>s.classList.toggle('on',k===i));
    compute();
  }
  $('scenSlider').addEventListener('input',e=>applyScenario(+e.target.value));

  $('reset').addEventListener('click',()=>{
    Object.assign(S,{cash:2000000,ar:1500000,credit:1000000,revenue:1000000,opex:650000,payroll:520000,
      growth:0.5,infl:0.3,payg:0.4,newHire:0,eventAmt:0,eventMonth:6,cosPct:45,
      dsoC:60,dsoT:45,dpoC:30,dpoT:45,dioC:45,dioT:30,sym:'AED ',locale:'en-AE'});
    FIELDS.forEach(f=>{ if($(f)) $(f).value=S[f]; });
    SLIDERS.forEach(f=>{ $(f).value=S[f]; const b=$(f+'val'); if(b) b.textContent=S[f]+'d'; });
    $('currency').value='AED |en-AE';
    $('scenSlider').value=1; applyScenario(1);
  });

  // init slider badges
  SLIDERS.forEach(f=>{ const b=$(f+'val'); if(b) b.textContent=$(f).value+'d'; });
  applyScenario(1);
})();
