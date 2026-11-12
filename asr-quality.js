(function(root){
'use strict';
function windows(duration,core=20,pad=4){const out=[];for(let start=0;start<duration;start+=core)out.push({start,end:Math.min(start+core,duration),from:Math.max(0,start-pad),to:Math.min(duration,start+core+pad)});return out;}
function inspect(chunks,duration){const issues=[];let prev=-1,repeats=0,last='';for(const [i,w] of chunks.entries()){
 const t=w.timestamp;if(!Array.isArray(t)||!Number.isFinite(t[0])||!Number.isFinite(t[1])||t[0]<0||t[1]<=t[0]||t[1]>duration+.1){issues.push({index:i,text:w.text,reason:'Horário ausente ou inválido'});continue;}
 if(t[0]<prev-.05)issues.push({index:i,text:w.text,reason:'Palavras fora de ordem'});prev=t[0];
 if(t[1]-t[0]>3.5)issues.push({index:i,time:t[0],text:w.text,reason:'Palavra muito longa: confira o canto'});
 const text=String(w.text||'').trim().toLowerCase();repeats=text===last?repeats+1:0;last=text;if(repeats===3)issues.push({index:i,time:t[0],text,reason:'Repetição: confirme se pertence à música'});
 }return issues;}
function mergeWindow(chunks,window,duration){return chunks.filter(c=>{const t=c.timestamp;return Array.isArray(t)&&Number.isFinite(t[0])&&Number.isFinite(t[1])&&t[1]>t[0];}).map(c=>({...c,timestamp:[c.timestamp[0]+window.from,Math.min(duration,c.timestamp[1]+window.from)]})).filter(c=>{const middle=(c.timestamp[0]+c.timestamp[1])/2;return middle>=window.start&&middle<window.end;});}
function mergeAll(chunks){const out=[];for(const c of [...chunks].sort((a,b)=>a.timestamp[0]-b.timestamp[0])){const prev=out.at(-1);if(prev&&String(prev.text).trim().toLowerCase()===String(c.text).trim().toLowerCase()&&Math.abs(prev.timestamp[0]-c.timestamp[0])<.25)continue;out.push(c);}return out;}
root.ASRQuality={windows,inspect,mergeWindow,mergeAll};if(typeof module!=='undefined')module.exports=root.ASRQuality;
})(globalThis);
