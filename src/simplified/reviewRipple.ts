import type { TimelineState } from '../editor/types';
import type { CaptionsData } from '../captions/types';
import { reduce } from '../editor/reduce';
import type { SourceSpan } from './reviewModel';

/** Delete absolute timeline intervals on every lane, from right to left. */
export function rippleReviewRanges(input: TimelineState, ranges: SourceSpan[], makeId: () => string): TimelineState {
  let state = input;
  for (const { start, end } of [...ranges].sort((a, b) => b.start - a.start)) {
    if (end <= start) continue;
    if (state.items.some(item => item.startFrame + item.durationInFrames > start && state.tracks?.[item.track]?.locked)
      || Object.values(state.tracks ?? {}).some(track => track?.locked && track.captions)) {
      throw new Error('Desbloqueie as faixas antes de cortar para manter tudo sincronizado.');
    }
    for (const boundary of [end, start]) {
      for (const item of [...state.items]) {
        if (item.startFrame < boundary && item.startFrame + item.durationInFrames > boundary) {
          state = reduce(state, { type: 'split', id: item.id, atFrame: boundary, newId: makeId() });
        }
      }
    }
    for (const item of [...state.items]) {
      if (item.startFrame >= start && item.startFrame + item.durationInFrames <= end)
        state = reduce(state, { type: 'remove', id: item.id, ripple: false });
    }
    const fromMs = start * 1000 / state.fps, toMs = end * 1000 / state.fps;
    function retime<T extends { start: number; end: number }>(words: T[]): T[] {
      const project = (time: number) => time <= fromMs ? time : time >= toMs ? time - (toMs - fromMs) : fromMs;
      return words.flatMap(word => {
        const next = { ...word, start: project(word.start), end: project(word.end) };
        return next.end > next.start ? [next] : [];
      });
    }
    function captions(data: CaptionsData | null | undefined) {
      if (!data) return data;
      const standalone = !data.sourceItemId && !data.sources?.length && data.sourceMode !== 'timeline';
      const offset = (data.offsetFrames ?? 0) * 1000 / state.fps;
      return { ...data,
        ...(standalone && data.words ? { words: retime(data.words.map(w => ({ ...w, start: w.start + offset, end: w.end + offset }))), offsetFrames: 0 } : {}),
        translation: data.translation ? retime(data.translation) : undefined,
        sourceEntries: data.sourceEntries?.map(entry => entry.words ? { ...entry, words: retime(entry.words) } : entry),
      };
    }
    state = { ...state,
      items: state.items.map(item => item.startFrame >= end ? { ...item, startFrame: item.startFrame - (end - start) } : item),
      captions: captions(state.captions),
      tracks: state.tracks ? Object.fromEntries(Object.entries(state.tracks).map(([id, track]) => [id, { ...track, captions: captions(track?.captions) }])) : state.tracks,
    };
  }
  return state;
}
