/**
 * LyricCode — inference in the user's own browser.
 * The module and Whisper weights are fetched from public CDNs on first use.
 * No audio is POSTed to our server; it arrives from the page as a transferable Float32Array.
 * For resource-limited mobiles, use Tiny, q8 and a single WASM thread.
 */
let pipelineInstance = null;
let lastModel = '';

function progress(percent, message) {
  self.postMessage({ type: 'progress', percent: Math.min(97, Math.max(0, percent)), message });
}

self.onmessage = async ({ data }) => {
  if (!data || data.type !== 'transcribe') return;
  try {
    if (!(data.pcm instanceof Float32Array) || !data.pcm.length) {
      throw new Error('O áudio não foi decodificado corretamente.');
    }
    const kind = data.model === 'base' ? 'base' : 'tiny';
    const modelId = `Xenova/whisper-${kind}`;
    progress(15, 'Carregando biblioteca de IA...');
    // CDN loading is endorsed by the project's official installation guide.
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
    }
    if (!pipelineInstance || lastModel !== modelId) {
      progress(19, `Baixando o Whisper ${kind} (primeiro uso pode demorar)...`);
      pipelineInstance = await pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q8',
        progress_callback: info => {
          if (info?.status === 'progress' && Number.isFinite(info.progress)) {
            progress(20 + 48 * info.progress / 100,
              `Modelo de IA: ${Math.round(info.progress)}% de ${String(info.file || 'arquivos').split('/').pop()}`);
          }
          if (info?.status === 'ready') progress(70, 'Modelo pronto. Lendo a voz da música...');
        },
      });
      lastModel = modelId;
    }
    progress(73, 'Reconhecendo palavras cantadas e procurando seus tempos...');
    const languages = { pt: 'portuguese', en: 'english', es: 'spanish' };
    const options = {
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 24,
      stride_length_s: 4,
      condition_on_previous_text: false,
    };
    if (languages[data.language]) options.language = languages[data.language];
    const result = await pipelineInstance(data.pcm, options);
    const chunks = Array.isArray(result?.chunks) && result.chunks.length
      ? result.chunks
      : (result?.text ? [{ text: result.text, timestamp: [0, data.pcm.length / 16000] }] : []);
    progress(98, 'Montando a letra e a sincronização...');
    self.postMessage({ type: 'result', text: result?.text || '', chunks });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: String(error?.message || error || 'Falha de transcrição.'),
    });
  }
};
