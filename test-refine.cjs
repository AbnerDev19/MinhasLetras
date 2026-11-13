const assert=require('node:assert/strict');const Q=require('./asr-quality.js');const SR=16000;
const pcm=new Float32Array(SR*12);for(let i=0;i<pcm.length;i++)pcm[i]=(Math.random()-.5)*.0004;
const truth=[[1,1.5],[2,2.4],[3.5,4.2],[6,6.3]];
for(const [a,b] of truth)for(let i=Math.floor(a*SR);i<b*SR;i++)pcm[i]+=.3*Math.sin(2*Math.PI*200*i/SR);
// ASR errado em até 120 ms (adiantado/atrasado)
const asr=[[1.09,1.62],[1.9,2.5],[3.58,4.4],[6.1,6.4]].map(([s,e],i)=>({text:'w'+i,start:s,end:e}));
const {words,moved}=Q.refineWords(asr,pcm,SR);
words.forEach((w,i)=>assert(Math.abs(w.start-truth[i][0])<.035,`início ${i}: ${w.start} vs ${truth[i][0]}`));
assert(Math.abs(words[0].end-1.5)<.08,'fim 0 '+words[0].end);
assert(moved>=4);
// sem evidência (silêncio): nada muda
const quiet=new Float32Array(SR*5).map(()=>(Math.random()-.5)*.0004);
const same=Q.refineWords([{text:'a',start:1,end:1.5}],quiet,SR).words[0];assert.equal(same.start,1);
// ordem e sobreposição preservadas
for(let i=1;i<words.length;i++)assert(words[i].start>=words[i-1].start&&words[i-1].end<=words[i].start+1e-9);
// inspect
assert.equal(Q.inspect([{text:'x',start:NaN,end:1}],10).length,1);assert.equal(Q.inspect([{text:'x',start:1,end:7}],10).length,1);
console.log('Refine: início ±35 ms em ataque claro, sem evidência não mexe, ordem preservada');
