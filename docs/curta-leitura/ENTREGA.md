# Editor de Vídeo — primeira entrega local

> Atualização de 16/10/2026: PR #1 integrado à `main`; todas as seis validações do GitHub passaram, incluindo `npm test` completo e geração/instalação/teste do `.exe` no Windows. O [instalador experimental](https://github.com/curtaleitura-cmyk/CurtaCut/actions/runs/38952050526/artifacts/12070055212) está disponível até 15/11/2026. Os registros abaixo documentam a primeira entrega e suas limitações naquele momento; a aceitação com vídeo próprio e GPU da usuária segue pendente.

## Estado da entrega

- Origem: https://github.com/0xsline/OpenChatCut
- Branch original: `main`; versão do pacote: 0.2.17.
- Commit original auditado: `72ddb3300cda4ed31cbd0bccbfc94fb29b8cffca`.
- Branch de trabalho: `feat/pt-br-local-transcription`.
- Fork remoto confirmado: https://github.com/curtaleitura-cmyk/CurtaCut — `main` preservada no commit original auditado.
- Pull Request: https://github.com/curtaleitura-cmyk/CurtaCut/pull/1 — aberto; integração em `main` ainda não realizada.
- Serviços pagos, credenciais de produção e sincronização externa: não ativados.

## Implementado

1. Opção `Português (Brasil) — pt` nas configurações locais e de provedores de transcrição.
2. `pt` como padrão compartilhado de cliente/servidor, incluindo chamadas diretas a Whisper local, AssemblyAI e serviços genéricos. Inglês, espanhol, chinês e demais opções preservados.
3. Provedor `local` como padrão inicial, inclusive seleção sugerida pelo agente e disponibilidade sem API paga. Ainda é necessário baixar um modelo antes de transcrever; não há cobrança de inferência local.
4. Detecção automática disponível. No Transformers.js, `auto` omite o parâmetro `language`; no Whisper.cpp, usa `auto`; provedores em nuvem mantêm suas conversões existentes.
5. Preferências salvas têm precedência sobre padrões. Abrir configurações com valores vazios no servidor não apaga escolhas existentes no navegador. Selecionar padrão e salvar explicitamente restaura `pt`/`local`.
6. O caminho existente aceita `languageCode` por tarefa e o checkpoint captura a escolha, sem alterar a preferência global. Não foi acrescentado um seletor por projeto à interface.
7. Nativo normaliza `pt-BR`, `pt-PT` e `por` para `pt`; o caminho do navegador também normaliza esses aliases. O seletor envia sempre `pt`.
8. Correção adicional do fallback Whisper.cpp CLI: removido `-nt`. Em teste real esse argumento colapsava muitos timestamps no fim do áudio; a CLI agora mantém a decodificação de timestamps. Extração dos argumentos para função pura testável, preservando seleção CPU/GPU existente.
9. Catálogo de modelos informa suporte a português.

Não foi traduzida toda a interface para português. Não foram substituídos o editor, o formato de projetos ou os motores de inferência.

## Validação

- TypeScript: `npx tsc -b` passou.
- Lint: `npm run lint` passou.
- Build de produção: sincronização de assets, verificação do catálogo, TypeScript e `npx vite build --config config/vite.config.ts` passaram; há o aviso já existente de chunks grandes.
- `npm run build` completo inicialmente parou no `tar` por tentativa de restaurar ownership do arquivo baixado. Reexecutado provisionamento com `TAR_OPTIONS=--no-same-owner`, depois os demais passos equivalentes. Não houve alteração do script do projeto para esse contorno do ambiente.
- `npm test` foi tentado, mas o executor `tsx` CLI não consegue criar seu socket IPC nesta sandbox (`EPERM /tmp/tsx-0/*.pipe`). Não é um resultado de aprovação da suíte completa.
- As verificações relevantes foram executadas individualmente com `node --import tsx`, sem precisar desse socket. A lista e o resultado final estão em `test-results.txt`.
- O teste de retomada AssemblyAI agora escolhe explicitamente AssemblyAI, pois ele deixou de ser o padrão da aplicação.
- FFmpeg foi provisionado com `npm rebuild ffmpeg-static` antes de repetir o teste real de extração PCM.
- Registro de testes: verificação do projeto confirmou que todos os 626 arquivos de teste rastreados estavam registrados no momento da execução.

