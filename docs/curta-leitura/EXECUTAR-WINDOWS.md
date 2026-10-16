# Executar no Windows e publicar a branch

O fork e a branch já foram publicados:
https://github.com/curtaleitura-cmyk/CurtaCut

Pull Request aberto, ainda não integrado:
https://github.com/curtaleitura-cmyk/CurtaCut/pull/1

## Baixar a versão com nossas alterações

Instalar Git e Node.js 24 LTS (o projeto requer `>=24 <25`). No PowerShell:

```powershell
git clone --branch feat/pt-br-local-transcription https://github.com/curtaleitura-cmyk/CurtaCut.git
cd CurtaCut
```

É necessário selecionar essa branch enquanto o PR não for integrado à `main`. Os instaladores do OpenChatCut original não contêm nossas mudanças.

## Instalar e abrir

Dentro do checkout recuperado:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Não sobrescrever um `.env.local` existente. O arquivo de exemplo não exige cadastrar chave paga para a timeline e a transcrição local. O provisionamento pode baixar binários/modelos e o navegador de renderização; deixar a conexão disponível.

Abrir `http://localhost:5199`. Para testar o motor nativo, encerrar o servidor anterior e executar:

```powershell
npm run desktop:dev
```

Não há instalador próprio gerado nesta entrega; os instaladores do upstream não contêm nossos commits.

Nas configurações de transcrição, o provedor inicial deve ser Local e o idioma padrão Português (Brasil). Se houver uma preferência anterior, ela será mantida: escolher português e salvar para mudá-la. Na área de modelos locais, baixar Base ou Small para o primeiro comparativo. O modelo também tem de estar disponível no formato adequado ao motor (GGML no nativo, ONNX no navegador); o aplicativo já diferencia essas disponibilidades.

## Verificar

```powershell
npm run verify:speech-providers
npm run verify:components
npm run verify:desktop-inference
npm run build
npm run lint
npm test
```

O `npm test` completo não pôde ser validado nesta sandbox por bloqueio de socket IPC do executor. As 37 verificações selecionadas, executadas por `node --import tsx`, passaram (ver `test-results.txt`). Essa limitação não é atribuída ao Windows.

Aceitação manual ainda necessária:

1. Iniciar sem preferências, conferir Local/Português, transcrever vídeo curto sem API paga.
2. Salvar inglês/espanhol/auto, fechar, reabrir e confirmar persistência; repetir entre projetos.
3. Comparar português no navegador e Electron; no Electron verificar o caminho CLI e o servidor persistente quando disponível.
4. Ouvir palavras e frases, conferir tempos contra a fala, excluir um trecho, revisar a junção, desfazer e exportar MP4.
5. Conferir a exportação inteira e preservar o original. Medir precisão e consumo com Base e Small.
6. Só depois de identificar GPU e driver, testar aceleração. A implementação atual de ASR Windows seleciona CPU; NVIDIA não implica CUDA ativo.

## Situação da integração

O PR #1 está aberto no fork `curtaleitura-cmyk/CurtaCut`, com base `main` e compare `feat/pt-br-local-transcription`. O upstream não foi alterado.

A suíte completa e a aceitação Windows continuam pendentes; nenhuma mesclagem automática foi executada. As próximas alterações devem ir pela branch e pelo PR, preservando o histórico e sem force push.
