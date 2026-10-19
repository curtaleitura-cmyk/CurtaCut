# CurtaCut

**Editor de vídeo baseado no OpenChatCut, com transcrição local em Português (Brasil).**

O CurtaCut é uma versão independente mantida por `curtaleitura-cmyk`. Reutiliza a timeline, a edição por texto, os projetos e a exportação do [OpenChatCut](https://github.com/0xsline/OpenChatCut). O objetivo inicial é facilitar a edição de vídeos falados, resenhas e conteúdos para YouTube, Instagram e TikTok.

> **Estado atual:** versão experimental integrada à `main`. Há um instalador para Windows 64 bits, com Whisper local e Português (Brasil) por padrão. A suíte completa e os testes do instalador passaram no GitHub; a aceitação com vídeos próprios no computador da usuária continua necessária.

## Baixar e instalar no Windows

**[Baixar CurtaCut para Windows x64 — ZIP com instalador, cerca de 740 MB](https://github.com/curtaleitura-cmyk/CurtaCut/actions/runs/39042654924/artifacts/12105330194)**

1. Entre na sua conta do GitHub para baixar o artefato.
2. Extraia o ZIP e abra **`CurtaCut-0.2.21-x64.exe`**.
3. Siga o assistente de instalação e abra o CurtaCut.
4. Nas configurações de modelos locais, baixe um modelo Whisper antes da primeira transcrição. No seletor da barra superior, escolha **Português (Brasil)** para a interface. Confira **Local** e **Português (Brasil) — pt**; preferências anteriores, se existirem, continuam sendo respeitadas.

A instalação pelo `.exe` dispensa Git, Node.js e os comandos abaixo. O pacote inclui `SHA256SUMS.txt`. É um instalador experimental; ainda não há release estável assinada. Esse download do GitHub Actions expira em **16/11/2026**. [Ver execução e testes](https://github.com/curtaleitura-cmyk/CurtaCut/actions/runs/39042654924).


## Edição simplificada (prévia 0.2.24)

A barra superior agora permite alternar entre **Edição simplificada** e **Edição avançada** no mesmo projeto. O novo modo reúne vídeo, transcrição clicável, cortes e restauração por frase, correção de palavras, prévia das junções, miniaturas, texto final, estatísticas e legendas SRT. Os cortes modificam a timeline real, com desfazer/refazer e salvamento automático.

Selos **Verificar**, **Provável erro** e **Pausa** aparecem junto aos horários e usam as mesmas cores na timeline. Painéis têm cantos levemente arredondados. O seletor **Claro/Escuro**, na barra superior, vale para os dois editores e a tela de projetos; a preferência fica salva. As indicações usam regras de texto (incerteza, retomadas e blocos repetidos) e intervalos entre palavras; **a análise contextual por IA ainda não está conectada**. Confira os motivos e ouça antes de cortar. Projetos com velocidade alterada, transições ou montagens complexas devem ser editados no modo avançado. [Funcionamento, limites e testes](docs/simplified-editor.md).

O download acima corresponde à versão 0.2.21; a prévia 0.2.24 é gerada no Pull Request desta implementação.

## Melhorias de uso (0.2.21)

- Importar em **Minhas mídias** ou arrastar para a timeline deixa de iniciar transcrição por padrão. Use **Transcrever** no cartão da mídia ou na aba de transcrição. A opção automática continua disponível em Configurações; escolhas anteriores explícitas são respeitadas.
- Um painel permanece visível durante transcrições manuais, automáticas e solicitadas pelo assistente, com arquivo, motor, idioma, modelo local, etapa, tempo decorrido e cancelamento. Percentuais aparecem quando fornecidos pelo motor, separados por etapa. Após 90 segundos sem atualização, o painel avisa sem afirmar que houve travamento.
- Cancelar interrompe a inferência local e descarta resultados posteriores. Em serviços na nuvem, interrompe a espera local; o provedor pode continuar processando. Use **Transcrever novamente** no cartão da mídia em caso de falha.
- Novos projetos e sequências usam nomes no idioma da interface. Os nomes e resumos das 11 skills de criação têm tradução para português e alternativa em inglês. Nomes personalizados e projetos existentes são preservados.

## Compatibilidade de vídeo e áudio (0.2.20)

- Novos projetos seguem o enquadramento do primeiro vídeo, inclusive quando uma música foi adicionada antes. Tamanhos manuais e projetos existentes são preservados.
- O FFmpeg incluído prepara uma cópia de áudio compatível quando necessário, mantendo o original intacto. Testes cobrem WAV, FLAC, MP3, AAC, ALAC, AC3, E-AC3, WMA, AIFF, CAF, Opus e Vorbis, além de AAC multicanal dentro de vídeo vertical.
- Vídeos com APAC e faixa estéreo compatível passam a usar explicitamente essa faixa. Arquivos protegidos ou codecs proprietários não têm suporte garantido.

Para testar o enquadramento automático, crie um projeto novo e importe o vídeo original.

## O que já mudou nesta versão

- **Interface em Português (Brasil)**, com inglês para os textos ainda sem tradução. Se uma preferência anterior mantiver inglês ou chinês, use o seletor de idioma na barra superior.
- Histórico de versões: os salvamentos automáticos antigos aparecem como **Salvamento automático**. Nomes personalizados são preservados.

- **Português (Brasil) — `pt`** nas opções de transcrição e como padrão em uma instalação nova.
- **Whisper local** como provedor inicial, sem exigir chave de API paga.
- Detecção automática e outros idiomas continuam disponíveis.
- Preferências anteriores são preservadas. Quem já usava outro idioma deve escolher português nas configurações e salvar.
- Correção dos timestamps no fallback nativo Whisper.cpp, importantes para cortar o vídeo pelo texto.
- Identidade CurtaCut nos títulos e informações principais do aplicativo; código de instalação/atualização preparado para nosso repositório.

O código de transcrição passou por testes automatizados e por um teste de áudio sintético em português brasileiro em Linux/CPU. A instalação automatizada passou no Windows; o fluxo com vídeo próprio no computador da usuária continua pendente de validação. A tradução para português cobre os controles principais; o restante do dicionário usa inglês. Mensagens externas de provedores e conteúdo criado pelo usuário mantêm o idioma original.

## Instalar no Windows — pelo código-fonte

### 1. Instale os pré-requisitos

- [Git para Windows](https://git-scm.com/download/win).
- [Node.js 24 LTS](https://nodejs.org/en/download). O projeto exige Node `>=24 <25`; o npm vem junto.
- Internet e espaço em disco para dependências, navegador de renderização, binários e modelo Whisper.

Após instalar, feche e abra novamente o PowerShell. Confira:

```powershell
git --version
node --version
npm --version
```

`node --version` deve começar com `v24.`. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd` nos comandos abaixo, sem precisar mudar a política do Windows.

### 2. Baixe a versão principal

No PowerShell, entre na pasta onde deseja guardar o aplicativo e execute:

```powershell
git clone https://github.com/curtaleitura-cmyk/CurtaCut.git
cd CurtaCut
npm.cmd ci
Copy-Item .env.example .env.local
```

O comando `Copy-Item` é para a primeira instalação. Não sobrescreva um `.env.local` que você já configurou. Não é necessário preencher chaves pagas para transcrição local ou edição manual. A instalação pode levar alguns minutos.

### 3. Abra o aplicativo no navegador do computador

```powershell
npm.cmd run dev
```

Mantenha essa janela aberta e acesse **http://localhost:5199** no navegador do mesmo PC. Para encerrar, use `Ctrl+C` no terminal.

O aplicativo está sendo executado no seu computador. Nesta fase, abrir esse endereço no celular não conecta ao PC: `localhost` sempre significa o próprio dispositivo.

### 4. Ative o modelo de transcrição

1. Abra **Settings / Configurações**.
2. Na área de **Local Models / Modelos locais → Local Transcription**, baixe um modelo. Comece comparando **Whisper Base** e **Small**; o Tiny é mais leve, mas pode errar mais.
3. Nas configurações de transcrição, confira **Local** e **Português (Brasil) — pt**.
4. Importe um vídeo curto, transcreva e revise o texto e os tempos antes de fazer cortes.

É necessário baixar os arquivos adequados ao motor: **ONNX no navegador**, **GGML no nativo**. As configurações existentes mostram a disponibilidade por motor. O primeiro download precisa de internet; o processamento local não cobra créditos de transcrição.

Se já havia configurações salvas, elas continuam valendo. Selecione português e o provedor local para alterá-las.

### 5. Opcional: abra a versão desktop em desenvolvimento

Para usar o motor nativo Whisper.cpp pelo Electron, encerre o servidor anterior e execute:

```powershell
npm.cmd run desktop:dev
```

Esse comando abre o app desktop a partir do código-fonte. **Não instala um `.exe` pronto.** Atualmente o ASR nativo no Windows seleciona CPU. A presença de uma NVIDIA não significa que CUDA esteja ativado.

## Abrir novamente ou atualizar

Para abrir novamente, entre na pasta `CurtaCut` e rode `npm.cmd run dev` ou `npm.cmd run desktop:dev`.

Para buscar atualizações da branch, depois de salvar/encerrar seu trabalho:

```powershell
git switch main
git pull --ff-only
npm.cmd ci
npm.cmd run dev
```

Se tiver alterações próprias no código, confira `git status` antes de atualizar; não use comandos que descartem seus arquivos. Faça backup dos projetos e da mídia antes de atualizar versões de desenvolvimento.

## Gerar outro instalador

O workflow **CurtaCut Windows installer** pode ser executado manualmente em [Actions](https://github.com/curtaleitura-cmyk/CurtaCut/actions/workflows/curtacut-windows.yml), selecionando a branch desejada. Ele compila, instala, testa, desinstala e disponibiliza o `.exe` com checksum como artefato por 30 dias. O upload do instalador depende da aprovação do smoke test.

O empacotamento usa NSIS/Windows x64. O projeto também mantém o script `npm run desktop:dist:win` para geração local. Código-fonte ZIP não é instalador; escolha o artefato Windows indicado acima.

## Recursos e próximos passos

| Área | Situação |
|---|---|
| Timeline, cortes, desfazer e projetos locais | Reutilizados do OpenChatCut |
| Edição por texto e timestamps | Recursos existentes preservados; regressões selecionadas testadas |
| Português e Whisper local por padrão | Implementados e integrados na `main` |
| Legendas e exportação SRT | Recursos existentes; aceitação com vídeos próprios pendente |
| Instalador Windows | Geração, instalação, abertura, renderização de quadro e recuperação da janela passaram em CI |
| Validação com vídeo da usuária e GPU real | Pendente |
| Sugestões contextuais de erros de gravação | Planejadas; detector semântico e interface ainda não implementados |
| Processamento no PC controlado pelo celular | Proposta técnica; não implementado |
| Importação Google Drive | Planejada; sem OAuth/credenciais configurados |
| Shorts, Reels e thumbnails | Backlog posterior |

## Testes e documentação técnica

- **37 verificações selecionadas passaram**, além de TypeScript, lint e build de produção, na primeira entrega de transcrição.
- O teste real em português usou uma amostra sintética pública de 6,33 segundos e Whisper.cpp Tiny q5_1 em CPU. Produziu 13 palavras com duração positiva; o modelo errou a saudação, portanto isso não comprova precisão suficiente para vídeos finais.
- A suíte completa `npm test`, lint e build passaram na execução final do GitHub Actions. A limitação de socket IPC afetava somente a execução local na sandbox.
- As seis validações finais do GitHub passaram: CI completo, runtime Whisper Windows, persistência de modelos, recuperação MCP, renderização de fontes de vídeo Windows e instalador Windows.
- O app instalado passou no smoke test Windows (SMOKE-OK), incluindo renderização de um quadro e recuperação da janela de transcrição. A inferência real no navegador, a aceitação com vídeo completo da usuária e a GPU específica continuam pendentes.

O [relatório técnico e as evidências](https://github.com/curtaleitura-cmyk/CurtaCut/tree/feat/pt-br-local-transcription/docs/curta-leitura) estão na branch de desenvolvimento. A documentação original foi preservada em [README_UPSTREAM.md](README_UPSTREAM.md), como referência do projeto de origem; seus downloads, canais e instruções de release pertencem ao OpenChatCut original.

## Créditos e licença

Baseado em [0xsline/OpenChatCut](https://github.com/0xsline/OpenChatCut), a partir do commit `72ddb3300cda4ed31cbd0bccbfc94fb29b8cffca`, versão upstream 0.2.17. Os créditos, avisos de autoria, atribuições e a licença **AGPL-3.0-or-later** foram preservados. Dependências, fontes e outros componentes mantêm suas próprias licenças; consulte [LICENSE](LICENSE), o lockfile e os avisos incluídos no código.

Nenhum código de edição proprietária/comercial foi incorporado. Os nomes internos de protocolos e compatibilidade continuam sendo os existentes para preservar a integração.

[Repositório](https://github.com/curtaleitura-cmyk/CurtaCut) · [Alterações em revisão](https://github.com/curtaleitura-cmyk/CurtaCut/pull/1) · [Issues](https://github.com/curtaleitura-cmyk/CurtaCut/issues)
