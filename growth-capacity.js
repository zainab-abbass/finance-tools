/* ============================================================
   Strategic Growth Capacity Simulator — model + UI
   "Can we afford to grow?"
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const S={
    rev:12000000, gm:55, ebitda:18, cash:1000000, employees:45,
    growth:35, newHires:10, marketing:800000, tech:700000, office:1200000,
    bank:1500000, shareholder:0, sym:'AED ', locale:'en-AE'
  };

  function money(v){const a=Math.abs(v);let x=v,s='';if(a>=1e9){x=v/1e9;s='B';}else if(a>=1e6){x=v/1e6;s='M';}else if(a>=1e3){x=v/1e3;s='K';}const dp=s?(Math.abs(x)>=100?0:1):0;return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;}
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);

  function model(){
    const GM=S.gm/100, EM=S.ebitda/100;
    const r0=S.rev/12, targetMonthly=S.rev*(1+S.growth/100)/12;
    const opCostAnnual=S.rev*(GM-EM);
    const avgCostPerEmp=S.employees>0?(opCostAnnual*0.6)/S.employees:0;
    const newHireAnnual=S.newHires*avgCostPerEmp;
    const totalInvest=S.marketing+S.tech+S.office;
    let bal=S.cash, minCash=Infinity, minMonth=0, futEB=0;
    const cash=[],ebArr=[],revArr=[],cumInv=[]; let ci=0;
    for(let m=1;m<=24;m++){
      const ramp=Math.min(m/12,1);
      const revM=r0+(targetMonthly-r0)*ramp;
      const ebM=revM*GM-(opCostAnnual/12)-newHireAnnual/12*Math.min(m/6,1)-((m<=12)?S.marketing/12:0);
      const capexM=(m<=3)?(S.tech+S.office)/3:0;
      bal=bal+ebM-capexM;
      ci+=capexM+((m<=12)?S.marketing/12:0);
      cash.push(bal); ebArr.push(ebM*12); revArr.push(revM*12); cumInv.push(ci);
      if(bal<minCash){minCash=bal;minMonth=m;}
      if(m===24)futEB=ebM*12;
    }
    const curEB=S.rev*EM;
    const addFunding=Math.max(0,-minCash);
    const fundable=minCash>=0;
    const coverage=Math.min(100,Math.round(S.cash/(S.cash+addFunding)*100));
    const monthlyIncr=(futEB-curEB)/12;
    const payback=monthlyIncr>0?totalInvest/monthlyIncr:null;
    const roi=totalInvest>0?(futEB-curEB)/totalInvest*100:0;
    const facilities=S.bank+S.shareholder;
    return {totalInvest,curEB,futEB,minCash,minMonth,addFunding,fundable,coverage,payback,roi,facilities,cash,ebArr,revArr,cumInv};
  }

  let cCash,cRevInv,cEB;
  function compute(){
    const r=model();
    // can-fund result
    const res=$('fundResult'), flag=$('fundFlag');
    if(r.fundable){ res.textContent='✅  Yes'; res.style.color='var(--pos)'; flag.className='ins-flag good'; flag.textContent='Self-funded'; }
    else if(r.addFunding<=r.facilities){ res.textContent='⚠️  With facilities'; res.style.color='var(--gold-deep)'; flag.className='ins-flag neutral'; flag.textContent='Needs facility draw'; }
    else { res.textContent='❌  No'; res.style.color='var(--neg)'; flag.className='ins-flag warn'; flag.textContent='Funding shortfall'; }

    $('kInvest').textContent=money(r.totalInvest);
    $('kFunding').textContent=r.addFunding<=0?'None':money(r.addFunding);
    $('kFundingSub').textContent=r.addFunding<=0?'self-funded':'beyond existing cash';
    $('kFutEB').textContent=money(r.futEB); $('kFutEBSub').textContent='from '+money(r.curEB);
    $('kPayback').textContent=r.payback?r.payback.toFixed(0):'—';
    $('kRoi').textContent=r.roi.toFixed(0)+'%';

    buildInsight(r);
    drawCharts(r);
  }

  function buildInsight(r){
    const parts=[];
    parts.push(`The proposed growth plan requires <b>${moneyFull(r.totalInvest)}</b> of investment.`);
    parts.push(`Existing cash reserves can support about <b>${r.coverage}%</b> of the plan's cash needs.`);
    if(r.addFunding>0){
      const within = r.addFunding<=r.facilities;
      parts.push(`An additional <b>${moneyFull(r.addFunding)}</b> of financing would be needed to keep cash positive${within?` — within your available facilities of ${moneyFull(r.facilities)}.`:` — which exceeds your available facilities of ${moneyFull(r.facilities)}.`}`);
    } else {
      parts.push(`The plan is fully fundable from existing cash, with the balance never falling below <b>${moneyFull(r.minCash)}</b>.`);
    }
    if(r.payback) parts.push(`Expected payback is about <b>${r.payback.toFixed(0)} months</b>, an annual return on investment of <b>${r.roi.toFixed(0)}%</b>.`);
    $('insBody').innerHTML=parts.join(' ');
  }

  const GOLD='#B8932B',GREEN='#2E8B57',RED='#C0563F',INK='#0d0d0d';
  const baseOpts=yFmt=>({responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:11,cornerRadius:8,callbacks:{label:c=>' '+(c.dataset.label?c.dataset.label+': ':'')+yFmt(c.parsed.y)}}},
    scales:{x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},maxRotation:0,autoSkip:true,maxTicksLimit:12}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt(v)}}}});
  function drawCharts(r){
    const labels=Array.from({length:24},(_,i)=>'M'+(i+1));
    const floor=new Array(24).fill(0);
    cCash=upd(cCash,'cCash','line',{labels,datasets:[
      {label:'Cash balance',data:r.cash,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:0,tension:.2,fill:true},
      {label:'Zero',data:floor,borderColor:RED,borderWidth:1.2,borderDash:[6,4],pointRadius:0,fill:false}
    ]},baseOpts(money));
    cRevInv=upd(cRevInv,'cRevInv','line',{labels,datasets:[
      {label:'Revenue (run-rate)',data:r.revArr,borderColor:GREEN,borderWidth:2.6,pointRadius:0,tension:.2,fill:false},
      {label:'Cumulative investment',data:r.cumInv,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.10)',borderWidth:2.6,pointRadius:0,tension:.2,fill:true}
    ]},baseOpts(money));
    cEB=upd(cEB,'cEB','line',{labels,datasets:[
      {label:'EBITDA (run-rate)',data:r.ebArr,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:0,tension:.2,fill:true}
    ]},baseOpts(money));
  }
  function upd(ch,id,type,data,options){if(ch){ch.data=data;ch.options=options;ch.update();return ch;}return new Chart($(id),{type,data,options});}

  const FIELDS=['rev','gm','ebitda','cash','employees','growth','newHires','marketing','tech','office','bank','shareholder'];
  function readInputs(){
    FIELDS.forEach(f=>{const el=$(f);if(el){const v=+el.value;S[f]=isNaN(v)?0:v;}});
    const [sym,loc]=$('currency').value.split('|');S.sym=sym;S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);
  $('reset').addEventListener('click',()=>{
    Object.assign(S,{rev:12000000,gm:55,ebitda:18,cash:1000000,employees:45,growth:35,newHires:10,marketing:800000,tech:700000,office:1200000,bank:1500000,shareholder:0,sym:'AED ',locale:'en-AE'});
    FIELDS.forEach(f=>{if($(f))$(f).value=S[f];}); $('currency').value='AED |en-AE'; readInputs();
  });
  readInputs(); fitPrefix();
})();
