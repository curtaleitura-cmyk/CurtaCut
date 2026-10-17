import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ensureLocaleDict } from '../i18n/locale';
import { TranscriptionActivityPanel } from './TranscriptionActivityPanel';
import { abortable, cancelTranscriptionActivity, dismissTranscriptionActivity,
  getTranscriptionActivities, runTranscriptionActivity } from './transcriptionActivity';
await ensureLocaleDict('pt-BR');
const ready = Promise.withResolvers<void>();
const result = Promise.withResolvers<void>();
const pending = runTranscriptionActivity({ source: '/media/uploads/story.mov', provider: 'local', language: 'pt' }, async (signal, progress) => {
  progress({ stage: 'transcribing', model: 'Whisper Small' }); ready.resolve();
  return abortable(result.promise, signal);
});
await ready.promise;
let markup = renderToStaticMarkup(<TranscriptionActivityPanel />);
assert.match(markup, /Transcrevendo fala/);
assert.match(markup, /Português \(Brasil\)/);
assert.match(markup, /story.mov/);
assert.match(markup, /Cancelar/);
assert.match(markup, /percentual confiável/);
assert.doesNotMatch(markup, /<progress[^>]*value=/, 'unknown inference progress remains indeterminate');
cancelTranscriptionActivity(getTranscriptionActivities()[0]!.id);
await assert.rejects(pending, { name: 'AbortError' });
markup = renderToStaticMarkup(<TranscriptionActivityPanel />);
assert.match(markup, /Transcrição cancelada/);
assert.match(markup, /Fechar/);
for (const activity of getTranscriptionActivities()) dismissTranscriptionActivity(activity.id);
assert.equal(renderToStaticMarkup(<TranscriptionActivityPanel />), '');
console.log('TranscriptionActivityPanel.verify: Portuguese status, identity, honest progress and cancellation UI passed');
