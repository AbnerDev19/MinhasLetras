/* Timing is never inferred by spreading a whole song over its text. */
(function(root){
'use strict';
function wordsToLines(raw,duration){
 const valid=[];
 for(const item of Array.isArray(raw)?raw:[]){
  const ts=item.timestamp,text=String(item.text||'').trim();
  if(!text||!Array.isArray(ts)||!Number.isFinite(ts[0])||!Number.isFinite(ts[1])||ts[0]<0||ts[1]<=ts[0]||ts[0]>=duration)continue;
  if(/^\[.*\]$/.test(text))continue;
  const w={text,start:ts[0],end:Math.min(ts[1],duration)};
  // Same word at the same overlapping timestamp is a chunk-boundary duplicate.
  if(valid.some(v=>v.text===text&&Math.abs(v.start-w.start)<.08))continue;
  valid.push(w);
 }
 valid.sort((a,b)=>a.start-b.start);
 const lines=[];let group=[];
 const flush=()=>{if(group.length)lines.push({time:group[0].start,end:group.at(-1).end,text:group.map(w=>w.text).join(' '),words:group,precision:group.some(w=>/\s/.test(w.text))?'segment':'word'});group=[];};
 for(const w of valid){const prev=group.at(-1);if(prev&&(w.start-prev.end>.65||group.map(x=>x.text).join(' ').length+w.text.length>42||w.end-group[0].start>5||group.length>=8||(/[.!?;:]$/.test(prev.text)&&w.start-prev.end>.12)))flush();group.push(w);}flush();return lines;
}
function visibleCharacters(line,time){
 if(time<line.time)return 0;
 if(line.words?.length){let count=0;for(let i=0;i<line.words.length;i++){const w=line.words[i];if(time<w.start)break;if(i)count++;count+=Math.floor(Array.from(w.text).length*Math.max(0,Math.min(1,(time-w.start)/Math.max(.02,w.end-w.start))));if(time<w.end)break;}return Math.min(Array.from(line.text).length,count);}
 // Line-only timing is deliberately an aesthetic reveal, not word alignment.
 return Math.min(Array.from(line.text).length,Math.floor((time-line.time)*28));
}
function validateLines(lines,duration){
 let prev=-1;
 return lines.map(l=>{
 if(typeof l.text!=='string'||!l.text.trim()||l.text.length>500||!Number.isFinite(l.time)||l.time<0||l.time>=duration||l.time<=prev)throw Error('Texto ou horários inválidos no projeto.');prev=l.time;
 let words;
 if(l.words!==undefined){if(!Array.isArray(l.words)||l.words.length>200)throw Error('Palavras inválidas.');let last=l.time-.02;words=l.words.map(w=>{if(typeof w.text!=='string'||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<last||w.end<=w.start||w.end>duration)throw Error('Tempos por palavra inválidos.');last=w.start;return {text:w.text,start:w.start,end:w.end};});if(words.map(w=>w.text).join(' ')!==l.text)throw Error('Palavras não correspondem ao texto.');}
 return {time:l.time,text:l.text,end:Number.isFinite(l.end)?Math.min(duration,l.end):undefined,words};
 });
}
root.LyricTiming={wordsToLines,visibleCharacters,validateLines};
if(typeof module!=='undefined')module.exports=root.LyricTiming;
})(globalThis);
