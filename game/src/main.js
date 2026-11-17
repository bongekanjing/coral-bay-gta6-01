// Coral Bay — main.js
// One clear job: run the game. Boot the renderer and every system, own the
// input listeners, the state machine (title / playing / paused / wasted /
// busted), saving to localStorage, and the ?shot= staging the screenshots use.
// The frame loop ticks the player, traffic, pedestrians, police and missions.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  const SAVE_KEY = 'coralbay-save-v1';

  const Game = {
    state: 'title',           // title | playing | paused | wasted | busted
    time: 0,
    city: null,
    scene: null,
    camera: null,
    renderer: null,
    rng: null,
    player: null,
    saveData: null,
    input: { w: false, a: false, s: false, d: false, shift: false, space: false, mouseDown: false, reloadPressed: false },
    lastDanger: null,
    saveDirty: false,
    shot: null,
    shotReadyAt: 0,
    shotDone: false,
    errors: [],

    loadSave: function () {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (typeof s.cash !== 'number') return null;
        return s;
      } catch (e) { return null; }
    },

    writeSave: function () {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          cash: this.player.cash,
          missionsDone: CB.Missions.index,
          stashes: CB.Missions.stashes.filter(function (s) { return s.taken; }).map(function (s) { return s.id; }),
        }));
        this.saveDirty = false;
      } catch (e) {}
    },

    save: function () { this.saveDirty = true; this.writeSave(); },

    addCash: function (n) {
      this.player.cash += n;
      this.save();
    },

    damagePlayer: function (n) {
      if (this.state !== 'playing') return;
      this.player.health -= n;
      if (this.player.health <= 0) {
        this.player.health = 0;
        this.wasted();
      }
    },

    wasted: function () {
      if (this.state !== 'playing') return;
      this.state = 'wasted';
      CB.AudioSys.failSting();
      CB.AudioSys.engineStop();
      CB.Police.clearAll();
      CB.HUD.show('screen-wasted', true);
      CB.HUD.showHud(false);
    },

    busted: function () {
      if (this.state !== 'playing') return;
      this.state = 'busted';
      CB.AudioSys.failSting();
      CB.AudioSys.engineStop();
      CB.Police.clearAll();
      CB.HUD.show('screen-busted', true);
      CB.HUD.showHud(false);
    },

    respawn: function (place) {
      const loc = this.city.locations[place];
      this.player.cash = Math.max(0, this.player.cash - (place === 'hospital' ? CFG.wastedFine : CFG.bustFine));
      if (this.player.inCar) this.player.exitCar();
      this.player.reset(loc.x, loc.z, 0);
      CB.Police.clearAll();
      CB.HUD.show('screen-wasted', false);
      CB.HUD.show('screen-busted', false);
      CB.HUD.showHud(true);
      this.state = 'playing';
      CB.HUD.flashObjective(place === 'hospital' ?
        'You woke up at Coral General. -$' + CFG.wastedFine :
        'You paid the fine and walked out of the precinct. -$' + CFG.bustFine);
      this.save();
    },

    onPedShot: function () { /* hook: a ped was shot; danger is set by Player.shoot */ },

    startGame: function (fresh) {
      if (fresh) {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        this.saveData = null;
        this.player.cash = 0;
        CB.Missions.index = 0;
      } else if (this.saveData) {
        this.player.cash = this.saveData.cash;
      }
      CB.AudioSys.init();
      CB.AudioSys.resume();
      CB.AudioSys.musicStart();
      CB.HUD.hideTitle();
      this.state = 'playing';
      // Fresh story start after a reset.
      if (fresh) {
        CB.Missions.index = 0;
        for (const st of CB.Missions.stashes) { st.taken = false; st.mesh.visible = true; }
        CB.Missions.stashCollected = 0;
        CB.Missions.taxi = null;
        CB.Missions.taxiCooldown = 12;
        CB.Missions.courier = null;
        CB.Missions.courierCooldown = CFG.courierCooldown;
        CB.Pickups.reset();
        CB.Missions.startStory();
      }
    },

    togglePause: function () {
      if (this.state === 'playing') {
        this.state = 'paused';
        CB.HUD.show('screen-pause', true);
        CB.AudioSys.engineSet(0, false);
      } else if (this.state === 'paused') {
        this.state = 'playing';
        CB.HUD.show('screen-pause', false);
        CB.AudioSys.resume();
      }
    },

    quitToTitle: function () {
      this.state = 'title';
      CB.HUD.show('screen-pause', false);
      CB.HUD.showHud(false);
      CB.HUD.showTitle(!!this.loadSave());
      CB.AudioSys.engineStop();
      if (this.player.inCar) this.player.exitCar();
      this.player.reset(36, 44, 0);
      CB.Police.clearAll();
      CB.Missions.startStory();
    },

    boot: function () {
      const params = new URLSearchParams(window.location.search);
      const seed = parseInt(params.get('seed') || '', 10);
      this.rng = CB.makeRng(Number.isFinite(seed) ? seed : CFG.seed);
      this.shot = params.get('shot');
      this.saveData = this.loadSave();

      window.addEventListener('error', function (e) {
        Game.errors.push(String(e.message || e.error));
      });

      // Renderer.
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      document.getElementById('app').appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
      this.camera.position.set(0, 30, 60);

      // Build the world.
      this.city = CB.City.build(this.scene, this.rng);
      CB.Vehicles.init(this.scene, this.city, this.rng);
      CB.People.init(this.scene, this.city, this.rng);
      CB.Police.init(this.scene, this.city, this.rng);
      this.player = CB.Player;
      this.player.init(this.scene);
      this.player.cash = this.saveData ? this.saveData.cash : 0;
      CB.Missions.init(this.scene, this.city, this.rng, this.saveData);
      CB.Pickups.init(this.scene, this.city, this.rng);
      CB.HUD.init();

      this.bindInput();
      this.bindButtons();

      window.addEventListener('resize', function () {
        Game.camera.aspect = window.innerWidth / window.innerHeight;
        Game.camera.updateProjectionMatrix();
        Game.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // Shot staging: skip the title screen and set up a scene worth shooting.
      if (this.shot) this.stageShot(this.shot);
      else CB.HUD.showTitle(!!this.saveData);

      const self = this;
      let last = performance.now();
      let acc = 0;
      function frame() {
        requestAnimationFrame(frame);
        // Freeze hook for screenshots: hold the last presented frame so the
        // compositor can capture it while the GPU process drains.
        if (window.__freezeFrame) return;
        const now = performance.now();
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 2) dt = 2; // long stall (tab switch, GPU back-pressure)
        // Fixed-step simulation, driven by wall-clock time so the game
        // advances in real time even when frames arrive in bursts or stall
        // (software rendering in headless Chrome). At most 1s of catch-up
        // a frame; anything older is dropped rather than spiralling.
        acc += dt;
        if (acc > 1) acc = 1;
        let steps = 0;
        while (acc >= 0.016 && steps < 64) {
          self.tick(0.016);
          acc -= 0.016;
          steps++;
        }
        self.renderer.render(self.scene, self.camera);
      }
      requestAnimationFrame(frame);
      window.__gameReady = true;
    },

    bindInput: function () {
      const self = this;
      const input = this.input;
      const keymap = { KeyW: 'w', ArrowUp: 'w', KeyA: 'a', ArrowLeft: 'a', KeyS: 's', ArrowDown: 's', KeyD: 'd', ArrowRight: 'd' };
      window.addEventListener('keydown', function (e) {
        CB.AudioSys.init();
        CB.AudioSys.resume();
        if (keymap[e.code] !== undefined) { input[keymap[e.code]] = true; e.preventDefault(); }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = true;
        if (e.code === 'Space') { input.space = true; e.preventDefault(); }
        if (e.code === 'KeyR') input.reloadPressed = true;
        if (e.code === 'KeyM') CB.AudioSys.setMuted(!CB.AudioSys.muted);
        if (e.code === 'KeyE' && !e.repeat) self.pressE();
        if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) self.togglePause();
      });
      window.addEventListener('keyup', function (e) {
        if (keymap[e.code] !== undefined) input[keymap[e.code]] = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = false;
        if (e.code === 'Space') input.space = false;
      });
      // Mouse: drag orbits the camera, click fires the pistol.
      let dragging = false, lastX = 0, lastY = 0;
      const canvas = this.renderer.domElement;
      canvas.addEventListener('mousedown', function (e) {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        if (self.state === 'playing' && !self.player.inCar) input.mouseDown = true;
      });
      window.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        self.player.camYaw -= dx * 0.005;
        self.player.camPitch = CB.clamp(self.player.camPitch + dy * 0.004, -0.1, 0.9);
      });
      window.addEventListener('mouseup', function () { dragging = false; input.mouseDown = false; });
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        self.player.zoom = CB.clamp((self.player.zoom || 1) + (e.deltaY > 0 ? 0.12 : -0.12), 0.6, 1.8);
      }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },

    pressE: function () {
      if (this.state !== 'playing') return;
      const p = this.player;
      if (p.inCar) { p.exitCar(); return; }
      const found = CB.Vehicles.nearestCar(p.x, p.z, 4.5, true);
      if (found) {
        p.enterCar(found);
        CB.Police.addWanted(1);
        CB.HUD.flashObjective('You stole a car! Wanted level up.');
        CB.AudioSys.chime();
      }
    },

    bindButtons: function () {
      const self = this;
      document.getElementById('btn-continue').addEventListener('click', function () { self.startGame(false); });
      document.getElementById('btn-new').addEventListener('click', function () { self.startGame(true); });
      document.getElementById('btn-resume').addEventListener('click', function () { self.togglePause(); });
      document.getElementById('btn-quit').addEventListener('click', function () { self.quitToTitle(); });
      document.getElementById('btn-respawn').addEventListener('click', function () { self.respawn('hospital'); });
      document.getElementById('btn-release').addEventListener('click', function () { self.respawn('policeStation'); });
    },

    // Stage a scene for a screenshot: no title screen, a set scenario, and
    // the car driving itself so the shot has motion in it.
    ensureCar: function (x, z, heading) {
      const p = this.player;
      let found = CB.Vehicles.nearestCar(x, z, 40, false);
      if (!found) {
        const mesh = CB.Vehicles.makeCar(0xc0392b, false);
        mesh.position.set(x, 0, z);
        mesh.rotation.y = heading;
        this.scene.add(mesh);
        CB.Vehicles.parked.push({ mesh: mesh, x: x, z: z, heading: heading, stolen: false, carClass: 'sedan' });
        found = { car: CB.Vehicles.parked[CB.Vehicles.parked.length - 1], isTraffic: false };
      }
      p.enterCar(found);
      p.car.x = x; p.car.z = z; p.car.heading = heading;
      p.x = x; p.z = z; p.heading = heading;
    },

    stageShot: function (shot) {
      const p = this.player;
      CB.AudioSys.init();
      this.state = 'playing';
      CB.HUD.hideTitle();
      CB.HUD.showHud(true);
      if (shot === 'cover') {
        this.ensureCar(-3.4, -72, 0);
        this.input.w = true;
        this.shotReadyAt = 3.0;
      } else if (shot === 'chase') {
        this.ensureCar(3.4, 0, Math.PI);
        CB.Police.setWanted(3);
        // Cops close behind the player so the chase reads in the shot.
        for (let i = 0; i < 3; i++) {
          const cop = CB.Police.spawnCop(p.x, p.z);
          cop.x = p.x + (i - 1) * 7;
          cop.z = p.z + 26 + i * 6;
          cop.heading = Math.PI;
          cop.mesh.position.set(cop.x, 0, cop.z);
        }
        // Camera in front of the car, looking back at it and the cops behind.
        p.camYaw = Math.PI;
        this.input.w = true;
        this.shotReadyAt = 2.2;
      } else if (shot === 'mission') {
        p.reset(24, 242, 0);
        p.camYaw = 0;
        p.zoom = 1.0;
        this.shotReadyAt = 2.0;
      } else if (shot === 'city') {
        this.shotReadyAt = 1.5;
      }
    },

    tick: function (dt) {
      this.time += dt;
      const p = this.player;
      if (this.state === 'title') {
        // Attract mode: slow orbit over the plaza for the title screen.
        const a = this.time * 0.05;
        this.camera.position.set(Math.sin(a) * 90, 42, 8 + Math.cos(a) * 90);
        this.camera.lookAt(0, 4, 40);
        CB.People.update(dt, this.city, this.rng, null);
        CB.Vehicles.update(dt, this.city, this.rng, null);
        return;
      }
      if (this.state !== 'playing') return;

      // Shot mode: the car drives itself; the city shot uses a fixed aerial camera.
      if (this.shot === 'city') {
        this.camera.position.set(150, 150, 330);
        this.camera.lookAt(-20, 0, 60);
      }

      if (p.inCar) p.updateDriving(dt, this.input);
      else p.updateOnFoot(dt, this.input, this.camera);
      p.updateEffects(dt);

      // Interact prompt.
      if (!p.inCar) {
        const found = CB.Vehicles.nearestCar(p.x, p.z, 4.5, true);
        CB.HUD.setInteract(found ? 'E — Steal car' : null);
      } else {
        CB.HUD.setInteract(null);
      }

      // Health regen when the heat is off.
      if (CB.Police.wanted === 0 && p.health < CFG.playerHealth) {
        p.health = Math.min(CFG.playerHealth, p.health + 4 * dt);
      }

      // Danger for pedestrians: gunfire (set by Player.shoot) or a car
      // speeding past — both send nearby peds running.
      let danger = this.lastDanger;
      if (p.inCar && Math.abs(p.carSpeed) > 12) {
        danger = { x: p.x, z: p.z, radius: 16, kind: 'car' };
      }
      this.lastDanger = null;
      CB.People.update(dt, this.city, this.rng, danger);
      CB.Vehicles.update(dt, this.city, this.rng, p.inCar ? { x: p.x, z: p.z } : null);
      CB.Police.update(dt, p);
      CB.Missions.update(dt, p);
      CB.Pickups.update(dt, p);
      CB.HUD.update(p);
      if (this.shot === 'city') { /* camera already set */ }
      else p.updateCamera(dt, this.camera);

      if (this.saveDirty && this.time % 10 < dt) this.writeSave();

      // Screenshot readiness. The mission banner is re-shown here so it is
      // still on screen when the shot is taken (real time runs faster than
      // game time under software rendering).
      if (this.shot && !this.shotDone && this.time >= this.shotReadyAt) {
        this.shotDone = true;
        if (this.shot === 'mission') {
          CB.HUD.banner('FIRST WHEELS', 'Marco is waiting at the pier. He has a job — but first, you need wheels.');
        }
        window.__shotReady = true;
      }
    },
  };

  CB.Game = Game;
  window.addEventListener('DOMContentLoaded', function () { Game.boot(); });
})();
