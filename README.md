# LyricCode Studio — versão 4

## Novidades da versão 4

### Reconhecimento além dos 24 segundos
Os blocos fixos de 20 s (o primeiro cobria só 0–24 s) foram trocados por uma varredura que avança pela **última palavra aceita**, como o Whisper original. Se o modelo para no meio da janela, a próxima começa exatamente ali.
- A última palavra de cada janela vinha com fim `null` e era **descartada**; agora o início real é mantido e só o fim é estimado.
- Palavras coladas no corte da janela são reanalisadas com contexto, em vez de truncadas.
- Janela que falha é repetida com 10 s; se ainda falhar, vira aviso e a análise continua (antes tudo era abortado). Falta de memória continua abortando.
- Trechos de 6 s ou mais com áudio e sem palavras são reanalisados em janelas curtas; o que restar é listado em "pontos para revisar".
- Frases típicas de alucinação do Whisper em silêncio ("Legendas pela comunidade Amara.org" etc.) são descartadas; silêncio digital não chama o modelo.
- Limite de análise local: 30 min. Modelo carrega com encoder fp32 (melhor tempo por palavra) e cai para q8 se não couber.
- Funciona mesmo se o navegador não informar a duração do arquivo (antes o botão não fazia nada).

### Tempo de cada palavra
Nenhum software garante 100% em música cantada; o que foi feito para reduzir e expor erros:
- Sem sobreposição, sem ordem trocada e duração mínima garantidos por código (testado).
- **Refinar início pela energia** (opção na aba Música; liga sozinha ao usar voz isolada): ajusta o início a até 150 ms para o ataque de energia mais forte e encurta o fim antes de pausas. Só age com evidência clara. Em música cheia ajuda pouco; com voz isolada ajuda mais.
- A digitação acontece no **início** da palavra (antes era esticada por toda a nota sustentada) e a palavra cantada no momento fica destacada no vídeo, então um erro de tempo fica visível na hora.
- Cada palavra do editor tem ▶ para ouvir só aquele trecho (−0,25 s/+0,25 s).
- `advanced/analyze.py`: números/símbolos sem tempo no WhisperX agora são interpolados entre vizinhas e marcados (`interpolated`), em vez de sumirem da letra.
- Para a maior precisão possível continue usando o modo avançado (WhisperX + voz isolada) e revise os trechos sinalizados.

### Animações (novo `renderer.js`)
- Partículas estavam amontoadas num canto por causa da função de hash; agora distribuídas e com deriva suave.
- Transições contínuas calculadas a partir do horário das frases: rolagem suave no Editor/Terminal (antes saltava), cena que sai/entra na Câmera flutuante (antes sumia de repente a cada 5 frases), dissolução entre frases no modo Destaque.
- Frases longas quebram em várias linhas em vez de encolher a fonte; fonte maior e constante.
- Depois do fim da frase a tela mostra `// instrumental` em vez de manter a última frase para sempre.
- Terminal com janela e prompt; Editor com números de linha e linha atual; vibração cromática na entrada da frase (opção Glitches).
- Limitador de 30 fps corrigido (descartava quadros em telas de 60 Hz); relógio de reprodução interpolado entre leituras de `currentTime`.
- Sem `ctx.filter` (não existe no Safari); renderização determinística: o mesmo tempo gera sempre o mesmo quadro.

### Testes (Node)
`node test-timing.cjs && node test-quality.cjs && node test-long.cjs && node test-refine.cjs && node test-render.cjs && node test-recorder.cjs && node test-app.cjs`

`test-long.cjs` usa um Whisper simulado que para cedo, devolve fim nulo e alucina. **Não** foram executados aqui os modelos reais, um navegador real nem gravação MP4/WebM; portanto a melhora de precisão em músicas reais não foi medida.

---
## Documentação da versão 3 (ainda válida onde não conflita com a v4)

Esta atualização contém o site estático completo, sem chave de API, e uma ferramenta Python avançada opcional.

## Publicar / atualizar

Extraia este ZIP e substitua **todos** os arquivos no repositório usado na Vercel, incluindo as pastas. Mantenha `index.html` na raiz. Não envie apenas o HTML: ele depende de `timing.js`, `styles.js`, `recorder.js`, `asr-quality.js`, `renderer.js`, `transcriber.worker.js` e `fonts/`.

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
