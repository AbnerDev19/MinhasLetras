/* Worker de transcrição. A lógica de janelas/recuperação vive em asr-quality.js (testada em Node). */
let busy = false;
const report = (percent, message) => self.postMessage({ type: 'progress', percent, message });

async function loadModel(pipeline, kind, onFile) {
  // Mesma configuração da v3 (q8 em tudo). A mistura fp32/q8 da v4 podia piorar o reconhecimento.
  return pipeline('automatic-speech-recognition', `Xenova/whisper-${kind}`, { device: 'wasm', dtype: 'q8', progress_callback: onFile });
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'transcribe' || busy) return;
  busy = true; let transcriber;
  try {
    await import('./asr-quality.js');
    const { pcm } = data, duration = pcm?.length / 16000;
    if (!(pcm instanceof Float32Array) || !pcm.length || duration > 1800) throw Error('Para análise local use até 30 minutos. O exportador não corta o áudio.');
    let energy = 0; for (let i = 0; i < pcm.length; i++) energy += pcm[i] * pcm[i];
    if (Math.sqrt(energy / pcm.length) < 0.0001) throw Error('O arquivo está silencioso.');
    const kind = ['tiny', 'base', 'small'].includes(data.model) ? data.model : 'base';
    report(8, 'Carregando modelo e alinhamento por palavra…');
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    env.allowRemoteModels = true; env.useBrowserCache = true;
    env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, self.navigator?.hardwareConcurrency || 2) : 1;
    transcriber = await loadModel(pipeline, kind, p => { if (p.status === 'progress' && Number.isFinite(p.progress)) report(10 + p.progress * 0.3, `Modelo ${kind}: ${Math.round(p.progress)}% de ${String(p.file || 'arquivo').split('/').pop()}`); });
    const languages = { pt: 'portuguese', en: 'english', es: 'spanish' };
    const options = { task: 'transcribe', return_timestamps: 'word', do_sample: false, num_beams: 1 };
    if (languages[data.language]) options.language = languages[data.language];

    const out = await ASRQuality.transcribeLong({
      pcm, windowSec: 28,
      transcribe: async slice => (await transcriber(slice, options)).chunks,
      onProgress: (f, msg) => report(40 + 52 * f, msg),
      isCancelled: () => false
    });
    let words = out.words, issues = out.issues.slice();
    issues.unshift({ time: 0, level: 'info', reason: `Diagnóstico: áudio de ${duration.toFixed(1)} s, ${out.calls} chamadas ao modelo, ${words.length} palavras, de ${words[0]?.start.toFixed(1)} s a ${words.at(-1)?.end.toFixed(1)} s.` });
    if (!words.length) throw Error('Não foram encontrados tempos utilizáveis. Tente voz isolada, modelo Small ou análise avançada.');
    if (data.refine) {
      report(94, 'Refinando início das palavras pela energia do áudio…');
      const r = ASRQuality.refineWords(words, pcm, 16000);
      words = ASRQuality.cleanSequence(r.words, duration);
      issues.push({ time: 0, reason: `Refinamento por energia ajustou ${r.moved} horários.`, level: 'info' });
    }
    issues.push(...ASRQuality.inspect(words, duration));
    const estimated = words.filter(w => w.estimated).length;
    if (estimated) issues.push({ time: 0, reason: `${estimated} palavras tiveram o fim estimado (o início veio do modelo).`, level: 'info' });
    self.postMessage({ type: 'result', chunks: words.map(w => ({ text: w.text, timestamp: [w.start, w.end], estimated: !!w.estimated })), issues, model: kind, duration, processedUntil: duration });
  } catch (e) { self.postMessage({ type: 'error', message: String(e?.message || e) }); }
  finally { try { await transcriber?.dispose(); } catch {} busy = false; }
};
