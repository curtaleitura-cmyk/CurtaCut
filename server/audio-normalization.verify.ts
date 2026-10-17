import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeAudioFile } from './audio-normalization';
import { ffmpegBin, ffprobeBin } from './media-binaries';
import { sha256File } from '../shared/node-content-hash';
import { kindOfDescriptor } from '../src/media/mediaProbe';
import { normalizeReason, resolveStreamPlan, probeVideo, encodeNormalized } from './media-normalization';
const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'curtacut-audio-formats-'));
const base = { width: 1080, height: 1920, duration: 1, size: 1000, sourceBitrate: 1000,
  videoCodec: 'h264', audioCodec: 'aac', hasAudio: true, variableFrameRate: false };
assert.equal(resolveStreamPlan({ ...base, audioCodec: '' }, false, false).transcodeAudio, true, 'unknown audio is not silently treated as compatible');
assert.equal(resolveStreamPlan({ ...base, audioChannels: 6 }, false, false).transcodeAudio, true);
assert.match(normalizeReason({ ...base, audioChannels: 6 }, 1000, false, false) ?? '', /audio codec/);
assert.equal(resolveStreamPlan({ ...base, audioProfile: 'HE-AAC' }, false, false).transcodeAudio, true);
assert.equal(resolveStreamPlan({ ...base, audioChannels: 2, audioProfile: 'LC' }, false, false).transcodeAudio, false);
const fixtures = [
  ['voice.wav', 'pcm_s24le'], ['voice.flac', 'flac'], ['voice.mp3', 'libmp3lame'],
  ['voice.m4a', 'alac'], ['voice.aac', 'aac'], ['voice.ac3', 'ac3'], ['voice.eac3', 'eac3'],
  ['voice.wma', 'wmav2'], ['voice.aiff', 'pcm_s16be'], ['voice.caf', 'pcm_s24le'],
  ['voice.opus', 'libopus'], ['voice.ogg', 'libvorbis'],
];
try {
  for (const [name, codec] of fixtures) {
    assert.equal(kindOfDescriptor(name!), 'audio', `${name} is accepted by the importer`);
    const source = join(directory, name!);
    await run(ffmpegBin(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.5',
      '-ac', '2', '-c:a', codec!, source]);
    const hash = await sha256File(source);
    const result = await normalizeAudioFile({ inputPath: source, publicSrc: `/media/uploads/${name}`, outputDirectory: directory });
    const output = join(directory, basename(result.path));
    assert.equal(await sha256File(source), hash, 'original audio bytes are preserved');
    const { stdout: info } = await run(ffprobeBin(), ['-v', 'error', '-show_streams', '-of', 'json', output]);
    const audio = JSON.parse(info).streams.filter((s: { codec_type: string }) => s.codec_type === 'audio');
    assert.equal(audio.length, 1);
    assert.equal(audio[0].channels, 2);
    if (result.normalized) { assert.equal(audio[0].codec_name, 'aac'); assert.equal(audio[0].profile, 'LC'); }
    const { stdout } = await run(ffmpegBin(), ['-v', 'error', '-i', output, '-vn', '-ac', '1', '-ar', '16000',
      '-f', 's16le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1024 * 1024 });
    const samples = new Int16Array(stdout.buffer, stdout.byteOffset, stdout.length / 2);
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + (sample / 32768) ** 2, 0) / samples.length);
    assert.ok(rms > 0.035, `${name} must remain audible, RMS=${rms}`);
    assert.ok((result.durationSeconds ?? 0) > 0.3);
    const second = await normalizeAudioFile({ inputPath: source, publicSrc: `/media/uploads/${name}`, outputDirectory: directory });
    assert.equal(second.path, result.path, 'repeated imports reuse the completed compatible copy');
    console.log(`audio-normalization.verify: ${name} → ${result.normalized ? 'AAC-LC stereo' : 'original compatible audio'}, RMS=${rms.toFixed(3)}`);
  }
  const multichannel = join(directory, 'surround.ac3');
  await run(ffmpegBin(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5',
    '-ac', '6', '-c:a', 'ac3', multichannel]);
  const converted = await normalizeAudioFile({ inputPath: multichannel, publicSrc: '/media/uploads/surround.ac3', outputDirectory: directory });
  assert.equal(converted.normalized, true);
  const { stdout: surroundInfo } = await run(ffprobeBin(), ['-v', 'error', '-show_streams', '-of', 'json', join(directory, basename(converted.path))]);
  assert.equal(JSON.parse(surroundInfo).streams[0].channels, 2);
  const embedded = join(directory, 'portrait-surround.mp4');
  const embeddedOut = join(directory, 'portrait-stereo.mp4');
  await run(ffmpegBin(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=180x320:r=30:d=0.5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.5', '-ac', '6', '-c:a', 'aac', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', embedded]);
  const meta = await probeVideo(embedded);
  assert.equal(meta.audioChannels, 6);
  await encodeNormalized(embedded, embeddedOut, meta, 180, 320, 500000, 30, false, resolveStreamPlan(meta, false, false));
  const verified = await probeVideo(embeddedOut);
  assert.deepEqual([verified.width, verified.height, verified.audioChannels, verified.audioProfile], [180, 320, 2, 'LC']);
  console.log('audio-normalization.verify: embedded six-channel AAC → stereo, portrait frame preserved');
  // Exercise the actual HTTP entry point without uploads or external storage.
  const { createServer } = await import('vite');
  const { normalizeMediaPlugin } = await import('./plugins/normalize-media');
  const { seedKeystore } = await import('./keystore');
  seedKeystore({ MEDIA_DIR: directory, R2_ENABLED: '0' });
  const server = await createServer({ configFile: false, root: directory, plugins: [normalizeMediaPlugin()],
    server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  try {
    await server.listen();
    const address = server.httpServer!.address() as { port: number };
    const endpoint = `http://127.0.0.1:${address.port}/api/normalize-media`;
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ src: '/media/uploads/voice.wma', mediaKind: 'audio' }) });
    assert.equal(response.status, 200);
    const result = await response.json() as { normalized: boolean; path: string; durationSeconds: number };
    assert.equal(result.normalized, true);
    assert.match(result.path, /^\/media\/uploads\/audio-compat-v1-.*\.m4a$/);
    assert.ok(result.durationSeconds > 0.3);
    const unsafe = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ src: '/media/uploads/../voice.wma', mediaKind: 'audio' }) });
    assert.equal(unsafe.status, 400);
  } finally { await server.close(); }
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(normalizeAudioFile({ inputPath: multichannel, publicSrc: '/media/uploads/surround.ac3', outputDirectory: directory, signal: aborted.signal }), /abort|cancel/i);
  const invalid = join(directory, 'invalid.wma'); await writeFile(invalid, 'not an audio file');
  await assert.rejects(normalizeAudioFile({ inputPath: invalid, publicSrc: '/media/uploads/invalid.wma', outputDirectory: directory }));
  assert.equal((await readdir(directory)).some(name => name.startsWith('.audio-')), false, 'temporary copies are cleaned up');
} finally { await rm(directory, { recursive: true, force: true }); }
