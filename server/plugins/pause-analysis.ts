import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import { existsSync } from 'node:fs';
import { ffmpegBin } from '../media-binaries.ts';
import { spawnMediaProcess, ffmpegThreadArgs } from '../media-process.ts';
import { isSafeUploadName, resolveUploadFile } from '../media-dir.ts';
import { normalizePauseSettings, SilenceLogParser, type PauseSettings } from '../../shared/pause-analysis.ts';

async function readBody(req: IncomingMessage) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) throw new Error('Solicitação muito grande.');
  }
  return JSON.parse(body);
}
export async function analyzePauses(file: string, settings: PauseSettings, signal: AbortSignal,
  progress: (processedMs: number) => void) {
  return new Promise<{ durationMs: number; quiet: { startMs: number; endMs: number }[] }>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Análise cancelada.')); return; }
    const child = spawnMediaProcess(ffmpegBin(), [...ffmpegThreadArgs(),
      '-nostdin', '-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-vn',
      '-af', `silencedetect=noise=${settings.thresholdDb}dB:d=${settings.minSilenceMs / 1000}`,
      '-progress', 'pipe:1', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const parser = new SilenceLogParser();
    let stderr = '', stdout = '', tail = '', durationMs = 0, timedOut = false;
    const abort = () => child.kill('SIGKILL');
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; abort(); }, 30 * 60_000);
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
      const lines = stdout.split(/\r?\n/); stdout = lines.pop() ?? '';
      for (const line of lines) if (line.startsWith('out_time_us=')) {
        const ms = Number(line.slice(12)) / 1000;
        if (Number.isFinite(ms) && ms >= 0) { durationMs = Math.max(durationMs, ms); progress(durationMs); }
      }
    });
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString(); tail = (tail + text).slice(-1600); stderr += text;
      const lines = stderr.split(/\r?\n/); stderr = lines.pop() ?? '';
      for (const line of lines) parser.feed(line);
    });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', code => {
      cleanup(); parser.feed(stderr);
      if (signal.aborted) reject(new Error('Análise cancelada.'));
      else if (timedOut) reject(new Error('A análise excedeu 30 minutos.'));
      else if (code !== 0) reject(new Error(/matches no streams|does not contain any stream/.test(tail)
        ? 'Este arquivo não contém uma faixa de áudio disponível.' : `Não foi possível analisar o áudio (FFmpeg ${code}).`));
      else if (durationMs <= 0) reject(new Error('O FFmpeg não retornou uma duração de áudio válida.'));
      else resolve({ durationMs, quiet: parser.finish(durationMs) });
    });
  });
}
export function pauseAnalysisPlugin(): Plugin {
  let running = 0;
  return { name: 'curtacut-pause-analysis', configureServer(server) {
    server.middlewares.use('/api/pause-analysis', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      const controller = new AbortController();
      const abort = () => controller.abort();
      let admitted = false;
      res.on('close', abort);
      const send = (event: unknown) => { if (!res.destroyed) res.write(JSON.stringify(event) + '\n'); };
      try {
        const body = await readBody(req);
        const match = typeof body.src === 'string' && body.src.match(/^\/media\/uploads\/([^/?]+)(?:\?.*)?$/);
        const name = match ? decodeURIComponent(match[1]) : '';
        const file = isSafeUploadName(name) ? resolveUploadFile(name) : null;
        if (!file || !existsSync(file)) { res.statusCode = 400; throw new Error('Selecione um vídeo local importado e disponível.'); }
        if (running >= 2) { res.statusCode = 429; throw new Error('Há outras análises em andamento. Tente novamente ao terminarem.'); }
        const settings = normalizePauseSettings(body.settings ?? {});
        running++; admitted = true;
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-store');
        send({ type: 'progress', processedMs: 0 });
        const result = await analyzePauses(file, settings, controller.signal, processedMs => send({ type: 'progress', processedMs }));
        send({ type: 'result', ...result });
      } catch (error) { send({ type: 'error', error: error instanceof Error ? error.message : String(error) }); }
      finally { if (admitted) running--; res.removeListener('close', abort); res.end(); }
    });
  } };
}
