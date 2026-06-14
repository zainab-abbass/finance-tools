/* ============================================================
   Headcount Planning Simulator — model + UI
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const S={
    curEmp:40, avgSalary:120000, benefits:12, bonus:8, visaIns:8000,
    curRev:18000000, growth:15, otherCosts:6000000,
    sym:'AED ', locale:'en-AE'
  };
  let hires=[{dept:'Sales',salary:140000,month:2},{dept:'Engineering',salary:180000,month:4},{dept:'Support',salary:90000,month:6}];

  function money(v){const a=Math.abs(v);let x=v,s='';if(a>=1e9){x=v/1e9;s='B';}else if(a>=1e6){x=v/1e6;s='M';}else if(a>=1e3){x=v/1e3;s='K';}const dp=s?(Math.abs(x)>=100?0:1):0;return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;}
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);
  const loaded=sal=>sal*(1+S.benefits/100+S.bonus/100)+S.visaIns;

  let cPay,cRevPay;
  function compute(){
    const curPayroll=S.curEmp*loaded(S.avgSalary);
    const futPayroll=curPayroll+hires.reduce((s,h)=>s+loaded(h.salary),0);
    const futHead=S.curEmp+hires.length;
    const futRev=S.curRev*(1+S.growth/100);
    const curRatio=S.curRev?curPayroll/S.curRev*100:0;
    const futRatio=futRev?futPayroll/futRev*100:0;
    const curEB=S.curRev-curPayroll-S.otherCosts;
    const futEB=futRev-futPayroll-S.otherCosts;
    const curMargin=S.curRev?curEB/S.curRev:0;
    const reqRev=(1-curMargin)!==0?(futPayroll+S.otherCosts)/(1-curMargin):0;
    const revNeeded=reqRev-S.curRev;

    $('kFutPay').textContent=money(futPayroll);
    $('kFutPaySub').textContent=money(futPayroll-curPayroll)+' added';
    $('kRatio').textContent=futRatio.toFixed(0)+'%';
    $('kRatioSub').textContent='from '+curRatio.toFixed(0)+'% current';
    $('kRevEmp').textContent=money(futHead?futRev/futHead:0);
    $('kFutEB').textContent=money(futEB);
    $('kFutEBSub').textContent='from '+money(curEB);

    // affordability
    const f=$('scoreFlag');
    let score,cls,txt;
    if(futEB<0 || futRatio>55){cls='warn';txt='Red — hiring outpaces revenue';}
    else if(futRatio>42 || futEB<curEB*0.85){cls='neutral';txt='Yellow — affordable with revenue growth';}
    else {cls='good';txt='Green — comfortably affordable';}
    f.className='ins-flag '+cls; f.textContent=txt;

    buildInsight(curPayroll,futPayroll,curRatio,futRatio,revNeeded);
    drawCharts(curPayroll,futPayroll,futRev);
  }

  function monthlyPayrollPath(curPayroll){
    const path=[];
    for(let m=1;m<=12;m++){
      let p=curPayroll/12;
      hires.forEach(h=>{ if(h.month<=m) p+=loaded(h.salary)/12; });
      path.push(p);
    }
    return path;
  }

  function buildInsight(curPay,futPay,curRatio,futRatio,revNeeded){
    const parts=[];
    parts.push(`Planned hiring increases payroll by <b>${moneyFull(futPay-curPay)}</b> a year.`);
    parts.push(`The payroll-to-revenue ratio moves from <b>${curRatio.toFixed(0)}%</b> to <b>${futRatio.toFixed(0)}%</b>.`);
    if(revNeeded>0) parts.push(`Revenue must grow by about <b>${moneyFull(revNeeded)}</b> to hold the current EBITDA margin.`);
    else parts.push(`At planned revenue growth, the current EBITDA margin is maintained.`);
    $('insBody').innerHTML=parts.join(' ');
  }

  const GOLD='#B8932B',GREEN='#2E8B57',INK='#0d0d0d';
  const baseOpts=yFmt=>({responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:11,cornerRadius:8,callbacks:{label:c=>' '+(c.dataset.label?c.dataset.label+': ':'')+yFmt(c.parsed.y)}}},
    scales:{x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10}}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt(v)}}}});
  function drawCharts(curPay,futPay,futRev){
    const labels=Array.from({length:12},(_,i)=>'M'+(i+1));
    const path=monthlyPayrollPath(curPay);
    cPay=upd(cPay,'cPay','line',{labels,datasets:[{label:'Monthly payroll',data:path,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:0,tension:.2,fill:true}]},baseOpts(money));
    const revPath=labels.map((_,i)=>(S.curRev/12)+((futRev-S.curRev)/12)*((i+1)/12));
    cRevPay=upd(cRevPay,'cRevPay','line',{labels,datasets:[
      {label:'Revenue',data:revPath,borderColor:GREEN,borderWidth:2.6,pointRadius:0,tension:.2,fill:false},
      {label:'Payroll',data:path,borderColor:GOLD,borderWidth:2.6,pointRadius:0,tension:.2,fill:false}
    ]},baseOpts(money));
  }
  function upd(ch,id,type,data,options){if(ch){ch.data=data;ch.options=options;ch.update();return ch;}return new Chart($(id),{type,data,options});}

  /* ---- hire rows ---- */
  function renderHires(){
    $('hireRows').innerHTML=hires.map((h,i)=>
      `<div class="hire-row">
        <input type="text" value="${h.dept}" data-i="${i}" data-k="dept" placeholder="Dept">
        <input type="number" value="${h.salary}" data-i="${i}" data-k="salary" placeholder="Salary">
        <input type="number" value="${h.month}" min="1" max="12" data-i="${i}" data-k="month" placeholder="Mo">
        <button class="hire-del" data-i="${i}" aria-label="Remove">×</button>
      </div>`).join('');
  }
  $('hireRows').addEventListener('input',e=>{
    const el=e.target; if(el.dataset.i==null)return;
    const i=+el.dataset.i, k=el.dataset.k;
    hires[i][k] = k==='dept'? el.value : (+el.value||0);
    compute();
  });
  $('hireRows').addEventListener('click',e=>{
    const b=e.target.closest('.hire-del'); if(!b)return;
    hires.splice(+b.dataset.i,1); renderHires(); compute();
  });
  $('addHire').addEventListener('click',()=>{ hires.push({dept:'New role',salary:100000,month:1}); renderHires(); compute(); });

  const FIELDS=['curEmp','avgSalary','benefits','bonus','visaIns','curRev','growth','otherCosts'];
  function readInputs(){
    FIELDS.forEach(f=>{const el=$(f);if(el){const v=+el.value;S[f]=isNaN(v)?0:v;}});
    const [sym,loc]=$('currency').value.split('|');S.sym=sym;S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);

  $('reset').addEventListener('click',()=>{
    Object.assign(S,{curEmp:40,avgSalary:120000,benefits:12,bonus:8,visaIns:8000,curRev:18000000,growth:15,otherCosts:6000000,sym:'AED ',locale:'en-AE'});
    hires=[{dept:'Sales',salary:140000,month:2},{dept:'Engineering',salary:180000,month:4},{dept:'Support',salary:90000,month:6}];
    FIELDS.forEach(f=>{if($(f))$(f).value=S[f];});
    $('currency').value='AED |en-AE'; renderHires(); readInputs();
  });

  renderHires(); readInputs(); fitPrefix();
})();
