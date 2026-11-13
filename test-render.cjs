const assert=require('node:assert/strict');
globalThis.LyricTiming=require('./timing.js');globalThis.LyricStyles=require('./styles.js');const R=require('./renderer.js');
let bad=0;const calls=[];
const ctx=new Proxy({measureText:s=>({width:s.length*26}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:(...a)=>{if(['translate','scale','rotate','fillText','arc','fillRect'].includes(k)&&a.some(x=>typeof x==='number'&&!Number.isFinite(x)))bad++;},set:(o,k,v)=>{o[k]=v;return true;}});
const r=R.create(ctx,{mono:'m'});
const pal={hot:'#ffa334',pink:'#d89467',orange:'#e8ca87',blue:'#81a7df',mint:'#828783',yellow:'#d6c2a0',white:'#eceddf',bottom:'#252c48'};
const mk=(t,text,words)=>({time:t,text,...(words?{words:text.split(' ').map((w,i)=>({text:w,start:t+i*.3,end:t+i*.3+.25})),end:t+text.split(' ').length*.3}:{})});
const sets={vazio:[],semPalavras:[mk(1,'só horário de frase'),mk(4,'outra frase')],comPalavras:Array.from({length:40},(_,i)=>mk(1+i*2.5,'Eu quero acreditar no amanhã '+i,true)),
 enorme:[mk(1,'supercalifragilisticexpialidocious '.repeat(12).trim(),true),mk(5,'💛 emoji e 日本語 de largura dupla',true)],unica:[mk(0,'a',true)]};
let n=0;
for(const [name,lines] of Object.entries(sets))for(const mode of ['cinema','terminal','stack','focus'])for(const language of Object.keys(LyricStyles.languages))
 for(const t of [-1,0,.001,.5,1,1.2,2.7,10,50,99.9,500,...Array.from({length:12},()=>Math.random()*120)]){
  r.draw(t,{lines,offset:Math.random()-.5,palette:pal,mode,language,intensity:Math.random(),fontScale:.75+Math.random()*.6,glitch:true,keyboard:t>50,fileName:'x.py',level:Math.random()});n++;}
assert.equal(bad,0,'valores NaN/Infinity chegaram ao canvas');
const prog=LyricStyles.program('uma frase bem comprida para quebrar em varias linhas','python'),rows=R.layoutRows(prog.glyphs,20);
assert(rows.length>1&&rows.every(row=>row.length<=20),'quebra de linha');
assert.equal(rows.flat().map(g=>g.ch).join('').replace(/ /g,''),prog.glyphs.map(g=>g.ch).join('').replace(/ /g,''),'nenhum glifo perdido');
console.log(`Render: ${n} quadros sem erro nem NaN (4 modos x 8 linguagens x tempos aleatórios, sem palavras, enorme, emoji)`);
