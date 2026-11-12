let busy=false;
const report=(percent,message)=>self.postMessage({type:'progress',percent,message});
self.onmessage=async({data})=>{
 if(data?.type!=='transcribe'||busy)return;busy=true;let transcriber;
 try{
 await import('./asr-quality.js');
 const {pcm}=data,duration=pcm?.length/16000;
 if(!(pcm instanceof Float32Array)||!pcm.length||duration>1200)throw Error('Para análise local use até 20 minutos. O exportador não corta o áudio.');
 let energy=0;for(let i=0;i<pcm.length;i++)energy+=pcm[i]*pcm[i];if(Math.sqrt(energy/pcm.length)<.0001)throw Error('O arquivo está silencioso.');
 const kind=['tiny','base','small'].includes(data.model)?data.model:'base';
 report(8,'Carregando modelo e alinhamento por palavra…');
 const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
 env.allowRemoteModels=true;env.useBrowserCache=true;env.backends.onnx.wasm.numThreads=1;
 transcriber=await pipeline('automatic-speech-recognition',`Xenova/whisper-${kind}`,{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress'&&Number.isFinite(p.progress))report(10+p.progress*.35,`Modelo ${kind}: ${Math.round(p.progress)}% de ${String(p.file||'arquivo').split('/').pop()}`);}});
 const languages={pt:'portuguese',en:'english',es:'spanish'};
 const options={task:'transcribe',return_timestamps:'word',do_sample:false,num_beams:1};if(languages[data.language])options.language=languages[data.language];
 const windows=ASRQuality.windows(duration),chunks=[],issues=[];
 for(let i=0;i<windows.length;i++){
  const win=windows[i],slice=pcm.slice(Math.floor(win.from*16000),Math.ceil(win.to*16000));
  report(45+50*i/windows.length,`Analisando bloco ${i+1}/${windows.length} — ${Math.floor(win.start)} a ${Math.ceil(win.end)} segundos`);
  let result;
  for(let attempt=0;attempt<2;attempt++){
   try{result=await transcriber(slice,options);break;}catch(e){if(attempt||/memory|allocation|out of bounds/i.test(String(e)))throw e;report(45+50*i/windows.length,`Repetindo o bloco ${i+1} após falha…`);}
  }
  if(!Array.isArray(result?.chunks))throw Error(`Bloco ${i+1}: o modelo não retornou tempos. Nenhum resultado parcial foi aplicado.`);
  const flagged=ASRQuality.inspect(result.chunks,slice.length/16000);
  issues.push(...flagged.map(x=>({...x,block:i+1,time:Number.isFinite(x.time)?x.time+win.from:win.start})));
  if(!result.chunks.length)issues.push({block:i+1,time:win.start,reason:'Sem palavras reconhecidas: pode ser instrumental ou falha de reconhecimento'});
  chunks.push(...ASRQuality.mergeWindow(result.chunks,win,duration));
 }
 const merged=ASRQuality.mergeAll(chunks);issues.push(...ASRQuality.inspect(merged,duration));
 if(!merged.length)throw Error('Não foram encontrados tempos utilizáveis. Tente voz isolada, modelo Small ou análise avançada.');
 self.postMessage({type:'result',chunks:merged,issues,model:kind,duration,processedUntil:duration});
 }catch(e){self.postMessage({type:'error',message:String(e?.message||e)});}finally{try{await transcriber?.dispose();}catch{}busy=false;}
};
