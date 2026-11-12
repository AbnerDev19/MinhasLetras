# LyricCode AI — versão web para Vercel e celular

Site estático sem backend e sem necessidade de Python no Vercel. O projeto foi adaptado do LyricCode Studio/Python: **áudio → Whisper no navegador → tempos aproximados das palavras → frases sincronizadas → animação de código → vídeo vertical com a música original**.

## Publicar na Vercel sem GitHub, terminal ou instalar nada

1. Baixe o arquivo **LyricCode-Vercel-Celular.zip** (contendo `index.html`, `transcriber.worker.js` e `vercel.json` na raiz).
2. Abra **https://vercel.com/drop** e entre na sua conta Vercel.
3. Arraste o **ZIP inteiro** para a página, escolha um nome e clique em **Deploy**.
4. O Vercel Drop publica um site estático sem build e gera um link `*.vercel.app`.
5. Abra esse link no celular e selecione uma música.

**Alternativa via GitHub:** extraia os arquivos, envie-os para um repositório, importe em https://vercel.com/new e selecione **Other**, sem comandos de build. 

**Nota:** um novo upload pelo Vercel Drop cria um novo projeto; para atualizações automáticas, depois conecte o projeto a um repositório Git.


## Como usar no celular

1. Toque **Escolher música** e selecione um áudio do seu aparelho.
2. O Whisper inicia automaticamente. Na primeira vez, ele baixa o modelo Tiny (precisa de boa conexão, espaço e memória). **Não consulta sites de letras**. O áudio é processado localmente no navegador.
3. Reveja e ajuste a letra; pode importar um `.lrc` ou marcar o início das frases manualmente.
4. Ajuste paleta e efeitos, veja a prévia e toque em **Gerar vídeo**.
5. Deixe a aba **aberta, com a tela acesa** até terminar. O resultado será baixado pelo navegador.

**Formatos:** Safari em iPhone pode exportar MP4/H.264/AAC. Chrome Android geralmente exporta WebM/VP8-9/Opus. O formato final depende da versão do navegador e da disponibilidade dos codecs. O site **não promete converter WebM em MP4 no servidor**, porque é hospedagem estática. A gravação é em tempo real (um vídeo de 3 min demora aproximadamente 3 min para registrar).

## Limites técnicos e privacidade

- O **Python Faster-Whisper e Demucs não executam na Vercel** neste projeto. A versão web usa Transformers.js + modelo Whisper convertido para ONNX, executado com WebAssembly dentro de um Web Worker no aparelho. Não há chave ou custo de API de IA.
- A primeira utilização requer acesso a `cdn.jsdelivr.net` (biblioteca) e `huggingface.co` (pesos do modelo). Esses fornecedores **recebem requisições do navegador para baixar código/modelos**, mas o arquivo de áudio não é enviado para eles pelo aplicativo.
- A IA pode errar bastante com música cantada, instrumentos altos, reverb, coros, intervalos sem voz ou idiomas misturados. **Os tempos por palavra são aproximados**, mesmo quando o modelo funciona. Não foi integrado Demucs no navegador, para evitar download e consumo de memória ainda maiores.
- Celulares com pouca RAM, Safari antigo ou formatos de áudio não suportados podem não conseguir transcrever ou exportar. Use **Whisper Tiny**, vídeo **720p**, a opção **Importar LRC** e, se necessário, a versão desktop Python.
- A interface permite corrigir a letra, aplicar `.lrc`, ajustar deslocamento e salvar legendas `.lrc` / `.srt` antes de exportar.
- Não há upload do áudio ou armazenamento em backend. O navegador gerencia seu arquivo local; o vídeo exportado fica no aparelho.
- A publicação de músicas comerciais com o vídeo depende das licenças/direitos aplicáveis.

## Arquivos

- `index.html`: interface responsiva, animação canvas, leitura de áudio e gravação com áudio.
- `transcriber.worker.js`: carregamento da biblioteca e inferência Whisper em segundo plano dentro da aba.
- `vercel.json`: configuração para site estático.
- `manifest.webmanifest` + `favicon.svg`: ícone/instalação como atalho.

## Desenvolvimento e testes

`python -m http.server 8000` na pasta; abra `http://localhost:8000` em Chrome ou Safari. Para conferir apenas a interface sem baixar o modelo, use o modo de importação de `.lrc`.

**Validação:** layout e lógica locais podem ser testados sem conexão externa; a qualidade/compatibilidade de inferência Whisper em um celular físico deve ser validada diretamente no aparelho, pois não é reproduzível em todos os dispositivos.
