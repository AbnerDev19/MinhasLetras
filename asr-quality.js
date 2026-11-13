/*
 * Transcrição de áudio longo + verificação/refinamento de tempos por palavra.
 * Nenhum código de modelo aqui: `transcribe` é injetado, então tudo é testável em Node.
 *
 * Por que não blocos fixos de 20 s:
 *  - O Whisper às vezes para no meio da janela (comum em música). Com blocos fixos,
 *    o resto do bloco se perdia. Aqui a próxima janela começa na ÚLTIMA palavra aceita,
 *    como no Whisper original ("seek"), então nada depois da parada é pulado.
 *  - Palavras cujo fim vem nulo (última palavra de cada janela) eram descartadas.
 *    Agora o início real é mantido e o fim é estimado (e marcado como `estimated`).
 *  - Depois da varredura, trechos longos com áudio e sem palavras são reanalisados
 *    com janelas curtas antes de serem reportados.
 */
(function (root) {
'use strict';

const SR = 16000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const HALLUCINATIONS = [/legendas?\s+pela\s+comunidade/i, /amara\.org/i, /obrigad[oa]\s+por\s+assistir/i, /thanks?\s+for\s+watching/i, /subtitles?\s+by/i];

/* ---------- áudio: nível em dB por quadro de 10 ms ---------- */
function frameDb(pcm, sr = SR, hopSec = 0.01, winSec = 0.03) {
  const hop = Math.max(1, Math.round(sr * hopSec)), n = Math.floor(pcm.length / hop);
  const prefix = new Float64Array(n + 1);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = j * hop, e = i + hop; i < e; i++) s += pcm[i] * pcm[i];
    prefix[j + 1] = prefix[j] + s / hop;
  }
  const k = Math.max(1, Math.round(winSec / hopSec)), half = k >> 1, db = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const a = Math.max(0, j - half), b = Math.min(n, a + k);
    db[j] = 10 * Math.log10((prefix[b] - prefix[a]) / Math.max(1, b - a) + 1e-12);
  }
  return db;
}
function percentile(arr, p, from = 0, to = arr.length) {
  const s = Array.from(arr.subarray ? arr.subarray(from, to) : arr.slice(from, to)).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : -120;
}

/* ---------- palavras ---------- */
// chunks {text, timestamp:[ini, fim|null]} locais -> palavras absolutas {text,start,end,estimated}
function normalizeWords(chunks, offset = 0, limit = Infinity) {
  const out = [];
  for (const c of Array.isArray(chunks) ? chunks : []) {
    const text = String(c?.text ?? '').trim();
    if (!text || /^[\[(].*[\])]$/.test(text) || /^[♪♫\s]+$/.test(text)) continue;
    const t = c.timestamp;
    if (!Array.isArray(t) || !Number.isFinite(t[0])) continue;       // sem início real: não inventamos
    const start = t[0] + offset;
    if (start >= limit) continue;
    out.push({ text, start, end: Number.isFinite(t[1]) ? t[1] + offset : NaN, estimated: false });
  }
  for (let i = 0; i < out.length; i++) {
    const w = out[i], next = out[i + 1];
    if (!(w.end > w.start)) {                                          // fim nulo/inválido: estima, nunca descarta
      const guess = w.start + Math.min(0.6, 0.08 * Array.from(w.text).length + 0.12);
      w.end = next && next.start > w.start + 0.04 ? Math.min(guess, next.start) : guess;
      w.estimated = true;
    }
    w.end = Math.min(w.end, limit);
  }
  return out.filter(w => w.end > w.start);
}
// ordena, impede sobreposição e garante duração mínima
function cleanSequence(words, duration) {
  const sorted = words.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end))
    .map(w => ({ ...w })).sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const w of sorted) {
    w.start = clamp(w.start, 0, duration); w.end = clamp(w.end, 0, duration);
    if (w.start >= duration - 0.01) continue;
    const prev = out.at(-1);
    if (prev) {
      if (w.start < prev.start + 0.01) w.start = prev.start + 0.01;
      if (prev.end > w.start) prev.end = Math.max(prev.start + 0.03, w.start);
    }
    if (w.end < w.start + 0.03) w.end = Math.min(duration, w.start + 0.03);
    out.push(w);
  }
  return out;
}
const overlap = (a, b) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
function mergeInto(base, extra) {
  const out = base.slice();
  for (const e of extra) {
    const dup = out.some(b => {
      const same = b.text.toLowerCase() === e.text.toLowerCase() && Math.abs(b.start - e.start) < 0.25;
      return same || overlap(b, e) > 0.5 * Math.min(b.end - b.start, e.end - e.start);
    });
    if (!dup) out.push(e);
  }
  return out.sort((a, b) => a.start - b.start);
}
function looksHallucinated(words) {
  if (!words.length) return false;
  const text = words.map(w => w.text).join(' ');
  return HALLUCINATIONS.some(rx => rx.test(text));
}

