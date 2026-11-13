(function(root){
'use strict';
const languages={
 python:{label:'Python',ext:'py',head:'print',open:'("',close:'")'},
 javascript:{label:'JavaScript',ext:'js',head:'console.log',open:'("',close:'");'},
 typescript:{label:'TypeScript',ext:'ts',head:'const verso: string',open:' = "',close:'";'},
 java:{label:'Java',ext:'java',head:'System.out.println',open:'("',close:'");'},
 cpp:{label:'C++',ext:'cpp',head:'std::cout',open:' << "',close:'" << std::endl;'},
 rust:{label:'Rust',ext:'rs',head:'println!',open:'("{}", "',close:'");'},
 html:{label:'HTML',ext:'html',head:'<p',open:' class="verso">',close:'</p>'},
 sql:{label:'SQL',ext:'sql',head:'SELECT',open:" '",close:"' AS verso;"}
};
function program(text,language){
 const lang=languages[language]||languages.python,chars=Array.from(text),map=[0],glyphs=[];
 const syn=(str,type)=>Array.from(str).map(ch=>({ch,type,src:-1}));
 glyphs.push(...syn(lang.head,'blue'),...syn(lang.open,'white'));const prefix=glyphs.length;let body='';
 chars.forEach((ch,i)=>{let out=ch;if(language==='html')out=({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]||ch);else if(language==='sql')out=ch==="'"?"''":ch;else out=ch==='\\'?'\\\\':ch==='"'?'\\"':ch==='\n'?'\\n':ch==='\r'?'\\r':ch==='\t'?'\\t':ch;
  body+=out;for(const g of Array.from(out))glyphs.push({ch:g,type:'orange',src:i});map.push(Array.from(body).length);});
 const close=syn(lang.close,'white');glyphs.push(...close);const total=glyphs.length;
 const tokens=[{type:'blue',text:lang.head},{type:'white',text:lang.open},{type:'orange',text:body},{type:'white',text:lang.close}];
 // quantos glifos já estão visíveis quando n caracteres da letra foram digitados
 const count=n=>{const k=Math.max(0,Math.min(chars.length,Math.floor(n)));return prefix+map[k]+(n>=chars.length?close.length:0);};
 return {tokens,glyphs,total,ext:lang.ext,count,reveal:n=>count(n)/total};
}
root.LyricStyles={languages,program};if(typeof module!=='undefined')module.exports=root.LyricStyles;
})(globalThis);
