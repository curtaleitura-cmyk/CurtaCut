import assert from 'node:assert/strict';
import { selectVideoAudio } from './media-audio-selection';
import { normalizeReason } from './media-normalization';
const video = { codec_type: 'video', index: 0 };
const aac = { codec_type: 'audio', codec_name: 'aac', index: 2, channels: 2 };
for (const spatial of [
  { codec_type: 'audio', codec_name: 'apac', index: 1, channels: 4 },
  { codec_type: 'audio', codec_tag_string: 'apac', index: 1, channels: 4 },
]) {
  for (const streams of [[video, spatial, aac], [video, aac, spatial]]) {
    const selected = selectVideoAudio(streams);
    assert.equal(selected.audio, aac, 'AAC compatibility audio wins regardless of track order');
    assert.equal(selected.hasSpatialAudio, true);
  }
  assert.throws(() => selectVideoAudio([video, spatial]), /no supported stereo compatibility track/,
    'unsupported APAC-only input must not silently become a video without audio');
  const pcm = { ...aac, codec_name: 'pcm_s24le' };
  assert.equal(selectVideoAudio([video, spatial, pcm]).audio, pcm);
}
const unknownAudio = { codec_type: 'audio', index: 1 };
assert.equal(selectVideoAudio([video, unknownAudio]).audio, unknownAudio, 'unknown codec does not mean no audio');
assert.equal(selectVideoAudio([video]).audio, undefined);
assert.equal(selectVideoAudio([video, aac]).audio, aac);
assert.equal(selectVideoAudio([video, aac]).hasSpatialAudio, false);
assert.match(normalizeReason({ width: 1080, height: 1920, videoCodec: 'h264', audioCodec: 'aac',
  hasAudio: true, hasSpatialAudio: true, size: 1000, sourceBitrate: 1000, duration: 1, variableFrameRate: false },
1000, false, false) ?? '', /stereo compatibility/, 'spatial movies are remuxed even when AAC/video codecs are compatible');
console.log('media-audio-selection.verify: APAC/AAC order, unknown codecs, PCM fallback and explicit failure passed');

// Prove the chosen absolute stream index is honoured by the real FFmpeg path.
// The fixture uses two AAC tracks (silent first, audible second); actual APAC
// selection is covered by the probe metadata cases above, not an APAC encoder.
const { execFile } = await import('node:child_process');
const { promisify } = await import('node:util');
const { mkdtemp, rm } = await import('node:fs/promises');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { ffmpegBin } = await import('./media-binaries');
const { probeVideo, encodeNormalized } = await import('./media-normalization');
const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'curtacut-audio-selection-'));
const previousEncoding = process.env.OPENCHATCUT_DISABLE_HARDWARE_ENCODING;
process.env.OPENCHATCUT_DISABLE_HARDWARE_ENCODING = '1';
try {
  const source = join(directory, 'alternate-audio.mp4');
  const output = join(directory, 'stereo.mp4');
  await run(ffmpegBin(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=90x160:r=30:d=1',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
    '-map', '0:v', '-map', '1:a', '-map', '2:a', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source]);
  const meta = await probeVideo(source);
  assert.equal(meta.hasAudio, true);
  await encodeNormalized(source, output, { ...meta, audioStreamIndex: 2 }, 90, 160, 1000000, 30, false,
    { transcodeVideo: false, transcodeAudio: false });
  const { stdout } = await run(ffmpegBin(), ['-v', 'error', '-i', output, '-vn', '-ac', '1',
    '-ar', '16000', '-f', 's16le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1024 * 1024 });
  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, stdout.length / 2);
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + (sample / 32768) ** 2, 0) / samples.length);
  assert.ok(rms > 0.04, `selected compatibility audio must be audible (RMS ${rms})`);
  const outputMeta = await probeVideo(output);
  assert.deepEqual([outputMeta.width, outputMeta.height], [90, 160], 'portrait dimensions survive audio selection');
  console.log(`media-audio-selection.verify: real FFmpeg selected the audible second track, RMS=${rms.toFixed(3)}`);
} finally {
  if (previousEncoding === undefined) delete process.env.OPENCHATCUT_DISABLE_HARDWARE_ENCODING;
  else process.env.OPENCHATCUT_DISABLE_HARDWARE_ENCODING = previousEncoding;
  await rm(directory, { recursive: true, force: true });
}
