/* ============================================================
   Budget Variance Analyzer — model + UI
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const S={
    bRev:1000000,bPay:300000,bMkt:120000,bRent:80000,bOth:100000,
    aRev:900000,aPay:330000,aMkt:140000,aRent:80000,aOth:110000,
    threshold:10, period:'monthly', sym:'AED ', locale:'en-AE'
  };

  function money(v){const a=Math.abs(v);let x=v,s='';if(a>=1e9){x=v/1e9;s='B';}else if(a>=1e6){x=v/1e6;s='M';}else if(a>=1e3){x=v/1e3;s='K';}const dp=s?(Math.abs(x)>=100?0:1):0;return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;}
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);
  const pct=v=>(v>=0?'+':'')+v.toFixed(1)+'%';

  let cWf;
  function compute(){
    const bEB=S.bRev-(S.bPay+S.bMkt+S.bRent+S.bOth);
    const aEB=S.aRev-(S.aPay+S.aMkt+S.aRent+S.aOth);
    const ebVar=aEB-bEB;
    const revVar=S.aRev-S.bRev;
    // contributions to EBITDA variance (signed: + helps EBITDA)
    const contrib=[
      {name:'Revenue',     impact:revVar},
      {name:'Payroll',     impact:-(S.aPay-S.bPay)},
      {name:'Marketing',   impact:-(S.aMkt-S.bMkt)},
      {name:'Rent',        impact:-(S.aRent-S.bRent)},
      {name:'Other',       impact:-(S.aOth-S.bOth)}
    ];

    $('kBudEB').textContent=money(bEB);
    $('kActEB').textContent=money(aEB);
    $('kEBVar').textContent=money(ebVar);
    $('kEBVarSub').textContent=(bEB!==0?pct(ebVar/Math.abs(bEB)*100):'—')+' vs budget';
    $('kRevVar').textContent=(S.bRev!==0?pct(revVar/S.bRev*100):'—');

    // top driver = most negative contribution (biggest drag); if all positive, biggest positive
    const sorted=[...contrib].sort((a,b)=>a.impact-b.impact);
    const top=sorted[0].impact<0?sorted[0]:[...contrib].sort((a,b)=>b.impact-a.impact)[0];
    $('topDriver').textContent=(top.impact<0?(top.name==='Revenue'?'Revenue decline':top.name+' overspend'):top.name+' favourable');
    $('topDriverVal').textContent=moneyFull(top.impact);

    buildHeatmap();
    buildVarianceTable();
    buildInsight(bEB,aEB,ebVar,revVar,contrib);
    drawWaterfall(bEB,aEB,contrib);
  }

  function buildVarianceTable(){
    const rows=[
      ['Revenue',S.bRev,S.aRev,true],
      ['Payroll',S.bPay,S.aPay,false],
      ['Marketing',S.bMkt,S.aMkt,false],
      ['Rent',S.bRent,S.aRent,false],
      ['Other',S.bOth,S.aOth,false]
    ];
    $('varBody').innerHTML=rows.map(([n,b,a,isRev])=>{
      const v=a-b, vp=b!==0?v/b*100:0;
      const fav = isRev ? v>=0 : v<=0;   // revenue up good; expense up bad
      const cls=fav?'up':'down';
      return `<tr><td>${n}</td><td>${moneyFull(b)}</td><td>${moneyFull(a)}</td>`+
             `<td class="${cls}">${(v>=0?'+':'')}${moneyFull(v)}</td><td class="${cls}">${pct(vp)}</td></tr>`;
    }).join('');
  }

  function buildHeatmap(){
    const cells=[
      ['Revenue',S.bRev,S.aRev,true],
      ['Payroll',S.bPay,S.aPay,false],
      ['Marketing',S.bMkt,S.aMkt,false],
      ['Rent',S.bRent,S.aRent,false],
      ['Other',S.bOth,S.aOth,false]
    ];
    $('heatmap').innerHTML=cells.map(([n,b,a,isRev])=>{
      const vp=b!==0?(a-b)/b*100:0;
      const fav=isRev? vp>=0 : vp<=0;
      const mag=Math.min(1,Math.abs(vp)/30);
      const col=fav?`rgba(46,139,87,${0.12+mag*0.5})`:`rgba(192,86,63,${0.12+mag*0.5})`;
      const breach=Math.abs(vp)>=S.threshold?'<span class="heat-flag">!</span>':'';
      return `<div class="heat-cell" style="background:${col}"><div class="heat-name">${n}${breach}</div><div class="heat-val">${pct(vp)}</div></div>`;
    }).join('');
  }

  function buildInsight(bEB,aEB,ebVar,revVar,contrib){
    const parts=[];
    if(ebVar<0 && revVar<0){
      const share=Math.abs(revVar)/Math.abs(ebVar)*100;
      parts.push(`Revenue shortfall accounts for about <b>${Math.min(100,share).toFixed(0)}%</b> of the EBITDA variance.`);
    } else if(ebVar>=0){
      parts.push(`Actual EBITDA came in <b>${moneyFull(Math.abs(ebVar))}</b> ${ebVar>=0?'ahead of':'behind'} budget.`);
    }
    const overspends=contrib.filter(c=>c.name!=='Revenue'&&c.impact<0).sort((a,b)=>a.impact-b.impact);
    if(overspends.length) parts.push(`${overspends[0].name} exceeded budget by <b>${moneyFull(-overspends[0].impact)}</b>.`);
    if(overspends.length && ebVar<0){
      const without=ebVar-overspends[0].impact;
      if(without>=0) parts.push(`Had ${overspends[0].name.toLowerCase()} stayed on budget, EBITDA would have remained on target.`);
    }
    const breaches=['Revenue','Payroll','Marketing','Rent','Other'].filter((n,i)=>{
      const b=[S.bRev,S.bPay,S.bMkt,S.bRent,S.bOth][i], a=[S.aRev,S.aPay,S.aMkt,S.aRent,S.aOth][i];
      return b!==0 && Math.abs((a-b)/b*100)>=S.threshold;
    });
    if(breaches.length) parts.push(`${breaches.length} line${breaches.length>1?'s':''} breached the ${S.threshold}% threshold: ${breaches.join(', ')}.`);
    $('insBody').innerHTML=parts.join(' ');
    const f=$('insFlag');
    if(ebVar<0){f.className='ins-flag warn';f.textContent='Behind budget';}
    else {f.className='ins-flag good';f.textContent='On or ahead of budget';}
  }

  const GOLD='#B8932B',GOLD_BRIGHT='#D4AF37',GREEN='#2E8B57',RED='#C0563F',INK='#0d0d0d';
  function drawWaterfall(bEB,aEB,contrib){
    const steps=[['Budget EBITDA',bEB,'base']];
    contrib.forEach(c=>{ if(Math.abs(c.impact)>0.5) steps.push([(c.impact>=0?'+ ':'– ')+c.name, c.impact,'flow']); });
    steps.push(['Actual EBITDA',aEB,'base']);
    const labels=[],data=[],colors=[]; let run=0;
    steps.forEach(([lab,val,type])=>{ labels.push(lab);
      if(type==='base'){ data.push([0,val]); colors.push(lab.startsWith('Budget')?GOLD:GOLD_BRIGHT); run=val; }
      else { const s=run,e=run+val; data.push(val>=0?[s,e]:[e,s]); colors.push(val>=0?GREEN:RED); run=e; }
    });
    const opts={responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},
      plugins:{legend:{display:false},tooltip:{backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:11,cornerRadius:8,
        callbacks:{label:c=>{const v=steps[c.dataIndex][1];return ' '+(steps[c.dataIndex][2]==='base'?moneyFull(v):((v>=0?'+':'')+moneyFull(v)));}}}},
      scales:{x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},maxRotation:0,autoSkip:false}},
              y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>money(v)}}}};
    if(cWf){cWf.data={labels,datasets:[{data,backgroundColor:colors,borderRadius:3}]};cWf.options=opts;cWf.update();}
    else cWf=new Chart($('cWf'),{type:'bar',data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:3}]},options:opts});
  }

  const FIELDS=['bRev','bPay','bMkt','bRent','bOth','aRev','aPay','aMkt','aRent','aOth'];
  function readInputs(){
    FIELDS.forEach(f=>{const el=$(f);if(el){const v=+el.value;S[f]=isNaN(v)?0:v;}});
    const [sym,loc]=$('currency').value.split('|');S.sym=sym;S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);
  $('threshSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;[...$('threshSeg').children].forEach(x=>x.classList.remove('active'));b.classList.add('active');S.threshold=+b.dataset.t;compute();});
  $('periodSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;[...$('periodSeg').children].forEach(x=>x.classList.remove('active'));b.classList.add('active');S.period=b.dataset.p;compute();});

  $('reset').addEventListener('click',()=>{
    Object.assign(S,{bRev:1000000,bPay:300000,bMkt:120000,bRent:80000,bOth:100000,aRev:900000,aPay:330000,aMkt:140000,aRent:80000,aOth:110000,threshold:10,period:'monthly',sym:'AED ',locale:'en-AE'});
    FIELDS.forEach(f=>{if($(f))$(f).value=S[f];});
    $('currency').value='AED |en-AE';
    [...$('threshSeg').children].forEach(x=>x.classList.toggle('active',+x.dataset.t===10));
    [...$('periodSeg').children].forEach(x=>x.classList.toggle('active',x.dataset.p==='monthly'));
    readInputs();
  });

  readInputs(); fitPrefix();
})();
