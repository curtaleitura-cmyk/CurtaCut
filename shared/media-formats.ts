/** Importable audio containers; the server probes the actual codec with FFmpeg. */
export const AUDIO_EXTENSIONS = [
  '.mp3', '.mp2', '.wav', '.wave', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac',
  '.aif', '.aiff', '.aifc', '.alac', '.caf', '.wma', '.ac3', '.eac3', '.dts', '.mka',
  '.amr', '.awb', '.au', '.qta',
] as const;
export const AUDIO_EXTENSION_MIME: Record<string, string> = Object.fromEntries(
  AUDIO_EXTENSIONS.map(extension => [extension, ({
    '.mp3': 'audio/mpeg', '.mp2': 'audio/mpeg', '.wav': 'audio/wav', '.wave': 'audio/wav',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
    '.opus': 'audio/opus', '.flac': 'audio/flac', '.aif': 'audio/aiff', '.aiff': 'audio/aiff',
    '.aifc': 'audio/aiff', '.wma': 'audio/x-ms-wma', '.ac3': 'audio/ac3', '.eac3': 'audio/eac3',
    '.mka': 'audio/x-matroska', '.amr': 'audio/amr', '.awb': 'audio/amr-wb', '.au': 'audio/basic',
  } as Record<string, string>)[extension] ?? 'audio/octet-stream']),
);
