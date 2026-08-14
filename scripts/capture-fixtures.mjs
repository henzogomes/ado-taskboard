// scripts/capture-fixtures.mjs
//
// Spike/data-capture script. Run OUTSIDE the browser (plain Node) so it can hit
// dev.azure.com directly without CORS. Reads ADO credentials from inline
// environment variables (never printed) and writes raw JSON fixtures used by
// the API client and the domain transforms / column mapping.
//
// Usage:
//   ADO_ORG=.. ADO_PROJECT=.. ADO_PAT=.. node scripts/capture-fixtures.mjs
import fs from 'node:fs';

const {
  ADO_ORG,
  ADO_PROJECT,
  ADO_TEAM,
  ADO_PAT,
  ADO_BASE_URL = 'https://dev.azure.com',
} = process.env;

if (!ADO_ORG || !ADO_PROJECT || !ADO_PAT) {
  throw new Error(
    'Missing ADO_ORG, ADO_PROJECT, or ADO_PAT — pass them inline, e.g.\n' +
      '  ADO_ORG=.. ADO_PROJECT=.. ADO_PAT=.. node scripts/capture-fixtures.mjs',
  );
}

const auth = 'Basic ' + Buffer.from(':' + ADO_PAT).toString('base64');
const root = `${ADO_BASE_URL}/${ADO_ORG}/${ADO_PROJECT}`;

const get = async (url) => {
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
};

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`POST ${url} -> ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
};

// --- Resolve team ---------------------------------------------------------
const teams = await get(
  `${ADO_BASE_URL}/${ADO_ORG}/_apis/projects/${ADO_PROJECT}/teams?api-version=7.1`
);
const team = ADO_TEAM || teams.value.find((t) => t.isDefault)?.name || teams.value[0].name;
const teamRoot = `${ADO_BASE_URL}/${ADO_ORG}/${ADO_PROJECT}/${encodeURIComponent(team)}`;

console.log('Resolved team:', team);

// --- Resolve the story/backlog-level board name ---------------------------
// The board name isn't always literally "Stories" -- list boards first and
// try the common story-level names, falling back to the first board.
let boardName = 'Stories';
let board;
try {
  board = await get(`${teamRoot}/_apis/work/boards/${boardName}?api-version=7.1`);
} catch (err) {
  if (err.status !== 404) throw err;
  console.log('Board "Stories" not found (404). Listing available boards...');
  const boards = await get(`${teamRoot}/_apis/work/boards?api-version=7.1`);
  console.log(
    'Available boards:',
    boards.value.map((b) => b.name)
  );
  const preferred =
    boards.value.find((b) => /stor(y|ies)/i.test(b.name)) ||
    boards.value.find((b) => /backlog/i.test(b.name)) ||
    boards.value[0];
  boardName = preferred.name;
  console.log('Using board:', boardName);
  board = await get(`${teamRoot}/_apis/work/boards/${encodeURIComponent(boardName)}?api-version=7.1`);
}

// --- Iterations -------------------------------------------------------------
const iterations = await get(`${teamRoot}/_apis/work/teamsettings/iterations?api-version=7.1`);

// --- WIQL: Stories + Tasks, not Removed -------------------------------------
const wiql = await post(`${teamRoot}/_apis/wit/wiql?api-version=7.1`, {
  query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='${ADO_PROJECT}' AND [System.WorkItemType] IN ('User Story','Task') AND [System.State] <> 'Removed'`,
});
const ids = wiql.workItems.map((w) => w.id).slice(0, 200);
console.log('WIQL matched work items:', wiql.workItems.length, '| fetching:', ids.length);

// --- Batch-fetch work item fields -------------------------------------------
// workitemsbatch is a POST-only endpoint (no GET form) -- call it directly.
const items = await post(`${ADO_BASE_URL}/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitemsbatch?api-version=7.1`, {
  ids,
  fields: [
    'System.Id',
    'System.WorkItemType',
    'System.Title',
    'System.State',
    'System.BoardColumn',
    'System.AssignedTo',
    'System.Tags',
    'System.Parent',
    'System.IterationPath',
    'System.Rev',
  ],
});

fs.mkdirSync('src/api/__fixtures__', { recursive: true });
fs.writeFileSync('src/api/__fixtures__/board.json', JSON.stringify(board, null, 2));
fs.writeFileSync('src/api/__fixtures__/iterations.json', JSON.stringify(iterations, null, 2));
fs.writeFileSync('src/api/__fixtures__/workitems.json', JSON.stringify(items, null, 2));

console.log('team:', team, '| board:', boardName, '| columns:', board.columns?.map((c) => c.name));
console.log('stories+tasks captured:', items.value?.length ?? items.count ?? 'unknown');
