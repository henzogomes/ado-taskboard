export function buildAuthHeader(pat: string): string {
  if (!pat) throw new Error('ADO_PAT is not set — add it to .env (see .env.example).');
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(':' + pat).toString('base64')
    : btoa(':' + pat);
  return 'Basic ' + b64;
}
