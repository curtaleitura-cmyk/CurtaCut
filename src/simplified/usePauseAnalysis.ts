import { projectStoreRemoteAvailable, waitForBrowserProjectOwnership } from '../persist/projectStoreTransport';
import { useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '../editor/types';
import type { AtomicAction } from '../editor/reduce';
import { sourceRevisionOf } from '../editor/mediaSourceRevision';
import { PAUSE_SETTINGS_EVENT, readPauseSettings } from '../audio/pausePreferences';
import type { PauseAnalysis, PauseSettings } from '../../shared/pause-analysis';

export function usePauseAnalysis(asset: MediaAsset | undefined, fps: number, projectId: string,
  commit: ((actions: AtomicAction[], label: string) => void) | undefined) {
  const [settings, setSettings] = useState(readPauseSettings);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState({ running: false, percent: 0, message: '' });
  const controller = useRef<AbortController | null>(null);
  const attempted = useRef(new Set<string>());
  const latest = useRef({ asset, commit });
  latest.current = { asset, commit };
  const revision = asset ? sourceRevisionOf(asset) : '';
  const cached = asset?.pauseAnalysis;
  const valid = cached?.version === 1 && cached.sourceRevision === revision
    && cached.thresholdDb === settings.thresholdDb && cached.minSilenceMs === settings.minSilenceMs;
  useEffect(() => {
    const update = (event: Event) => setSettings((event as CustomEvent<PauseSettings>).detail ?? readPauseSettings());
    window.addEventListener(PAUSE_SETTINGS_EVENT, update);
    return () => window.removeEventListener(PAUSE_SETTINGS_EVENT, update);
  }, []);
  useEffect(() => {
    const current = latest.current.asset;
    if (!current || !latest.current.commit || !settings.enabled || valid) {
      setStatus({ running: false, percent: valid ? 100 : 0, message: valid ? 'Análise do áudio salva no projeto.' : '' });
      return;
    }
    const abort = new AbortController(); controller.current = abort;
    setStatus({ running: true, percent: 0, message: 'Analisando pausas no áudio com FFmpeg…' });
    const run = async () => {
      try {
        // Automatic analysis must not change the project revision before the editor acquires its write lease.
        if (projectStoreRemoteAvailable() && !await waitForBrowserProjectOwnership(projectId))
          throw new Error('Aguardando acesso de edição ao projeto. Tente analisar novamente.');
        if (abort.signal.aborted) return;
        const key = `${current.id}:${revision}:${settings.thresholdDb}:${settings.minSilenceMs}:${attempt}`;
        if (attempted.current.has(key)) {
          setStatus({ running: false, percent: 0, message: 'Análise não aplicada. Clique em Analisar áudio novamente para repetir.' });
          return;
        }
        attempted.current.add(key);
        const response = await fetch('/api/pause-analysis', { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: current.src, settings: { thresholdDb: settings.thresholdDb, minSilenceMs: settings.minSilenceMs } }), signal: abort.signal });
        if (!response.body) throw new Error('Resposta de análise indisponível.');
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let pending = '', result: PauseAnalysis | undefined;
        for (;;) {
          const { done, value } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split('\n'); pending = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.type === 'error') throw new Error(event.error);
            if (event.type === 'progress') setStatus({ running: true,
              percent: Math.min(99, Math.max(0, Math.floor(event.processedMs / Math.max(1, current.durationInFrames * 1000 / fps) * 100))),
              message: 'Analisando pausas no áudio com FFmpeg…' });
            if (event.type === 'result') result = { version: 1, sourceRevision: revision,
              durationMs: event.durationMs, quiet: event.quiet, thresholdDb: settings.thresholdDb,
              minSilenceMs: settings.minSilenceMs, analyzedAt: Date.now() };
          }
          if (done) break;
        }
        if (!response.ok || !result) throw new Error('A análise não retornou um resultado válido.');
        if (abort.signal.aborted || latest.current.asset?.id !== current.id
          || sourceRevisionOf(latest.current.asset) !== revision) return;
        latest.current.commit?.([{ type: 'pool.updateAsset', id: current.id, patch: { pauseAnalysis: result } }], 'Analisar pausas do áudio');
        setStatus({ running: false, percent: 100, message: 'Análise concluída. Ouça as pausas antes de removê-las.' });
      } catch (error) {
        if (!abort.signal.aborted) setStatus({ running: false, percent: 0, message: error instanceof Error ? error.message : String(error) });
      }
    };
    void run();
    return () => { abort.abort(); };
  }, [asset?.id, asset?.src, revision, settings.enabled, settings.thresholdDb, settings.minSilenceMs, valid, attempt, fps, projectId]);
  return { settings, analysis: settings.enabled && valid ? cached : undefined, status,
    cancel: () => { controller.current?.abort(); setStatus({ running: false, percent: 0, message: 'Análise cancelada. Você pode tentar novamente.' }); },
    retry: () => setAttempt(n => n + 1) };
}
