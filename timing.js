/* Os horários vêm do modelo/arquivo. Nunca se espalha uma música inteira sobre o texto. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const len=s=>Array.from(s).length;
const MAX_CHARS=34;

function wordsToLines(raw,duration){
 const valid=[];
 for(const item of Array.isArray(raw)?raw:[]){
  const ts=item.timestamp,text=String(item.text||'').trim();
  // Sem INÍCIO válido a palavra é descartada (não inventamos horário). Fim nulo é estimado abaixo.
  if(!text||!Array.isArray(ts)||!Number.isFinite(ts[0])||ts[0]<0||ts[0]>=duration)continue;
  if(/^\[.*\]$/.test(text))continue;
  const end=Number.isFinite(ts[1])&&ts[1]>ts[0]?Math.min(ts[1],duration):NaN;
  if(valid.some(v=>v.text===text&&Math.abs(v.start-ts[0])<.08))continue;
  valid.push({text,start:ts[0],end});
 }
 valid.sort((a,b)=>a.start-b.start);
 valid.forEach((w,i)=>{
  const next=valid[i+1];
  if(!(w.end>w.start)){const guess=w.start+Math.min(.6,.08*len(w.text)+.12);w.end=Math.min(duration,next&&next.start>w.start+.04?Math.min(guess,next.start):guess);}
  if(next&&w.end>next.start)w.end=Math.max(w.start+.03,next.start);   // sem sobreposição
  if(w.end<=w.start)w.end=Math.min(duration,w.start+.03);
 });
 const lines=[];let group=[];
 const flush=()=>{if(group.length)lines.push({time:group[0].start,end:group.at(-1).end,text:group.map(w=>w.text).join(' '),words:group,precision:group.some(w=>/\s/.test(w.text))?'segment':'word'});group=[];};
 for(const w of valid){
  const prev=group.at(-1);
  if(prev){
   const gap=w.start-prev.end,chars=len(group.map(x=>x.text).join(' '))+1+len(w.text);
   if(gap>.65||chars>MAX_CHARS||w.end-group[0].start>5.5||group.length>=8||(/[.!?;:]$/.test(prev.text)&&gap>.12)||(/,$/.test(prev.text)&&chars>18&&gap>.25))flush();
  }
  group.push(w);
 }
 flush();return lines;
}

// A palavra aparece no INÍCIO dela (digitação rápida), não esticada por toda a nota sustentada.
function revealDuration(w){return Math.max(.06,Math.min(w.end-w.start,.045*len(w.text)+.05,.5));}
function visibleCharacters(line,time){
 if(time<line.time)return 0;
 if(line.words?.length){let count=0;for(let i=0;i<line.words.length;i++){const w=line.words[i];if(time<w.start)break;if(i)count++;const p=clamp((time-w.start)/revealDuration(w),0,1);count+=p>0?Math.ceil(len(w.text)*p):0;if(p<1)break;}return Math.min(len(line.text),count);}
 // Só horário de frase: efeito estético, não é alinhamento por palavra.
 return Math.min(len(line.text),Math.floor((time-line.time)*28));
}
// índice da palavra "cantada agora" (início <= t < fim + folga) ou -1
function wordAt(line,time,tail=.12){
 if(!line.words?.length)return -1;let found=-1;
 for(let i=0;i<line.words.length;i++){const w=line.words[i];if(time<w.start)break;if(time<w.end+tail)found=i;}
 return found;
}
function validateLines(lines,duration){
 let prev=-1;
 return lines.map((l,n)=>{
 if(typeof l.text!=='string'||!l.text.trim()||l.text.length>500||!Number.isFinite(l.time)||l.time<0||l.time>=duration||l.time<=prev)throw Error(`Texto ou horários inválidos na frase ${n+1} do projeto.`);prev=l.time;
 let words;
 if(l.words!==undefined){if(!Array.isArray(l.words)||l.words.length>200)throw Error('Palavras inválidas.');let last=l.time-.02;words=l.words.map(w=>{if(typeof w.text!=='string'||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<last||w.end<=w.start||w.end>duration)throw Error('Tempos por palavra inválidos.');last=w.start;return {text:w.text,start:w.start,end:w.end};});if(words.map(w=>w.text).join(' ')!==l.text)throw Error('Palavras não correspondem ao texto.');}
 return {time:l.time,text:l.text,end:Number.isFinite(l.end)?Math.min(duration,l.end):undefined,words};
 });
}
root.LyricTiming={wordsToLines,visibleCharacters,validateLines,wordAt,revealDuration};
if(typeof module!=='undefined')module.exports=root.LyricTiming;
})(globalThis);
