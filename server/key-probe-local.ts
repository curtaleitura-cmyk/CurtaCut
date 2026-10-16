import { ProxyAgent } from 'undici';
import { environmentProxyUrl } from './outbound-proxy.ts';
import { getKey } from './keystore.ts';
import { checkDataDir, readDataDirPointer } from './data-dir.ts';
import { DATA_DIR_ENV, defaultRootDir, runtimeProfile } from './runtime-profile.ts';
import { networkMessage, type ProbeResult } from './key-probe-result.ts';

export const PROBE_TIMEOUT_MS = 12_000;
const PROXY_PROBE_URL = 'https://www.gstatic.com/generate_204';

function proxyProbeUrl(overrides: Record<string, unknown>): string {
  if (Object.hasOwn(overrides, 'PROXY_URL')) return String(overrides.PROXY_URL ?? '').trim();
  return getKey('PROXY_URL').trim() || environmentProxyUrl();
}

/** Storage-root writability check: a local disk probe, never a network request. */
export async function runDataDirProbe(overrides: Record<string, unknown>): Promise<ProbeResult> {
  const profile = runtimeProfile();
  if (process.env[DATA_DIR_ENV]?.trim()) {
    return { ok: false, message: `Directory pinned by ${DATA_DIR_ENV}; it cannot be changed in Settings` };
  }
  const raw = Object.hasOwn(overrides, DATA_DIR_ENV)
    ? String(overrides[DATA_DIR_ENV] ?? '')
    : readDataDirPointer() ?? '';
  const started = Date.now();
  const body = await checkDataDir(raw, defaultRootDir(profile));
  const latencyMs = Date.now() - started;
  return body.ok
    ? { ok: true, latencyMs, message: body.note ?? 'Directory is writable' }
    : { ok: false, latencyMs, message: body.error ?? 'Directory check failed' };
}

/** Test the saved proxy or the unsaved value currently shown in the settings field. */
export async function runProxyProbe(overrides: Record<string, unknown>): Promise<ProbeResult> {
  const proxyUrl = proxyProbeUrl(overrides);
  if (!proxyUrl) return { ok: false, message: 'No proxy address was entered and no system proxy environment variable was found' };
  let dispatcher: ProxyAgent;
  try {
    dispatcher = new ProxyAgent(proxyUrl);
  } catch {
    return { ok: false, message: 'Invalid proxy address; use http://host:port or https://host:port' };
  }
  const started = Date.now();
  try {
    const response = await fetch(PROXY_PROBE_URL, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), dispatcher,
    } as RequestInit);
    const latencyMs = Date.now() - started;
    if (!response.ok) return { ok: false, status: response.status, latencyMs, message: `Proxy connected, but the external probe returned HTTP ${response.status}` };
    return { ok: true, status: response.status, latencyMs, message: `Proxy connected · Internet reachable · ${latencyMs}ms` };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, message: proxyNetworkMessage(error) };
  } finally {
    await dispatcher.close();
  }
}

function proxyNetworkMessage(error: unknown): string {
  const message = networkMessage(error).replace(/; this does not indicate an invalid key$/, '');
  return `Proxy connection failed · ${message}`;
}
