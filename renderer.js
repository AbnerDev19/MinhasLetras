/*
 * Renderizador do vídeo. Função pura do tempo: draw(t, opções) não guarda estado entre
 * quadros, então busca na barra, pausa e exportação mostram exatamente o mesmo desenho.
 * Todas as transições são calculadas a partir do horário das frases (sem saltos).
 */
(function (root) {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const easeInOut = x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rgba(hex, a) { return /^#[\da-f]{6}$/i.test(hex) ? `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})` : hex; }
function gw(ch) { const cp = ch.codePointAt(0); return cp >= 0x1100 && (cp <= 0x115f || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x1f300 && cp <= 0x1faff)) ? 2 : 1; }

// Quebra os glifos em linhas de até maxCols colunas, só nos espaços da letra.
function layoutRows(glyphs, maxCols) {
  const rows = [], lim = r => maxCols - (r ? 2 : 0);
  let row = [], cols = 0, lastSpace = -1;
  glyphs.forEach((g, i) => {
    const w = gw(g.ch), cell = { ...g, i };
    if (cols + w > lim(rows.length) && row.length) {
      if (g.ch === ' ' && g.src >= 0) { rows.push(row); row = []; cols = 0; lastSpace = -1; return; }   // espaço na quebra some
      if (lastSpace > 0 && g.src >= 0) { const tail = row.splice(lastSpace + 1); rows.push(row); row = tail; } else { rows.push(row); row = []; }
      cols = row.reduce((n, x) => n + gw(x.ch), 0); lastSpace = -1;
    }
    if (g.ch === ' ' && g.src >= 0) lastSpace = row.length;
    row.push(cell); cols += w;
  });
  if (row.length) rows.push(row);
  return rows;
}

function create(ctx, { W = 1080, H = 1920, mono = 'monospace' } = {}) {
  const rnd = rng(20240611);
  const particles = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), v: 6 + rnd() * 22, s: 1 + rnd() * 4.2, a: .1 + rnd() * .22, ph: rnd() * 6.28, k: rnd() < .34 ? 'orange' : 'blue', sw: 8 + rnd() * 26 }));
  const cache = new Map();
  let cw = 24;

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    r = Math.min(r, w / 2, h / 2); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lineInfo(line, language, cols) {
    const key = `${language}|${cols}|${line.words ? line.words.length : 0}|${line.text}`;
    let L = cache.get(key);
    if (!L) {
      if (cache.size > 600) cache.clear();
      const prog = root.LyricStyles.program(line.text, language), wordOf = [];
      if (line.words?.length) line.words.forEach((w, wi) => { for (let k = 0; k < Array.from(w.text).length; k++) wordOf.push(wi); wordOf.push(-1); });
      L = { rows: layoutRows(prog.glyphs, cols), total: prog.total, count: prog.count, wordOf };
      cache.set(key, L);
    }
    return L;
  }
  function activeIndex(lines, t) { let lo = 0, hi = lines.length - 1, f = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m].time <= t) { f = m; lo = m + 1; } else hi = m - 1; } return f; }

  /* ---------- peças ---------- */
  function background(t, p, level, o) {
    ctx.globalAlpha = 1; ctx.fillStyle = '#020306'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * .46, 40, W / 2, H * .46, 980);
    g.addColorStop(0, rgba(p.bottom, .16 + .26 * level)); g.addColorStop(.55, rgba(p.bottom, .05)); g.addColorStop(1, rgba(p.bottom, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!o.glitch) return;
    ctx.save();
    for (const q of particles) {
      const x = ((q.x * W + Math.sin(t * .18 + q.ph) * q.sw) % W + W) % W, y = (((q.y * H - t * q.v) % H) + H) % H;
      ctx.globalAlpha = q.a * (.75 + .6 * level); ctx.fillStyle = q.k === 'orange' ? p.orange : p.blue;
      ctx.beginPath(); ctx.arc(x, y, q.s * (1 + .25 * level), 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  function vignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function keyboard(t, p, level, I) {
    ctx.save(); const oy = 1436;
    const grad = ctx.createRadialGradient(W * .5, oy + 365, 15, W * .5, oy + 365, 480);
    grad.addColorStop(0, rgba(p.bottom, .15 + .35 * level)); grad.addColorStop(.6, rgba(p.bottom, .085)); grad.addColorStop(1, rgba(p.bottom, 0));
    ctx.fillStyle = grad; ctx.fillRect(0, oy - 100, W, 484);
    ctx.transform(1, .07, 0, .59, 0, oy + 102);
    const rows = [[13, 42, 0], [13, 42, 14], [12, 45, 31], [11, 49, 55]];
    for (let r = 0; r < rows.length; r++) {
      const [num, keyW, offset] = rows[r], gap = 9, total = num * keyW + (num - 1) * gap, start = (W - total) * .5 + offset, y = r * 99;
      for (let i = 0; i < num; i++) {
        const x = start + i * (keyW + gap), wave = .4 + .6 * Math.sin(t * 2.6 + i * .9 + r * 1.9), v = clamp(.09 + level * .9 * I + Math.max(0, wave) * .075, 0, .7);
        rr(x, y, keyW, 76, 6); ctx.fillStyle = rgba(p.bottom, .28 + v * .36); ctx.fill(); ctx.strokeStyle = '#080a16'; ctx.stroke();
        rr(x + 4, y + 4, keyW - 8, 65, 4); ctx.fillStyle = rgba(p.bottom, .04 + v * .15); ctx.fill();
        ctx.fillStyle = rgba('#ddd5ff', .12 + v * .4); ctx.font = `500 14px ${mono}`; ctx.fillText('QWERTYUIOPASDFGHJKLZXCVBNM'[(r * 11 + i) % 26], x + 15, y + 25);
      }
    }
    ctx.restore();
  }
  function label(text, alpha, t, p) {
    if (alpha <= .01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.font = `500 32px ${mono}`; ctx.fillStyle = '#7b8498';
    ctx.fillText(text + (Math.floor(t * 1.8) % 2 ? ' ▌' : ''), W / 2, H * .46); ctx.restore();
  }
  function header(x, y, text, alpha) { ctx.save(); ctx.globalAlpha = alpha; ctx.font = `400 22px ${mono}`; ctx.fillStyle = '#8b8d86'; ctx.fillText('▌ ' + text, x, y); ctx.restore(); }

  // Desenha uma frase (todas as linhas visuais). yTop = linha de base da primeira linha.
  function drawLine(L, { x0, yTop, fs, lineH, alpha, count, hi, p, glow, center, cursor, bold, dx = 0 }) {
    if (alpha <= .005) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.font = `${bold ? 700 : 500} ${fs}px ${mono}`;
    let curRow = -1, curCol = 0;
    L.rows.forEach((row, r) => {
      const y = yTop + r * lineH, indent = center ? 0 : (r ? 2 : 0);
      const rowCols = row.reduce((n, g) => n + gw(g.ch), 0), xs = (center ? W / 2 - rowCols * cw / 2 : x0 + indent * cw) + dx;
      let col = 0, run = null;
      const flush = () => { if (!run) return; ctx.fillStyle = run.color; ctx.shadowColor = rgba(p.hot, .85); ctx.shadowBlur = run.hot ? glow * 1.8 : (bold ? glow * .4 : 0); ctx.fillText(run.text, xs + run.col * cw, y); run = null; };
      for (const g of row) {
        if (g.i >= count) break;
        const hot = hi >= 0 && g.src >= 0 && L.wordOf[g.src] === hi, key = hot ? 'hot' : g.type;
        if (!run || run.key !== key) { flush(); run = { key, hot, color: hot ? p.hot : (p[g.type] || p.white), text: '', col }; }
        run.text += g.ch; col += gw(g.ch);
        if (g.i === count - 1) { curRow = r; curCol = col; }
      }
      flush();
      if (cursor && count === 0 && r === 0) { curRow = 0; curCol = 0; }
      if (cursor && curRow === r) {
        ctx.shadowBlur = 0; ctx.fillStyle = p.hot; ctx.shadowColor = p.hot; ctx.shadowBlur = 28;
        ctx.fillRect(xs + curCol * cw + 4, y - fs * .86, Math.max(9, cw * .42), fs * 1.02); ctx.shadowBlur = 0;
      }
    });
    ctx.restore();
  }

  /* ---------- quadro ---------- */
  function draw(t, o) {
    const p = o.palette, I = clamp(o.intensity ?? .65, 0, 1), level = clamp(o.level || 0, 0, 1), lines = o.lines || [], mode = o.mode, lang = o.language || 'python';
    const time = t - (o.offset || 0), active = activeIndex(lines, time);
    background(t, p, level, o);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const fsBase = (mode === 'focus' ? 62 : 44) * (o.fontScale || 1);
    ctx.font = `500 ${fsBase}px ${mono}`; cw = ctx.measureText('M').width; if (!(cw > 0)) cw = fsBase * .6;
    const lineH = fsBase * 1.62, fileName = o.fileName || 'minha_musica.py';

    if (active < 0) {
      header(72, H * .46 - 90, fileName, .8);
      label(lines.length ? '// …' : '// sua música vira código', clamp(1 - (lines.length ? Math.max(0, time - (lines[0].time - 1.2)) / 1.2 : 0), 0, 1), t, p);
    } else {
      const cur = lines[active], age = time - cur.time, lastEnd = cur.end ?? cur.time + 3, nextT = lines[active + 1]?.time ?? Infinity;
      // depois de ~2 s do fim da frase sem outra começando: some devagar e mostra "instrumental"
      const quiet = time - (lastEnd + 2.2), fade = quiet > 0 && nextT > time ? easeInOut(quiet / .7) : 0, groupAlpha = 1 - fade;
      const widthPx = W - 144, cols = Math.max(12, Math.floor(widthPx / cw));
      const stateOf = (i, c = cols) => {
        const L = lineInfo(lines[i], lang, c), isActive = i === active;
        const count = i < active ? L.total : L.count(root.LyricTiming.visibleCharacters(lines[i], time));
        return { L, count, hi: isActive ? root.LyricTiming.wordAt(lines[i], time) : -1 };
      };
      const hOf = (i, c = cols) => lineInfo(lines[i], lang, c).rows.length * lineH + lineH * .35;
      const common = { fs: fsBase, lineH, p, glow: 10 + 26 * level };
      const typing = age < (cur.words?.length ? cur.end - cur.time + .15 : 99);
      const cursorOn = typing || Math.floor(time * 1.9) % 2 === 0;

      if (mode === 'focus') {
        ctx.save(); ctx.translate(W / 2, H * .46); const z = .94 + .06 * easeOut(age / .4); ctx.scale(z, z); ctx.translate(-W / 2, -H * .46);
        if (active > 0 && age < .3) {                                   // frase anterior se dissolve
          const { L } = stateOf(active - 1), tot = L.rows.length * lineH;
          drawLine(L, { ...common, x0: 0, center: true, yTop: H * .46 - tot / 2 + fsBase * .35, alpha: (1 - easeOut(age / .3)) * groupAlpha, count: L.total, hi: -1 });
        }
        const s = stateOf(active), tot = s.L.rows.length * lineH;
        header(72, H * .2, fileName, .8 * groupAlpha);
        drawLine(s.L, { ...common, x0: 0, center: true, bold: true, yTop: H * .46 - tot / 2 + fsBase * .35, alpha: easeOut(age / .18) * groupAlpha, count: s.count, hi: s.hi, cursor: cursorOn });
        ctx.restore();
      } else if (mode === 'stack' || mode === 'terminal') {
        const cc = cols - (mode === 'stack' ? 2 : 3), e = easeOut(age / (mode === 'stack' ? .45 : .3)), hAct = hOf(active, cc);
        ctx.save(); ctx.globalAlpha = 1;
        if (mode === 'stack') {
          const anchor = H * .56, x0 = 110; header(72, H * .13, fileName, .8 * groupAlpha);
          ctx.fillStyle = rgba('#ffffff', .035 * groupAlpha); ctx.fillRect(48, anchor + hAct * (1 - e) - hAct + lineH * .35 - fsBase * .35, W - 96, hAct);
          ctx.fillStyle = rgba('#ffffff', .07 * groupAlpha); ctx.fillRect(92, H * .15, 2, H * .6);
          let rel = hAct * (1 - e);                                   // posição da base da frase ativa (rolagem contínua)
          for (let i = active; i >= 0 && rel > -H * .5; i--) {
            const h = hOf(i, cc), L = lineInfo(lines[i], lang, cc), yBase = anchor + rel - lineH * .35, yTop = yBase - (L.rows.length - 1) * lineH, delta = active - i;
            const edge = clamp((yTop - H * .17) / 260, 0, 1);       // some perto do topo
            const st = i === active ? stateOf(i, cc) : { L, count: L.total, hi: -1 };
            ctx.save(); ctx.font = `400 20px ${mono}`; ctx.fillStyle = rgba('#a8b1c4', .5 * edge * groupAlpha); ctx.fillText(String(i + 1).padStart(2, '0'), 36, yTop); ctx.restore();
            drawLine(st.L, { ...common, x0, yTop, bold: i === active, alpha: (i === active ? 1 : Math.max(.22, 1 - delta * .14)) * edge * groupAlpha, count: st.count, hi: st.hi, cursor: i === active && cursorOn });
            rel -= h;
          }
        } else {
          const top = H * .2, panelH = H * .6, capH = panelH - 150, x0 = 100;
          ctx.save(); rr(48, top - 10, W - 96, panelH + 20, 22); ctx.fillStyle = rgba('#0b0e14', .72 * groupAlpha); ctx.fill(); ctx.strokeStyle = rgba(p.white, .09 * groupAlpha); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
          ['#ff5f57', '#febc2e', '#28c840'].forEach((c, k) => { ctx.beginPath(); ctx.arc(86 + k * 30, top + 30, 8, 0, 6.2832); ctx.fillStyle = rgba(c, .7 * groupAlpha); ctx.fill(); });
          header(210, top + 38, 'bash — ' + fileName, .6 * groupAlpha);
          let cum = 0; const bottoms = []; for (let i = 0; i <= active; i++) { cum += hOf(i, cc); bottoms.push(cum); }
          const bottomSmooth = bottoms[active] - hAct * (1 - e), scroll = Math.max(0, bottomSmooth - capH);
          ctx.save(); ctx.beginPath(); ctx.rect(52, top + 70, W - 104, panelH - 90); ctx.clip();
          for (let i = Math.max(0, active - 14); i <= active; i++) {
            const L = lineInfo(lines[i], lang, cc), yTop = top + 70 + (bottoms[i] - hOf(i, cc)) - scroll + fsBase, st = i === active ? stateOf(i, cc) : { L, count: L.total, hi: -1 };
            const edge = clamp((yTop - (top + 30)) / 120, 0, 1);
            ctx.save(); ctx.globalAlpha = edge * groupAlpha; ctx.font = `500 ${fsBase}px ${mono}`; ctx.fillStyle = rgba(p.mint, .8); ctx.fillText('$', 64, yTop); ctx.restore();
            drawLine(st.L, { ...common, x0, yTop, bold: i === active, alpha: (i === active ? 1 : .85) * edge * groupAlpha, count: st.count, hi: st.hi, cursor: i === active && cursorOn });
          }
          ctx.restore();
        }
        ctx.restore();
      } else {                                                           // cinema: câmera flutuante
        const per = 4, scene = Math.floor(active / per), first = scene * per, last = Math.min(lines.length - 1, first + per - 1), sceneAge = time - lines[first].time;
        const layout = f => { const l = Math.min(lines.length - 1, f + per - 1); let tot = 0; for (let i = f; i <= l; i++) tot += hOf(i); return { l, top: H * .46 - tot / 2 }; };
        const kick = .035 * (1 - easeOut(age / .55)) * I;
        ctx.save(); ctx.translate(W / 2 + Math.sin(t * .33) * 14 * I, H * .46 + Math.cos(t * .27) * 10 * I);
        ctx.rotate((Math.sin(t * .21) * .012 + Math.sin(scene * 2.3) * .02) * I); const z = 1 + .018 * Math.sin(t * .4) * I + kick; ctx.scale(z, z); ctx.translate(-W / 2, -H * .46);
        const x0 = 72;
        if (scene > 0 && sceneAge < .6) {                                // cena anterior sai para cima
          const pf = first - per, lay = layout(pf), k = easeInOut(sceneAge / .6); let y = lay.top + fsBase;
          ctx.save(); ctx.translate(0, -110 * k);
          for (let i = pf; i <= lay.l; i++) { const L = lineInfo(lines[i], lang, cols); drawLine(L, { ...common, x0, yTop: y, alpha: (1 - k) * groupAlpha, count: L.total, hi: -1 }); y += hOf(i); }
          ctx.restore();
        }
        const lay = layout(first); let y = lay.top + fsBase;
        header(x0, lay.top - 70, fileName, .8 * groupAlpha * clamp(sceneAge / .3, 0, 1));
        for (let i = first; i <= last; i++) {
          if (i <= active) {
            const st = stateOf(i), isA = i === active, delta = active - i, enter = isA ? easeOut(age / .45) : 1;
            drawLine(st.L, { ...common, x0, yTop: y + (1 - enter) * 26 * I, bold: isA, alpha: (isA ? enter : Math.max(.4, 1 - delta * .2)) * clamp(sceneAge / .25 + (i > first ? 1 : 0), 0, 1) * groupAlpha, count: st.count, hi: st.hi, cursor: isA && cursorOn });
            if (isA && o.glitch && age < .14 && I > 0) {                  // vibração cromática na entrada
              const k = 1 - age / .14, d = 7 * k * I;
              drawLine(st.L, { ...common, x0, yTop: y, alpha: .3 * k * groupAlpha, count: st.count, hi: -1, dx: -d, p: { ...p, orange: p.pink, blue: p.pink, white: p.pink, hot: p.pink } });
              drawLine(st.L, { ...common, x0, yTop: y, alpha: .3 * k * groupAlpha, count: st.count, hi: -1, dx: d, p: { ...p, orange: p.blue, blue: p.blue, white: p.blue, hot: p.blue } });
            }
          }
          y += hOf(i);
        }
        ctx.restore();
      }
      label('// instrumental', fade * .7, t, p);
    }
    vignette();
    if (o.keyboard) keyboard(t, p, level, I);
  }
  return { draw, layoutRows };
}
root.LyricRenderer = { create, layoutRows };
if (typeof module !== 'undefined') module.exports = root.LyricRenderer;
})(globalThis);
