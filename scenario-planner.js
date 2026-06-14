/* ============================================================
   CFO Scenario Planning Simulator — model + UI
   Depends on: Chart.js
   Model is intentionally transparent: costs are built bottom-up
   so EBITDA margin moves with the actual assumptions.
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const YEARS = 5;

  /* ---- scenario presets (drive the slider) ---- */
  const PRESETS = {
    0:{name:'Conservative', growth:4, newCust:2, price:2, upsell:1, custChurn:11, revChurn:5, payroll:7, opex:5, infl:4},
    1:{name:'Moderate',     growth:4, newCust:4, price:3, upsell:2, custChurn:8,  revChurn:4, payroll:7, opex:5, infl:3},
    2:{name:'Aggressive',   growth:8, newCust:10,price:4, upsell:4, custChurn:5,  revChurn:2, payroll:10,opex:6, infl:3}
  };

  /* ---- state ---- */
  const S = {
    revenue:10000000, grossMargin:55, ebitdaMargin:18, customers:500,
    growth:4, newCust:4, price:3, upsell:2,
    custChurn:8, revChurn:4,
    payroll:7, opex:5, infl:3,
    sens:4, sym:'AED ', locale:'en-AE',
    tg:{seasonality:false, spike:false, slowdown:false, acquisition:false, product:false}
  };

  /* ---- formatting ---- */
  function money(v){
    const a=Math.abs(v); let x=v,s='';
    if(a>=1e9){x=v/1e9;s='B';} else if(a>=1e6){x=v/1e6;s='M';} else if(a>=1e3){x=v/1e3;s='K';}
    const dp = s ? (Math.abs(x)>=100?0:1) : 0;
    return S.sym + x.toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp}) + s;
  }
  const moneyFull = v => S.sym + Math.round(v).toLocaleString(S.locale);
  const pct = v => (v>=0?'+':'') + v.toFixed(1) + '%';

  /* ---- the model ---- */
  // a = assumption set (a clone of S fields). Returns yearly arrays (length YEARS).
  function runModel(a){
    const gm0=a.grossMargin/100, em0=a.ebitdaMargin/100;
    const rev0=a.revenue;
    const opCost0=Math.max(0, rev0*gm0 - rev0*em0);   // operating cost between GP and EBITDA
    let payroll=opCost0*0.60, opex=opCost0*0.40;       // bottom-up cost base
    let core=rev0, cust=a.customers;
    let arpc = a.customers>0 ? rev0/a.customers : 0;
    let prevReported=rev0;

    const productRamp={2:0.04,3:0.08,4:0.11,5:0.13};   // new-product stream as % of base revenue
    const R={revenue:[],ebitda:[],margin:[],customers:[],gp:[],cogs:[],payroll:[],opex:[],ocf:[],arpc:[]};

    for(let t=1;t<=YEARS;t++){
      let growth=a.growth, cc=a.custChurn, rc=a.revChurn;
      if(a.tg.slowdown && (t===2||t===3)){ growth-=6; cc+=3; rc+=2; }

      const newPerYear=a.newCust*12;
      const season = a.tg.seasonality ? 0.5 : 1;        // mid-year convention for added logos
      const newLogoPct = prevReported>0 ? (newPerYear*arpc*season)/prevReported*100 : 0;
      const effGrowth = growth + a.price + a.upsell + newLogoPct - rc;

      core = core * (1 + effGrowth/100);
      cust = cust*(1 - cc/100) + newPerYear;

      // cost base grows (opex also carries inflation)
      payroll *= (1 + a.payroll/100);
      opex    *= (1 + (a.opex + a.infl)/100);

      // acquisition: permanent inorganic step-up in year 3
      if(a.tg.acquisition && t===3){ core*=1.15; cust*=1.20; payroll*=1.10; opex*=1.10; }

      const product = a.tg.product ? (productRamp[t]||0)*rev0 : 0;   // recurring, growing
      const spike   = (a.tg.spike && t===2) ? 0.08*rev0 : 0;          // one-time only

      const reported = core + product + spike;
      const cogs = reported*(1-gm0)*Math.pow(1+a.infl/100*0.5, t);   // inflation partially erodes gross margin
      const gp   = reported - cogs;
      const ebitda = gp - payroll - opex;
      const ocf = ebitda - 0.10*Math.max(0, reported - prevReported); // 10% working-capital drag on growth

      R.revenue.push(reported); R.ebitda.push(ebitda); R.margin.push(reported>0?ebitda/reported*100:0);
      R.customers.push(cust); R.gp.push(gp); R.cogs.push(cogs);
      R.payroll.push(payroll); R.opex.push(opex); R.ocf.push(ocf);
      R.arpc.push(cust>0?reported/cust:0);

      arpc = cust>0 ? reported/cust : arpc;
      prevReported = reported;
    }
    return R;
  }

  // flex an assumption set for sensitivity: dir +1 best, -1 worst
  function flex(dir){
    const s=S.sens;
    return Object.assign({}, S, {
      growth:   S.growth + dir*s,
      custChurn:Math.max(0, S.custChurn - dir*s*0.5),
      revChurn: Math.max(0, S.revChurn  - dir*s*0.5),
      payroll:  Math.max(0, S.payroll   - dir*s*0.6),
      tg:S.tg
    });
  }

  let cRev,cEbitda,cCust,cWaterfall;

  function compute(){
    const exp = runModel(Object.assign({},S));
    const best= runModel(flex(1));
    const worst=runModel(flex(-1));

    const rev5=exp.revenue[4], eb5=exp.ebitda[4], cust5=exp.customers[4];
    const cagr=(Math.pow(rev5/S.revenue,1/YEARS)-1)*100;
    const m0=S.ebitdaMargin, m5=exp.margin[4];

    // KPIs
    $('kRev').textContent=money(rev5);
    $('kEbitda').textContent=money(eb5);
    $('kEbitdaSub').textContent=m5.toFixed(1)+'% margin · from '+m0.toFixed(0)+'%';
    $('kCust').textContent=Math.round(cust5).toLocaleString(S.locale);
    $('kCagr').textContent=pct(cagr);

    buildInsight(rev5,cagr,m0,m5,exp);
    buildSensTable(best,exp,worst);
    buildYearTable(exp);
    drawCharts(exp,best,worst);
  }

  /* ---- executive insight ---- */
  function buildInsight(rev5,cagr,m0,m5,exp){
    const ocf5=exp.ocf[4];
    let s1 = `Revenue is projected to grow from <b>${moneyFull(S.revenue)}</b> to <b>${moneyFull(rev5)}</b> over five years — a <b>${cagr.toFixed(1)}% CAGR</b>.`;
    let s2, flagCls, flagTxt;
    const d=m5-m0;
    if(d < -0.5){
      const driver = (S.payroll>S.opex)?'payroll growth':'operating-cost growth';
      s2 = ` However, ${driver} is set to outpace revenue, compressing EBITDA margin from <b>${m0.toFixed(1)}%</b> to <b>${m5.toFixed(1)}%</b>. Consider tightening cost discipline or revisiting pricing to protect profitability.`;
      flagCls='warn'; flagTxt='Margin at risk';
    } else if(d > 0.5){
      s2 = ` EBITDA margin expands from <b>${m0.toFixed(1)}%</b> to <b>${m5.toFixed(1)}%</b>, reflecting operating leverage as revenue outgrows the cost base.`;
      flagCls='good'; flagTxt='Operating leverage';
    } else {
      s2 = ` EBITDA margin holds broadly steady near <b>${m5.toFixed(1)}%</b>, with costs and revenue scaling in step.`;
      flagCls='neutral'; flagTxt='Margin stable';
    }
    let s3 = ` Estimated operating cash generation reaches <b>${moneyFull(ocf5)}</b> by Year 5.`;
    if(S.custChurn>=12) s3 += ` Customer churn of ${S.custChurn.toFixed(0)}% is a meaningful drag — retention gains would compound directly into the forecast.`;

    $('insBody').innerHTML = s1 + s2 + s3;
    const flag=$('insFlag'); flag.className='ins-flag '+flagCls; flag.textContent=flagTxt;
  }

  /* ---- tables ---- */
  function buildSensTable(best,exp,worst){
    const row=(label,r,cls)=>{
      const cagr=(Math.pow(r.revenue[4]/S.revenue,1/YEARS)-1)*100;
      return `<tr><td>${label}</td><td class="${cls}">${money(r.revenue[4])}</td>`+
             `<td class="${cls}">${money(r.ebitda[4])}</td><td>${r.margin[4].toFixed(1)}%</td><td>${pct(cagr)}</td></tr>`;
    };
    $('sensBody').innerHTML =
      row('Best case',best,'best') + row('Expected',exp,'val') + row('Worst case',worst,'worst');
  }
  function buildYearTable(exp){
    let html='';
    for(let i=0;i<YEARS;i++){
      html+=`<tr><td>Year ${i+1}</td><td class="val">${moneyFull(exp.revenue[i])}</td>`+
            `<td>${moneyFull(exp.ebitda[i])}</td><td>${exp.margin[i].toFixed(1)}%</td>`+
            `<td>${Math.round(exp.customers[i]).toLocaleString(S.locale)}</td>`+
            `<td>${moneyFull(exp.ocf[i])}</td></tr>`;
    }
    $('yearBody').innerHTML=html;
  }

  /* ---- charts ---- */
  const GOLD='#B8932B', GOLD_BRIGHT='#E3C65C', GREY='#9A958C', GREEN='#2E8B57', RED='#C0563F';
  const baseOpts=(yFmt)=>({
    responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{
      backgroundColor:'#0d0d0d',borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',
      padding:11,cornerRadius:8,titleFont:{family:'Arial'},bodyFont:{family:'Arial'},
      callbacks:{label:c=>' '+c.dataset.label+': '+(yFmt?yFmt(c.parsed.y):c.parsed.y)}
    }},
    scales:{
      x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10}}},
      y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt?yFmt(v):v}}
    }
  });
  const labels=['Y1','Y2','Y3','Y4','Y5'];

  function drawCharts(exp,best,worst){
    // 1. Revenue with best/worst band
    const revData={labels,datasets:[
      {label:'Best',data:best.revenue,borderColor:GOLD_BRIGHT,backgroundColor:'rgba(227,198,92,.12)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:.3,fill:'+1'},
      {label:'Expected',data:exp.revenue,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.14)',borderWidth:3,pointRadius:0,tension:.3,fill:'+1',pointHoverRadius:5},
      {label:'Worst',data:worst.revenue,borderColor:GREY,backgroundColor:'transparent',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:.3,fill:false}
    ]};
    cRev=upd(cRev,'cRev','line',revData,baseOpts(money));

    // 2. EBITDA bars + margin line (dual axis)
    const ebOpts=baseOpts(money);
    ebOpts.scales.y1={position:'right',grid:{drawOnChartArea:false},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>v.toFixed(0)+'%'}};
    const ebData={labels,datasets:[
      {type:'bar',label:'EBITDA',data:exp.ebitda,backgroundColor:'rgba(184,147,43,.78)',borderRadius:4,yAxisID:'y',order:2},
      {type:'line',label:'Margin %',data:exp.margin,borderColor:GREEN,borderWidth:2.5,pointRadius:3,pointBackgroundColor:GREEN,tension:.3,yAxisID:'y1',order:1}
    ]};
    cEbitda=upd(cEbitda,'cEbitda','bar',ebData,ebOpts);

    // 3. Customers
    const custData={labels,datasets:[
      {label:'Customers',data:exp.customers.map(Math.round),borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:3,pointBackgroundColor:GOLD,tension:.3,fill:true}
    ]};
    cCust=upd(cCust,'cCust','line',custData,baseOpts(v=>Math.round(v).toLocaleString()));

    // 4. Waterfall: Revenue -> Gross Profit -> EBITDA (Year 5)
    const r=exp.revenue[4], cogs=exp.cogs[4], gp=exp.gp[4], pay=exp.payroll[4], op=exp.opex[4], eb=exp.ebitda[4];
    // floating bars: [start,end]
    const wfData={labels:['Revenue','– COGS','Gross Profit','– Payroll','– Opex','EBITDA'],datasets:[{
      label:'',
      data:[[0,r],[gp,r],[0,gp],[gp-pay,gp],[eb,gp-pay],[0,eb]],
      backgroundColor:[GOLD,RED,GOLD,RED,RED,GREEN],borderRadius:3
    }]};
    const wfOpts=baseOpts(money);
    wfOpts.plugins.tooltip.callbacks.label=c=>{
      const seg=['Revenue','COGS','Gross Profit','Payroll','Other Opex','EBITDA'][c.dataIndex];
      const vals=[r,cogs,gp,pay,op,eb][c.dataIndex];
      return ' '+seg+': '+moneyFull(vals);
    };
    cWaterfall=upd(cWaterfall,'cWaterfall','bar',wfData,wfOpts);
  }
  function upd(chart,id,type,data,options){
    if(chart){chart.data=data;chart.options=options;chart.update();return chart;}
    return new Chart($(id),{type,data,options});
  }

  /* ---- wiring ---- */
  const FIELDS=['revenue','grossMargin','ebitdaMargin','customers','growth','newCust','price','upsell','custChurn','revChurn','payroll','opex','infl','sens'];
  function syncFieldsFromState(){
    FIELDS.forEach(f=>{ if($(f)) $(f).value=S[f]; });
    if($('arpc')) $('arpc').value = S.customers>0 ? Math.round(S.revenue/S.customers).toLocaleString(S.locale) : '—';
    $('curSym').textContent=S.sym.trim()||S.sym;
  }
  function readFields(){
    S.revenue=Math.max(0,+$('revenue').value||0);
    S.grossMargin=+$('grossMargin').value||0;
    S.ebitdaMargin=+$('ebitdaMargin').value||0;
    S.customers=Math.max(1,Math.round(+$('customers').value||1));
    S.growth=+$('growth').value||0;
    S.newCust=Math.max(0,+$('newCust').value||0);
    S.price=+$('price').value||0;
    S.upsell=+$('upsell').value||0;
    S.custChurn=Math.max(0,+$('custChurn').value||0);
    S.revChurn=Math.max(0,+$('revChurn').value||0);
    S.payroll=+$('payroll').value||0;
    S.opex=+$('opex').value||0;
    S.infl=+$('infl').value||0;
    S.sens=Math.max(0,+$('sens').value||0);
    const [sym,loc]=$('currency').value.split('|'); S.sym=sym; S.locale=loc;
    $('arpc').value = S.customers>0 ? Math.round(S.revenue/S.customers).toLocaleString(S.locale) : '—';
    $('curSym').textContent=sym.trim()||sym;
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readFields));
  $('currency').addEventListener('input',readFields);

  // toggles
  Object.keys(S.tg).forEach(k=>{
    const el=$('tg_'+k);
    if(el) el.addEventListener('change',()=>{ S.tg[k]=el.checked; compute(); });
  });

  // scenario slider
  function applyScenario(idx){
    const p=PRESETS[idx];
    S.growth=p.growth; S.newCust=p.newCust; S.price=p.price; S.upsell=p.upsell;
    S.custChurn=p.custChurn; S.revChurn=p.revChurn; S.payroll=p.payroll; S.opex=p.opex; S.infl=p.infl;
    $('scenName').textContent=p.name;
    [...$('scenTicks').children].forEach((s,i)=>s.classList.toggle('on',i===idx));
    syncFieldsFromState();
    compute();
  }
  $('scenSlider').addEventListener('input',e=>applyScenario(+e.target.value));

  // reset
  $('reset').addEventListener('click',()=>{
    Object.assign(S,{revenue:10000000,grossMargin:55,ebitdaMargin:18,customers:500,sens:4,sym:'AED ',locale:'en-AE'});
    $('currency').value='AED |en-AE';
    Object.keys(S.tg).forEach(k=>{S.tg[k]=false; if($('tg_'+k))$('tg_'+k).checked=false;});
    $('scenSlider').value=1; applyScenario(1);
  });

  // init
  applyScenario(1);
})();