/* ---------- varredura principal ---------- */
async function transcribeLong(opts) {
  const { pcm, transcribe } = opts, sr = opts.sampleRate || SR;
  const windowSec = opts.windowSec || 28, guard = opts.guardSec ?? 1.5, minAdvance = opts.minAdvance || 1, shortSec = opts.shortWindowSec || 10;
  const report = opts.onProgress || (() => {}), cancelled = opts.isCancelled || (() => false);
  const duration = pcm.length / sr, hop = 0.01;
  const db = frameDb(pcm, sr, hop, 0.03);
  const speechThr = Math.max(-70, percentile(db, 0.1)) + 8;
  const frames = (a, b) => [clamp(Math.floor(a / hop), 0, db.length), clamp(Math.ceil(b / hop), 0, db.length)];
  const silent = (a, b) => { const [f, g] = frames(a, b); return g <= f || percentile(db, 0.95, f, g) < -55; };
  const activity = (a, b) => { const [f, g] = frames(a, b); let n = 0; for (let i = f; i < g; i++) if (db[i] > speechThr) n++; return g > f ? n / (g - f) : 0; };
  const slice = (a, b) => pcm.slice(Math.floor(a * sr), Math.ceil(b * sr));
  const issues = [];
  let words = [], calls = 0;

  async function run(a, b) {
    let last;
    for (let attempt = 0; attempt <= (opts.retries ?? 1); attempt++) {
      try {
        calls++;
        const chunks = await transcribe(slice(a, b), { from: a, to: b });
        if (!Array.isArray(chunks)) throw Error('O modelo não retornou tempos.');
        return { words: normalizeWords(chunks, a, b) };
      } catch (e) {
        if (/memory|allocation|out of bounds/i.test(String(e?.message || e))) throw e;   // sem recurso: não adianta repetir
        last = e;
      }
    }
    return { error: last };
  }
  async function attemptWindow(seek, len) {
    const end = Math.min(duration, seek + len), final = end >= duration - 0.05;
    const r = await run(seek, end);
    if (r.error) return { error: r.error, end };
    let all = r.words.filter(w => w.start >= seek - 0.02);
    if (looksHallucinated(all)) all = [];
    const limit = final ? end + 1 : end - guard;            // palavra colada no corte pode estar truncada
    return { all, kept: all.filter(w => w.end <= limit), end, final };
  }

  let seek = 0, guardIter = 0;
  const maxIter = Math.ceil(duration / minAdvance) + 20;
  while (seek < duration - 0.4 && guardIter++ < maxIter) {
    if (cancelled()) throw Error('Cancelado');
    const end = Math.min(duration, seek + windowSec);
    report(0.9 * seek / duration, `Analisando ${fmt(seek)} → ${fmt(end)} de ${fmt(duration)}`);
    if (silent(seek, end)) { seek = end; continue; }

    let len = windowSec, res = await attemptWindow(seek, len);
    if (res.error) { len = shortSec; res = await attemptWindow(seek, len); }
    if (res.error) {
      issues.push({ time: seek, reason: `Falha ao analisar ${fmt(seek)}–${fmt(res.end)}: ${String(res.error?.message || res.error)}`, level: 'warn' });
      seek = res.end; continue;
    }
    if (!res.all.length && len > shortSec && activity(seek, res.end) >= 0.5) {   // há som e nada reconhecido: tenta janela curta
      const second = await attemptWindow(seek, shortSec);
      if (!second.error) res = second;
    }
    if (!res.kept.length && res.all.length) {                                     // só havia fala colada no corte
      seek = Math.max(seek + minAdvance, res.all[0].start - 0.25); continue;
    }
    words = mergeInto(words, res.kept);
    seek = res.kept.length ? Math.max(seek + minAdvance, res.kept.at(-1).end - 0.05) : Math.max(seek + minAdvance, res.end);
  }

  /* ---------- recuperação: som sem palavras por muito tempo ---------- */
  words = cleanSequence(words, duration);
  if (opts.fillGaps !== false) {
    const total = opts.maxGapCalls ?? 12;
    let budget = total;
    for (const gap of findGaps(words, db, { duration, speechThr, minGap: opts.minGapSec ?? 6 })) {
      for (let a = gap.from; a < gap.to - 1 && budget > 0; a += shortSec) {
        if (cancelled()) throw Error('Cancelado');
        budget--;
        const b = Math.min(gap.to, a + shortSec), c = Math.max(0, a - 0.5), d = Math.min(duration, b + 0.5);
        report(0.9 + 0.1 * (1 - budget / total), `Reanalisando trecho sem letra ${fmt(a)} → ${fmt(b)}`);
        const r = await run(c, d);
        if (r.error) continue;
        const found = r.words.filter(w => w.start >= a - 0.05 && w.start < b && w.end <= d - 0.1);
        if (!looksHallucinated(found)) words = mergeInto(words, found);
      }
    }
    words = cleanSequence(words, duration);
    for (const g of findGaps(words, db, { duration, speechThr, minGap: opts.minGapSec ?? 6 }))
      issues.push({ time: g.from, reason: `Há áudio de ${fmt(g.from)} a ${fmt(g.to)} sem palavras reconhecidas (instrumental ou voz não captada). Ouça e, se houver letra, adicione.`, level: 'info' });
  }
  return { words, issues, duration, calls };
}