### Áudio real de fumaça (smoke test)

Amostra pública **sintética** de português brasileiro, 6,33 segundos:
https://huggingface.co/edwixx/omnivoice-brpt-v15/resolve/main/samples/01_welcome.wav

Executado Whisper.cpp v1.9.2 com Tiny q5_1, em Linux/CPU, usando os argumentos reais gerados pela nova função `whisperCliArgs`. Modelo baixado na revisão fixada no catálogo; SHA-256 `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7`, conferido.

- O JSON do motor confirmou `params.language = pt`.
- A conversão real `whisperTokensToChunks` produziu 13 palavras com duração positiva, todas dentro do tempo original.
- Resultado e tempos: `audio-smoke-evidence.json`.
- Texto reconhecido incluiu “demonstração em português brasileiro, com voz clara e natural”. Tiny errou “Bom dia” como “Bongea”; isso é uma limitação de precisão, não um teste de qualidade aprovado. Avaliar Base/Small com os vídeos da usuária.
- Com `-nt`, várias palavras começavam e terminavam em 6320 ms. Após a correção, por exemplo, “demonstração” ficou em 2040–2800 ms e “natural.” em 5410–6110 ms.
- Não mede precisão de alinhamento contra anotações humanas; duração positiva não garante cortes perfeitos. Revisar bordas no player.
- Não foi um teste de ponta a ponta no Electron/Windows nem de inferência real no navegador. Estes seguem pendentes.

## Arquitetura encontrada

| Área | Código existente | Decisão |
|---|---|---|
| Interface | React 19, TypeScript 6, Vite 8, `src/components/` | Reutilizar; testar ergonomia em telas pequenas numa fase seguinte |
| Timeline e histórico | `src/editor/`, EditorCore e comandos imutáveis | Reutilizar cortes, ripple, propostas e undo |
| Texto editável | `src/transcript/TranscriptPanel.tsx`, `TranscriptViews.tsx`, `edit.ts`, `projection.ts` | Já há seleção, reprodução, palavras excluídas, projeção de intervalos e compressão de pausas |
| Jobs de transcrição | `src/transcript/transcribe-jobs.ts`, `src/persist/transcriptionJobStore.ts` | Preservar checkpoints, revisão da fonte e idioma capturado por tarefa |
| Whisper navegador | `src/transcript/local-asr.ts`, `local-asr.worker.ts` | Transformers.js/ONNX, WebGPU quando disponível e fallback WASM |
| Whisper nativo | `desktop/native-asr-service.ts`, `native-asr-worker.ts` | Electron IPC; whisper-server persistente, CLI fallback, extração PCM via FFmpeg |
| Armazenamento | `src/persist/`, `server/plugins/project-store*` | Projetos locais compartilhados, cache IndexedDB; registrar mídia por revisão |
| Exportação | `src/export/`, `remotion/`, plugins do servidor | Reutilizar Remotion/FFmpeg, opções de destino, fila e exportações existentes |
| Envio do celular | `server/mobile-upload-service.ts`, `src/media/mobileUploadApi.ts` | Já existe sessão temporária de upload com token; não equivale a editor remoto completo |

Os testes de edição por texto, projeção, fontes obsoletas, comandos de transcript, desfazer, silêncios, SRT e exportação do navegador foram incluídos na seleção de regressão. Não foi exportado um vídeo completo do fluxo da usuária. Os componentes necessários já existem, mas a aceitação de ponta a ponta com vídeo falado continua necessária.

### Windows e aceleração

