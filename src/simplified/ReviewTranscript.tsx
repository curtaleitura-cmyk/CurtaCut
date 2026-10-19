import { Fragment, useMemo } from "react";
import type { useSimplifiedEditor } from "./useSimplifiedEditor";
import { reviewTime as clock, type SourceSpan } from "./reviewModel";
import { transcriptReviewHints, type ReviewHint } from "./reviewHints";
import "./reviewBadges.css";

function HintBadge({ hint }: { hint?: ReviewHint }) {
  return hint ? (
    <span
      className={`cc-simple-badge is-${hint.kind}`}
      title={hint.reason}
      aria-label={`${hint.label}: ${hint.reason}`}
    >
      {hint.label}
    </span>
  ) : null;
}
export function ReviewTranscript({
  editor,
}: {
  editor: ReturnType<typeof useSimplifiedEditor>;
}) {
  const {
    model,
    tab,
    library,
    importInput,
    pauses,
    sourceSeek,
    fps,
    selected,
    active,
    select,
    setSelectedId,
    changeCut,
    editingRow,
    setEditingRow,
    fixWord,
  } = editor;
  const hints = useMemo(
    () => transcriptReviewHints(model?.rows ?? []),
    [model],
  );
  const trash = (span: SourceSpan, label: string) => (
    <button className="cc-review-trash" aria-label={label} title={label}
      disabled={!!model?.blocker || !model?.kept.some(w => w.end > span.start && w.start < span.end)}
      onClick={(event) => { event.stopPropagation(); changeCut(false, span); }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
    </button>
  );
  return (
    <>
      {!!pauses.length && <button className="cc-remove-pauses" disabled={!!model?.blocker || !pauses.some(p => model?.kept.some(w => w.end > p.start && w.start < p.end))} onClick={editor.removeAllPauses}>Excluir todas as pausas</button>}
      {!model ? (
        <div className="cc-simple-empty">
          <h2>Comece pelo seu vídeo</h2>
          <p>Importe um vídeo para editar usando o texto da fala.</p>
          <button onClick={() => importInput.current?.click()}>
            Importar vídeo
          </button>
        </div>
      ) : tab === "suggestions" ? (
        <div className="cc-simple-empty">
          <h2>Indícios para revisar</h2>
          <p>
            Os selos usam regras de texto e intervalos da transcrição. A análise
            contextual por IA ainda não está conectada. Nenhum corte é aplicado
            automaticamente.
          </p>
          {model.rows
            .filter((row) => hints.has(row.id))
            .map((row) => (
              <div key={row.id} className="cc-simple-suggestion">
                <button onClick={() => select(row, true)}>Ouvir trecho</button>
                {trash(row, "Excluir trecho sugerido")}
                <HintBadge hint={hints.get(row.id)} />
                <span>
                  {clock(row.speechStart / 1000)} –{" "}
                  {clock(row.speechEnd / 1000)}
                </span>
                <strong>{row.text}</strong>
                <small>{hints.get(row.id)!.reason}</small>
              </div>
            ))}
          {!hints.size && (
            <p>
              Nenhum indício pelas regras de texto disponíveis. Isso não garante
              uma gravação sem erros.
            </p>
          )}
          <h3>Pausas entre falas</h3>
          <p>
            Roxo indica um intervalo sem palavras transcritas, não silêncio
            confirmado pelo áudio. Ouça antes de decidir.
          </p>
          {pauses.length ? (
            pauses.map((pause, i) => (
              <div key={i} className="cc-simple-pause">
                {trash(pause, "Excluir pausa")}
                <button onClick={() => sourceSeek(pause.start, true, pause.end)}>Ouvir pausa</button>
                <span className="cc-simple-badge is-pause">Pausa</span> ▶{" "}
                {clock(pause.start / fps)} – {clock(pause.end / fps)} ·{" "}
                {((pause.end - pause.start) / fps).toFixed(1)}s
              </div>
            ))
          ) : (
            <p>
              Nenhuma pausa de pelo menos um segundo nos tempos disponíveis.
            </p>
          )}
        </div>
      ) : !model.rows.length ? (
        <div className="cc-simple-empty">
          <h2>Seu vídeo, palavra por palavra</h2>
          <p>Transcreva o vídeo para navegar pelas falas e começar a editar.</p>
          <button
            disabled={model.asset.transcribeStatus === "running"}
            onClick={() => library.onTranscribeAsset(model.asset)}
          >
            {model.asset.transcribeStatus === "running"
              ? "Transcrição em andamento…"
              : "Transcrever vídeo"}
          </button>
          {model.asset.transcribeError && (
            <p role="alert">{model.asset.transcribeError}</p>
          )}
        </div>
      ) : (
        model.rows.map((row) => (
          <Fragment key={row.id}>
            <article
              key={row.id}
              data-row-id={row.id}
              className={`cc-simple-row ${row.keptFrames === 0 ? "is-cut" : ""} ${selected?.id === row.id ? "is-selected" : ""} ${active?.id === row.id ? "is-playing" : ""}`}
            >
              {trash(row, "Excluir trecho")}
              <div className="cc-simple-row-meta">
                <button
                  onClick={() => select(row, true)}
                  aria-label={`Reproduzir trecho em ${clock(row.speechStart / 1000)}`}
                >
                  ▶
                </button>
                <button onClick={() => select(row)}>
                  {clock(row.speechStart / 1000)} –{" "}
                  {clock(row.speechEnd / 1000)}
                </button>
                <HintBadge hint={hints.get(row.id)} />
                <span className="cc-simple-row-status">
                  {row.keptFrames === 0
                    ? "Removido"
                    : row.keptFrames < row.end - row.start
                      ? "Parcialmente cortado"
                      : "Mantido"}
                </span>
              </div>
              <button
                className="cc-simple-row-text"
                onClick={() => select(row)}
              >
                {row.text}
              </button>
              <div className="cc-simple-row-actions">
                <button
                  disabled={row.keptFrames === 0 ? !editor.topBar.canUndo : !!model.blocker}
                  onClick={() => {
                    setSelectedId(row.id);
                    changeCut(row.keptFrames === 0, row);
                  }}
                >
                  {row.keptFrames === 0 ? "Desfazer última alteração" : "Marcar corte"}
                </button>
                <details
                  onToggle={(event) => {
                    if (event.currentTarget.open) setEditingRow(row.id);
                  }}
                >
                  <summary>Corrigir palavras</summary>
                  <div className="cc-simple-word-edit">
                    {editingRow === row.id &&
                      row.wordIndices.map((i) => (
                        <input
                          key={`${i}:${model.words[i]!.text}`}
                          aria-label={`Corrigir palavra ${i + 1}`}
                          defaultValue={model.words[i]!.text}
                          onBlur={(event) => fixWord(i, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              event.currentTarget.blur();
                          }}
                        />
                      ))}
                  </div>
                </details>
              </div>
            </article>
            {pauses
              .filter(
                (pause) => pause.start >= row.start && pause.start < row.end,
              )
              .map((pause, i) => (
                <div key={i} className="cc-simple-pause-row">
                  {trash(pause, "Excluir pausa")}
                  <button
                    onClick={() => sourceSeek(pause.start, true, pause.end)}
                    aria-label={`Reproduzir pausa em ${clock(pause.start / fps)}`}
                  >
                    ▶ {clock(pause.start / fps)} – {clock(pause.end / fps)}
                    <span className="cc-simple-badge is-pause">Pausa</span>
                    <span>
                      Intervalo de{" "}
                      {((pause.end - pause.start) / fps).toFixed(1)}s sem
                      palavras transcritas
                    </span>
                  </button>
                </div>
              ))}
          </Fragment>
        ))
      )}
    </>
  );
}
