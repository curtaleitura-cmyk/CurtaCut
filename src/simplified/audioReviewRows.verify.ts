import assert from 'node:assert/strict';
import { DEFAULT_PAUSE_SETTINGS, SilenceLogParser, type PauseAnalysis } from '../../shared/pause-analysis';
import { audioReviewRows } from './audioReviewRows';
import { buildReviewModel, planReviewCut, reviewSrt } from './reviewModel';
import { docFromTimeline } from '../persist/projectStore';
import { historyReduce } from '../editor/reduce';
import { buildCommands } from '../editor/storeCommandBuilder';
import { activeEditorState, type MediaAsset, type ProjectDoc } from '../editor/types';
import { sourceRevisionOf } from '../editor/mediaSourceRevision';

const parser = new SilenceLogParser();
parser.feed('[silencedetect] silence_start: 1.5');
parser.feed('[silencedetect] silence_end: 3 | silence_duration: 1.5');
parser.feed('[silencedetect] silence_start: 5');
assert.deepEqual(parser.finish(6000), [{ startMs: 1500, endMs: 3000 }, { startMs: 5000, endMs: 6000 }]);
const words = [{ text: 'Vamos', start: 3100, end: 3400 }, { text: 'conhecer', start: 3500, end: 3800 }, { text: 'leituras.', start: 4000, end: 4700 }];
const asset: MediaAsset = { id: 'source', kind: 'video', name: 'retake.mp4', src: '/media/uploads/retake.mp4', durationInFrames: 180, transcript: words };
const analysis: PauseAnalysis = { version: 1, sourceRevision: sourceRevisionOf(asset), durationMs: 6000, quiet: parser.quiet, thresholdDb: -35, minSilenceMs: 500, analyzedAt: 1 };
asset.pauseAnalysis = analysis;
const rows = audioReviewRows(asset.id, 180, 30, words, [{ start: 0, end: 180 }], analysis, DEFAULT_PAUSE_SETTINGS);
assert.equal(rows[0]!.kind, 'untranscribed', 'first attempt survives although Whisper omitted all its words');
assert.equal(rows[0]!.text, 'Possível fala não transcrita');
assert.equal(rows[1]!.kind, 'pause');
assert.ok(rows[1]!.start >= 49 && rows[1]!.end <= 86, 'speech margins preserved');
assert.equal(rows[2]!.text, 'Vamos conhecer leituras.');
assert.ok(rows.some(r => r.kind === 'pause' && r.start >= 150), 'trailing silence is visible');
assert.deepEqual(rows.flatMap(r => r.wordIndices), [0, 1, 2]);
for (let i = 1; i < rows.length; i++) assert.equal(rows[i]!.start, rows[i - 1]!.end, 'partition covers source without overlaps or holes');
const noQuiet = audioReviewRows(asset.id, 180, 30, words, [{ start: 0, end: 180 }], { ...analysis, quiet: [] }, DEFAULT_PAUSE_SETTINGS);
assert.equal(noQuiet.filter(r => r.kind === 'pause').length, 0, 'no silence is a successful result');
const conflicting = audioReviewRows(asset.id, 180, 30, words, [], { ...analysis, quiet: [{ startMs: 3200, endMs: 4500 }] }, DEFAULT_PAUSE_SETTINGS);
assert.equal(conflicting.filter(r => r.kind === 'pause').length, 0, 'quiet speech with transcript evidence is protected');
const tinyPause = audioReviewRows(asset.id, 180, 30, words, [], { ...analysis, quiet: [{ startMs: 1500, endMs: 1700 }] }, DEFAULT_PAUSE_SETTINGS);
assert.equal(tinyPause.filter(r => r.kind === 'pause').length, 0, 'natural short pauses do not fragment speech');
const split = audioReviewRows(asset.id, 180, 30, words, [], analysis, DEFAULT_PAUSE_SETTINGS, [3450]);
assert.deepEqual(split.flatMap(r => r.wordIndices), [0, 1, 2], 'manual boundary retains each word once');
assert.ok(split.length > rows.length);
const initial = docFromTimeline({ fps: 30, width: 180, height: 320, assets: [asset], selectedId: null,
  items: [{ id: 'video', kind: 'video', name: asset.name, src: asset.src, sourceAssetId: asset.id, track: 'V1', startFrame: 0, durationInFrames: 180, transcript: words, volume: 1 },
    { id: 'audio', kind: 'audio', name: 'audio', src: asset.src, track: 'A1', startFrame: 0, durationInFrames: 180, volume: 1 }],
  tracks: { V1: { kind: 'video' }, A1: { kind: 'audio' } }, trackOrder: ['V1', 'A1'] });
let history = { past: [] as ProjectDoc[], present: initial, future: [] as ProjectDoc[] };
const commands = buildCommands(a => { history = historyReduce(history, a); }, () => history.present);
let count = 0;
const model = () => buildReviewModel(activeEditorState(history.present), history.present.assets[0]!, { analysis, settings: DEFAULT_PAUSE_SETTINGS });
commands.batch(planReviewCut(model(), rows[0]!, () => `cut-${count++}`), 'Remove omitted first attempt');
assert.ok(activeEditorState(history.present).items.every(c => c.startFrame === 0 && (c.srcInFrame ?? 0) === rows[0]!.end));
assert.match(reviewSrt(model(), 30), /Vamos conhecer leituras/);
assert.equal(model().rows[0]!.keptFrames, 0);
const cut = JSON.stringify(history.present);
commands.undo(); assert.equal(JSON.stringify(history.present), JSON.stringify(initial));
commands.redo(); assert.equal(JSON.stringify(history.present), cut);
commands.batch(planReviewCut(model(), model().rows.filter(r => r.kind === 'pause'), () => `cut-${count++}`), 'Remove pauses');
const edited = activeEditorState(history.present);
for (const track of [...new Set(edited.items.map(c => c.track))]) {
  const clips = edited.items.filter(c => c.track === track).sort((a, b) => a.startFrame - b.startFrame);
  assert.ok(clips.length > 0, JSON.stringify({ track, items: edited.items.map(c => [c.kind, c.track, c.startFrame, c.durationInFrames]) }));
  for (let i = 1; i < clips.length; i++) assert.equal(clips[i]!.startFrame, clips[i - 1]!.startFrame + clips[i - 1]!.durationInFrames, 'ripple gaps closed');
}
assert.deepEqual(edited.items.filter(c => c.kind === 'video').map(c => [c.startFrame, c.durationInFrames]), edited.items.filter(c => c.kind === 'audio').map(c => [c.startFrame, c.durationInFrames]));
assert.deepEqual(JSON.parse(JSON.stringify(history.present)).assets[0].pauseAnalysis, analysis, 'analysis persists in project document');
console.log('Audio review: omitted speech, margins, quiet speech protection, natural pauses, word ownership, real A/V cuts, SRT, history and persistence passed');