// trechos contínuos sem palavra (com 0,3 s de folga) e com som
function findGaps(words, db, { duration, speechThr, minGap = 6, hop = 0.01 }) {
  const n = db.length, covered = new Uint8Array(n);
  for (const w of words) for (let f = Math.max(0, Math.floor((w.start - 0.3) / hop)); f <= Math.min(n - 1, Math.ceil((w.end + 0.3) / hop)); f++) covered[f] = 1;
  const gaps = [], need = Math.round(minGap / hop);
  for (let f = 0; f < n;) {
    if (covered[f]) { f++; continue; }
    let g = f, active = 0;
    while (g < n && !covered[g]) { if (db[g] > speechThr) active++; g++; }
    if (g - f >= need && active / (g - f) >= 0.5) gaps.push({ from: f * hop, to: Math.min(duration, g * hop) });
    f = g;
  }
  return gaps;
}

/* ---------- verificação ---------- */
function inspect(words, duration) {
  const issues = [];
  let prev = -1, repeats = 0, last = '';
  words.forEach((w, i) => {
    if (![w.start, w.end].every(Number.isFinite) || w.start < 0 || w.end <= w.start || w.end > duration + 0.1) { issues.push({ index: i, time: Number.isFinite(w.start) ? w.start : 0, text: w.text, reason: 'Horário ausente ou inválido' }); return; }
    if (w.start < prev - 0.05) issues.push({ index: i, time: w.start, text: w.text, reason: 'Palavras fora de ordem' });
    prev = w.start;
    if (w.end - w.start > 3.5) issues.push({ index: i, time: w.start, text: w.text, reason: 'Palavra muito longa: confira o canto', level: 'info' });
    const text = String(w.text || '').trim().toLowerCase();
    repeats = text === last ? repeats + 1 : 0; last = text;
    if (repeats === 3) issues.push({ index: i, time: w.start, text, reason: 'Repetição: confirme se pertence à música', level: 'info' });
  });
  return issues;
}

/* ---------- refinamento por energia (opcional) ----------
 * Move o INÍCIO de uma palavra para o maior ataque de energia a até `maxShift` s dele,
 * e encurta o FIM antes de pausas quando a energia some. Só age com evidência clara
 * (subida de >= minRise dB em 40 ms acima do ruído) e nunca troca a ordem das palavras.
 * Com voz isolada funciona bem; com música cheia só confirma ataques fortes. */
function refineWords(words, pcm, sr = SR, { maxShift = 0.15, minRise = 7 } = {}) {
  const hop = 0.01, db = frameDb(pcm, sr, hop, 0.03), n = db.length, duration = pcm.length / sr;
  const floor = percentile(db, 0.1), at = t => clamp(Math.round(t / hop), 0, n - 1);
  const out = words.map(w => ({ ...w })); let moved = 0;
  for (let i = 0; i < out.length; i++) {
    const w = out[i], prev = out[i - 1], next = out[i + 1], f0 = at(w.start), r = Math.round(maxShift / hop);
    let best = -1, bestRise = minRise;
    for (let f = Math.max(2, f0 - r); f <= Math.min(n - 3, f0 + r); f++) {
      const rise = db[f + 2] - db[f - 2];
      if (rise > bestRise && db[f + 2] > floor + 10) { best = f; bestRise = rise; }
    }
    if (best >= 0) {
      const s = (best - 1) * hop, lo = prev ? prev.start + 0.03 : 0;
      if (s > lo && s < w.end - 0.04) { if (prev && prev.end > s) prev.end = Math.max(prev.start + 0.03, s); if (Math.abs(s - w.start) > 0.004) moved++; w.start = s; w.estimated = false; }
    }
    if ((next ? next.start - w.end : 1) > 0.12) {
      let peak = -120; for (let f = at(w.start); f <= at(w.end); f++) peak = Math.max(peak, db[f]);
      const thr = Math.max(peak - 22, floor + 6), lim = at(Math.min(w.end + 0.35, (next ? next.start : duration) - 0.02));
      let f = lim; while (f > at(w.end - 0.25) && db[f] < thr) f--;
      const e = (f + 1) * hop;
      if (e > w.start + 0.06 && Math.abs(e - w.end) <= 0.35 && Math.abs(e - w.end) > 0.004) { w.end = e; moved++; }
    }
  }
  return { words: out, moved };
}

root.ASRQuality = { frameDb, percentile, normalizeWords, cleanSequence, mergeInto, findGaps, transcribeLong, inspect, refineWords, looksHallucinated };
if (typeof module !== 'undefined') module.exports = root.ASRQuality;
})(globalThis);
