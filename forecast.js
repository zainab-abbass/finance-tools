/* ============================================================
   Sales Forecast Simulator — calculator logic
   Depends on: Chart.js (loaded in the page)
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function fitPrefix(){var s=document.getElementById('curSym'),i=document.querySelector('input.has-pre');if(s&&i)i.style.paddingLeft=(s.offsetWidth+20)+'px';}

  const state = {
    base:100000, growth:8, periods:12, perPerYear:1, unit:'Year',
    sym:'$', locale:'en-US', sens:3, decel:0, churn:0
  };
  const defaults = JSON.parse(JSON.stringify(state));

  // ---- formatting ----
  function money(v){
    const abs = Math.abs(v);
    let val, suf='';
    if(abs>=1e9){val=v/1e9;suf='B';}
    else if(abs>=1e6){val=v/1e6;suf='M';}
    else if(abs>=1e3){val=v/1e3;suf='K';}
    else val=v;
    const dp = suf ? (Math.abs(val)>=100?0:1) : 0;
    return state.sym + val.toLocaleString(state.locale,{minimumFractionDigits:dp,maximumFractionDigits:dp}) + suf;
  }
  function moneyFull(v){ return state.sym + Math.round(v).toLocaleString(state.locale); }
  function pct(v){ return (v>=0?'+':'') + v.toFixed(1) + '%'; }

  // ---- core model: compound growth from base for a given starting rate ----
  function project(g0){
    const out=[]; let s=state.base; let g=g0;
    for(let i=0;i<state.periods;i++){
      const net = g - state.churn;
      s = s * (1 + net/100);
      out.push(s);
      g += state.decel;
    }
    return out;
  }

  let chart;
  function compute(){
    const base = project(state.growth);
    const low  = project(state.growth - state.sens);
    const high = project(state.growth + state.sens);

    const end = base[base.length-1];
    const total = base.reduce((a,b)=>a+b,0);
    const years = state.periods / state.perPerYear;
    const cagr = years>0 ? (Math.pow(end/state.base, 1/years)-1)*100 : 0;
    const uplift = (end/state.base - 1)*100;

    $('kEnd').textContent   = money(end);
    $('kTotal').textContent = money(total);
    $('kCagr').textContent  = (cagr>=0?'+':'') + cagr.toFixed(1) + '%';
    $('kUplift').textContent = pct(uplift);
    $('kEndSub').textContent   = 'final ' + state.unit.toLowerCase() + ', base case';
    $('kTotalSub').textContent = state.periods + ' ' + state.unit.toLowerCase() + (state.periods>1?'s':'');

    buildTable(base);
    drawChart(low, base, high);
  }

  function buildTable(base){
    const tb=$('tbody'); tb.innerHTML='';
    let cum=0, prev=state.base;
    base.forEach((s,i)=>{
      cum+=s;
      const g=(s/prev-1)*100; prev=s;
      const cls = g>0?'up':(g<0?'down':'');
      tb.insertAdjacentHTML('beforeend',
        `<tr><td>${state.unit} ${i+1}</td><td class="val">${moneyFull(s)}</td>`+
        `<td class="${cls}">${pct(g)}</td><td>${moneyFull(cum)}</td></tr>`);
    });
    $('tfoot').innerHTML =
      `<tr><td>Total</td><td class="val">—</td><td>—</td><td class="val">${moneyFull(cum)}</td></tr>`;
  }

  function drawChart(low, base, high){
    const labels = base.map((_,i)=>state.unit[0]+(i+1));
    const data = {
      labels,
      datasets:[
        {label:'Optimistic',data:high,borderColor:'#E3C65C',backgroundColor:'rgba(227,198,92,.12)',
         borderWidth:1.5,fill:'+1',pointRadius:0,tension:.3,borderDash:[5,4]},
        {label:'Base case',data:base,borderColor:'#B8932B',backgroundColor:'rgba(184,147,43,.14)',
         borderWidth:3,fill:'+1',pointRadius:0,tension:.3,
         pointHoverRadius:5,pointHoverBackgroundColor:'#B8932B'},
        {label:'Conservative',data:low,borderColor:'#9A958C',backgroundColor:'transparent',
         borderWidth:1.5,fill:false,pointRadius:0,tension:.3,borderDash:[5,4]}
      ]
    };
    const opts={
      responsive:true,maintainAspectRatio:false,
      animation: reduce ? false : {duration:600},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'#0d0d0d',borderColor:'#B8932B',borderWidth:1,
          titleColor:'#F3F1EA',bodyColor:'#D8D4CB',padding:12,cornerRadius:8,
          titleFont:{family:'Arial'},bodyFont:{family:'Arial'},
          callbacks:{label:c=>' '+c.dataset.label+': '+moneyFull(c.parsed.y)}
        }
      },
      scales:{
        x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},maxRotation:0,autoSkip:true,maxTicksLimit:14}},
        y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#6E6A62',font:{family:'Arial',size:10},callback:v=>money(v)}}
      }
    };
    if(chart){chart.data=data;chart.options=opts;chart.update();}
    else chart=new Chart($('chart'),{type:'line',data,options:opts});
  }

  // ---- wiring ----
  function readInputs(){
    state.base    = Math.max(0, +$('base').value || 0);
    state.growth  = +$('growth').value || 0;
    state.periods = Math.min(120, Math.max(1, Math.round(+$('periods').value || 1)));
    state.sens    = Math.max(0, +$('sens').value || 0);
    state.decel   = +$('decel').value || 0;
    state.churn   = Math.max(0, +$('churn').value || 0);
    const [sym,loc] = $('currency').value.split('|');
    state.sym = sym; state.locale = loc;
    $('curSym').textContent = sym.trim() || sym; fitPrefix();
    compute();
  }

  ['base','growth','periods','sens','decel','churn','currency'].forEach(id=>{
    $(id).addEventListener('input', readInputs);
  });

  $('periodSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    [...$('periodSeg').children].forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    state.perPerYear = +b.dataset.pp;
    state.unit = b.dataset.unit;
    compute();
  });

  $('reset').addEventListener('click', ()=>{
    $('base').value=defaults.base; $('growth').value=defaults.growth;
    $('periods').value=defaults.periods; $('sens').value=defaults.sens;
    $('decel').value=0; $('churn').value=0; $('currency').value='$|en-US';
    [...$('periodSeg').children].forEach(x=>x.classList.remove('active'));
    $('periodSeg').querySelector('[data-pp="1"]').classList.add('active');
    state.perPerYear=1; state.unit='Year';
    readInputs();
  });

  readInputs();
  fitPrefix();
})();
