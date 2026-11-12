/* One cancellable worker per task. Audio never leaves the device. */
let busy=false;
const report=(percent,message)=>self.postMessage({type:'progress',percent,message});
self.onmessage=async({data})=>{
 if(data?.type!=='transcribe'||busy)return;busy=true;
 try{
 const {pcm}=data;
 if(!(pcm instanceof Float32Array)||!pcm.length||pcm.length>16000*360)throw Error('Áudio inválido ou maior que 6 minutos.');
 let energy=0;for(let i=0;i<pcm.length;i++)energy+=pcm[i]*pcm[i];
 if(Math.sqrt(energy/pcm.length)<.0001)throw Error('Arquivo silencioso: não há sinal suficiente para transcrever.');
 const kind=['tiny','base','small'].includes(data.model)?data.model:'base';
 report(12,'Carregando a IA. O primeiro uso baixa os arquivos do modelo…');
 const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
 env.allowRemoteModels=true;env.useBrowserCache=true;env.backends.onnx.wasm.numThreads=1;
 const transcriber=await pipeline('automatic-speech-recognition',`Xenova/whisper-${kind}`,{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress'&&Number.isFinite(p.progress))report(15+p.progress*.45,`Baixando ${kind}: ${Math.round(p.progress)}% de ${String(p.file||'arquivo').split('/').pop()}`);}});
 report(65,'Reconhecendo o canto e os tempos por palavra. Isso pode levar vários minutos…');
 const options={task:'transcribe',return_timestamps:'word',chunk_length_s:25,stride_length_s:5,do_sample:false};
 const languages={pt:'portuguese',en:'english',es:'spanish'};if(languages[data.language])options.language=languages[data.language];
 const result=await transcriber(pcm,options);
 // Do not fabricate a [0,duration] segment when timestamps are missing.
 if(!Array.isArray(result.chunks)||!result.chunks.length)throw Error('O modelo retornou texto sem tempos. Importe LRC ou marque as frases.');
 self.postMessage({type:'result',text:result.text||'',chunks:result.chunks});
 await transcriber.dispose();
 }catch(e){self.postMessage({type:'error',message:String(e?.message||e)});}finally{busy=false;}
};
