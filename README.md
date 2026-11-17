# Coral Bay — an open-world crime story

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/bongekanjing/coral-bay-gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/bongekanjing/coral-bay-gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game built for make.fun's **gta6-01 — "Make GTA 6"**
competition. Dario Cole is back in Coral Bay with a debt to the Kroll crew and
nothing but the clothes on his back. Steal cars, outrun the Coral Bay PD, run
three jobs for Marco — and take the city back, one score at a time.

## Play it

Serve `game/` with any static file server and open `game/index.html` in
desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: every file the game loads lives under
`game/` (three.js r149 is vendored as `game/vendor/three.min.js`).

## What is in the game

- **A city to explore on foot and by car** — Coral Bay: a sun-soaked coastal
  grid of streets, towers with lit windows, a neon-signed downtown strip, a
  plaza with a fountain, a park, a beach with a pier and the ocean beyond it.
- **Traffic and pedestrians** — cars drive the road network, stop for each
  other and brake for you; pedestrians stroll the sidewalks, flee gunfire and
  speeding cars, and panic spreads through a crowd.
- **Cars to steal and drive** — walk up to any parked or stopped car and
  press `E`. Three classes with distinct handling: quick **sport** cars, the
  all-round **sedan**, and slow but sturdy **vans**. Arcade handling with a
  handbrake, damage and wrecks.
- **Jump and pickups** — press `Space` on foot to jump; health, ammo and car
  repair pickups are scattered around the city and respawn after a while.
- **A wanted level with police who respond** — steal, shoot or run someone
  over and the Coral Bay PD comes after you with wig-wag light bars that
  strobe faster at higher wanted levels, rams your car, and busts you on foot
  if they stay close. Lay low and the heat cools off.
- **Missions and a story** — five story jobs (First Wheels, The Drop, Heat
  Run, The Vault, King of Coral Bay), plus repeatable taxi fares, timed
  courier deliveries and ten hidden stash packages that pay cash.
- **Combat** — a pistol with tracers, muzzle flash, reloads and panicking crowds.
- **A HUD with a minimap** — cash, health, wanted stars, a speedometer with
  a speed bar and car-class badge, a mission-objective tracker that ticks
  steps off as you finish them, a live minimap with police and mission
  markers, banners and toasts.
- **Start screen and saving** — continue or start a new game; cash, missions
  and stashes save in the browser.
- **Sound** — synthesised WebAudio: engine hum, sirens, gunshots, a bass groove.

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive |
| Mouse drag | Look around (orbit camera) |
| Click | Fire pistol (on foot) |
| E | Steal / enter / exit car |
| Shift | Run |
| Space | Jump (on foot) / Handbrake (in car) |
| R | Reload |
| P / Esc | Pause |
| M | Mute |

## Tech

- `game/index.html` — page, HUD and menus
- `game/vendor/three.min.js` — three.js r149 (vendored, minified)
- `game/src/config.js` — tuning, colours, car classes, seeded RNG
- `game/src/city.js` — the procedural city, neon strip, beach and road graph
- `game/src/vehicles.js` — car models, classes and traffic
- `game/src/people.js` — pedestrians
- `game/src/police.js` — wanted system and police AI
- `game/src/missions.js` — story missions, taxi fares, courier runs, stashes
- `game/src/hud.js` — HUD, speedometer, mission tracker, minimap, menus
- `game/src/player.js` — Dario: walking, jumping, driving, camera, combat, pickups
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/main.js` — boot, fixed-step loop, save/load, screenshots
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`

Everything in the game — the city, characters, vehicles, names, story, art,
sound and music — is original. Nothing is taken from Rockstar Games or any
other commercial game.

## License

MIT — see [LICENSE](LICENSE).
