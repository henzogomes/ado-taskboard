export function buildAuthHeader(pat: string): string {
  if (!pat) throw new Error('No PAT provided — the active connection must carry one.');
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(':' + pat).toString('base64')
    : btoa(':' + pat);
  return 'Basic ' + b64;
}
