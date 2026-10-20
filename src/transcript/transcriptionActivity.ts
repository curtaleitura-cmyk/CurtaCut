/** Live activity shared by manual, ingest and agent transcription entry points. */
export type TranscriptionStage = 'queued' | 'preparing' | 'loading' | 'transcribing' | 'finalizing';
export interface TranscriptionProgress { stage: TranscriptionStage; percent?: number; model?: string; engine?: string; device?: string; fallback?: string }
export interface TranscriptionActivity extends TranscriptionProgress {
  id: string; source: string; provider: string; language: string;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  startedAt: number; updatedAt: number; finishedAt?: number; error?: string;
}
let snapshot: readonly TranscriptionActivity[] = [];
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();
let localQueue: Promise<unknown> = Promise.resolve();
let sequence = 0;
export const getTranscriptionActivities = () => snapshot;
export function subscribeTranscriptionActivities(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
function publish(activity: TranscriptionActivity) {
  snapshot = [...snapshot.filter(item => item.id !== activity.id), activity];
  listeners.forEach(listener => listener());
}
export function cancelTranscriptionActivity(id: string) { controllers.get(id)?.abort(); }
export function dismissTranscriptionActivity(id: string) {
  if (controllers.has(id)) return;
  snapshot = snapshot.filter(item => item.id !== id); listeners.forEach(listener => listener());
}
export function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void operation.catch(() => {}); return Promise.reject(signal.reason); }
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
export async function runTranscriptionActivity<T>(
  info: { source: string; provider: string; language: string },
  operation: (signal: AbortSignal, progress: (value: TranscriptionProgress) => void, heartbeat: () => void) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', abort, { once: true });
  if (externalSignal?.aborted) abort();
  let activity: TranscriptionActivity = { ...info, id: `asr-${++sequence}`, status: 'running',
    stage: info.provider === 'local' ? 'queued' : 'preparing', startedAt: Date.now(), updatedAt: Date.now() };
  controllers.set(activity.id, controller); publish(activity);
  const progress = (value: TranscriptionProgress) => {
    if (controller.signal.aborted || activity.status !== 'running') return;
    const percent = value.percent !== undefined && Number.isFinite(value.percent)
      ? Math.min(100, Math.max(0, value.percent)) : undefined;
    activity = { ...activity, ...value, percent, updatedAt: Date.now() }; publish(activity);
  };
  const execute = async () => {
    controller.signal.throwIfAborted(); progress({ stage: 'preparing' });
    return operation(controller.signal, progress, () => {
      if (!controller.signal.aborted) { activity = { ...activity, updatedAt: Date.now() }; publish(activity); }
    });
  };
  try {
    // A shared browser worker handles one local attempt at a time. Cancelling a
    // queued import must never terminate another video's active inference.
    const pending = info.provider === 'local' ? localQueue.then(execute) : execute();
    const cancellable = abortable(pending, controller.signal);
    if (info.provider === 'local') localQueue = cancellable.catch(() => {});
    const result = await cancellable;
    activity = { ...activity, status: 'done', stage: 'finalizing', percent: 100, finishedAt: Date.now() };
    return result;
  } catch (error) {
    activity = { ...activity, status: controller.signal.aborted ? 'cancelled' : 'failed',
      error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : String(error), finishedAt: Date.now() };
    throw controller.signal.aborted ? controller.signal.reason : error;
  } finally {
    controllers.delete(activity.id); externalSignal?.removeEventListener('abort', abort); publish(activity);
  }
}
