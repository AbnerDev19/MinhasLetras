/* Export owns its audio source and clock. Preview media events cannot end it. */
(function(root){
'use strict';
class FullTrackRecorder{
 constructor({context,canvas,buffer,mimeType,videoBitsPerSecond=2600000,Recorder=root.MediaRecorder,Stream=root.MediaStream,onProgress=()=>{},maxBytes=180*1024*1024}){
  Object.assign(this,{context,canvas,buffer,mimeType,videoBitsPerSecond,Recorder,Stream,onProgress,maxBytes});this.phase='idle';this.chunks=[];this.bytes=0;this.completedAudio=false;
 }
 get time(){return this.startAt===undefined?0:Math.min(this.buffer.duration,Math.max(0,this.context.currentTime-this.startAt));}
 async start(){
  if(this.phase!=='idle')throw Error('Gravação já iniciada.');this.phase='preparing';
  this.result=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
  try{
   if(!this.buffer||!Number.isFinite(this.buffer.duration)||this.buffer.duration<=0)throw Error('Áudio vazio.');
   if((this.videoBitsPerSecond+192000)*this.buffer.duration/8>this.maxBytes*.9)throw Error('Este vídeo excederia a memória reservada. Escolha uma resolução menor. O áudio não será cortado.');
   await this.context.resume();if(this.phase==='failed')return this.result;
   this.destination=this.context.createMediaStreamDestination();this.source=this.context.createBufferSource();this.source.buffer=this.buffer;
   this.source.connect(this.destination);this.source.connect(this.context.destination);
   this.videoStream=this.canvas.captureStream(30);
   const tracks=[...this.videoStream.getVideoTracks(),...this.destination.stream.getAudioTracks()];
   if(tracks.length!==2||tracks.some(t=>t.readyState!=='live'))throw Error('Não foi possível abrir as faixas de áudio e vídeo.');
   this.recorder=new this.Recorder(new this.Stream(tracks),{mimeType:this.mimeType,videoBitsPerSecond:this.videoBitsPerSecond,audioBitsPerSecond:192000});
   this.recorder.ondataavailable=e=>{if(e.data?.size&&this.phase!=='failed'){this.bytes+=e.data.size;if(this.bytes>this.maxBytes){this.fail(Error('Memória de gravação excedida; nenhum vídeo parcial foi publicado.'));return;}this.chunks.push(e.data);}};
   this.recorder.onerror=e=>this.fail(Error(e.error?.message||'Erro do codificador de vídeo.'));
   this.recorder.onstop=()=>{
    if(this.phase==='failed')return;
    if(!this.completedAudio||!this.chunks.length){this.fail(Error('Gravação terminou antes do áudio completo. Nenhum arquivo parcial foi publicado.'));return;}
    const blob=new Blob(this.chunks,{type:this.recorder.mimeType||this.mimeType});this.phase='done';this.cleanup();this.resolve({blob,duration:this.buffer.duration,bytes:blob.size});
   };
   this.recorder.onstart=()=>{
    if(this.phase==='failed')return;clearTimeout(this.startWatchdog);
    try{this.startAt=this.context.currentTime;this.phase='recording';this.source.start(this.startAt);
    this.timer=setInterval(()=>{if(this.context.state!=='running')this.fail(Error('O aparelho suspendeu o áudio. Repita mantendo a tela ativa.'));else this.onProgress(this.time,this.buffer.duration);},250);}catch(e){this.fail(e);}
   };
   this.source.onended=()=>{
    if(this.phase!=='recording')return;
    if(this.time<this.buffer.duration-.08){this.fail(Error('A reprodução terminou antes da duração original.'));return;}
    this.completedAudio=true;this.phase='finalizing';this.onProgress(this.buffer.duration,this.buffer.duration);
    // Leave a small encoder tail so the last audio packet is not cut off.
    this.tail=setTimeout(()=>{if(this.phase==='finalizing'&&this.recorder.state!=='inactive'){this.stopWatchdog=setTimeout(()=>this.fail(Error('O codificador não finalizou o arquivo.')),10000);this.recorder.stop();}},250);
   };
   this.startWatchdog=setTimeout(()=>this.fail(Error('O codificador não iniciou a gravação.')),10000);this.recorder.start(1000);
  }catch(e){this.fail(e);}
  return this.result;
 }
 fail(error){if(['done','failed'].includes(this.phase))return;this.phase='failed';this.cleanup();this.reject?.(error);}
 cancel(){this.fail(Error('Exportação cancelada. Nenhum arquivo parcial foi publicado.'));}
 cleanup(){clearInterval(this.timer);clearTimeout(this.tail);clearTimeout(this.startWatchdog);clearTimeout(this.stopWatchdog);if(this.source){this.source.onended=null;try{this.source.stop();}catch{}try{this.source.disconnect();}catch{}}if(this.recorder&&this.recorder.state!=='inactive')try{this.recorder.stop();}catch{}for(const track of [...(this.videoStream?.getTracks()||[]),...(this.destination?.stream.getTracks()||[])])track.stop();try{this.destination?.disconnect();}catch{}this.chunks=[];}
}
root.FullTrackRecorder=FullTrackRecorder;if(typeof module!=='undefined')module.exports=FullTrackRecorder;
})(globalThis);
