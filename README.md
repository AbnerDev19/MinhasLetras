# LyricCode Studio — revisão 2

Projeto estático para Vercel. Sem chave de API. O áudio é processado no aparelho.

## Atualizar seu site

1. Extraia este ZIP.
2. No repositório usado pelo seu projeto Vercel, substitua os arquivos da raiz pelos deste pacote. O arquivo principal precisa se chamar **index.html** (não index(3).html).
3. Inclua também **timing.js** e **transcriber.worker.js** na mesma pasta.
4. Faça o commit. Se seu projeto Vercel já estiver ligado a esse repositório, aguarde o deploy. Para importar um repositório novo, escolha um projeto estático, sem comando de build.
5. Recarregue o site no celular para obter a versão nova.

## Usar

Música → escolher áudio → escolher idioma/modelo → Transcrever.
Letra → ouvir as frases, corrigir texto/segundos → Aplicar letra se alterou a caixa principal.
Visual → conferir animação e ajustar paleta, movimento e tamanho.
Exportar → confirmar que ouviu/revisou → Gerar vídeo. Mantenha a aba aberta.

Base é o modelo padrão. Small exige mais download, RAM e processamento; use preferencialmente no computador. Tiny é uma alternativa leve, com menor capacidade. Modelo maior não garante letra correta em música.

Se já tem a letra correta, cole-a e marque os inícios das frases ouvindo a música. Texto sem horários NÃO é espalhado automaticamente pela duração do áudio. LRC traz início de frase; isso não equivale a alinhamento de cada palavra.

O editor mostra segundos absolutos por frase. O botão ▶ ouve a região escolhida. Alterar somente um horário desloca os tempos das palavras daquela frase. Alterar seu texto invalida os antigos tempos por palavra; essa frase passa a usar uma digitação visual a partir de seu início.

Salvar projeto exporta JSON com letra, tempos por palavra, deslocamento e paleta. Para reabrir, escolha o mesmo arquivo de áudio e depois Abrir projeto. O áudio não está dentro do JSON. LRC/SRT não preservam tempos de cada palavra; use JSON para preservar essa informação.

## Correções

- Preserva os tempos por palavra até o renderizador; a versão anterior os descartava.
- Recusa timestamps ausentes/inválidos em vez de inventar um bloco para a música inteira.
- Remove repetições idênticas no mesmo instante entre blocos, sem apagar refrões repetidos em outros momentos.
- Mantém o texto literal da letra no código; antes parte dele era transformada em identificadores sem acentos.
- Base por padrão, opção Small e checagem de áudio silencioso.
- Cancelamento encerra worker e promessa pendente; troca de arquivo invalida tarefas anteriores.
- Limites de 100 MB por entrada, 6 minutos decodificados e 180 MB de gravação em memória.
- Editor em quatro etapas, campos maiores e área de prévia compacta em celular.
- Animação inspirada na referência: fundo escuro, partículas, cursor âmbar, código com sintaxe colorida, movimento de câmera e linhas antigas desfocadas. Não é reprodução idêntica quadro a quadro.
- Sem teclado, cabeçalho ou marcação de resolução por padrão dentro do vídeo.
- Bloqueia edição durante gravação e cancela ao ocultar a aba para evitar exportação incompleta.
- Aplica ajuste de sincronia também às legendas exportadas e oferece link de download persistente na página após gravar.

## Limites reais

Não existe garantia de transcrição perfeita de canto. Instrumentos, coros, efeitos e pronúncia podem confundir o Whisper. Os tempos retornados também precisam de revisão. Esta versão não tem separação automática de voz nem alinhamento fonético forçado. Small ainda é um modelo local; não substitui um serviço com modelos maiores e separação de voz.

Whisper baixa biblioteca e pesos de jsDelivr/Hugging Face; conexão é necessária no primeiro uso. Fontes são carregadas do Google Fonts, com fallback monoespaçado. O áudio não é enviado a esses serviços pelo aplicativo.

MP4 depende dos codecs fornecidos pelo navegador; quando não há MP4, a saída pode ser WebM. Gravação em tempo real. Limites de RAM e codecs variam entre aparelhos. O limite de arquivo é checado antes da decodificação; a duração só pode ser checada depois, então arquivos comprimidos muito longos ainda podem consumir muita memória ao decodificar.

## Verificação desta entrega

Passaram: sintaxe JavaScript, oito verificações do módulo de tempos e testes da aplicação com DOM simulado (parser LRC, offset no fim do arquivo, rejeição de horários inválidos, editor, ausência de horários inventados, chamadas de desenho e exportação de LRC).

Não foram validados: inferência real de modelos externos, aparência renderizada em navegador, MP4/WebM final ou uso em aparelho físico. O navegador automatizado não iniciou por restrições do ambiente. Os testes com DOM simulado não comprovam layout ou qualidade visual.

Para testar lógica: `node test-timing.cjs` e `node test-app.cjs`.
Para servir localmente: `python -m http.server 8000`, abrir http://localhost:8000.

Referência técnica do suporte a timestamps por palavra: https://huggingface.co/docs/transformers.js/v2.17.2/en/api/pipelines
