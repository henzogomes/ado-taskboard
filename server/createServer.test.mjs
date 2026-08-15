// @vitest-environment node
//
// Unit tests for the production Express app (server/createServer.mjs). The
// relay targets a local mock ADO origin (via the adoBaseUrl test override) so
// nothing here touches dev.azure.com.
import { mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from './createServer.mjs';

function boot(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    );
  });
}

describe('createServer', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'ado-taskboard-server-'));
  writeFileSync(path.join(tmp, 'index.html'), '<html>board-app</html>');

  // Mock ADO origin: records what the relay forwarded, then answers per test.
  const hits = [];
  let mockStatus = 200;
  const ado = http.createServer((req, res) => {
    hits.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      org: req.headers['x-ado-org'],
      pat: req.headers['x-ado-pat'],
    });
    res.statusCode = mockStatus;
    res.setHeader('content-type', 'application/json');
    res.end('{}');
  });
  const adoUrl = new Promise((resolve) => {
    ado.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${ado.address().port}`));
  });

  let appUrl;
  beforeAll(async () => {
    appUrl = await boot(
      createServer({ distDir: tmp, adoBaseUrl: await adoUrl }),
    );
  });

  afterAll(async () => {
    await new Promise((r) => ado.close(r));
  });

  it('serves the built app at /', async () => {
    const res = await fetch(appUrl + '/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('board-app');
  });

  it('falls back to index.html for client-side routes', async () => {
    const res = await fetch(appUrl + '/some/client/route');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('board-app');
  });

  it('relays /api/ado to the org target with Basic auth from X-ADO-PAT', async () => {
    const res = await fetch(appUrl + '/api/ado/_apis/wit/workitems/1', {
      headers: { 'X-ADO-Org': 'contoso', 'X-ADO-PAT': 'tok' },
    });
    expect(res.status).toBe(200);
    const hit = hits.at(-1);
    expect(hit.method).toBe('GET');
    expect(hit.url).toBe('/contoso/_apis/wit/workitems/1');
    expect(hit.authorization).toBe('Basic ' + Buffer.from(':tok').toString('base64'));
    // Sensitive relay headers must never be forwarded onward to ADO.
    expect(hit.org).toBeUndefined();
    expect(hit.pat).toBeUndefined();
  });

  it('does not set Authorization when no PAT is sent', async () => {
    await fetch(appUrl + '/api/ado/_apis/wit/boards', {
      headers: { 'X-ADO-Org': 'contoso' },
    });
    const hit = hits.at(-1);
    expect(hit.authorization).toBeUndefined();
  });

  it('collapses a redirect from the origin into a same-origin 401', async () => {
    mockStatus = 302;
    const res = await fetch(appUrl + '/api/ado/_apis/wit/boards', {
      headers: { 'X-ADO-Org': 'contoso' },
      redirect: 'manual',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('location')).toBeNull();
  });
});
