import { createHash, randomUUID } from 'node:crypto';
import { stat, rename, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { ffmpegBin, ffprobeBin } from './media-binaries.ts';
import { selectVideoAudio } from './media-audio-selection.ts';
import { normalizeAdmission, runNormalizationProcess, throwIfNormalizationAborted } from './media-normalization.ts';
import type { NormalizeAdmission } from './media-normalization.ts';

/** Decode with the bundled FFmpeg; publish a separate AAC-LC editing copy.
 * The source is never renamed, overwritten or deleted.
 */
export async function normalizeAudioFile(options: {
  inputPath: string; publicSrc: string; outputDirectory: string;
  signal?: AbortSignal; admission?: NormalizeAdmission; onCreated?: (path: string) => void;
}) {
  const { inputPath, publicSrc, outputDirectory, signal } = options;
  const source = await stat(inputPath);
  const { stdout } = await runNormalizationProcess(ffprobeBin(),
    ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', inputPath], 30000, signal);
  const probe = JSON.parse(stdout) as { streams?: Array<Record<string, unknown>>; format?: { duration?: string } };
  const { audio, hasSpatialAudio } = selectVideoAudio(probe.streams ?? []);
  if (!audio) throw new Error('No audio stream was found in this file.');
  const codec = String(audio.codec_name ?? '').toLowerCase();
  const channels = Number(audio.channels);
  const profile = String(audio.profile ?? '');
  const durationSeconds = Number(probe.format?.duration) || undefined;
  const extension = extname(inputPath).toLowerCase();
  const direct = !hasSpatialAudio && channels > 0 && channels <= 2
    && ((codec === 'aac' && profile === 'LC' && ['.m4a', '.mp4'].includes(extension))
      || (codec === 'mp3' && extension === '.mp3')
      || (codec === 'flac' && extension === '.flac')
      || (codec === 'opus' && ['.opus', '.ogg', '.oga'].includes(extension))
      || (codec === 'vorbis' && ['.ogg', '.oga'].includes(extension))
      || (['pcm_s16le', 'pcm_s24le', 'pcm_f32le'].includes(codec) && ['.wav', '.wave'].includes(extension)));
  if (direct) return { path: publicSrc, normalized: false, durationSeconds, bytes: source.size };
  const id = createHash('sha256').update(`${publicSrc}\0${inputPath}\0${source.size}\0${source.mtimeMs}`).digest('hex').slice(0, 24);
  const name = `audio-compat-v1-${id}.m4a`;
  const output = join(outputDirectory, name);
  const temporary = join(outputDirectory, `.audio-${randomUUID()}.m4a`);
  const release = await (options.admission ?? normalizeAdmission).acquire(output, signal);
  try {
    throwIfNormalizationAborted(signal);
    const cached = await stat(output).catch(() => null);
    if (cached?.isFile() && cached.size > 0) {
      return { path: `/media/uploads/${name}`, normalized: true, durationSeconds, bytes: cached.size };
    }
    const selected = Number.isInteger(audio.index) && Number(audio.index) >= 0 ? `0:${audio.index}` : '0:a:0';
    await runNormalizationProcess(ffmpegBin(), ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
      '-protocol_whitelist', 'file,pipe', '-i', inputPath, '-map', selected, '-vn', '-sn', '-dn', '-map_metadata', '-1',
      ...(codec === 'aac' && profile === 'LC' && channels <= 2 ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-profile:a', 'aac_low', '-ac', '2', '-ar', '48000', '-b:a', '192k']),
      '-movflags', '+faststart', temporary], 60 * 60_000, signal);
    const current = await stat(inputPath);
    if (current.size !== source.size || current.mtimeMs !== source.mtimeMs) {
      throw new Error('The source audio changed during import. Please import it again.');
    }
    throwIfNormalizationAborted(signal);
    await rename(temporary, output);
    options.onCreated?.(output);
    return { path: `/media/uploads/${name}`, normalized: true, durationSeconds, bytes: (await stat(output)).size };
  } finally {
    await unlink(temporary).catch(() => undefined);
    release();
  }
}
