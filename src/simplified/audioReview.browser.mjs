import assert from 'node:assert/strict';
/** Second real-browser fixture: ASR omitted the first audible region entirely. */
export async function verifyOmittedSpeech(page, wait, capture) {
  const id = await page.evaluate(async () => {
    const store = await import('/src/persist/projectStore.ts');
    const words = [{ text: 'Vamos', start: 4600, end: 4950 }, { text: 'conhecer', start: 5050, end: 5500 }, { text: 'essas', start: 5600, end: 5900 }, { text: 'leituras.', start: 6000, end: 6600 }];
    const asset = { id: 'omitted-source', kind: 'video', name: 'Teste sintético · primeira tentativa omitida.mp4', src: '/media/uploads/validacao.mp4', durationInFrames: 540, width: 720, height: 1280, transcript: words };
    const doc = store.docFromTimeline({ fps: 30, width: 720, height: 1280, assets: [asset], selectedId: null,
      items: [{ id: 'omitted-clip', kind: 'video', name: asset.name, src: asset.src, sourceAssetId: asset.id, track: 'V1', startFrame: 0, durationInFrames: 540, volume: 1, transcript: words }],
      tracks: { V1: { kind: 'video' } }, trackOrder: ['V1'] });
    const project = await store.createProject('Teste de fala não transcrita', doc);
    await store.flushProjectSaves();
    return project.id;
  });
  await page.goto({ url: `http://127.0.0.1:5201/#/editor/${id}`, timeout: 60000 });
  await wait(() => !!document.querySelector('.cc-simple-row.kind-untranscribed'), 'omitted speech block from audio');
  assert.match(await page.evaluate(() => document.querySelector('.cc-simple-row.kind-untranscribed').textContent), /Possível fala não transcrita/);
  await capture('audio-segmentation-before.png');
  await page.evaluate(() => document.querySelector('.cc-simple-row.kind-untranscribed .cc-review-trash').click());
  await wait(() => !!document.querySelector('.cc-simple-row.kind-untranscribed.is-cut'), 'delete only omitted first attempt');
  assert.match(await page.evaluate(() => document.querySelector('.cc-simple-row.kind-speech:not(.is-cut)').textContent), /Vamos.*conhecer.*essas.*leituras/);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Excluir todas as pausas').click());
  await wait(() => !!document.querySelector('.cc-pause-confirm'), 'review real audio pause intervals');
  await capture('audio-segmentation-review.png');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Confirmar exclusão das pausas').click());
  await wait(() => !document.querySelector('.cc-pause-confirm'), 'pause cuts committed');
  await new Promise(r => setTimeout(r, 2000));
  const doc = await page.evaluate(async id => {
    const store = await import('/src/persist/projectStore.ts');
    await store.flushProjectSaves(); return store.loadProject(id);
  }, id);
  assert.ok(doc.assets[0].pauseAnalysis.quiet.length >= 2, 'audio evidence actually persisted');
  const clips = doc.timelines[0].items;
  assert.ok(clips.every(c => c.srcInFrame > 0));
  for (let i = 1; i < clips.length; i++) assert.equal(clips[i].startFrame, clips[i - 1].startFrame + clips[i - 1].durationInFrames);
  await capture('audio-segmentation-after.png');
  console.log('OMITTED-SPEECH-QA-OK: audio blocks, missing words, first-attempt-only cut, review/confirm pauses, persisted evidence');
  return { durationSeconds: Math.max(...clips.map(c => c.startFrame + c.durationInFrames)) / 30 };
}
