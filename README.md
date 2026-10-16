# CurtaCut

**Editor de vídeo baseado no OpenChatCut, com transcrição local em Português (Brasil).**

O CurtaCut é uma versão independente mantida por `curtaleitura-cmyk`. Reutiliza a timeline, a edição por texto, os projetos e a exportação do [OpenChatCut](https://github.com/0xsline/OpenChatCut). O objetivo inicial é facilitar a edição de vídeos falados, resenhas e conteúdos para YouTube, Instagram e TikTok.

> **Estado atual:** versão de desenvolvimento. As melhorias estão na branch [`feat/pt-br-local-transcription`](https://github.com/curtaleitura-cmyk/CurtaCut/tree/feat/pt-br-local-transcription), no [PR #1](https://github.com/curtaleitura-cmyk/CurtaCut/pull/1). Enquanto esse PR estiver aberto, baixar apenas a `main` não inclui as melhorias de transcrição. **Ainda não há instalador `.exe` próprio do CurtaCut.**

## O que já mudou nesta versão

- **Português (Brasil) — `pt`** nas opções de transcrição e como padrão em uma instalação nova.
- **Whisper local** como provedor inicial, sem exigir chave de API paga.
- Detecção automática e outros idiomas continuam disponíveis.
- Preferências anteriores são preservadas. Quem já usava outro idioma deve escolher português nas configurações e salvar.
- Correção dos timestamps no fallback nativo Whisper.cpp, importantes para cortar o vídeo pelo texto.
- Identidade CurtaCut nos títulos e informações principais do aplicativo; código de instalação/atualização preparado para nosso repositório.

O código de transcrição passou por testes automatizados e por um teste de áudio sintético em português brasileiro em Linux/CPU. A instalação e o fluxo completo no Windows ainda precisam de validação. A interface ainda não foi totalmente traduzida para português.

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

### 2. Baixe a branch com as nossas alterações

No PowerShell, entre na pasta onde deseja guardar o aplicativo e execute:

```powershell
git clone --branch feat/pt-br-local-transcription https://github.com/curtaleitura-cmyk/CurtaCut.git
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
git switch feat/pt-br-local-transcription
git pull --ff-only
npm.cmd ci
npm.cmd run dev
```

Se tiver alterações próprias no código, confira `git status` antes de atualizar; não use comandos que descartem seus arquivos. Faça backup dos projetos e da mídia antes de atualizar versões de desenvolvimento.

## Instalador `.exe`

Ainda não foi gerado nem publicado um instalador próprio desta versão. Os instaladores do OpenChatCut original não contêm as alterações do CurtaCut.

O projeto já possui um workflow manual de empacotamento desktop e o script `npm run desktop:dist:win`, mas gerar um instalador, validar sua instalação e publicar uma release são etapas separadas. Não considerar um pacote instalado/testado no Windows até essa validação ocorrer.

As atualizações do CurtaCut devem vir de [releases deste repositório](https://github.com/curtaleitura-cmyk/CurtaCut/releases), quando existirem. Código-fonte ZIP não é instalador.

## Recursos e próximos passos

| Área | Situação |
|---|---|
| Timeline, cortes, desfazer e projetos locais | Reutilizados do OpenChatCut |
| Edição por texto e timestamps | Recursos existentes preservados; regressões selecionadas testadas |
| Português e Whisper local por padrão | Implementados na branch do PR #1 |
| Legendas e exportação SRT | Recursos existentes; aceitação com vídeos próprios pendente |
| Validação Windows e vídeo completo exportado | Pendente |
| Sugestões contextuais de erros de gravação | Planejadas; detector semântico e interface ainda não implementados |
| Processamento no PC controlado pelo celular | Proposta técnica; não implementado |
| Importação Google Drive | Planejada; sem OAuth/credenciais configurados |
| Shorts, Reels e thumbnails | Backlog posterior |

## Testes e documentação técnica

- **37 verificações selecionadas passaram**, além de TypeScript, lint e build de produção, na primeira entrega de transcrição.
- O teste real em português usou uma amostra sintética pública de 6,33 segundos e Whisper.cpp Tiny q5_1 em CPU. Produziu 13 palavras com duração positiva; o modelo errou a saudação, portanto isso não comprova precisão suficiente para vídeos finais.
- A suíte completa `npm test` foi bloqueada pelo socket IPC do executor nesta sandbox; não foi declarada aprovada. Os testes selecionados foram executados com `node --import tsx`.
- Windows/Electron de ponta a ponta, inferência real no navegador e exportação de um vídeo completo da usuária continuam pendentes.

O [relatório técnico e as evidências](https://github.com/curtaleitura-cmyk/CurtaCut/tree/feat/pt-br-local-transcription/docs/curta-leitura) estão na branch de desenvolvimento. A documentação original foi preservada em [README_UPSTREAM.md](README_UPSTREAM.md), como referência do projeto de origem; seus downloads, canais e instruções de release pertencem ao OpenChatCut original.

## Créditos e licença

Baseado em [0xsline/OpenChatCut](https://github.com/0xsline/OpenChatCut), a partir do commit `72ddb3300cda4ed31cbd0bccbfc94fb29b8cffca`, versão upstream 0.2.17. Os créditos, avisos de autoria, atribuições e a licença **AGPL-3.0-or-later** foram preservados. Dependências, fontes e outros componentes mantêm suas próprias licenças; consulte [LICENSE](LICENSE), o lockfile e os avisos incluídos no código.

Nenhum código de edição proprietária/comercial foi incorporado. Os nomes internos de protocolos e compatibilidade continuam sendo os existentes para preservar a integração.

[Repositório](https://github.com/curtaleitura-cmyk/CurtaCut) · [Alterações em revisão](https://github.com/curtaleitura-cmyk/CurtaCut/pull/1) · [Issues](https://github.com/curtaleitura-cmyk/CurtaCut/issues)
