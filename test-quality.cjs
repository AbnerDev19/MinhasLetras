const assert=require('node:assert/strict'),q=require('./asr-quality.js'),s=require('./styles.js');
const windows=q.windows(62.75);assert.equal(windows.length,4);assert.equal(windows[3].to,62.75);
assert.equal(q.inspect([{text:'x',timestamp:[null,1]}],10).length,1);
assert.equal(q.inspect([{text:'x',timestamp:[1,7]}],10).length,1);
const word={text:'fronteira',timestamp:[19.8,20.2]};assert.equal(q.mergeWindow([word],windows[0],62.75).length,0);assert.equal(q.mergeWindow([{text:'fronteira',timestamp:[3.8,4.2]}],windows[1],62.75).length,1);
assert.equal(q.mergeAll([{text:'oi',timestamp:[1,2]},{text:'oi',timestamp:[1.1,2]},{text:'oi',timestamp:[5,6]}]).length,2);
for(const language of Object.keys(s.languages)){const p=s.program('A "voz" & coração 💛',language);assert.equal(p.reveal(500),1);assert(p.tokens.length===4);}
assert(s.program('<letra>', 'html').tokens[2].text.includes('&lt;'));assert(s.program("d'água",'sql').tokens[2].text.includes("''"));
console.log('ASR: seam ownership, complete windows, suspect timings, repeated chorus preservation passed. 8 code styles passed.');