| Opção | Integração e manutenção | Memória, precisão e desempenho | Recomendação inicial |
|---|---|---|---|
| Whisper.cpp existente | Integração e catálogo GGML já prontos; menor mudança | Tiny economiza recursos mas errou texto no smoke test. Base/Small precisam de benchmark local; quantização afeta resultado | Manter. Começar com Base/Small e comparar |
| Faster-Whisper | Exigiria serviço Python/CTranslate2, empacotamento e adaptação dos resultados | Oferece CPU quantizada e caminhos NVIDIA. GPU depende das versões de CUDA/cuDNN e da placa | Benchmark posterior, sem substituir o motor agora |
| Whisper no navegador | Já integrado; execução ocorre no dispositivo que abriu a página | Consome RAM do navegador; WebGPU depende do navegador/driver. No celular processaria no próprio celular | Fallback útil; não cumpre sozinho processamento remoto no PC |
| FFmpeg | Já integrado para PCM e exportação | CPU disponível. NVENC é para codificação de vídeo, separado da aceleração Whisper | Testar encoder/driver reais e preservar fallback software |
| Ollama | Adaptador local de análise textual futuro, sem substituir ASR | Uso depende do modelo, quantização, contexto e VRAM. 16 GB totais não bastam para prometer rodar tudo simultaneamente | Uma tarefa pesada por vez; escolher modelo só após conhecer GPU |

O código auditado seleciona `native-cpu` para ASR no Windows e `native-metal` no macOS. A simples presença de uma NVIDIA não ativa CUDA no Whisper. Outros módulos ONNX têm suas próprias regras de aceleração; não extrapolar isso para ASR. Não foi validado CUDA, DirectML ou NVENC na máquina da usuária.

Fontes oficiais para avaliação posterior:
- https://github.com/SYSTRAN/faster-whisper — dependências GPU e diferenças de execução.
- https://github.com/ollama/ollama/blob/main/docs/gpu.mdx — requisitos de hardware/driver.
- https://github.com/ggml-org/whisper.cpp — execução nativa e compilação com aceleração.

Estas são recomendações de integração baseadas na arquitetura, não medições na máquina Windows.

## Próxima etapa: sugestões de erros, sem corte automático

Não foi implementado um detector semântico nem uma nova interface de sugestões nesta entrega. A alteração obrigatória e os timestamps tiveram prioridade. O editor já tem `clean_script`, regras de pausas, VAD e propostas; reaproveitar esses caminhos.

Contrato proposto para um módulo independente em `src/transcript/analysis/`:

```ts
interface AnalysisInput {
  assetId: string;
  sourceRevision: string;
  transcriptGenerationId: string;
  language: string;
  words: readonly { id?: string; text: string; start: number; end: number }[];
}
interface RecordingSuggestion {
  id: string;
  sourceRevision: string;
  transcriptGenerationId: string;
  startMs: number;
  endMs: number;
  excerpt: string;
  reason: string;
  kind: 'restart' | 'self-correction' | 'repetition';
  confidence: number; // estimativa do motor; não probabilidade calibrada
  decision: 'pending' | 'keep' | 'exclude';
}
interface RecordingAnalyzer {
  analyze(input: AnalysisInput, signal?: AbortSignal): Promise<RecordingSuggestion[]>;
}
```

- `silence.ts`/VAD continua responsável por evidência acústica. Ausência de palavras não prova silêncio. Silêncios não devem ser inferidos só de espaços da transcrição.
- Um adaptador de análise semântica recebe o contexto anterior/posterior, distingue citação/repetição intencional de recomeço e retorna somente sugestões. Regras de frases (“falei errado”, “vou começar de novo”) podem gerar candidatos, nunca decisão final.
- Adaptadores futuros: Ollama local; API configurada explicitamente; integração ChatGPT apenas se elegível e validada. Nenhum acesso por assinatura foi pressuposto nem implementado.
- Validar JSON, limites de tempo, palavras, revisão da fonte e geração. Rejeitar resposta obsoleta antes da aplicação.
- UI: cards no TranscriptPanel com trecho, motivo, confiança identificada como estimativa, player.seekTo no intervalo original e ações Manter/Excluir. Excluir monta proposta usando comandos existentes; aceitação aplica uma operação atômica de undo. Nunca modificar o arquivo original.
- Critérios: repetições enfáticas preservadas, citações não cortadas, correção de informação contextualizada, cancelamento, resposta malformada, fonte substituída e undo/export do resultado.

