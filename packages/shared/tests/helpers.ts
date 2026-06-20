/**
 * Test helpers for the redaction key-scan / allowlist / content-scan contract.
 *
 * `collectKeys` walks any JSON value and returns the set of EVERY object key at any depth — the
 * denylist scan asserts none of the server-only key names appear. `collectStrings` returns every
 * string leaf — the content scan asserts a known secret/truth string never appears. These are
 * structural (key/value scans over the serialized projection), the `shared` analogue of the wire
 * payload-scan.
 */

type Json = unknown;

/** Every object key appearing at any depth of `value`. */
export function collectKeys(value: Json): Set<string> {
  const keys = new Set<string>();
  const visit = (v: Json): void => {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v !== null && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) {
        keys.add(k);
        visit(child);
      }
    }
  };
  visit(value);
  return keys;
}

/** Every string leaf appearing at any depth of `value`. */
export function collectStrings(value: Json): string[] {
  const out: string[] = [];
  const visit = (v: Json): void => {
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v !== null && typeof v === 'object') {
      Object.values(v).forEach(visit);
    }
  };
  visit(value);
  return out;
}

/** The exact top-level key-set of an object, sorted for stable comparison. */
export function topLevelKeys(value: object): string[] {
  return Object.keys(value).sort();
}
