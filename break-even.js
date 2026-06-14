/* ============================================================
   Break-Even & Margin Optimizer — model + UI
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const S={
    rev:8000000, arpc:16000, cogs:35, labor:10, commission:5,
    payroll:1800000, rent:400000, tech:300000, admin:250000, marketing:250000,
    target:1500000, sym:'AED ', locale:'en-AE'
  };

  function money(v){const a=Math.abs(v);let x=v,s='';if(a>=1e9){x=v/1e9;s='B';}else if(a>=1e6){x=v/1e6;s='M';}else if(a>=1e3){x=v/1e3;s='K';}const dp=s?(Math.abs(x)>=100?0:1):0;return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;}
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);

  let cBE,cProfit;
  function compute(){
    const v=(S.cogs+S.labor+S.commission)/100, cm=1-v;
    const F=S.payroll+S.rent+S.tech+S.admin+S.marketing;
    const beRev=cm>0?F/cm:Infinity;
    const beCust=S.arpc>0?beRev/S.arpc:0;
    const profit=S.rev*cm-F;
    const safety=S.rev-beRev, safetyPct=S.rev?safety/S.rev*100:0;

    $('kBeRev').textContent=isFinite(beRev)?money(beRev):'—';
    $('kBeCust').textContent=isFinite(beCust)?Math.round(beCust).toLocaleString(S.locale):'—';
    $('kSafety').textContent=(safetyPct>=0?'+':'')+safetyPct.toFixed(0)+'%';
    $('kSafetySub').textContent=money(safety)+' above break-even';
    $('kProfit').textContent=money(profit);

    // target profit
    const reqRev=cm>0?(F+S.target)/cm:0;
    const reqCust=S.arpc>0?reqRev/S.arpc:0;
    const reqMargin=S.rev?(F+S.target)/S.rev*100:0;
    $('tgtRev').textContent=money(reqRev);
    $('tgtCust').textContent=Math.round(reqCust).toLocaleString(S.locale);
    $('tgtMargin').textContent=reqMargin.toFixed(0)+'%';

    buildLevers(cm,F);
    buildInsight(cm,F,profit,safetyPct);
    drawCharts(v,cm,F,beRev);
  }

  function levers(){
    return [
      ['Increase price by 3%', S.rev*0.03],
      ['Reduce COGS by 2 points', S.rev*0.02],
      ['Reduce payroll by 5%', S.payroll*0.05],
      ['Reduce rent by 10%', S.rent*0.10],
      ['Reduce marketing by 10%', S.marketing*0.10]
    ].sort((a,b)=>b[1]-a[1]);
  }
  function buildLevers(){
    const L=levers();
    $('topLever').textContent=L[0][0];
    $('topLeverVal').textContent='+'+moneyFull(L[0][1]);
    $('leverBody').innerHTML=L.map(l=>`<tr><td>${l[0]}</td><td class="val">+${moneyFull(l[1])}</td></tr>`).join('');
  }

  function buildInsight(cm,F,profit,safetyPct){
    const parts=[];
    const price3=S.rev*0.03, pay5=S.payroll*0.05;
    if(price3>pay5) parts.push(`Increasing average price by <b>3%</b> (<b>+${moneyFull(price3)}</b>) improves profit more than reducing payroll by 5% (<b>+${moneyFull(pay5)}</b>).`);
    else parts.push(`Reducing payroll by <b>5%</b> (<b>+${moneyFull(pay5)}</b>) improves profit more than a 3% price increase (<b>+${moneyFull(price3)}</b>).`);
    const tag = safetyPct>=30?'strong':(safetyPct>=10?'moderate':(safetyPct>=0?'thin':'negative'));
    parts.push(`Current revenue is <b>${safetyPct.toFixed(0)}%</b> ${safetyPct>=0?'above':'below'} break-even, providing <b>${tag}</b> operating safety.`);
    parts.push(`At a contribution margin of <b>${(cm*100).toFixed(0)}%</b>, every additional ${money(1000000)} of revenue adds about <b>${money(cm*1000000)}</b> of profit.`);
    $('insBody').innerHTML=parts.join(' ');
    const f=$('insFlag');
    if(safetyPct>=30){f.className='ins-flag good';f.textContent='Strong safety margin';}
    else if(safetyPct>=10){f.className='ins-flag neutral';f.textContent='Moderate safety';}
    else if(safetyPct>=0){f.className='ins-flag warn';f.textContent='Thin safety margin';}
    else {f.className='ins-flag warn';f.textContent='Below break-even';}
  }

  const GOLD='#B8932B',RED='#C0563F',GREEN='#2E8B57',INK='#0d0d0d';
  const baseOpts=yFmt=>({responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:11,cornerRadius:8,callbacks:{label:c=>' '+(c.dataset.label?c.dataset.label+': ':'')+yFmt(c.parsed.y)}}},
    scales:{x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:function(val){return money(this.getLabelForValue(val));}}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt(v)}}}});
  function drawCharts(v,cm,F,beRev){
    const maxR=Math.max(S.rev,isFinite(beRev)?beRev:0)*1.5||1000000;
    const steps=12, labels=[], revLine=[], costLine=[], profitLine=[];
    for(let i=0;i<=steps;i++){ const R=maxR*i/steps; labels.push(R); revLine.push(R); costLine.push(F+R*v); profitLine.push(R*cm-F); }
    cBE=upd(cBE,'cBE','line',{labels,datasets:[
      {label:'Revenue',data:revLine,borderColor:GREEN,borderWidth:2.6,pointRadius:0,tension:0},
      {label:'Total cost',data:costLine,borderColor:RED,borderWidth:2.6,pointRadius:0,tension:0}
    ]},baseOpts(money));
    cProfit=upd(cProfit,'cProfit','line',{labels,datasets:[
      {label:'Profit',data:profitLine,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:0,tension:0,fill:true}
    ]},baseOpts(money));
  }
  function upd(ch,id,type,data,options){if(ch){ch.data=data;ch.options=options;ch.update();return ch;}return new Chart($(id),{type,data,options});}

  const FIELDS=['rev','arpc','cogs','labor','commission','payroll','rent','tech','admin','marketing','target'];
  function readInputs(){
    FIELDS.forEach(f=>{const el=$(f);if(el){const v=+el.value;S[f]=isNaN(v)?0:v;}});
    const [sym,loc]=$('currency').value.split('|');S.sym=sym;S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);
  $('reset').addEventListener('click',()=>{
    Object.assign(S,{rev:8000000,arpc:16000,cogs:35,labor:10,commission:5,payroll:1800000,rent:400000,tech:300000,admin:250000,marketing:250000,target:1500000,sym:'AED ',locale:'en-AE'});
    FIELDS.forEach(f=>{if($(f))$(f).value=S[f];}); $('currency').value='AED |en-AE'; readInputs();
  });
  readInputs(); fitPrefix();
})();
