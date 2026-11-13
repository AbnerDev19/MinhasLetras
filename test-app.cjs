const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
class Element{constructor(){this.value='';this.disabled=false;this.checked=false;this.style={};this.dataset={};this.children=[];this.classList={add(){},remove(){},toggle(){}};this.handlers={};this.currentTime=0;this.paused=true;this.duration=20;this.files=[];}addEventListener(k,f){(this.handlers[k]??=[]).push(f)}setAttribute(){}appendChild(item){this.children.push(item)}append(...items){this.children.push(...items)}replaceChildren(){this.children=[]}click(){for(const f of this.handlers.click||[])f({target:this});this.onclick?.({target:this});}pause(){this.paused=true}play(){this.paused=false;return Promise.resolve()}load(){}getContext(){return context}remove(){}}
const context=new Proxy({measureText:s=>({width:s.length*20}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
const els={};for(const m of html.matchAll(/id="([^"]+)"/g))els[m[1]]=new Element();
for(const [id,value] of Object.entries({theme:'reference',programLanguage:'python',animationMode:'cinema',fontScale:'100',intensity:'65'}))els[id].value=value;
const blocks=Array.from({length:4},()=>new Element()),tabs=blocks.map((_,i)=>{const e=new Element();e.dataset.tab=i;return e});
const document={getElementById:id=>els[id],createElement:()=>new Element(),querySelectorAll:s=>s==='[data-tab]'?tabs:s==='.controls>.block'?blocks:[],addEventListener(){},fonts:{ready:Promise.resolve()},body:new Element()};
const sandbox={document,console,setTimeout(){},clearTimeout,requestAnimationFrame(){},navigator:{},Blob,URL,Float32Array,Number,Math,Error,Promise,MediaStream(){}};sandbox.window=sandbox;sandbox.addEventListener=()=>{};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/timing.js','utf8'),sandbox);vm.runInContext(fs.readFileSync(__dirname+'/styles.js','utf8'),sandbox);vm.runInContext(fs.readFileSync(__dirname+'/renderer.js','utf8'),sandbox);vm.runInContext(html.split('<script>')[1].split('</script>')[0],sandbox);
const app=sandbox.LyricCodeStudio;
assert.equal(app.lrcParse('[00:02.00] Olá\n[offset:1000]').lines[0].time,3);
assert.equal(app.lrcParse('[00:61.00] Inválida').lines.length,0);
const lines=[{time:1,text:'Olá mundo',words:[{text:'Olá',start:1,end:1.5},{text:'mundo',start:2,end:3}]}];app.setTestLines(lines);
assert.equal(els.lineEditor.children.length,2);assert.equal(app.getState().lines,1);
for(const mode of ['cinema','terminal','stack','focus'])for(const language of Object.keys(sandbox.LyricStyles.languages)){els.animationMode.value=mode;els.programLanguage.value=language;app.draw(2.4);}app.draw(0); // exercise renderer with word-level timing
els.lyrics.value='Letra sem horários';els.applyLyrics.click();assert.equal(app.getState().lines,0);assert.equal(app.getState().source,'untimed');
app.setTestLines(lines);els.lyrics.value='[00:01.00] Olá mundo';els.applyLyrics.click();assert.equal(app.getState().lines,1);
els.saveLrc.click();
console.log('App: parser, late offset, invalid time, editor, untimed rejection, renderer and subtitle export passed');

if(false){const {createCanvas,GlobalFonts}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');GlobalFonts.registerFromPath(__dirname+'/fonts/LyricMono.ttf','LyricMono');const canvas=createCanvas(1080,1920);els.videoCanvas.getContext=()=>canvas.getContext('2d');const script=html.split('<script>')[1].split('</script>')[0];vm.runInContext(script,sandbox);const rows=[{time:1,text:'Eu quero acreditar'},{time:4,text:'Todo dia a gente acorda'},{time:7,text:'E diz que vai ser bom'}];sandbox.LyricCodeStudio.setTestLines(rows);for(const mode of ['cinema','terminal','stack','focus']){els.animationMode.value=mode;els.programLanguage.value=mode==='terminal'?'javascript':mode==='stack'?'rust':'python';sandbox.LyricCodeStudio.draw(8.5);fs.writeFileSync('/tmp/lyric-'+mode+'.png',canvas.toBuffer('image/png'));}}