## Celular e Google Drive: proposta técnica

Não basta abrir o Vite no celular: `window.openChatCutDesktop.inference` existe no Electron, não no navegador remoto. O fallback atual fará Whisper no dispositivo que abriu a página. Não expor o servidor de desenvolvimento como solução pronta de acesso remoto.

1. **Mídia:** reaproveitar importação/upload e revisões existentes. Adaptar o serviço móvel para um fluxo autenticado de projeto, com limites, progresso, retomada e verificação de tipo/tamanho. Upload temporário existente não é autenticação completa de edição.
2. **Drive:** novo adaptador server-side em `server/plugins/drive-import.ts` e seletor em `src/media/`. Google OAuth + Picker, escopo mínimo adequado ao arquivo escolhido (avaliar `drive.file`), refresh token no keystore; mídia baixada pelo servidor/agente e importada pelo registro atual. Não guardar tokens no projeto ou em variáveis VITE.
3. **Fila:** novo `server/plugins/processing-jobs.ts`, contrato em `shared/processing-jobs.ts`. Campos: jobId, projectId, assetId, sourceRevision, idioma, modelo, status, progresso, lease, tentativas e cancelamento. Idempotência e limites de concorrência.
4. **Agente Windows:** extrair o serviço nativo de Electron para um adaptador de jobs, reaproveitando worker, validação e FFmpeg. No cenário remoto, o agente faz polling/lease por HTTPS quando ligado, sem abrir entrada pública na máquina. PC desligado mantém tarefa pendente.
5. **Resultados:** armazenar palavras/tempos/revisões pelo serviço de projetos e notificar o browser por polling/SSE autenticado. Validar revisão antes de anexar transcript e antes de aceitar sugestões.
6. **Exportação:** enviar snapshot imutável do projeto editado à fila existente do render; persistir resultado e permitir download autenticado no celular.
7. **Primeiro piloto:** um usuário, PC e celular na mesma rede, backend apropriado, autenticação de sessão e acesso HTTPS para recursos que exijam contexto seguro. Depois avaliar fila hospedada e armazenamento. Um serviço intermediário é necessário se o celular precisar enviar tarefa enquanto o PC estiver desligado.

Dependências externas futuras: projeto Google Cloud/OAuth consent, Picker/Drive APIs e HTTPS. Hospedagem/fila/blob e custos dependerão do cenário; nada disso foi configurado. O tracker de livros e outros projetos existentes não foram alterados.

## Backlog posterior

- Aceitação Windows: importação de vídeo do celular, transcrição, ouvir frase, excluir, revisar junção, undo e exportação; comparar navegador e Electron.
- Detector modular + cards de revisão e testes contextuais.
- Idioma por projeto na UI, reutilizando override existente de tarefa.
- Legendas: testar geração/edição/estilos/SRT já existentes antes de acrescentar recursos; legendas incorporadas na exportação precisam de aceitação real.
- Shorts/Reels: melhores momentos completos, 9:16 e reenquadramento revisável.
- Thumbnails: frames, títulos, composição e exportação YouTube.

## Pendências da usuária

- Informar modelo exato da NVIDIA, VRAM e driver (por exemplo, saída não secreta de `nvidia-smi`).
- Disponibilizar um vídeo curto representativo para a aceitação em Windows; isso não bloqueou a implementação ou o teste público de áudio.

Licença original AGPL-3.0-or-later e avisos foram preservados. Não foi copiado código proprietário. Dependências e seus avisos permanecem os do upstream.
