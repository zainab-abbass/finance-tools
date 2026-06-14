/* ============================================================
   Pricing Impact Simulator — model + UI
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const S={ customers:500, avgPrice:2000, gm:60, churn:8, priceInc:10, custLoss:12, costInfl:3, fixed:400000, sym:'AED ', locale:'en-AE' };

  function money(v){const a=Math.abs(v);let x=v,s='';if(a>=1e9){x=v/1e9;s='B';}else if(a>=1e6){x=v/1e6;s='M';}else if(a>=1e3){x=v/1e3;s='K';}const dp=s?(Math.abs(x)>=100?0:1):0;return (v<0?'-':'')+S.sym+Math.abs(x).toLocaleString(S.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp})+s;}
  const moneyFull=v=>(v<0?'-':'')+S.sym+Math.abs(Math.round(v)).toLocaleString(S.locale);

  // linear demand: loss rate per 1% price, anchored to the proposed point
  function lossRate(){ return S.priceInc>0 ? (S.custLoss/100)/S.priceInc : 0.008; }
  function at(p){ // p = price increase %
    const unitCost=S.avgPrice*(1-S.gm/100)*(1+S.costInfl/100);
    const cust=S.customers*Math.max(0,1-lossRate()*p);
    const price=S.avgPrice*(1+p/100);
    const gp=cust*(price-unitCost);
    return {cust,price,rev:cust*price,gp,ebitda:gp-S.fixed};
  }
  function optimum(){ let best={p:0,e:-1e18}; for(let p=0;p<=30;p+=0.5){const m=at(p);if(m.ebitda>best.e)best={p,e:m.ebitda,m};} return best; }

  let cElas,cChurn;
  function compute(){
    const before=at(0), after=at(S.priceInc), opt=optimum();
    $('kRevA').textContent=money(after.rev); $('kRevASub').textContent='from '+money(before.rev);
    $('kGpA').textContent=money(after.gp);   $('kGpASub').textContent='from '+money(before.gp);
    $('kEbA').textContent=money(after.ebitda);$('kEbASub').textContent='from '+money(before.ebitda);
    $('kOpt').textContent='+'+opt.p+'%';

    $('topPrice').textContent='Increase price by '+opt.p+'%';
    $('topPriceVal').textContent=moneyFull(opt.e);

    buildScenario();
    buildInsight(before,after,opt);
    drawCharts(opt);
  }

  function buildScenario(){
    $('scenBody').innerHTML=[0,5,10,15,20].map(p=>{
      const m=at(p);
      return `<tr><td>+${p}%</td><td>${Math.round(m.cust)}</td><td class="val">${money(m.ebitda)}</td></tr>`;
    }).join('');
  }

  function buildInsight(before,after,opt){
    const parts=[];
    if(opt.p>0){
      const lossAtOpt=(lossRate()*opt.p*100).toFixed(0);
      parts.push(`A <b>${opt.p}%</b> price increase produces the highest EBITDA — about <b>${moneyFull(opt.e)}</b> — despite an estimated <b>${lossAtOpt}%</b> customer attrition.`);
    } else {
      parts.push(`At the current elasticity, holding price is optimal — increases erode profit faster than they add it.`);
    }
    const eb0=before.ebitda;
    parts.push(`Your proposed <b>${S.priceInc}%</b> increase moves EBITDA from <b>${moneyFull(eb0)}</b> to <b>${moneyFull(after.ebitda)}</b>.`);
    if(opt.p>S.priceInc) parts.push(`There is room to price higher — the optimum sits above your proposal.`);
    else if(opt.p<S.priceInc) parts.push(`Your proposed increase is past the profit-maximising point.`);
    $('insBody').innerHTML=parts.join(' ');
    const f=$('insFlag');
    if(after.ebitda>before.ebitda){f.className='ins-flag good';f.textContent='Pricing accretive';}
    else {f.className='ins-flag warn';f.textContent='Pricing dilutive';}
  }

  const GOLD='#B8932B',GREEN='#2E8B57',INK='#0d0d0d';
  const baseOpts=yFmt=>({responsive:true,maintainAspectRatio:false,animation:reduce?false:{duration:500},interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:INK,borderColor:GOLD,borderWidth:1,titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:11,cornerRadius:8,callbacks:{label:c=>' '+(c.dataset.label?c.dataset.label+': ':'')+yFmt(c.parsed.y)}}},
    scales:{x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10}}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>yFmt(v)}}}});
  function drawCharts(opt){
    const ps=[]; const eb=[];
    for(let p=0;p<=25;p++){ps.push('+'+p+'%');eb.push(at(p).ebitda);}
    cElas=upd(cElas,'cElas','line',{labels:ps,datasets:[{label:'EBITDA',data:eb,borderColor:GOLD,backgroundColor:'rgba(184,147,43,.12)',borderWidth:3,pointRadius:ps.map((_,i)=>i===opt.p?5:0),pointBackgroundColor:'#D4AF37',tension:.25,fill:true}]},baseOpts(money));
    // revenue vs churn (customer loss 0..40 at proposed price)
    const losses=[],revs=[];
    for(let l=0;l<=40;l+=4){ const cust=S.customers*(1-l/100); const price=S.avgPrice*(1+S.priceInc/100); losses.push(l+'%'); revs.push(cust*price); }
    cChurn=upd(cChurn,'cChurn','line',{labels:losses,datasets:[{label:'Revenue',data:revs,borderColor:GREEN,backgroundColor:'rgba(46,139,87,.10)',borderWidth:3,pointRadius:0,tension:.2,fill:true}]},baseOpts(money));
  }
  function upd(ch,id,type,data,options){if(ch){ch.data=data;ch.options=options;ch.update();return ch;}return new Chart($(id),{type,data,options});}

  const FIELDS=['customers','avgPrice','gm','churn','priceInc','custLoss','costInfl','fixed'];
  function readInputs(){
    FIELDS.forEach(f=>{const el=$(f);if(el){const v=+el.value;S[f]=isNaN(v)?0:v;}});
    const [sym,loc]=$('currency').value.split('|');S.sym=sym;S.locale=loc;
    $('curSym').textContent=sym.trim()||sym; fitPrefix();
    compute();
  }
  FIELDS.forEach(f=>$(f)&&$(f).addEventListener('input',readInputs));
  $('currency').addEventListener('input',readInputs);
  $('reset').addEventListener('click',()=>{
    Object.assign(S,{customers:500,avgPrice:2000,gm:60,churn:8,priceInc:10,custLoss:12,costInfl:3,fixed:400000,sym:'AED ',locale:'en-AE'});
    FIELDS.forEach(f=>{if($(f))$(f).value=S[f];}); $('currency').value='AED |en-AE'; readInputs();
  });
  readInputs(); fitPrefix();
})();
