const assert=require('node:assert/strict'),s=require('./styles.js');
for(const language of Object.keys(s.languages)){const p=s.program('A "voz" & coração 💛',language);assert.equal(p.reveal(500),1);assert(p.tokens.length===4);assert.equal(p.glyphs.map(g=>g.ch).join(''),p.tokens.map(t=>t.text).join(''));assert.equal(p.count(0)<p.total,true);}
assert(s.program('<letra>','html').tokens[2].text.includes('&lt;'));assert(s.program("d'água",'sql').tokens[2].text.includes("''"));
console.log('Styles: 8 linguagens, glifos == tokens, escaping passed. (Motor de áudio: test-long.cjs e test-refine.cjs)');
