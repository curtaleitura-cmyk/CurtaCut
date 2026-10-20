import type { MediaAsset, TimelineItem, TimelineState } from "../editor/types";
import type { AtomicAction } from "../editor/reduce";
import { timelineItemAssetId } from "../editor/mediaAssetUsage";
import { sourceWindowForTimelineRange } from "../editor/sourceLimit";
import { rippleReviewRanges } from "./reviewRipple";
import {
  packTranscriptPhrases,
  joinTranscriptWords,
} from "../transcript/phrases";
import type { TranscriptWord } from "../transcript/types";
import { srtTimestamp } from "../captions/exportCaptions";
export interface SourceSpan {
  start: number;
  end: number;
}
export interface ReviewRow extends SourceSpan {
  id: string;
  wordIndices: number[];
  text: string;
  speechStart: number;
  speechEnd: number;
  keptFrames: number;
}
export interface ReviewModel {
  state: TimelineState;
  asset: MediaAsset;
  clips: TimelineItem[];
  words: TranscriptWord[];
  rows: ReviewRow[];
  duration: number;
  kept: SourceSpan[];
  blocker: string | null;
}
export function mergeSpans(spans: SourceSpan[]): SourceSpan[] {
  const out: SourceSpan[] = [];
  for (const span of spans
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start)) {
    const prev = out.at(-1);
    if (prev && span.start <= prev.end) prev.end = Math.max(prev.end, span.end);
    else out.push({ ...span });
  }
  return out;
}
export function missingSpans(
  range: SourceSpan,
  kept: SourceSpan[],
): SourceSpan[] {
  const missing: SourceSpan[] = [];
  let cursor = range.start;
  for (const span of mergeSpans(kept)) {
    if (span.end <= cursor || span.start >= range.end) continue;
    if (span.start > cursor)
      missing.push({ start: cursor, end: Math.min(span.start, range.end) });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < range.end) missing.push({ start: cursor, end: range.end });
  return missing;
}
export function buildReviewModel(
  state: TimelineState,
  asset: MediaAsset,
): ReviewModel {
  const clips = state.items
    .filter(
      (item) =>
        item.kind === "video" &&
        timelineItemAssetId(item, state.assets ?? [asset]) === asset.id,
    )
    .sort((a, b) => a.startFrame - b.startFrame);
  const clipWords = new Map(
    clips
      .filter((clip) => !clip.transcriptStale)
      .flatMap((clip) => clip.transcript ?? [])
      .map((word) => [`${word.start}:${word.end}`, word]),
  );
  const master = asset.transcriptStale
    ? []
    : (asset.transcript ??
      [...clipWords.values()].sort((a, b) => a.start - b.start));
  const currentWords = new Map(
    clips
      .flatMap((clip) => clip.transcript ?? [])
      .map((word) => [`${word.start}:${word.end}`, word]),
  );
  const words = master.map((word) => {
    const current = currentWords.get(`${word.start}:${word.end}`);
    return current && current.text !== word.text
      ? { ...word, text: current.text }
      : word;
  });
  const duration = Math.max(
    1,
    asset.durationInFrames ??
      Math.max(
        0,
        ...clips.map(
          (c) =>
            sourceWindowForTimelineRange(c, 0, c.durationInFrames).endFrame,
        ),
      ),
  );
  const windows = clips.map((c) => {
    const w = sourceWindowForTimelineRange(c, 0, c.durationInFrames);
    return { start: w.startFrame, end: w.endFrame };
  });
  const kept = mergeSpans(
    windows.map((w) => ({
      start: Math.max(0, w.start),
      end: Math.min(duration, w.end),
    })),
  );
  let blocker: string | null = null;
  if (
    clips.some(
      (c) =>
        (c.playbackRate ?? 1) !== 1 ||
        c.deletedWordIdx?.length ||
        c.transcriptPlayOrder?.length ||
        Object.keys(c.gapCapsMs ?? {}).length > 0 ||
        c.silenceFrames != null,
    )
  )
    blocker =
      "Este vídeo tem alterações de velocidade ou edição de áudio por palavras. Revise-o no editor avançado.";
  if (
    new Set(clips.map((c) => c.track)).size > 1 ||
    windows.some((w, i) => i > 0 && w.start < windows[i - 1]!.end)
  )
    blocker =
      "Este vídeo foi repetido, reordenado ou usado em várias faixas. Use o editor avançado para preservar essa montagem.";
  const ids = new Set(clips.map((c) => c.id));
  if (
    clips.some((c) => state.tracks?.[c.track]?.locked) ||
    state.transitions?.some(
      (t) => ids.has(t.outgoingItemId) || ids.has(t.incomingItemId),
    ) ||
    state.linkGroups?.length ||
    state.multicamGroups?.length
  )
    blocker =
      "Há faixas bloqueadas, transições ou vínculos de edição. Faça os cortes no editor avançado.";
  const phrases = packTranscriptPhrases(words, {
    sourceItemId: asset.id,
    maxWordsPerPhrase: 18,
    silenceThresholdMs: 450,
  });
  const rows = phrases
    .map((phrase, i): ReviewRow => {
      const start =
        i === 0
          ? 0
          : Math.max(0, Math.round((phrase.start * state.fps) / 1000));
      const end =
        i === phrases.length - 1
          ? duration
          : Math.min(
              duration,
              Math.round((phrases[i + 1]!.start * state.fps) / 1000),
            );
      const wordIndices = phrase.wordRanges.flatMap(([from, to]) =>
        Array.from({ length: to - from }, (_, j) => from + j),
      );
      return {
        id: `${asset.id}:${wordIndices[0]}`,
        start,
        end,
        speechStart: phrase.start,
        speechEnd: phrase.end,
        wordIndices,
        text: phrase.text,
        keptFrames: kept.reduce(
          (n, w) =>
            n + Math.max(0, Math.min(end, w.end) - Math.max(start, w.start)),
          0,
        ),
      };
    })
    .filter((row) => row.end > row.start);
  return { state, asset, clips, words, rows, duration, kept, blocker };
}
export function sourceToTimeline(
  model: ReviewModel,
  frame: number,
): number | null {
  for (const clip of model.clips) {
    const w = sourceWindowForTimelineRange(clip, 0, clip.durationInFrames);
    if (frame >= w.startFrame && frame < w.endFrame)
      return (
        clip.startFrame +
        Math.round((frame - w.startFrame) / (clip.playbackRate ?? 1))
      );
  }
  return null;
}
export function timelineToSource(
  model: ReviewModel,
  frame: number,
): number | null {
  const clip = model.clips.find(
    (c) => frame >= c.startFrame && frame < c.startFrame + c.durationInFrames,
  );
  return clip
    ? (clip.srcInFrame ?? 0) +
        (frame - clip.startFrame) * (clip.playbackRate ?? 1)
    : null;
}
/** Standard split/remove operations; no parallel cut state is saved. */
export function planReviewCut(
  model: ReviewModel,
  row: SourceSpan | SourceSpan[],
  makeId: () => string,
): AtomicAction[] {
  if (model.blocker) throw new Error(model.blocker);
  const preserveMaster: AtomicAction[] =
    !model.asset.transcript?.length && model.words.length
      ? [
          {
            type: "pool.setTranscription",
            id: model.asset.id,
            patch: { transcript: model.words, transcribeStatus: "done" },
          },
        ]
      : [];
  const ranges = mergeSpans((Array.isArray(row) ? row : [row]).flatMap(span => model.clips.flatMap(clip => {
    const from = Math.max(span.start, clip.srcInFrame ?? 0);
    const to = Math.min(span.end, (clip.srcInFrame ?? 0) + clip.durationInFrames);
    return to > from ? [{ start: clip.startFrame + from - (clip.srcInFrame ?? 0), end: clip.startFrame + to - (clip.srcInFrame ?? 0) }] : [];
  })));
  if (!ranges.length) return [];
  return [...preserveMaster, { type: 'setFullState', state: rippleReviewRanges(model.state, ranges, makeId) }];
}
/** Restore only source windows absent from the real lane, using ordinary ripple insertion. */
export function planReviewRestore(
  model: ReviewModel,
  row: SourceSpan,
  track: string,
  makeId: () => string,
): AtomicAction[] {
  if (model.blocker) throw new Error(model.blocker);
  return missingSpans(row, model.kept)
    .reverse()
    .flatMap((span) => {
      const after = model.clips.find((c) => (c.srcInFrame ?? 0) >= span.end);
      const before = [...model.clips]
        .reverse()
        .find((c) => (c.srcInFrame ?? 0) + c.durationInFrames <= span.start);
      const template = after ?? before ?? model.clips[0];
      const fitsGap =
        !!before &&
        !!after &&
        after.startFrame - before.startFrame - before.durationInFrames >=
          span.end - span.start;
      const startFrame = fitsGap
        ? before!.startFrame + before!.durationInFrames
        : (after?.startFrame ??
          (before ? before.startFrame + before.durationInFrames : 0));
      const item: TimelineItem = template
        ? {
            ...template,
            id: makeId(),
            transcript: model.words,
            transcriptGenerationId:
              model.asset.transcriptGenerationId ??
              template.transcriptGenerationId,
            variants: undefined,
            srcInFrame: span.start,
            durationInFrames: span.end - span.start,
            startFrame,
          }
        : {
            id: makeId(),
            kind: "video",
            track,
            name: model.asset.name,
            src: model.asset.src,
            sourceAssetId: model.asset.id,
            sourceRevision: model.asset.sourceRevision,
            width: model.asset.width,
            height: model.asset.height,
            volume: 1,
            srcInFrame: span.start,
            durationInFrames: span.end - span.start,
            startFrame,
            transcript: model.words,
            transcriptGenerationId: model.asset.transcriptGenerationId,
          };
      return [
        { type: "add", item, startFrame, ripple: !fitsGap } as AtomicAction,
      ];
    });
}
export function reviewFinalText(model: ReviewModel, fps: number): string {
  return joinTranscriptWords(
    model.words.filter(
      (w) =>
        sourceToTimeline(
          model,
          Math.floor(((w.start + w.end) * fps) / 2000),
        ) !== null,
    ),
  );
}
/** Export through the caption formatter with real projected, edited timestamps. */
export function reviewSrt(model: ReviewModel, fps: number): string {
  return model.rows
    .flatMap((row) => {
      const words = row.wordIndices
        .map((i) => model.words[i]!)
        .filter(
          (w) =>
            sourceToTimeline(
              model,
              Math.floor(((w.start + w.end) * fps) / 2000),
            ) !== null,
        );
      if (!words.length) return [];
      const start =
        sourceToTimeline(model, Math.ceil((words[0]!.start * fps) / 1000)) ??
        sourceToTimeline(
          model,
          Math.floor(((words[0]!.start + words[0]!.end) * fps) / 2000),
        );
      const last = words.at(-1)!;
      const end = sourceToTimeline(
        model,
        Math.max(0, Math.ceil((last.end * fps) / 1000) - 1),
      );
      if (start === null || end === null) return [];
      return [
        {
          start: (start * 1000) / fps,
          end: ((end + 1) * 1000) / fps,
          text: joinTranscriptWords(words),
        },
      ];
    })
    .map(
      (cue, i) =>
        `${i + 1}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${cue.text}`,
    )
    .join("\n\n");
}

export const reviewTime = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
