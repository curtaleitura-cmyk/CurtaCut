import { useState } from 'react';
import type { useSimplifiedEditor } from './useSimplifiedEditor';
import { PauseSettingsPane } from '../components/settings/PauseSettingsPane';
import { reviewTime } from './reviewModel';

export function PauseReviewTools({ editor }: { editor: ReturnType<typeof useSimplifiedEditor> }) {
  const { audio, model, fps, pauses } = editor;
  const [reviewing, setReviewing] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const available = pauses.filter(p => model?.kept.some(k => k.start < p.end && k.end > p.start));
  const id = (p: { start: number; end: number }) => `${p.start}:${p.end}`;
  const selected = available.filter(p => chosen.includes(id(p)));
  const seconds = selected.reduce((n, p) => n + (model?.kept.reduce((t, k) => t + Math.max(0, Math.min(k.end, p.end) - Math.max(k.start, p.start)), 0) ?? 0) / fps, 0);
  if (!model) return null;
  return <div className="cc-pause-tools">
    <PauseSettingsPane />
    <div role="status" aria-live="polite">
      {audio.status.message}
      {audio.status.running && <> <strong>{audio.status.percent}%</strong><progress max="100" value={audio.status.percent} aria-label="Análise das pausas" /></>}
    </div>
    {audio.status.running ? <button onClick={audio.cancel}>Cancelar análise</button>
      : !audio.analysis && audio.settings.enabled && <button onClick={audio.retry}>Analisar áudio novamente</button>}
    <button disabled={!audio.analysis} onClick={editor.splitAtPlayhead}>Dividir no ponto da reprodução</button>
    {!!available.length && <button className="cc-remove-pauses" disabled={!!model.blocker}
      onClick={() => { setChosen(available.map(id)); setReviewing(true); }}>Excluir todas as pausas</button>}
    {reviewing && <section aria-label="Revisar exclusão de pausas" className="cc-pause-confirm">
      <strong>{selected.length} pausas · {seconds.toFixed(2)} s serão removidos</strong>
      <p>Ouça os intervalos e desmarque pausas expressivas ou com fala baixa. A detecção mede o volume; não confirma ausência de fala. A margem de proteção já foi aplicada.</p>
      {available.map(p => <div key={id(p)}>
        <label><input type="checkbox" checked={chosen.includes(id(p))} onChange={e => setChosen(old => e.target.checked ? [...old, id(p)] : old.filter(v => v !== id(p)))} />
          {reviewTime(p.start / fps)} – {reviewTime(p.end / fps)} · {((p.end - p.start) / fps).toFixed(2)} s</label>
        <button onClick={() => editor.sourceSeek(p.start, true, p.end)}>Ouvir pausa</button>
      </div>)}
      <button disabled={!selected.length || !!model.blocker} onClick={() => { editor.removeAllPauses(selected); setReviewing(false); }}>Confirmar exclusão das pausas</button>
      <button onClick={() => setReviewing(false)}>Cancelar</button>
    </section>}
    {!model.words.length && <button disabled={model.asset.transcribeStatus === 'running'} onClick={() => editor.library.onTranscribeAsset(model.asset)}>
      {model.asset.transcribeStatus === 'running' ? 'Transcrição em andamento…' : 'Transcrever vídeo'}</button>}
  </div>;
}
