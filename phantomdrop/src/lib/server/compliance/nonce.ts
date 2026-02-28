import "server-only";

declare global {
  var __phantomdrop_nonce_cache: Map<string, number> | undefined;
}

function getNonceCache(): Map<string, number> {
  if (!global.__phantomdrop_nonce_cache) {
    global.__phantomdrop_nonce_cache = new Map();
  }
  return global.__phantomdrop_nonce_cache;
}

export function consumeNonce(nonce: string, nowMs: number, ttlMs: number): boolean {
  const cache = getNonceCache();

  for (const [key, seenAt] of cache.entries()) {
    if (nowMs - seenAt > ttlMs) {
      cache.delete(key);
    }
  }

  if (cache.has(nonce)) {
    return false;
  }

  cache.set(nonce, nowMs);
  return true;
}
