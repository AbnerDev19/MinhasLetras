# LyricCode Studio — versão 3

Esta atualização contém o site estático completo, sem chave de API, e uma ferramenta Python avançada opcional.

## Publicar / atualizar

Extraia este ZIP e substitua **todos** os arquivos no repositório usado na Vercel, incluindo as pastas. Mantenha `index.html` na raiz. Não envie apenas o HTML: ele depende de `timing.js`, `styles.js`, `recorder.js`, `asr-quality.js`, `transcriber.worker.js` e `fonts/`.

Para hospedagem estática, use preset Other, sem comando de build. A pasta `advanced` contém ferramentas de computador; ela não cria um servidor de IA na Vercel.

## O que mudou

### Música inteira na exportação

O exportador decodifica o arquivo original inteiro e reproduz um AudioBufferSourceNode exclusivo para gravar. O reprodutor da prévia, o fim da letra e o final da transcrição não encerram mais a gravação. Introdução, pausas e final instrumental continuam no vídeo.

O mesmo relógio Web Audio guia áudio e animação. A gravação começa antes da fonte tocar e só termina após o evento de fim da fonte, com uma margem de 250 ms para os últimos pacotes. Espera o último `dataavailable` antes de construir o arquivo. Pode haver cerca de 250 ms extras no final do vídeo.

Interrupção antecipada, erro do codec, suspensão do áudio ou estouro de memória geram erro: não há link novo de um vídeo parcial. O download é oferecido por botão ao concluir, para funcionar melhor no celular.

Não existe mais limite de seis minutos para exportação. Existem limites de recursos: entrada de 100 MB, áudio PCM de até 512 MB após decodificação e gravação de até 180 MB. A estimativa por bitrate verifica a gravação antes de começar. O app avisa se não cabe, sem cortar a música. A verificação de PCM ocorre após decodificar; aparelhos com pouca RAM podem falhar antes dela. Mantenha a tela ligada e esta aba visível. Trocar de aba cancela a gravação para não oferecer vídeo incompleto.

O navegador ainda determina os codecs: MP4 quando disponível, WebM como alternativa. Não há conversão em servidor. A duração do contêiner resultante não é verificada automaticamente; a verificação interna cobre reprodução integral e finalização do gravador, não cada pacote codificado.

### Reconhecimento e timing

- Blocos de 20 segundos com até quatro segundos extras de contexto de cada lado, percorrendo o áudio até o fim.
- Cada bloco devolve tempos locais convertidos em tempos absolutos.
- Atribuição nas bordas por ponto médio e remoção de duplicatas muito próximas. Mudanças de reconhecimento nas bordas ainda podem exigir revisão.
- Repetição única de blocos que apresentam falha transitória; falha persistente não aplica resultado parcial.
- Progresso por bloco e timeout de dez minutos sem progresso.
- Avisos para horários inválidos, palavras muito longas, repetições e blocos sem reconhecimento. São heurísticas, não probabilidades de acerto.
- Base por padrão, opções Small e Tiny. Small exige mais memória e pode ajudar, mas não garante acerto.
- Entrada opcional de voz isolada com a mesma linha do tempo. A exportação usa sempre a música original. A duração é checada; o app não detecta automaticamente deslocamento entre as duas gravações.
- Revisão de início/fim por palavra, além dos ajustes por frase.

A análise no navegador suporta até 20 minutos. Não altera a duração da exportação. Não foram inventados tempos para texto sem alinhamento. Palavras sem tempos válidos podem ficar fora das frases: os avisos pedem revisão. O usuário pode corrigir a letra e marcar os horários.

### Modo avançado opcional

`advanced/analyze.py` combina Whisper large-v3 com alinhamento fonético WhisperX/wav2vec2. Pode separar voz com Demucs e realinhar segmentos cujo texto você corrigiu. Consulte `advanced/LEIA-ME.md`.

Este modo roda em computador/servidor com Python, FFmpeg e modelos instalados; não roda automaticamente no celular nem na Vercel. Importe seu resultado em Letra → Importar análise avançada. Não há API remota já configurada.

### Linguagens e animações

Escolha separadamente na etapa Visual:

| Linguagens | Animações |
|---|---|
| Python, JavaScript, TypeScript, Java, C++, Rust, HTML e SQL | Câmera flutuante, Terminal, Editor em rolagem, Frase em destaque |

São 32 combinações. A letra é representada como texto dentro da sintaxe escolhida; aspas, símbolos HTML e apóstrofos são escapados conforme o estilo. O código é visual, não executa a letra. A fonte monoespaçada do vídeo acompanha o pacote, com licença em `fonts/LICENSE.txt`.

Salvar projeto guarda também linguagem e animação. Projetos JSON v2 continuam aceitos; novos usam v3. LRC/SRT não preservam horários palavra por palavra: use o projeto JSON para isso.

## Testes e limites da validação

Passaram os testes de lógica em Node:

```sh
node test-timing.cjs
node test-quality.cjs
node test-recorder.cjs
node test-app.cjs
```

Eles cobrem tempos, bordas entre blocos, repetição de refrão, escaping das oito linguagens, chamadas de desenho das 32 combinações, editor de palavras e máquina de estados do gravador. O teste do gravador simula Web Audio/MediaRecorder e verifica duração completa, último pacote, encerramento antecipado, cancelamento, orçamento de memória e erro de codec.

Os quatro estilos foram renderizados com canvas nativo e inspecionados visualmente. Isso não valida a interface HTML/CSS em um navegador real.

Não foram executados nesta entrega: modelos reais de transcrição/WhisperX/Demucs, browser em celular físico ou gravação MP4/WebM real. Portanto não há garantia de infalibilidade nem medição de melhoria de precisão. Instrumentos, notas sustentadas e coros ainda podem causar erros; revise os trechos sinalizados.

Para servir localmente: `python -m http.server 8000`, abrir http://localhost:8000. Downloads de modelos usam Hugging Face/jsDelivr, e a interface mantém a fonte opcional do Google Fonts. O áudio não é enviado a esses serviços pelo aplicativo.

Referências técnicas:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/stop
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event
- https://github.com/m-bain/whisperX
- https://github.com/facebookresearch/demucs
