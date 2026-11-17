// Coral Bay — a gta6-01 entry (Node 22, standard library only).
// v2: five story missions, three car classes, pickups, a neon downtown strip
// and a mission tracker. The game itself lives in game/ — plain static files
// a desktop browser loads offline (game/index.html, three.js vendored under
// game/vendor/ as a minified build, and the game's own ES-classic scripts
// under game/src/). This program hands the entry in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library (vendor/makefun-game.ts, copied unchanged from the kit).
//
// The game: an original open-world crime story set in Coral Bay, a sun-soaked
// coastal city. Drive and steal cars in three classes, walk the streets and
// jump, outrun the Coral Bay PD, work five story missions plus taxi fares,
// courier runs and hidden stashes, grab health/ammo/repair pickups, and save
// your progress. Title, HUD with minimap, speedometer and mission tracker,
// pause, wasted and busted screens; keyboard and mouse; synthesised WebAudio
// sound; procedural art only — no borrowed names, art or music.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// ---------------------------------------------------------------------------
// Paths and limits
// ---------------------------------------------------------------------------

// The entry lives beside this file, wherever the grader checks it out.
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the other limits refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes: game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
const CAPS = {
  textMaxBytes: 163840,
  screenshots: { max: 4, maxBytes: 262144 },
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  gamePathMaxBytes: 1000,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Count the files under a directory (recursively), for the build summary.
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

// Copy the entry's payload into /output: the game first, then the shots.
function copyEntry() {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }
}

// List the copied screenshots with their sizes, and fail loudly if any
// breaks the scorer's caps — better to catch it here than at submission.
function verifyShots() {
  const dir = join(out, 'screenshots');
  if (!existsSync(dir)) return [];
  const shots = readdirSync(dir)
    .filter((f) => !statSync(join(dir, f)).isDirectory())
    .map((f) => ({ name: f, bytes: statSync(join(dir, f)).size }));
  if (shots.length > CAPS.screenshots.max) {
    throw new Error(`too many screenshots: ${shots.length} (max ${CAPS.screenshots.max})`);
  }
  for (const s of shots) {
    if (s.bytes > CAPS.screenshots.maxBytes) {
      throw new Error(`screenshot ${s.name} is ${s.bytes} bytes (max ${CAPS.screenshots.maxBytes})`);
    }
  }
  return shots;
}

// Write the dossier the judge reads, from the copied payload.
function writeDossier() {
  writeFileSync(
    join(out, 'dossier.json'),
    buildDossier(out, {
      text_max_bytes: CAPS.textMaxBytes,
      // The dossier library takes snake_case keys; CAPS keeps camelCase.
      screenshots: { max: CAPS.screenshots.max, max_bytes: CAPS.screenshots.maxBytes },
      game_max_files: CAPS.gameMaxFiles,
      game_max_bytes: CAPS.gameMaxBytes,
      game_path_max_bytes: CAPS.gamePathMaxBytes,
    }),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(join(here, 'game', 'index.html'))) {
    throw new Error('game/index.html is missing — run from the repository root');
  }
  copyEntry();
  const shots = verifyShots();
  writeDossier();
  const files = countFiles(join(out, 'game'));
  const dossierBytes = statSync(join(out, 'dossier.json')).size;
  const shotList = shots.map((s) => `${s.name} (${Math.round(s.bytes / 1024)} KiB)`).join(', ') || 'none';
  console.log(`Coral Bay entry written to ${out}: ${files} game files, ${shots.length} screenshots [${shotList}], dossier.json (${dossierBytes} bytes) ready.`);
}

main();
