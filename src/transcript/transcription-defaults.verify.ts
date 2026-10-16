import assert from 'node:assert/strict';
import { browserWhisperLanguageOptions } from '../../shared/transcription-language';
import { ASR_INFERENCE_CONTRACT } from '../../shared/asr-inference-contract';
import { whisperLanguage } from '../../desktop/native-asr-utils';
import type { DesktopAsrRequest } from '../../shared/desktop-inference';
import {
  preferredTranscriptionLanguage, preferredTranscriptionProvider,
  syncTranscriptionPreferences, transcribePath,
} from './provider';

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value); },
} });
const requests: DesktopAsrRequest[] = [];
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  dispatchEvent: () => true,
  openChatCutDesktop: { inference: {
    getCapabilities: async () => ({ asr: { available: true, contractId: ASR_INFERENCE_CONTRACT.id } }),
    subscribeProgress: () => () => {},
    transcribe: async (request: DesktopAsrRequest) => {
      requests.push(request);
      return { requestId: request.requestId, backend: 'native-cpu', text: 'Olá mundo',
        chunks: [{ text: 'Olá', start: 100, end: 350 }, { text: 'mundo', start: 400, end: 800 }] };
    },
  } },
} });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  assert.equal(String(input), '/api/asr-models', 'no cloud transcription or paid API call');
  return Response.json({ models: [] });
};
try {
  assert.equal(preferredTranscriptionLanguage(), 'pt');
  assert.equal(preferredTranscriptionProvider(), 'local');
  syncTranscriptionPreferences({});
  const result = await transcribePath('/media/uploads/test.wav');
  assert.equal(requests.at(-1)?.language, 'pt', 'real provider path delivers pt to native bridge');
  assert.deepEqual(result.words.map(({ start, end }) => ({ start, end })),
    [{ start: 100, end: 350 }, { start: 400, end: 800 }]);

  for (const language of ['en', 'es', 'zh', 'pt', 'auto']) {
    syncTranscriptionPreferences({ TRANSCRIPTION_LANGUAGE: language, PREFERRED_TRANSCRIPTION_PROVIDER: 'local' });
    syncTranscriptionPreferences({ TRANSCRIPTION_LANGUAGE: '' }); // Opening settings must not replace a saved browser preference.
    assert.equal(preferredTranscriptionLanguage(), language);
    await transcribePath('/media/uploads/test.wav');
    assert.equal(requests.at(-1)?.language, language);
    assert.deepEqual(browserWhisperLanguageOptions(language), language === 'auto' ? {} : { language });
  }
  syncTranscriptionPreferences({ TRANSCRIPTION_LANGUAGE: 'pt' });
  await transcribePath('/media/uploads/test.wav', undefined, { languageCode: 'es' });
  assert.equal(requests.at(-1)?.language, 'es', 'one transcription can override the global language');
  assert.equal(preferredTranscriptionLanguage(), 'pt', 'override does not change global preference');
  syncTranscriptionPreferences({ PREFERRED_TRANSCRIPTION_PROVIDER: 'assemblyai' });
  syncTranscriptionPreferences({});
  assert.equal(preferredTranscriptionProvider(), 'assemblyai', 'saved cloud preference is preserved');
  syncTranscriptionPreferences({ TRANSCRIPTION_LANGUAGE: '', PREFERRED_TRANSCRIPTION_PROVIDER: '' });
  assert.equal(preferredTranscriptionProvider(), 'assemblyai', 'unset server status preserves saved provider');
  syncTranscriptionPreferences({}, { TRANSCRIPTION_LANGUAGE: '', PREFERRED_TRANSCRIPTION_PROVIDER: '' });
  assert.equal(preferredTranscriptionLanguage(), 'pt');
  assert.equal(preferredTranscriptionProvider(), 'local');
  for (const language of ['pt', 'pt-BR', 'pt-PT', 'por']) {
    assert.equal(whisperLanguage(language), 'pt');
    assert.deepEqual(browserWhisperLanguageOptions(language), { language: 'pt' });
  }
  assert.equal(whisperLanguage('auto'), 'auto');
  assert.deepEqual(browserWhisperLanguageOptions('auto'), {});
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
  assert.equal(preferredTranscriptionLanguage(), 'pt', 'private browsing fallback');
  assert.equal(preferredTranscriptionProvider(), 'local');
} finally {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');
}
console.log('transcription-defaults.verify: defaults, persistence, routing, overrides, timestamps and auto passed');
