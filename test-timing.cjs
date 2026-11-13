const assert=require('node:assert/strict');const t=require('./timing.js');
let lines=t.wordsToLines([{text:'Olá',timestamp:[2,2.5]},{text:'mundo',timestamp:[3,4]},{text:'mundo',timestamp:[3,4]},{text:'erro',timestamp:[null,null]},{text:'fim',timestamp:[7,8]}],10);
assert.equal(lines.length,2);assert.equal(lines[0].words.length,2);assert.equal(t.visibleCharacters(lines[0],1),0);assert.equal(t.visibleCharacters(lines[0],2.6),3);assert.equal(t.visibleCharacters(lines[0],4),9);
assert.deepEqual(t.wordsToLines([{text:'inválido',timestamp:[null,1]}],5),[]);              // sem início: descartada
const est=t.wordsToLines([{text:'fim',timestamp:[1,null]}],5)[0].words[0];assert(est.end>1&&est.end<2);   // fim nulo: mantém a palavra, estima o fim
const ov=t.wordsToLines([{text:'a',timestamp:[1,3]},{text:'b',timestamp:[2,2.5]}],9)[0].words;assert(ov[0].end<=ov[1].start);   // sem sobreposição
const ln={time:1,text:'oi mundo',words:[{text:'oi',start:1,end:3},{text:'mundo',start:3,end:4}]};assert.equal(t.visibleCharacters(ln,1.3),2);assert.equal(t.wordAt(ln,2),0);assert.equal(t.wordAt(ln,3.1),1);   // nota longa não estica a digitação
assert.equal(t.wordsToLines([{text:'frase sem palavras',timestamp:[1,3]}],5)[0].precision,'segment');
assert.throws(()=>t.validateLines([{time:2,text:'a'},{time:1,text:'b'}],10));assert.throws(()=>t.validateLines([{time:NaN,text:'a'}],10));
assert.equal(t.validateLines(lines,10).length,2);
console.log('Timing: 12 checks passed');
