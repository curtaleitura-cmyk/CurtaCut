# Default to local Portuguese transcription and preserve native word timestamps

A fresh installation selected AssemblyAI and Chinese transcription. This change selects local Whisper and Brazilian Portuguese (`pt`), keeps saved preferences, and exposes automatic language detection for local and cloud settings. Explicit per-task overrides continue to work without changing global preferences.

The real Portuguese audio smoke test also exposed collapsed word timestamps in the native CLI fallback with `-nt`. Removing that argument preserves timestamp decoding; CLI argument generation is now covered by a regression check.

## Main changes

- `shared/transcription-language.ts`: shared default and browser Whisper language options.
- `src/components/settings/`: Portuguese/auto choices and explicit-save preference synchronization.
- `src/transcript/`: defaults for all routing paths, saved-preference preservation and tests.
- `desktop/native-asr-utils.ts`, `native-asr-worker.ts` and verification: Portuguese normalization and timestamp-safe CLI arguments.
- `server/plugins/media-provider-config.ts`, `server/keystore.ts`, `src/agent/capabilities.ts`: server language default and local-first capabilities/routing.
- `shared/asr-models.ts`: advertise Portuguese; `package.json`: register regression test.
- `docs/curta-leitura/`: architecture audit, Windows instructions, limitations and future work.

## Validation

- 37 selected regression checks passed, including preferences, native/cloud routing, job resumption, word editing/projection, undo, silence, SRT and browser export.
- TypeScript, lint and production Vite build passed.
- Real 6.33-second public synthetic PT-BR audio passed through Whisper.cpp v1.9.2 CPU/Tiny q5_1 and the production chunk converter: `pt` confirmed, 13 words with positive durations within source bounds.
- `npm test` full gate blocked by sandbox IPC permission (`tsx` CLI); selected checks used `node --import tsx` instead.
- Initial build pre-step tar ownership issue was worked around using `TAR_OPTIONS=--no-same-owner`; no application script was modified for that environment issue.

## Limits

Windows/Electron end-to-end, real browser Whisper inference and a full user-video MP4 export remain untested. Tiny misrecognized the greeting in the sample; Base/Small need accuracy evaluation. Timestamp bounds checks do not establish human alignment accuracy. No CUDA/NVENC compatibility is assumed. No semantic mistake detector UI, remote processing queue, Google Drive integration or paid service activation is included.
