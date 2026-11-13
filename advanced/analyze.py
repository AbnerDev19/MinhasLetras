"""Optional desktop/GPU pipeline. Never hosted inside static Vercel functions."""
import argparse
import gc
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile


def make_output(aligned, duration, name):
    words, issues = [], []
    for segment in aligned.get('segments', []):
        if not segment.get('words') and segment.get('text', '').strip():
            issues.append({'time': segment.get('start', 0), 'text': segment['text'], 'reason': 'Segmento sem palavras alinhadas: revise o texto completo'})
        seg_words = [w for w in segment.get('words', []) if str(w.get('word', '')).strip()]
        ok = lambda w: all(isinstance(w.get(k), (int, float)) and math.isfinite(w[k]) for k in ('start', 'end')) and 0 <= w['start'] < w['end'] <= duration + .05
        for idx, word in enumerate(seg_words):
            text = str(word.get('word', '')).strip()
            if not ok(word):
                # Números/símbolos costumam vir sem tempo no WhisperX. Em vez de perder a palavra da letra,
                # posiciona entre os vizinhos alinhados do MESMO segmento e avisa (interpolado, confirme).
                prev = next((seg_words[j] for j in range(idx - 1, -1, -1) if ok(seg_words[j])), None)
                nxt = next((seg_words[j] for j in range(idx + 1, len(seg_words)) if ok(seg_words[j])), None)
                if prev and nxt and nxt['start'] - prev['end'] > .08:
                    gap = [j for j in range(seg_words.index(prev) + 1, seg_words.index(nxt)) if not ok(seg_words[j])]
                    slot = (nxt['start'] - prev['end']) / len(gap)
                    pos = gap.index(idx)
                    start, end = prev['end'] + slot * pos, prev['end'] + slot * (pos + 1)
                    words.append({'text': text, 'start': start, 'end': end, 'score': None, 'interpolated': True})
                    issues.append({'time': start, 'text': text, 'reason': 'Tempo interpolado entre palavras vizinhas: confirme', 'level': 'info'})
                else:
                    issues.append({'time': segment.get('start', 0), 'text': text, 'reason': 'Palavra sem alinhamento e sem vizinhas para interpolar: precisa de revisão'})
                continue
            start, end = word['start'], word['end']
            score = word.get('score')
            if score is not None and score < .5:
                issues.append({'time': start, 'text': text, 'reason': 'Baixa pontuação de alinhamento; confirme o horário'})
            words.append({'text': text, 'start': start, 'end': min(end, duration), 'score': score})
    if not words:
        raise ValueError('Nenhuma palavra foi alinhada. Não foi produzido resultado vazio.')
    return {'format': 'lyriccode-alignment-v1', 'audioName': name, 'duration': duration,
            'words': words, 'issues': issues, 'engine': 'WhisperX / wav2vec2',
            'reviewRequired': True}


def main():
    parser = argparse.ArgumentParser(description='Transcrição + alinhamento fonético para LyricCode')
    parser.add_argument('audio', type=Path)
    parser.add_argument('--output', type=Path, default=Path('analise.json'))
    parser.add_argument('--model', default='large-v3')
    parser.add_argument('--language', default='pt')
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    parser.add_argument('--separate', action='store_true', help='Isolar voz com Demucs antes de transcrever')
    parser.add_argument('--segments', type=Path, help='Reutilizar segmentos JSON após corrigir texto manualmente')
    args = parser.parse_args()
    if not args.audio.is_file():
        parser.error('Arquivo de áudio não encontrado.')
    import whisperx
    import torch
    audio_path = args.audio.resolve()
    print('Lendo o áudio original…', flush=True)
    original = whisperx.load_audio(str(audio_path))
    duration = len(original) / 16000
    with tempfile.TemporaryDirectory(prefix='lyriccode-') as tmp:
        analysis_audio = original
        if args.separate:
            print('Separando voz. O áudio original da exportação não será modificado…', flush=True)
            subprocess.run([sys.executable, '-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs',
                            '-d', args.device, '-o', tmp, str(audio_path)], check=True)
            vocal = Path(tmp) / 'htdemucs' / audio_path.stem / 'vocals.wav'
            analysis_audio = whisperx.load_audio(str(vocal))
            if abs(len(analysis_audio) / 16000 - duration) > .25:
                raise ValueError('A voz separada mudou a duração. Alinhamento interrompido.')
        if args.segments:
            segments = json.loads(args.segments.read_text(encoding='utf-8'))
            if not isinstance(segments, list) or not segments:
                raise ValueError('O JSON precisa conter uma lista de segmentos.')
            for segment in segments:
                if not isinstance(segment.get('text'), str) or not 0 <= segment['start'] < segment['end'] <= duration + .1:
                    raise ValueError('Segmento inválido ou fora da duração.')
        else:
            print('Transcrevendo com Whisper '+args.model+'…', flush=True)
            model = whisperx.load_model(args.model, args.device, compute_type='int8' if args.device == 'cpu' else 'float16',
                                       language=args.language, vad_method='silero',
                                       asr_options={'beam_size': 5, 'condition_on_previous_text': False})
            result = model.transcribe(analysis_audio, batch_size=1, language=args.language)
            segments = result['segments']
            del model
            gc.collect()
            if args.device == 'cuda':
                torch.cuda.empty_cache()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Editable checkpoint for a second alignment pass with corrected lyrics.
        checkpoint = args.output.with_suffix('.segments.json')
        checkpoint.write_text(json.dumps(segments, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Alinhando fonemas por palavra…', flush=True)
        model_a, metadata = whisperx.load_align_model(language_code=args.language, device=args.device)
        aligned = whisperx.align(segments, model_a, metadata, analysis_audio, args.device, return_char_alignments=False)
        output = make_output(aligned, duration, audio_path.name)
        temporary = args.output.with_suffix('.tmp')
        temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        temporary.replace(args.output)
        print(f'Pronto: {args.output}. Pontos para revisão: {len(output["issues"])}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Falha: {error}. Nenhuma análise parcial foi publicada.', file=sys.stderr)
        sys.exit(1)
