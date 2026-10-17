import assert from 'node:assert/strict';
import { newManualCaptions } from '../captions/manualCaptions';
import { CURRENT_PROJECT_VERSION } from '../../shared/project-version';
import { historyReduce } from './reduce';
import { buildCommands } from './storeCommandBuilder';
import type { MediaAsset, ProjectDoc } from './types';

function setup(autoSizeFromFirstVideo?: boolean) {
  const initial: ProjectDoc = {
    version: CURRENT_PROJECT_VERSION, activeTimelineId: 'timeline', assets: [], mediaFolders: [],
    timelines: [{ id: 'timeline', name: 'test', order: 0, fps: 30, width: 1920, height: 1080,
      autoSizeFromFirstVideo, items: [], selectedId: null, tracks: { V1: { kind: 'video' } }, trackOrder: ['V1'] }],
  };
  let history = { past: [] as ProjectDoc[], present: initial, future: [] as ProjectDoc[] };
  const commands = buildCommands(action => { history = historyReduce(history, action); }, () => history.present);
  return { commands, initial, state: () => history.present.timelines[0]!, history: () => history };
}
const video = (width: number, height: number): MediaAsset => ({
  id: crypto.randomUUID(), name: 'story.mp4', kind: 'video', src: '/media/uploads/story.mp4',
  width, height, durationInFrames: 90,
});
for (const [width, height] of [[1080, 1920], [720, 1280], [1080, 1080], [1920, 1080]]) {
  const test = setup(true);
  test.commands.addMediaItem(video(width!, height!));
  assert.deepEqual([test.state().width, test.state().height], [width, height]);
  assert.equal(test.state().items[0]?.volume, 1, 'source audio remains enabled');
  assert.equal(test.history().past.length, 1, 'sizing and placement are one undo step');
  assert.deepEqual(historyReduce(test.history(), { type: 'undo' }).present, test.initial);
  test.commands.addMediaItem(video(1920, 1080));
  assert.deepEqual([test.state().width, test.state().height], [width, height], 'later videos do not resize an edited sequence');
}
{
  const test = setup(true);
  test.commands.addMediaItem({ id: 'music', name: 'music.mp3', kind: 'audio', src: '/media/uploads/music.mp3', durationInFrames: 90 });
  test.commands.addMediaItem(video(1080, 1920));
  assert.deepEqual([test.state().width, test.state().height], [1080, 1920], 'music before the first video does not choose its frame');
  assert.equal(test.state().items.length, 2, 'the music is preserved');
}
for (const choice of [undefined, false]) {
  const test = setup(choice);
  test.commands.addMediaItem(video(1080, 1920));
  assert.equal(test.state().width, 1920, 'legacy or manually sized sequences keep their canvas');
}
for (const method of ['retarget', 'toolbar']) {
  const test = setup(true);
  if (method === 'toolbar') test.commands.setAspect(1920, 1080);
  else test.commands.retargetTimeline('timeline', 1920, 1080);
  test.commands.addMediaItem(video(1080, 1920));
  assert.equal(test.state().width, 1920, 'an explicit landscape choice wins even before the first clip');
}
{
  const test = setup(true);
  test.commands.addMediaItem(video(Number.NaN, 1920));
  assert.equal(test.state().width, 1920, 'invalid metadata does not change the canvas');
}
{
  const test = setup(true);
  test.state().tracks!.C1 = { kind: 'caption', captions: newManualCaptions() };
  test.state().trackOrder!.push('C1');
  test.commands.addMediaItem(video(1080, 1920));
  assert.equal(test.state().width, 1920, 'existing caption layout is preserved');
}
{
  const test = setup(true);
  test.commands.duplicateTimeline('timeline', { retarget: { width: 1080, height: 1920 }, activate: true });
  test.commands.addMediaItem(video(1920, 1080));
  const active = test.history().present.timelines.find(timeline => timeline.id === test.history().present.activeTimelineId)!;
  assert.deepEqual([active.width, active.height], [1080, 1920], 'explicit duplicate sizing wins');
}
{
  const test = setup();
  delete test.state().autoSizeFromFirstVideo;
  test.commands.setAspect(1080, 1920);
  assert.equal('autoSizeFromFirstVideo' in test.state(), false, 'legacy JSON is preserved');
}
console.log('firstVideoCanvas.verify: portrait, square, manual sizing, legacy projects, undo and audio volume passed');
