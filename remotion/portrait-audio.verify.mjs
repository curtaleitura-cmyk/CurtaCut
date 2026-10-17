// A phone-shaped AAC video must keep audible sound after adjacent text-edit cuts.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { renderTimeline, setUploadsDirProvider } from './render.mjs';
import { disposeServeBundle } from './serve-bundle.mjs';
const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'curtacut-portrait-audio-'));
const ffmpeg = args => run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
try {
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=180x320:r=30:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(directory, 'story.mp4')]);
  setUploadsDirProvider(() => directory);
  process.env.OPENCHATCUT_DISABLE_HARDWARE_ENCODING = '1';
  for (const decoder of process.platform === 'win32' ? ['offthread'] : ['webcodecs', 'offthread']) {
    process.env.CC_RENDER_VIDEO_DECODER = decoder;
    for (const muted of [false, true]) {
      const output = join(directory, `${decoder}-${muted}.mp4`);
      const state = { fps: 30, width: 180, height: 320, selectedId: null,
        tracks: { V1: { kind: 'video', muted } }, trackOrder: ['V1'],
        items: [0, 1].map(index => ({ id: `cut-${index}`, kind: 'video', name: 'story.mp4',
          track: 'V1', startFrame: index * 15, durationInFrames: 15, srcInFrame: index * 15,
          src: '/media/uploads/story.mp4', width: 180, height: 320, volume: 1 })) };
      await renderTimeline({ state, outputLocation: output, codec: 'h264',
        h264Profile: { id: 'libx264', label: 'Software', hardware: false, transport: 'server' } });
      const decoded = await run(ffmpegPath, ['-v', 'error', '-i', output, '-vn', '-ac', '1',
        '-ar', '16000', '-f', 's16le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024 })
        .catch(error => { if (muted && /does not contain any stream|matches no streams/.test(error.stderr ?? '')) return { stdout: Buffer.alloc(0) }; throw error; });
      const samples = new Int16Array(decoded.stdout.buffer, decoded.stdout.byteOffset, decoded.stdout.length / 2);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + (sample / 32768) ** 2, 0) / (samples.length || 1));
      assert.ok(muted ? rms < 0.001 : rms > 0.04, `${decoder}: muted=${muted}, audio RMS=${rms}`);
      const { stdout: pixel } = await run(ffmpegPath, ['-v', 'error', '-i', output, '-frames:v', '1',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1024 * 1024 });
      assert.equal(pixel.length, 180 * 320 * 3, 'portrait canvas survives export');
      console.log(`portrait-audio.verify: ${decoder}, muted=${muted}, portrait output, RMS=${rms.toFixed(3)}`);
    }
  }
} finally {
  await disposeServeBundle();
  await rm(directory, { recursive: true, force: true });
}
