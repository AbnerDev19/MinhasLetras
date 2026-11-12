const assert=require('node:assert/strict');const t=require('./timing.js');
let lines=t.wordsToLines([{text:'Olá',timestamp:[2,2.5]},{text:'mundo',timestamp:[3,4]},{text:'mundo',timestamp:[3,4]},{text:'erro',timestamp:[null,null]},{text:'fim',timestamp:[7,8]}],10);
assert.equal(lines.length,2);assert.equal(lines[0].words.length,2);assert.equal(t.visibleCharacters(lines[0],1),0);assert.equal(t.visibleCharacters(lines[0],2.6),3);assert.equal(t.visibleCharacters(lines[0],4),9);
assert.deepEqual(t.wordsToLines([{text:'inválido',timestamp:[0,null]}],5),[]);
assert.equal(t.wordsToLines([{text:'frase sem palavras',timestamp:[1,3]}],5)[0].precision,'segment');
assert.throws(()=>t.validateLines([{time:2,text:'a'},{time:1,text:'b'}],10));assert.throws(()=>t.validateLines([{time:NaN,text:'a'}],10));
assert.equal(t.validateLines(lines,10).length,2);
console.log('Timing: 8 checks passed');
