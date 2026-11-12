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
 const lang=languages[language]||languages.python,chars=Array.from(text),map=[0];let body='';
 for(const ch of chars){let out=ch;if(language==='html')out=({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]||ch);else if(language==='sql')out=ch==="'"?"''":ch;else out=ch==='\\'?'\\\\':ch==='"'?'\\"':ch==='\n'?'\\n':ch==='\r'?'\\r':ch==='\t'?'\\t':ch;body+=out;map.push(Array.from(body).length);}
 const tokens=[{type:'blue',text:lang.head},{type:'white',text:lang.open},{type:'orange',text:body},{type:'white',text:lang.close}];
 const prefix=Array.from(lang.head+lang.open).length,total=Array.from(lang.head+lang.open+body+lang.close).length;
 return {tokens,ext:lang.ext,reveal:n=>(prefix+map[Math.max(0,Math.min(chars.length,Math.floor(n)))]+(n>=chars.length?Array.from(lang.close).length:0))/total};
}
root.LyricStyles={languages,program};if(typeof module!=='undefined')module.exports=root.LyricStyles;
})(globalThis);
