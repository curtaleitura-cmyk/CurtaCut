import { useEffect, useState } from 'react';
import { readPauseSettings, savePauseSettings, PAUSE_SETTINGS_EVENT } from '../../audio/pausePreferences';
import type { PauseSettings } from '../../../shared/pause-analysis';

export function PauseSettingsPane() {
  const [value, setValue] = useState(readPauseSettings);
  useEffect(() => {
    const update = (event: Event) => setValue((event as CustomEvent<PauseSettings>).detail ?? readPauseSettings());
    window.addEventListener(PAUSE_SETTINGS_EVENT, update);
    return () => window.removeEventListener(PAUSE_SETTINGS_EVENT, update);
  }, []);
  const change = (patch: Partial<PauseSettings>) => savePauseSettings({ ...value, ...patch });
  return <details style={{ padding: 12, border: '1px solid var(--cc-border, #8886)', borderRadius: 8, margin: '8px 0' }}>
    <summary>Detecção de pausas e silêncios</summary>
    <div style={{ display: 'grid', gap: 10, paddingTop: 10 }}>
      <label><input type="checkbox" checked={value.enabled} onChange={e => change({ enabled: e.target.checked })} /> Detecção automática no editor simplificado</label>
      <label>Duração mínima do silêncio (ms) <input aria-label="Duração mínima do silêncio (ms)" type="number" min="200" max="10000" step="100" defaultValue={value.minSilenceMs} key={`min:${value.minSilenceMs}`} onBlur={e => change({ minSilenceMs: Number(e.target.value) })} /></label>
      <label>Sensibilidade (dB) <input aria-label="Sensibilidade (dB)" type="number" min="-80" max="-10" step="1" defaultValue={value.thresholdDb} key={`db:${value.thresholdDb}`} onBlur={e => change({ thresholdDb: Number(e.target.value) })} /></label>
      <label>Margem de proteção das falas (ms) <input aria-label="Margem de proteção das falas (ms)" type="number" min="0" max="1000" step="50" defaultValue={value.paddingMs} key={`pad:${value.paddingMs}`} onBlur={e => change({ paddingMs: Number(e.target.value) })} /></label>
      <label><input type="checkbox" checked={value.showPauses} onChange={e => change({ showPauses: e.target.checked })} /> Exibir silêncios como blocos</label>
      <small>A análise não inicia uma transcrição. Alterar a sensibilidade ou a duração mínima analisa o áudio novamente. Áudio baixo pode conter fala: nenhuma pausa é excluída automaticamente.</small>
    </div>
  </details>;
}
