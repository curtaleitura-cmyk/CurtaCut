import type { ReviewModel, SourceSpan } from "./reviewModel";
import { transcriptReviewHints } from "./reviewHints";

export interface ReviewSegment extends SourceSpan {
  kind: "kept" | "cut" | "check" | "error" | "pause";
  removed: boolean;
}
export const segmentLabels = {
  kept: "Mantido",
  cut: "Removido",
  check: "Verificar",
  error: "Provável erro",
  pause: "Pausa",
};

/** Hints determine colour; hatching separately marks actual missing source windows. */
export function reviewTimelineSegments(
  model: ReviewModel,
  pauses: readonly SourceSpan[],
): ReviewSegment[] {
  const hints = transcriptReviewHints(model.rows);
  const bounds = [
    ...new Set([
      0,
      model.duration,
      ...model.rows.flatMap((row) => [row.start, row.end]),
      ...model.kept.flatMap((span) => [span.start, span.end]),
      ...pauses.flatMap((span) => [span.start, span.end]),
    ]),
  ]
    .filter((frame) => frame >= 0 && frame <= model.duration)
    .sort((a, b) => a - b);
  const segments: ReviewSegment[] = [];
  let rowIndex = 0,
    keptIndex = 0,
    pauseIndex = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i]!,
      end = bounds[i + 1]!;
    if (end <= start) continue;
    while (model.rows[rowIndex] && model.rows[rowIndex]!.end <= start)
      rowIndex++;
    while (model.kept[keptIndex] && model.kept[keptIndex]!.end <= start)
      keptIndex++;
    while (pauses[pauseIndex] && pauses[pauseIndex]!.end <= start) pauseIndex++;
    const row = model.rows[rowIndex],
      kept = model.kept[keptIndex],
      pause = pauses[pauseIndex];
    const removed = !kept || kept.start > start;
    const hint = row && row.start <= start ? hints.get(row.id) : undefined;
    const kind =
      pause && pause.start <= start
        ? "pause"
        : (hint?.kind ?? (removed ? "cut" : "kept"));
    const previous = segments.at(-1);
    if (
      previous &&
      previous.kind === kind &&
      previous.removed === removed &&
      previous.end === start
    )
      previous.end = end;
    else segments.push({ start, end, kind, removed });
  }
  return segments;
}
