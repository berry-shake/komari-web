// Distribution order: upstream base < fork.1 < fork.2. Build metadata is ignored.
// GitHub releases must also be marked stable; beta/snapshot tags are not accepted.
export function parseVersion(input?: string | null): number[] | null {
  const match = input?.trim().match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-fork\.([1-9]\d*))?(?:\+[0-9A-Za-z.-]+)?$/i);
  if (!match) return null;
  const parts = [match[1], match[2], match[3], match[4] || "0"].map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function compareVersions(a?: string | null, b?: string | null): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

export const isNewerVersion = (latest?: string | null, current?: string | null) =>
  compareVersions(latest, current) > 0;
