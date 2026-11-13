const assert=require('node:assert/strict');const Q=require('./asr-quality.js');
const SR=16000,DUR=100;
// "voz" sintética: 0,4 s de tom a cada 0,6 s, de 2 s a 92 s; instrumental alto de 40 a 60 s (sem palavras)
const truth=[];for(let t=2;t<92;t+=.6){if(t>=40&&t<60)continue;truth.push({text:'p'+truth.length,start:+t.toFixed(3),end:+(t+.4).toFixed(3)});}
const pcm=new Float32Array(SR*DUR);
for(let i=0;i<pcm.length;i++)pcm[i]=(Math.random()-.5)*.0004;
const tone=(a,b,amp)=>{for(let i=Math.floor(a*SR);i<Math.min(pcm.length,Math.ceil(b*SR));i++)pcm[i]+=amp*Math.sin(2*Math.PI*220*i/SR);};
for(const w of truth)tone(w.start,w.end,.3);tone(40,60,.1);
function mock({stopAfter=8,nullEnd=true,hallucinate=false}={}){let calls=0;return async(slice,{from,to})=>{calls++;
  const inside=truth.filter(w=>w.start>=from&&w.end<=to).filter(w=>w.start<from+stopAfter);   // para cedo
  if(!inside.length&&hallucinate)return [{text:'Legendas pela comunidade Amara.org',timestamp:[0,2]}];
  const out=inside.map(w=>({text:' '+w.text,timestamp:[+(w.start-from).toFixed(3),+(w.end-from).toFixed(3)]}));
  if(nullEnd&&out.length)out.at(-1).timestamp[1]=null;return out;};}
(async()=>{
 // 1) para cedo + fim nulo: ainda assim cobre os 90 s
 let r=await Q.transcribeLong({pcm,transcribe:mock({stopAfter:8}),minGapSec:30});
 const got=new Set(r.words.map(w=>w.text));const missing=truth.filter(w=>!got.has(w.text));
 assert.equal(missing.length,0,'faltaram '+missing.length+' palavras, ex. '+missing[0]?.text);
 assert(r.words.at(-1).start>90,'última palavra em '+r.words.at(-1).start);
 // 2) tempos preservados (palavras com fim nulo mantêm o início real)
 for(const w of r.words){const t=truth.find(x=>x.text===w.text);assert(Math.abs(t.start-w.start)<1e-6,'início alterado '+w.text);assert(w.end>w.start);}
 for(let i=1;i<r.words.length;i++)assert(r.words[i].start>=r.words[i-1].end-1e-9,'sobreposição');
 // 3) alucinação em trecho instrumental é descartada
 r=await Q.transcribeLong({pcm,transcribe:mock({stopAfter:30,hallucinate:true}),minGapSec:30});
 assert(!r.words.some(w=>/Amara|Legendas/i.test(w.text)));
 // 4) trecho instrumental com som e sem palavras vira aviso (gap de 20 s com minGap 6)
 r=await Q.transcribeLong({pcm,transcribe:mock({stopAfter:30})});
 assert(r.issues.some(i=>i.time>=38&&i.time<=62&&i.level==='info'),'sem aviso de trecho sem palavras');
 // 5) falha persistente numa janela não derruba tudo; vira aviso
 let n=0;const flaky=async(s,m)=>{if(m.from<1&&n++<4)throw Error('boom');return mock({stopAfter:30})(s,m);};
 r=await Q.transcribeLong({pcm,transcribe:flaky,minGapSec:30});assert(r.words.length>100);assert(r.issues.some(i=>i.level==='warn'));
 // 6) memória esgotada aborta (não esconde)
 await assert.rejects(Q.transcribeLong({pcm,transcribe:async()=>{throw Error('out of memory')}}),/memory/);
 // 7) cancelamento
 await assert.rejects(Q.transcribeLong({pcm,transcribe:mock(),isCancelled:()=>true}),/Cancelado/);
 // 8) áudio silencioso: nenhuma chamada ao modelo
 let called=0;r=await Q.transcribeLong({pcm:new Float32Array(SR*60),transcribe:async()=>{called++;return[]}});assert.equal(called,0);assert.equal(r.words.length,0);
 console.log('Long audio: 8 checks passed (parada precoce, fim nulo, alucinação, lacunas, falhas, memória, cancelamento, silêncio)');
})().catch(e=>{console.error(e);process.exit(1)});
