/** iPhone spatial movies may carry APAC plus a stereo compatibility track.
 * Choose the compatibility track explicitly; an unrecognised codec is not silence.
 * https://developer.apple.com/videos/play/wwdc2025/251/
 */
export interface ProbedAudioStream {
  codec_type?: unknown;
  codec_name?: unknown;
  codec_tag_string?: unknown;
  channels?: unknown;
  profile?: unknown;
  index?: unknown;
}
export function selectVideoAudio(streams: ProbedAudioStream[]): {
  audio: ProbedAudioStream | undefined;
  hasSpatialAudio: boolean;
} {
  const audio = streams.filter(stream => stream.codec_type === 'audio');
  const isApac = (stream: ProbedAudioStream) => [stream.codec_name, stream.codec_tag_string]
    .some(codec => String(codec ?? '').toLowerCase() === 'apac');
  const hasSpatialAudio = audio.some(isApac);
  if (!hasSpatialAudio) return { audio: audio[0], hasSpatialAudio };
  const stereo = (stream: ProbedAudioStream) => Number(stream.channels) > 0 && Number(stream.channels) <= 2;
  const fallback = audio.find(stream => !isApac(stream) && stereo(stream)
    && ['aac', 'mp4a'].includes(String(stream.codec_name ?? '').toLowerCase()))
    ?? audio.find(stream => !isApac(stream) && stereo(stream)
      && String(stream.codec_name ?? '').toLowerCase().startsWith('pcm_'));
  if (!fallback) throw new Error('Spatial audio (APAC) has no supported stereo compatibility track. Export a stereo copy from the source device and import it again.');
  return { audio: fallback, hasSpatialAudio };
}
