# Análise avançada (opcional, computador/GPU)

O site continua funcionando no celular. Este caminho é separado: executa Whisper large-v3 e alinhamento fonético wav2vec2 com WhisperX, com separação de voz opcional. Não executa na hospedagem estática Vercel e não é uma API já instalada.

Requisitos: Python 3.11, FFmpeg disponível no PATH, internet para baixar modelos e memória suficiente. Large-v3 é pesado no computador; CPU funciona lentamente. CUDA exige GPU NVIDIA e dependências compatíveis. Não foi executado com modelos reais neste ambiente; as dependências abaixo são uma faixa de compatibilidade, não um ambiente validado e travado.

No terminal, na pasta advanced:

```sh
python -m venv .venv
```

Windows: `.venv\Scripts\activate`. Linux/macOS: `source .venv/bin/activate`.

```sh
pip install -r requirements.txt
python analyze.py "musica.mp3" --output analise.json --language pt
```

Para incluir separação automática de voz:

```sh
pip install demucs==4.0.1
python analyze.py "musica.mp3" --output analise.json --language pt --separate
```

Adicione `--device cuda` somente se a instalação PyTorch/CUDA estiver pronta. Para menos memória, escolha `--model medium` ou `--model small`.

No site, escolha exatamente o mesmo áudio, abra Letra e use **Importar análise avançada (.json)**. Importe `analise.json`, não `analise.segments.json`. O áudio exportado continuará sendo o original inteiro, com instrumentos.

Se a transcrição errou a letra, edite só os textos no `analise.segments.json`, mantendo os intervalos aproximados dos segmentos. Rode novamente o alinhamento:

```sh
python analyze.py "musica.mp3" --output analise.json --segments analise.segments.json --language pt
```

Use `--separate` novamente se quiser alinhar sobre a voz isolada. A separação é refeita; não há cache de voz persistente nesta ferramenta.

Palavras não alinhadas são listadas em `issues`, com seu texto; não recebem tempos inventados. Revise esses pontos e adicione a palavra faltante no editor da letra. Alinhamento fonético também pode errar em canto, notas sustentadas e coros. Pontuações não são probabilidades de acerto.

Fontes: https://github.com/m-bain/whisperX e https://github.com/facebookresearch/demucs
