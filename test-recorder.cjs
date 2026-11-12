const assert=require('node:assert/strict');const FullTrackRecorder=require('./recorder.js');
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(){const tracks=[];const track=()=>{const t={readyState:'live',stop(){this.readyState='ended'}};tracks.push(t);return t;};const video=track(),audio=track();
 const stream={getTracks:()=>[audio],getAudioTracks:()=>[audio]};
 const context={currentTime:0,state:'running',destination:{},resume:async()=>{},createMediaStreamDestination:()=>({stream,disconnect(){}}),createBufferSource(){this.source={connect(){},disconnect(){},start(t){this.at=t},stop(){this.stopped=true}};return this.source;}};
 class Recorder{constructor(){this.state='inactive';this.mimeType='video/webm';}start(){this.state='recording';queueMicrotask(()=>this.onstart());}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['LAST-AUDIO-PACKET'])});this.onstop();}}
 const job=new FullTrackRecorder({context,canvas:{captureStream:()=>({getVideoTracks:()=>[video],getTracks:()=>[video]})},buffer:{duration:62.75},mimeType:'video/webm',Recorder,Stream:class{constructor(t){this.tracks=t}}});return {job,context,tracks};}
(async()=>{
 {const {job,context,tracks}=fixture();const promise=job.start();await tick();assert.equal(context.source.at,0);context.currentTime=12;assert.equal(job.time,12);assert.equal(job.phase,'recording');context.currentTime=62.75;context.source.onended();const result=await promise;assert.equal(result.duration,62.75);assert.equal(await result.blob.text(),'LAST-AUDIO-PACKET');assert(tracks.every(t=>t.readyState==='ended'));}
 {const {job}=fixture();const promise=job.start();await tick();job.recorder.stop();await assert.rejects(promise,/antes do áudio completo/);}
 {const {job,context}=fixture();const promise=job.start();await tick();context.currentTime=30;context.source.onended();await assert.rejects(promise,/antes da duração/);}
 {const {job}=fixture();const promise=job.start();await tick();job.cancel();await assert.rejects(promise,/cancelada/);}
 {const {job}=fixture();job.maxBytes=1;await assert.rejects(job.start(),/não será cortado/);}
 {const {job}=fixture();const promise=job.start();await tick();job.recorder.onerror({error:Error('codec failed')});await assert.rejects(promise,/codec failed/);}
 console.log('Recorder: full duration, final packet, early stop, early source end, cancel, memory preflight, codec failure passed');
})().catch(e=>{console.error(e);process.exitCode=1});
