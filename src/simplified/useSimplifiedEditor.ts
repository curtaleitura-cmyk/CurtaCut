import { useEffect, useMemo, useRef, useState } from "react";
import type { CallbackListener } from "@remotion/player";
import type { EditorWorkspaceViewProps } from "../editor/EditorWorkspaceView";
import type { AtomicAction } from "../editor/reduce";
import { usePreviewMediaSource } from "../media/previewMedia";
import {
  buildReviewModel,
  planReviewCut,
  reviewFinalText,
  reviewSrt,
  sourceToTimeline,
  timelineToSource,
  type ReviewRow,
  type SourceSpan,
} from "./reviewModel";
const makeId = () => `item_${crypto.randomUUID()}`;
export interface SimplifiedEditorProps {
  workspace: EditorWorkspaceViewProps;
  onAdvanced: () => void;
}
export function useSimplifiedEditor({
  workspace,
  onAdvanced,
}: SimplifiedEditorProps) {
  const {
    simpleCommands: commands,
    previewPanel: preview,
    libraryPanel: library,
    topBar,
  } = workspace;
  const state = preview.reviewState;
  const assets = library.assets.filter((asset) => asset.kind === "video");
  const [assetId, setAssetIdState] = useState(() => {
    try { return sessionStorage.getItem(`cc.reviewAsset:${location.hash}`) ?? ""; } catch { return ""; }
  });
  const setAssetId = (id: string) => {
    setAssetIdState(id);
    try { sessionStorage.setItem(`cc.reviewAsset:${location.hash}`, id); } catch { /* optional preference */ }
  };
  const asset =
    assets.find((a) => a.id === assetId) ??
    assets.find((a) => state.items.some((c) => c.sourceAssetId === a.id)) ??
    assets[0];
  useEffect(() => {
    if (asset) { try { sessionStorage.setItem(`cc.reviewAsset:${location.hash}`, asset.id); } catch { /* preference */ } }
  }, [asset]);
  const model = useMemo(
    () =>
      asset
        ? buildReviewModel({ ...state, assets: library.assets }, asset)
        : null,
    [asset, state, library.assets],
  );
  const [selectedId, setSelectedId] = useState("");
  const selected =
    model?.rows.find((row) => row.id === selectedId) ?? model?.rows[0];
  const [tab, setTab] = useState<"transcript" | "suggestions">("transcript");
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceFrame, setSourceFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingRow, setEditingRow] = useState("");
  const lastFrameUpdate = useRef(0);
  const original = useRef<HTMLVideoElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const stopAt = useRef<number | null>(null);
  const previewSource = usePreviewMediaSource(asset?.src);
  const fps = state.fps;
  const playerRef = preview.playerRef;
  const track =
    model?.clips[0]?.track ??
    state.trackOrder?.find((id) => state.tracks?.[id]?.kind === "video") ??
    "V1";
  useEffect(() => {
    original.current?.pause();
    playerRef.current?.pause();
    stopAt.current = null;
    setSourceMode(false);
    setSelectedId("");
    setSourceFrame(0);
  }, [asset?.id, playerRef]);
  useEffect(() => {
    if (original.current) original.current.playbackRate = speed;
  }, [speed]);
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !model) return;
    const update: CallbackListener<"frameupdate"> = (event) => {
      if (sourceMode) return;
      const frame = event.detail.frame;
      const source = timelineToSource(model, frame);
      if (source !== null && performance.now() - lastFrameUpdate.current > 80) {
        setSourceFrame(source);
        lastFrameUpdate.current = performance.now();
      }
      if (stopAt.current !== null && frame >= stopAt.current) {
        player.pause();
        stopAt.current = null;
      }
    };
    const play: CallbackListener<"play"> = () => {
      original.current?.pause();
      setSourceMode(false);
    };
    player.addEventListener("frameupdate", update);
    player.addEventListener("play", play);
    return () => {
      player.removeEventListener("frameupdate", update);
      player.removeEventListener("play", play);
    };
  }, [model, playerRef, sourceMode]);
  const active = model?.rows.find(
    (row) => sourceFrame >= row.start && sourceFrame < row.end,
  );
  useEffect(() => {
    if (!active?.id) return;
    body.current
      ?.querySelector(`[data-row-id="${CSS.escape(active.id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);
  function editedSeek(frame: number, play = false, end?: number) {
    original.current?.pause();
    setSourceMode(false);
    stopAt.current = end ?? null;
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    player.seekTo(Math.max(0, frame));
    if (play) void player.play();
  }
  function sourceSeek(frame: number, play = false, end?: number) {
    const timeline = model ? sourceToTimeline(model, frame) : null;
    if (timeline !== null) {
      editedSeek(
        timeline,
        play,
        end === undefined ? undefined : timeline + Math.max(1, end - frame),
      );
      return;
    }
    playerRef.current?.pause();
    setSourceMode(true);
    setSourceFrame(frame);
    stopAt.current = end ?? null;
    const video = original.current;
    if (video) {
      video.pause();
      video.currentTime = frame / fps;
      if (play)
        void video
          .play()
          .catch(() =>
            setNotice(
              "Não foi possível reproduzir o original. Verifique o arquivo ou use o editor avançado.",
            ),
          );
    }
  }
  function select(row: ReviewRow, play = false) {
    setSelectedId(row.id);
    sourceSeek(
      Math.round((row.speechStart * fps) / 1000),
      play,
      play ? Math.ceil((row.speechEnd * fps) / 1000) : undefined,
    );
  }
  function changeCut(restore: boolean, row: SourceSpan | undefined = selected) {
    if (!commands || !model || !row) return;
    try {
      playerRef.current?.pause();
      original.current?.pause();
      stopAt.current = null;
      if (restore) {
        commands.undo();
        setNotice("Última alteração desfeita em todas as faixas.");
        return;
      }
      const actions = planReviewCut(model, row, makeId);
      commands.batch(actions, "Cortar trecho");
      setNotice(
        actions.length
          ? "Corte aplicado ao vídeo, áudio e legendas, sem espaços. Use Desfazer para recuperar."
          : "Nenhuma alteração necessária.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }
  function removeAllPauses() {
    if (!commands || !model) return;
    try {
      playerRef.current?.pause();
      original.current?.pause();
      stopAt.current = null;
      commands.batch(planReviewCut(model, pauses, makeId), "Excluir todas as pausas");
      setNotice("Pausas removidas de vídeo, áudio e legendas, sem espaços. Use Desfazer para recuperar.");
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  }
  function hearJoin() {
    if (!model || !selected) return;
    const next = model.clips.find((c) => (c.srcInFrame ?? 0) >= selected.end);
    const before = [...model.clips]
      .reverse()
      .find((c) => (c.srcInFrame ?? 0) + c.durationInFrames <= selected.start);
    const join =
      next?.startFrame ??
      (before
        ? before.startFrame + before.durationInFrames
        : (sourceToTimeline(model, selected.start) ?? 0));
    editedSeek(
      Math.max(0, join - Math.round(fps * 1.5)),
      true,
      join + Math.round(fps * 2),
    );
  }
  function fixWord(index: number, text: string) {
    if (
      !model ||
      !commands ||
      !text.trim() ||
      model.words[index]?.text === text.trim()
    )
      return;
    const actions: AtomicAction[] = [
      {
        type: "pool.fixTranscriptWord",
        id: model.asset.id,
        wordIndex: index,
        text: text.trim(),
      },
    ];
    for (const clip of model.clips) {
      const wordIndex =
        clip.transcript?.findIndex(
          (word) =>
            word.start === model.words[index]?.start &&
            word.end === model.words[index]?.end,
        ) ?? -1;
      if (wordIndex >= 0)
        actions.push({
          type: "fixTranscriptWord",
          id: clip.id,
          wordIndex,
          text: text.trim(),
        });
    }
    commands.batch(actions, "Corrigir palavra");
  }
  async function importVideo(file: File) {
    setBusy(true);
    setNotice("Importando e preparando o vídeo…");
    try {
      await preview.onImport(file);
      setNotice("Vídeo importado. Clique em Transcrever para começar.");
    } catch (error) {
      setNotice(String(error));
    } finally {
      setBusy(false);
    }
  }
  function downloadSrt() {
    if (!model) return;
    const content = reviewSrt(model, fps);
    if (!content) {
      setNotice("Não há falas preservadas para gerar o SRT.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([content + "\n"], {
        type: "application/x-subrip;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${model.asset.name.replace(/\.[^.]+$/, "")}-editado.srt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const keptFrames =
    model?.kept.reduce((total, span) => total + span.end - span.start, 0) ?? 0;
  const removedFrames = Math.max(0, (model?.duration ?? 0) - keptFrames);
  const pauses = useMemo(() =>
    model?.words.flatMap((word, i) =>
      i > 0 && word.start - model.words[i - 1]!.end >= 1000
        ? [
            {
              start: Math.round((model.words[i - 1]!.end * fps) / 1000),
              end: Math.round((word.start * fps) / 1000),
            },
          ]
        : [],
    ) ?? [], [model, fps]);
  const finalText = useMemo(
    () => (model ? reviewFinalText(model, fps) : ""),
    [model, fps],
  );
  const cutCount =
    model?.rows.filter((row) => row.keptFrames === 0).length ?? 0;
  const index = model?.rows.findIndex((row) => row.id === selected?.id) ?? -1;
  return {
    commands,
    preview,
    library,
    topBar,
    state,
    assets,
    asset,
    model,
    selected,
    active,
    tab,
    setTab,
    sourceMode,
    setSourceMode,
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
    track,
    index,
    keptFrames,
    removedFrames,
    pauses,
    cutCount,
    finalText,
    editingRow,
    setEditingRow,
    select,
    sourceSeek,
    editedSeek,
    changeCut,
    removeAllPauses,
    hearJoin,
    fixWord,
    importVideo,
    downloadSrt,
    setAssetId,
    setSelectedId,
    onAdvanced,
  };
}
