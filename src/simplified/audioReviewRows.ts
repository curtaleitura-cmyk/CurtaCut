import type { PauseAnalysis, PauseSettings } from '../../shared/pause-analysis';
import type { TranscriptWord } from '../transcript/types';
import type { ReviewRow, SourceSpan } from './reviewModel';
import { packTranscriptPhrases, joinTranscriptWords } from '../transcript/phrases';

/** Partition the source independently of ASR. Never invent missing words. */
export function audioReviewRows(assetId: string, duration: number, fps: number,
  words: TranscriptWord[], kept: SourceSpan[], analysis: PauseAnalysis,
  settings: PauseSettings, manualSplits: number[] = []): ReviewRow[] {
  const msDuration = duration * 1000 / fps;
  // Words protect quiet candidates. Contradictory evidence is kept for review, never bulk removal.
  const quiet = analysis.quiet.filter(s => s.endMs - s.startMs >= settings.minSilenceMs - 1)
    .map(s => ({ start: Math.max(0, Math.ceil((s.startMs <= 1 ? 0 : s.startMs + settings.paddingMs) * fps / 1000)),
      end: Math.min(duration, Math.floor((s.endMs >= analysis.durationMs - 1 ? s.endMs : s.endMs - settings.paddingMs) * fps / 1000)) }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const regions: (SourceSpan & { kind: 'speech' | 'pause' | 'untranscribed' })[] = [];
  let cursor = 0;
  for (const span of quiet) {
    // A quiet span conflicting with any Whisper word is not an eligible pause.
    if (words.some(w => w.start < span.end * 1000 / fps && w.end > span.start * 1000 / fps)) continue;
    const start = Math.max(cursor, span.start);
    if (span.end <= start) continue;
    if (start > cursor) regions.push({ start: cursor, end: start, kind: 'speech' });
    regions.push({ start, end: span.end, kind: 'pause' });
    cursor = span.end;
  }
  if (cursor < duration) regions.push({ start: cursor, end: duration, kind: 'speech' });
  const result: ReviewRow[] = [];
  for (const region of regions) {
    const indices = words.flatMap((w, i) => {
      const middle = (w.start + w.end) / 2 * fps / 1000;
      return middle >= region.start && middle < region.end ? [i] : [];
    });
    const phrases = packTranscriptPhrases(indices.map(i => words[i]!), { sourceItemId: assetId,
      maxWordsPerPhrase: 18, silenceThresholdMs: Number.MAX_SAFE_INTEGER });
    const boundaries = [...new Set([region.start, region.end,
      ...phrases.slice(1).map(p => Math.round(p.start * fps / 1000)),
      ...manualSplits.filter(ms => ms > 0 && ms < msDuration).map(ms => Math.round(ms * fps / 1000))])]
      .filter(f => f >= region.start && f <= region.end).sort((a, b) => a - b);
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]!, end = boundaries[i + 1]!;
      if (end <= start) continue;
      const wordIndices = indices.filter(j => { const middle = (words[j]!.start + words[j]!.end) * fps / 2000; return middle >= start && middle < end; });
      const kind = region.kind === 'pause' ? 'pause' : wordIndices.length ? 'speech' : 'untranscribed';
      result.push({ id: `${assetId}:audio:${start}:${end}`, start, end, kind, wordIndices,
        speechStart: start * 1000 / fps, speechEnd: end * 1000 / fps,
        text: kind === 'pause' ? 'Pausa detectada no áudio' : kind === 'untranscribed' ? 'Possível fala não transcrita' : joinTranscriptWords(wordIndices.map(j => words[j]!)),
        keptFrames: kept.reduce((n, s) => n + Math.max(0, Math.min(end, s.end) - Math.max(start, s.start)), 0) });
    }
  }
  return result;
}
