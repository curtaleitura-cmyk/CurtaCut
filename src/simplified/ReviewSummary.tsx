import { invokeAction } from "../shortcuts/actionRegistry";
import { reviewTime as clock, type ReviewModel } from "./reviewModel";
interface Props {
  model: ReviewModel | null;
  fps: number;
  keptFrames: number;
  removedFrames: number;
  cutCount: number;
  finalText: string;
  canExport: boolean;
  downloadSrt: () => void;
  onAdvanced: () => void;
}
export function ReviewSummary({
  model,
  fps,
  keptFrames,
  removedFrames,
  cutCount,
  finalText,
  canExport,
  downloadSrt,
  onAdvanced,
}: Props) {
  return (
    <div className="cc-simple-bottom">
      <section>
        <h3>Texto final</h3>
        <p>
          {model
            ? finalText || "Nenhuma fala preservada."
            : "O texto aparecerá depois da transcrição."}
        </p>
      </section>
      <section>
        <h3>Estatísticas do vídeo selecionado</h3>
        <dl>
          <dt>Original</dt>
          <dd>{clock((model?.duration ?? 0) / fps)}</dd>
          <dt>Mantido</dt>
          <dd>{clock(keptFrames / fps)}</dd>
          <dt>Removido</dt>
          <dd>
            {clock(removedFrames / fps)} ·{" "}
            {model ? Math.round((removedFrames / model.duration) * 100) : 0}%
          </dd>
          <dt>Trechos totalmente cortados</dt>
          <dd>{cutCount}</dd>
        </dl>
      </section>
      <section>
        <h3>Finalizar</h3>
        <button
          disabled={!canExport}
          onClick={() => invokeAction("open-export")}
        >
          Exportar vídeo
        </button>
        <button disabled={!model?.rows.length} onClick={downloadSrt}>
          Gerar SRT do vídeo selecionado
        </button>
        <button onClick={onAdvanced}>Abrir editor avançado</button>
      </section>
    </div>
  );
}
