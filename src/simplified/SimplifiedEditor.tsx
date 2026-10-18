import { ReviewTranscript } from "./ReviewTranscript";
import { ReviewSummary } from "./ReviewSummary";
import { reviewTime as clock } from "./reviewModel";
import { PreviewPanel } from "../components/PreviewPanel";

import {
  useSimplifiedEditor,
  type SimplifiedEditorProps,
} from "./useSimplifiedEditor";
import "./simplified.css";
export function SimplifiedEditor(props: SimplifiedEditorProps) {
  const editor = useSimplifiedEditor(props);
  const {
    commands,
    preview,
    topBar,
    state,
    assets,
    asset,
    model,
    selected,
    tab,
    setTab,
    sourceMode,
    sourceFrame,
    setSourceFrame,
    speed,
    setSpeed,
    notice,
    setNotice,
    busy,
    original,
    importInput,
    body,
    stopAt,
    previewSource,
    fps,
    index,
    keptFrames,
    removedFrames,
    pauses,
    cutCount,
    finalText,
    select,
    sourceSeek,
    editedSeek,
    changeCut,
    hearJoin,
    importVideo,
    downloadSrt,
    setAssetId,
    onAdvanced,
  } = editor;
  return (
    <main className="cc-simple" aria-label="Edição simplificada">
      <div className="cc-simple-heading">
        <div>
          <strong>Edição pelo texto</strong>
          <small>Assista, revise e escolha o que fica.</small>
        </div>
        <div className="cc-simple-heading-actions">
          <input
            ref={importInput}
            type="file"
            accept="video/*,.mov,.mp4,.m4v,.webm"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importVideo(file);
              event.target.value = "";
            }}
          />
          <button disabled={busy} onClick={() => importInput.current?.click()}>
            + Importar vídeo
          </button>
          {!!assets.length && (
            <select
              aria-label="Vídeo em revisão"
              value={asset?.id ?? ""}
              onChange={(event) => setAssetId(event.target.value)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <button disabled={!topBar.canUndo} onClick={() => commands?.undo()}>
            Desfazer
          </button>
          <button disabled={!topBar.canRedo} onClick={() => commands?.redo()}>
            Refazer
          </button>
        </div>
      </div>
      <div className="cc-simple-columns">
        <section className="cc-simple-watch" aria-label="Player de vídeo">
          <div className="cc-simple-panel-title">
            {sourceMode
              ? "Arquivo original · revisão do trecho removido"
              : "Prévia da edição · cortes aplicados"}
            <label>
              Velocidade{" "}
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="cc-simple-video-area"
            style={{ display: sourceMode ? "none" : "flex" }}
          >
            <PreviewPanel
              {...preview}
              state={state}
              simplifiedControls
              onSelectItem={undefined}
              onSetItemTransform={undefined}
              onSetItemKeyframe={undefined}
              onItemPropChange={undefined}
              onUpdateCaptions={undefined}
              onSelectCaption={undefined}
              playbackRate={speed}
            />
          </div>
          <video
            ref={original}
            src={previewSource.previewSrc}
            poster={previewSource.posterSrc}
            controls
            preload="metadata"
            className="cc-simple-original"
            style={{ display: sourceMode ? "block" : "none" }}
            onError={() => {
              previewSource.requestFallback();
              setNotice(
                "O arquivo original não está disponível para esta reprodução.",
              );
            }}
            onTimeUpdate={() => {
              const video = original.current;
              if (!video || !sourceMode) return;
              const frame = video.currentTime * fps;
              setSourceFrame(frame);
              if (stopAt.current !== null && frame >= stopAt.current) {
                video.pause();
                stopAt.current = null;
              }
            }}
          />
          {sourceMode && (
            <button
              onClick={() => editedSeek(model?.clips[0]?.startFrame ?? 0)}
            >
              Voltar à prévia editada
            </button>
          )}
          <p className="cc-simple-hint">
            Clique em uma frase para navegar. Trechos vermelhos continuam
            disponíveis no original e podem ser restaurados.
          </p>
          {model && model.clips.length === 0 && (
            <button onClick={() => commands?.addMediaItem(model.asset)}>
              Adicionar este vídeo à edição
            </button>
          )}
          {model?.blocker && (
            <p role="alert" className="cc-simple-warning">
              {model.blocker}{" "}
              <button onClick={onAdvanced}>Abrir editor avançado</button>
            </p>
          )}
        </section>
        <section
          className="cc-simple-transcript"
          aria-label="Transcrição interativa"
        >
          <div className="cc-simple-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "transcript"}
              onClick={() => setTab("transcript")}
            >
              Transcrição
            </button>
            <button
              role="tab"
              aria-selected={tab === "suggestions"}
              onClick={() => setTab("suggestions")}
            >
              Cortes sugeridos pela IA
            </button>
          </div>
          <div className="cc-simple-scroll" ref={body} role="tabpanel">
            <ReviewTranscript editor={editor} />
          </div>
          <div className="cc-simple-tools">
            <button
              disabled={!selected || !!model?.blocker}
              onClick={() => changeCut(false)}
            >
              Marcar corte
            </button>
            <button
              disabled={!selected || !!model?.blocker}
              onClick={() => changeCut(true)}
            >
              Restaurar
            </button>
            <button
              disabled={!selected || !model?.clips.length}
              onClick={hearJoin}
            >
              Ouvir com o corte
            </button>
            <button
              disabled={index <= 0}
              onClick={() => model && select(model.rows[index - 1]!)}
            >
              Anterior
            </button>
            <button
              disabled={!model || index >= model.rows.length - 1}
              onClick={() => model && select(model.rows[index + 1]!)}
            >
              Próximo
            </button>
          </div>
        </section>
      </div>
      <section
        className="cc-simple-filmstrip"
        aria-label="Timeline simplificada"
      >
        <div className="cc-simple-panel-title">
          Timeline de revisão{" "}
          <small>Tempo do arquivo original · clique para navegar</small>
          <span className="cc-simple-legend">
            <b className="kept" /> Mantido <b className="cut" /> Corte{" "}
            <b className="pause" /> Pausa
          </span>
        </div>
        <div className="cc-simple-thumbs">
          {asset &&
            Array.from({ length: 8 }, (_, i) => (
              <img
                key={i}
                src={`/api/media-frame?src=${encodeURIComponent(asset.src)}&time=${((((i + 0.5) / 8) * (model?.duration ?? 1)) / fps).toFixed(3)}`}
                onError={(event) => {
                  if (
                    !event.currentTarget.dataset.fallback &&
                    previewSource.posterSrc
                  ) {
                    event.currentTarget.dataset.fallback = "1";
                    event.currentTarget.src = previewSource.posterSrc;
                  }
                }}
                alt=""
              />
            ))}
        </div>
        <div
          className="cc-simple-ruler"
          onClick={(event) => {
            if (!model) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            sourceSeek(
              Math.min(
                model.duration - 1,
                Math.max(
                  0,
                  ((event.clientX - bounds.left) / bounds.width) *
                    model.duration,
                ),
              ),
            );
          }}
          role="slider"
          tabIndex={0}
          aria-label="Posição no arquivo original"
          aria-valuemin={0}
          aria-valuemax={model?.duration ?? 1}
          aria-valuenow={Math.round(sourceFrame)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight")
              sourceSeek(
                Math.min((model?.duration ?? 1) - 1, sourceFrame + fps),
              );
            if (event.key === "ArrowLeft")
              sourceSeek(Math.max(0, sourceFrame - fps));
          }}
        >
          {model?.rows.map((row) => (
            <span
              key={row.id}
              className={row.keptFrames === 0 ? "cut" : "kept"}
              style={{
                left: `${(row.start / model.duration) * 100}%`,
                width: `${((row.end - row.start) / model.duration) * 100}%`,
              }}
            />
          ))}
          {pauses.map((pause, i) => (
            <span
              key={`p${i}`}
              className="pause"
              style={{
                left: `${(pause.start / (model?.duration ?? 1)) * 100}%`,
                width: `${((pause.end - pause.start) / (model?.duration ?? 1)) * 100}%`,
              }}
            />
          ))}
          <i
            style={{
              left: `${Math.min(100, (sourceFrame / (model?.duration ?? 1)) * 100)}%`,
            }}
          />
        </div>
        <div className="cc-simple-time-labels">
          <span>0:00</span>
          <span>{clock((model?.duration ?? 0) / fps)}</span>
        </div>
      </section>
      <ReviewSummary
        model={model}
        fps={fps}
        keptFrames={keptFrames}
        removedFrames={removedFrames}
        cutCount={cutCount}
        finalText={finalText}
        canExport={state.items.length > 0}
        downloadSrt={downloadSrt}
        onAdvanced={onAdvanced}
      />
      <div className="cc-simple-notice" role="status">
        {notice ||
          "As alterações são salvas no mesmo projeto do editor avançado."}
      </div>
    </main>
  );
}
