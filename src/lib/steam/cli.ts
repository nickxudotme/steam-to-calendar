import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SteamWishlistError } from '@/lib/steam/client';
import { getCachedSteamCliValue } from '@/lib/steam/cache';

type SteamCliEnvelope<T> = {
  ok: boolean;
  command: string;
  schema: string;
  data?: T;
  error?: {
    type: string;
    message: string;
    hint?: string;
  };
};

export type SteamCliOptions = {
  cacheTtlMs?: number;
  cc?: string;
  lang?: string;
  processTimeoutMs?: number;
  uiLang?: string;
};

const DEFAULT_PROCESS_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_BUFFER = 20 * 1024 * 1024;

export async function runSteamCliJson<T>(
  commandArgs: string[],
  options: SteamCliOptions = {},
): Promise<T | null> {
  const binaryPath = resolveSteamCliPath();
  if (!binaryPath) {
    return null;
  }

  const args = [
    ...commandArgs,
    '--json',
    '--cc',
    options.cc?.trim() || process.env.STEAM_CLI_CC?.trim() || 'US',
    '--lang',
    options.lang?.trim() || process.env.STEAM_CLI_LANG?.trim() || 'english',
    '--ui-lang',
    options.uiLang?.trim() || process.env.STEAM_CLI_UI_LANG?.trim() || 'en',
    '--timeout',
    process.env.STEAM_CLI_REQUEST_TIMEOUT_SECONDS?.trim() || '12',
  ];

  return getCachedSteamCliValue(
    steamCliCacheKey(binaryPath, args),
    options.cacheTtlMs,
    async () => {
      const stdout = await execSteamCli(binaryPath, args, options);
      const envelope = parseEnvelope<T>(stdout);

      if (!envelope.ok) {
        throw steamCliError(envelope);
      }

      if (envelope.data === undefined) {
        throw new SteamWishlistError('wishlist_parse_failed', 'steam-cli JSON response did not include data.');
      }

      return envelope.data;
    },
  );
}

function steamCliCacheKey(binaryPath: string, args: string[]): string {
  return JSON.stringify([binaryPath, args]);
}

function resolveSteamCliPath(): string | null {
  const configuredPath = process.env.STEAM_CLI_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  }

  const bundledPath = path.join(/* turbopackIgnore: true */ process.cwd(), 'bin', 'steam-cli');
  return existsSync(bundledPath) ? bundledPath : null;
}

function execSteamCli(
  binaryPath: string,
  args: string[],
  options: SteamCliOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      binaryPath,
      args,
      {
        timeout: options.processTimeoutMs ?? readNumberEnv('STEAM_CLI_PROCESS_TIMEOUT_MS', DEFAULT_PROCESS_TIMEOUT_MS),
        maxBuffer: readNumberEnv('STEAM_CLI_MAX_BUFFER_BYTES', DEFAULT_MAX_BUFFER),
      },
      (error, stdout) => {
        if (stdout.trim()) {
          resolve(stdout);
          return;
        }

        if (error && 'code' in error && error.code === 'ENOENT') {
          resolve('');
          return;
        }

        reject(new SteamWishlistError('fetch_failed', 'steam-cli did not return JSON output.', error));
      },
    );
  });
}

function parseEnvelope<T>(stdout: string): SteamCliEnvelope<T> {
  if (!stdout.trim()) {
    throw new SteamWishlistError('fetch_failed', 'Configured steam-cli binary was not found.');
  }

  try {
    return JSON.parse(stdout) as SteamCliEnvelope<T>;
  } catch (error) {
    throw new SteamWishlistError('wishlist_parse_failed', 'Could not parse steam-cli JSON output.', error);
  }
}

function steamCliError(envelope: SteamCliEnvelope<unknown>): SteamWishlistError {
  const message = envelope.error?.message ?? 'steam-cli failed.';

  switch (envelope.error?.type) {
    case 'invalid_input':
      return new SteamWishlistError('invalid_steam_id', message);
    case 'not_found':
    case 'access_denied':
      return new SteamWishlistError('wishlist_private_or_unavailable', message);
    case 'rate_limited':
      return new SteamWishlistError('wishlist_rate_limited', message);
    default:
      return new SteamWishlistError('fetch_failed', message);
  }
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
