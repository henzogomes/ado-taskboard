// server/index.mjs
//
// CLI entry point for the production server (npm run serve / npm start).
// The app itself is built by createServer.mjs so Electron can embed the same
// server on an ephemeral port.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './createServer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// A port is not ADO config — keep reading it from the environment.
const PORT = process.env.PORT || 5280;

const app = createServer({ distDir });

app.listen(PORT, () => {
  console.log(`ado-taskboard listening on http://localhost:${PORT}`);
});
