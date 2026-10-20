import { useEffect, useState, useSyncExternalStore } from 'react';
import { useT } from '../i18n/locale';
import { theme } from '../theme';
import { cancelTranscriptionActivity, dismissTranscriptionActivity, getTranscriptionActivities,
  subscribeTranscriptionActivities } from './transcriptionActivity';
const stageLabels = { queued: 'Waiting in queue', preparing: 'Preparing audio', loading: 'Loading model',
  transcribing: 'Transcribing speech', finalizing: 'Finalizing transcript' } as const;
const terminalLabels = { done: 'Transcription complete', failed: 'Transcription failed', cancelled: 'Transcription cancelled' } as const;
function activityDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function sourceName(source: string) {
  try { return decodeURIComponent(source.split(/[?#]/)[0]!.split('/').pop() || source); } catch { return source; }
}
export function TranscriptionActivityPanel() {
  const t = useT();
  const activities = useSyncExternalStore(subscribeTranscriptionActivities, getTranscriptionActivities, getTranscriptionActivities);
  const [now, setNow] = useState(Date.now());
  const running = activities.some(item => item.status === 'running');
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);
  }, [running]);
  if (!activities.length) return null;
  return <aside aria-label={t('Transcription activity')} style={{ position: 'fixed', right: 16, bottom: 16,
    width: 'min(380px, calc(100vw - 32px))', maxHeight: '50vh', overflowY: 'auto', zIndex: 900,
    background: theme.panel, color: theme.text, border: `1px solid ${theme.borderLight}`, borderRadius: 8,
    boxShadow: '0 4px 20px #0005', padding: 12, fontSize: 12 }}>
    <strong>{t('Transcription activity')}</strong>
    {activities.map(item => <section key={item.id} style={{ borderTop: `1px solid ${theme.borderLight}`, marginTop: 10, paddingTop: 8 }}>
      <div style={{ overflowWrap: 'anywhere', fontWeight: 600 }}>{sourceName(item.source)}</div>
      <div style={{ marginTop: 4 }} role="status">{t(item.status === 'running' ? stageLabels[item.stage] : terminalLabels[item.status])}
        {item.status === 'running' && item.percent !== undefined ? ` — ${Math.round(item.percent)}%` : ''}</div>
      {item.status === 'running' && <progress aria-label={t(stageLabels[item.stage])} max={100} value={item.percent} style={{ width: '100%', marginTop: 6 }} />}
      <div style={{ color: theme.textDim, marginTop: 4 }}>{t('Provider: {provider} · Language: {language}', { provider: item.provider === 'local' ? 'Whisper local' : item.provider, language: item.language === 'pt' ? 'Português (Brasil)' : item.language })}</div>
      {item.engine && <div>{t('Engine: {engine}', { engine: item.engine })}</div>}
      {item.device && <div>{t('Device: {device}', { device: item.device })}</div>}
      {item.fallback && <div role="status" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{t('Fallback: {reason}', { reason: item.fallback })}</div>}
      {item.model && <div style={{ color: theme.textDim }}>{t('Model: {model}', { model: item.model })}</div>}
      <div>{t('Elapsed: {time}', { time: activityDuration((item.finishedAt ?? now) - item.startedAt) })}</div>
      {item.status === 'running' && item.percent === undefined && <div style={{ color: theme.textDim, marginTop: 4 }}>{t('This engine does not report a reliable percentage for this stage.')}</div>}
      {item.status === 'running' && now - item.updatedAt > 90000 && <div role="status" style={{ marginTop: 6 }}>{t('No progress update for {time}. Processing may still be running.', { time: activityDuration(now - item.updatedAt) })}</div>}
      {item.error && <div role="alert" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>{item.error}</div>}
      {item.status === 'running' && item.provider !== 'local' && <div style={{ color: theme.textDim, marginTop: 4 }}>{t('For cloud services, cancellation stops waiting here; the provider may continue processing.')}</div>}
      <button type="button" onClick={() => item.status === 'running' ? cancelTranscriptionActivity(item.id) : dismissTranscriptionActivity(item.id)} style={{ marginTop: 8, cursor: 'pointer' }}>{t(item.status === 'running' ? 'Cancel' : 'Dismiss')}</button>
    </section>)}
  </aside>;
}
