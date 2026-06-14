/* ============================================================
   EBITDA Scenario Planning Tool — model + UI
   Depends on: Chart.js
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const S={
    rev:10000000, gm:55, pay:2800000, opex:700000, fixed:200000,
    revGrowth:6, pricing:3, customer:4, newStream:0,
    payg:6, rent:4, infl:3, mkt:5, tech:5,
    tg:{hire:false,loc:false,svc:false,invest:false,out:false,cut:false},
    hireAmt:300000, locRev:1500000, svcRev:800000, investAmt:400000, outAmt:600000, cutAmt:500000,
    targetMargin:25, scen:1,
    sym:'AED ', locale:'en-AE'
  };

  const SCEN={0:'Conservative',1:'Expected',2:'Aggressive'};

  /* ---- formatting ---- */
  function money(v){
    const a=Math.abs(v); let x=v,s='';
    if(a>=1e9){x=v/1e9;s='B';} else if(a>=1e6){x=v/1e6;s='M';} else if(a>=1e3){x=v/1e3;s='K';}
    const dp=s?(Math.abs(x)>=100?0:1):0;
    return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;
  }
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);

  /* ---- scenario adjustment ---- */
  function scenInputs(scen){
    const o=Object.assign({},S);
    if(scen===0){ o.revGrowth-=8; o.customer-=3; o.pricing=Math.max(0,o.pricing-1); o.payg+=2; o.infl+=1; o.rent+=1; }
    else if(scen===2){ o.revGrowth+=8; o.customer+=3; o.pricing+=1; o.payg=Math.max(0,o.payg-1); }
    return o;
  }

  /* ---- model ---- */
  function future(o){
    const GM=o.gm/100;
    const vol=(o.revGrowth+o.customer)/100, price=o.pricing/100;
    const tg=o.tg;
    const strat=(tg.loc?o.locRev:0)+(tg.svc?o.svcRev:0);
    const addRev=(o.newStream||0)+strat;
    const Rev=o.rev*(1+vol)*(1+price)+addRev;
    const COGS=o.rev*(1-GM)*(1+vol)+addRev*(1-GM);
    const GP=Rev-COGS;
    const Pay=o.pay*(1+o.payg/100)+(tg.hire?o.hireAmt:0)-(tg.out?o.outAmt:0)-(tg.cut?o.cutAmt:0);
    const Opex=o.opex*(0.5*(1+o.infl/100)+0.3*(1+o.mkt/100)+0.2*(1+o.tech/100))
               +(tg.out?o.outAmt*0.7:0)-(tg.invest?o.investAmt*0.3:0)+(tg.loc?o.locRev*0.2:0);
    const Fixed=o.fixed*(1+o.rent/100);
    const EBITDA=GP-Pay-Opex-Fixed;
    return {Rev,COGS,GP,Pay,Opex,Fixed,EBITDA,margin:Rev>0?EBITDA/Rev*100:0,vol,price,addRev};
  }
  function current(){
    const o=Object.assign({},S,{revGrowth:0,pricing:0,customer:0,newStream:0,payg:0,rent:0,infl:0,mkt:0,tech:0,
      tg:{hire:false,loc:false,svc:false,invest:false,out:false,cut:false}});
    return future(o);
  }

  let cBridge,cScen,cTrend;
  function compute(){
    const cur=current();
    const o=scenInputs(S.scen);
    const fut=future(o);

    $('kCurEbitda').textContent=money(cur.EBITDA);
    $('kFutEbitda').textContent=money(fut.EBITDA);
    const chg=cur.EBITDA!==0?(fut.EBITDA/cur.EBITDA-1)*100:0;
    $('kChange').textContent=(chg>=0?'+':'')+chg.toFixed(0)+'%';
    $('kFutMargin').textContent=fut.margin.toFixed(1)+'%';
    $('kFutMarginSub').textContent='from '+cur.margin.toFixed(1)+'% current';

    buildLevers(cur);
    buildRevRequired(fut);
    buildCostReq(cur);
    buildScenarioTable();
    buildInsight(cur,fut);
    drawBridge(cur,fut,o);
    drawScenario();
    drawTrend(cur,fut);
  }

  /* ---- levers ranking ---- */
  function levers(cur){
    const R=S.rev,GM=S.gm/100;
    return [
      ['Increase prices by 5%', R*0.05],
      ['Grow revenue by 10%',  R*0.10*GM],
      ['Reduce payroll by 10%', S.pay*0.10],
      ['Cut operating expenses 10%', S.opex*0.10],
      ['Reduce fixed costs 15%', S.fixed*0.15]
    ].sort((a,b)=>b[1]-a[1]);
  }
  function buildLevers(cur){
    const L=levers(cur);
    $('topLever').textContent=L[0][0];
    $('topLeverVal').textContent='+'+moneyFull(L[0][1]);
    $('leverBody').innerHTML=L.map(l=>`<tr><td>${l[0]}</td><td class="val">+${moneyFull(l[1])}</td></tr>`).join('');
  }

  /* ---- revenue required for target margins ---- */
  function buildRevRequired(fut){
    const GM=S.gm/100, F=fut.Pay+fut.Opex+fut.Fixed;
    $('revReqBody').innerHTML=[20,25,30].map(m=>{
      const t=m/100;
      const req= GM>t ? F/(GM-t) : null;
      return `<tr><td>${m}% EBITDA margin</td><td class="val">${req==null?'n/a at this gross margin':moneyFull(req)}</td></tr>`;
    }).join('');
  }

  /* ---- cost reduction / revenue increase for target ---- */
  function buildCostReq(cur){
    const t=S.targetMargin/100, GM=S.gm/100;
    const targetEB=t*S.rev, gap=targetEB-cur.EBITDA;
    let txt;
    if(gap<=0) txt=`You already exceed a ${S.targetMargin}% EBITDA margin at current revenue.`;
    else txt=`To reach <b>${S.targetMargin}% EBITDA</b> at current revenue, either reduce costs by <b>${moneyFull(gap)}</b> or grow revenue by <b>${moneyFull(gap/GM)}</b>.`;
    $('costReq').innerHTML=txt;
  }

  /* ---- scenario comparison ---- */
  function buildScenarioTable(){
    const rows=[0,1,2].map(s=>{ const f=future(scenInputs(s)); return {name:SCEN[s],f}; });
    $('scenBody').innerHTML=rows.map(r=>
      `<tr><td>${r.name}</td><td>${money(r.f.Rev)}</td><td class="val">${money(r.f.EBITDA)}</td>`+
      `<td>${r.f.margin.toFixed(1)}%</td><td>${money(r.f.EBITDA)}</td></tr>`).join('');
  }

  /* ---- insight ---- */
  function buildInsight(cur,fut){
    const parts=[];
    const dir = fut.margin>=cur.margin?'improves':'compresses';
    parts.push(`Revenue growth of <b>${(S.revGrowth+S.customer)}%</b> with payroll growth of <b>${S.payg}%</b> ${dir} EBITDA margin from <b>${cur.margin.toFixed(1)}%</b> to <b>${fut.margin.toFixed(1)}%</b>.`);
    const payPct=S.pay/S.rev*100;
    const costs=[['Payroll',S.pay],['Operating expenses',S.opex],['Fixed costs',S.fixed]].sort((a,b)=>b[1]-a[1]);
    if(costs[0][0]==='Payroll') parts.push(`Payroll consumes <b>${payPct.toFixed(0)}%</b> of revenue and is the largest cost line — the biggest single margin lever.`);
    // price vs payroll equivalence
    const priceImpact=S.rev*0.03;
    parts.push(`A 3% price increase delivers about <b>${moneyFull(priceImpact)}</b> of EBITDA — equivalent to cutting payroll by the same amount.`);
    if(S.tg.invest) parts.push(`The technology investment reduces EBITDA in Year 1 but lifts profitability from Year 2 as efficiency savings come through.`);
    const L=levers(cur);
    parts.push(`Highest-impact action: <b>${L[0][0].toLowerCase()}</b>, worth about <b>+${moneyFull(L[0][1])}</b>.`);
    $('insBody').innerHTML=parts.join(' ');
    const f=$('insFlag');
    if(fut.margin>cur.margin+0.5){f.className='ins-flag good';f.textContent='Margin expanding';}
    else if(fut.margin<cur.margin-0.5){f.className='ins-flag warn';f.textContent='Margin compressing';}
    else {f.className='ins-flag neutral';f.textContent='Margin stable';}
  }

  /* ---- charts ---- */
  const GOLD='#B8932B', GOLD_BRIGHT='#D4AF37', GREEN='#2E8B57', RED='#C0563F', GREY='#9a958c', INK='#0d0d0d';
  const baseOpts=(yFmt)=>({
    responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:11,cornerRadius:8,titleFont:{family:'Arial'},bodyFont:{family:'Arial'},callbacks:{label:c=>' '+(c.dataset.label?c.dataset.label+': ':'')+(yFmt?yFmt(c.parsed.y):c.parsed.y)}}},
    scales:{x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},maxRotation:0,autoSkip:true,maxTicksLimit:13}},
            y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt?yFmt(v):v}}}
  });

  function drawBridge(cur,fut,o){
    const volD=S.rev*(S.gm/100)*fut.vol;
    const priceD=S.rev*(1+fut.vol)*fut.price;
    const addD=fut.addRev*(S.gm/100);
    const payD=-(fut.Pay-cur.Pay);
    const costD=-((fut.Opex-cur.Opex)+(fut.Fixed-cur.Fixed));
    const steps=[['Current',cur.EBITDA,'base'],['+ Revenue',volD,'up'],['+ Price',priceD,'up']];
    if(Math.abs(addD)>1) steps.push(['+ New rev',addD,'up']);
    steps.push(['– Payroll',payD,'down'],['– Costs',costD,'down'],['Future',fut.EBITDA,'base']);
    const labels=[], data=[], colors=[]; let run=0;
    steps.forEach(([lab,val,type])=>{
      labels.push(lab);
      if(type==='base'){ data.push([0,val]); colors.push(lab==='Current'?GOLD:GOLD_BRIGHT); run=val; }
      else { const start=run, end=run+val; data.push(val>=0?[start,end]:[end,start]); colors.push(val>=0?GREEN:RED); run=end; }
    });
    const o2=baseOpts(money);
    o2.plugins.tooltip.callbacks.label=c=>{ const v=steps[c.dataIndex][1]; return ' '+((steps[c.dataIndex][2]==='base')?moneyFull(v):((v>=0?'+':'')+moneyFull(v))); };
    cBridge=upd(cBridge,'cBridge','bar',{labels,datasets:[{data,backgroundColor:colors,borderRadius:3}]},o2);
  }
  function drawScenario(){
    const rows=[0,1,2].map(s=>future(scenInputs(s)));
    cScen=upd(cScen,'cScen','bar',{labels:['Conservative','Expected','Aggressive'],datasets:[
      {label:'EBITDA',data:rows.map(r=>r.EBITDA),backgroundColor:[RED,GOLD,GREEN],borderRadius:5}
    ]},baseOpts(money));
  }
  function drawTrend(cur,fut){
    const labels=Array.from({length:24},(_,i)=>'M'+(i+1));
    const c0=cur.EBITDA/12, c1=fut.EBITDA/12;
    const data=[];
    for(let m=1;m<=24;m++){
      let v=c0+(c1-c0)*(m/24);
      if(S.tg.invest && m<=12) v-=S.investAmt/12; // year-1 investment drag
      data.push(v*12); // annualised run-rate
    }
    cTrend=upd(cTrend,'cTrend','line',{labels,datasets:[
      {label:'EBITDA run-rate',data,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:0,tension:.25,fill:true}
    ]},baseOpts(money));
  }
  function upd(ch,id,type,data,options){ if(ch){ch.data=data;ch.options=options;ch.update();return ch;} return new Chart($(id),{type,data,options}); }

  /* ---- wiring ---- */
  const FIELDS=['rev','gm','pay','opex','fixed','revGrowth','pricing','customer','newStream','payg','rent','infl','mkt','tech','targetMargin','hireAmt','locRev','svcRev','investAmt','outAmt','cutAmt'];
  function readInputs(){
    FIELDS.forEach(f=>{ const el=$(f); if(el){ const v=+el.value; S[f]=isNaN(v)?0:v; } });
    $('revGrowthVal').textContent=(S.revGrowth>=0?'+':'')+S.revGrowth+'%';
    const [sym,loc]=$('currency').value.split('|'); S.sym=sym; S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);

  Object.keys(S.tg).forEach(k=>{
    const el=$('tg_'+k);
    if(el) el.addEventListener('change',()=>{ S.tg[k]=el.checked; const w=$('wrap_'+k); if(w) w.style.display=el.checked?'block':'none'; compute(); });
  });

  $('scenSlider').addEventListener('input',e=>{ S.scen=+e.target.value; $('scenName').textContent=SCEN[S.scen];
    [...$('scenTicks').children].forEach((s,i)=>s.classList.toggle('on',i===S.scen)); compute(); });

  $('reset').addEventListener('click',()=>{
    Object.assign(S,{rev:10000000,gm:55,pay:2800000,opex:700000,fixed:200000,revGrowth:6,pricing:3,customer:4,newStream:0,
      payg:6,rent:4,infl:3,mkt:5,tech:5,targetMargin:25,scen:1,
      hireAmt:300000,locRev:1500000,svcRev:800000,investAmt:400000,outAmt:600000,cutAmt:500000,sym:'AED ',locale:'en-AE'});
    S.tg={hire:false,loc:false,svc:false,invest:false,out:false,cut:false};
    FIELDS.forEach(f=>{ if($(f)) $(f).value=S[f]; });
    Object.keys(S.tg).forEach(k=>{ if($('tg_'+k))$('tg_'+k).checked=false; const w=$('wrap_'+k); if(w)w.style.display='none'; });
    $('currency').value='AED |en-AE'; $('scenSlider').value=1; $('scenName').textContent='Expected';
    [...$('scenTicks').children].forEach((s,i)=>s.classList.toggle('on',i===1));
    readInputs();
  });

  $('revGrowthVal').textContent='+'+S.revGrowth+'%';
  readInputs(); fitPrefix();
})();
