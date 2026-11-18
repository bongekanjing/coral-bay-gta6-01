// Coral Bay — missions.js
// One clear job: the story and the jobs. Three story missions for Dario Cole
// (meet Marco, steal wheels, run the drop, lose the heat), repeatable taxi
// fares, and ten hidden stash packages. Objectives, markers, timers, rewards
// and the story text all live here.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  const STORY = [
    {
      id: 'm1',
      title: 'FIRST WHEELS',
      intro: 'Marco is waiting at the pier. He has a job — but first, you need wheels.',
      steps: [
        { text: 'Meet Marco at the pier', loc: 'marcoPier', radius: 6 },
        { text: 'Steal a car (press E near one)', kind: 'stealCar' },
        { text: 'Drive to the garage on Marlin Ave', loc: 'garage', radius: 7, inCar: true },
      ],
    },
    {
      id: 'm2',
      title: 'THE DROP',
      intro: 'A package for the Coral Hotel. Fast, quiet, no cops. 100 seconds.',
      steps: [
        { text: 'Get in a car', kind: 'inCar' },
        { text: 'Deliver the package to the Coral Hotel', loc: 'hotel', radius: 7, inCar: true, time: 100 },
      ],
    },
    {
      id: 'm3',
      title: 'HEAT RUN',
      intro: 'The Kroll crew tipped off the PD. Three stars. Lose them, then vanish.',
      steps: [
        { text: 'Lose the heat — get your wanted level to zero', kind: 'loseHeat', setWanted: 3 },
        { text: 'Reach the safehouse on Gull Street', loc: 'safehouse', radius: 7 },
      ],
    },
    {
      id: 'm4',
      title: 'THE VAULT',
      intro: 'Marco has the Coral Bank cased. Wheels, a fast run, the vault — then gone.',
      steps: [
        { text: 'Steal a car for the job', kind: 'stealCar' },
        { text: 'Reach the Coral Bank — 120 seconds', loc: 'bank', radius: 8, inCar: true, time: 120 },
        { text: 'Get inside on foot — reach the vault door', loc: 'bankVault', radius: 5, kind: 'vault', onFoot: true },
        { text: 'Lose the heat and reach the safehouse', loc: 'safehouse', radius: 7 },
      ],
    },
    { id: 'm5', title: 'KING OF THE BAY',
      intro: 'One last job. Four stars behind you, one getaway ahead — then the city is yours.',
      steps: [
        { text: 'Marco waits at the pier for the last job', loc: 'marcoPier', radius: 6 },
        { text: 'Shake the heat until every star is gone', kind: 'loseHeat', setWanted: 4 },
        { text: 'Getaway drive to the Coral Hotel', loc: 'hotel', radius: 7, inCar: true },
        { text: 'Victory lap — back to the plaza', loc: 'plaza', radius: 8 },
      ] },
    { id: 'm6', title: 'HARBOUR LIGHTS',
      intro: 'A van full of cargo waits at the port. Take it, haul it to the Coral Hotel, lose the heat, and slip back to the pier.',
      steps: [
        { text: 'Drive out to the port on the west edge', loc: 'port', radius: 10 },
        { text: 'Steal a van for the haul', kind: 'stealVan' },
        { text: 'Haul the cargo to the Coral Hotel', loc: 'hotel', radius: 7, inCar: true, time: 120 },
        { text: 'Lose the heat, then reach the pier', loc: 'marcoPier', radius: 6, kind: 'loseHeat' },
      ] }];

  const Missions = {
    scene: null,
    city: null,
    rng: null,
    index: 0,           // story mission index (0..3, 3 = story done)
    step: 0,
    active: false,
    beacon: null,
    beaconRing: null,
    markerPos: null,
    stepTimer: 0,
    taxi: null,         // {state, ped, dest, timer, fare}
    taxiCooldown: 12,
    courier: null,       // {state, crate, pickup, dest, timer, fare}
    courierCooldown: CFG.courierCooldown,
    stashes: [],
    stashCollected: 0,
    objectiveText: '',
    onMissionComplete: null,

    init: function (scene, city, rng, save) {
      this.scene = scene;
      this.city = city;
      this.rng = rng;
      this.index = save && save.missionsDone ? Math.min(save.missionsDone, STORY.length) : 0;
      this.stashCollected = 0;
      // Beacon: a glowing pillar and a pulsing ring at the objective.
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xffc21a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
      this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true), beaconMat);
      this.beacon.visible = false;
      scene.add(this.beacon);
      this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 24),
        new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      this.beaconRing.rotation.x = -Math.PI / 2;
      this.beaconRing.visible = false;
      scene.add(this.beaconRing);
      // Stash packages: small glowing crates tucked around the city.
      const stashMat = new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x1e8449 });
      const savedStashes = (save && save.stashes) || [];
      for (let k = 0; k < CFG.stashCount; k++) {
        const spot = city.sidewalkSpots[Math.floor(rng() * city.sidewalkSpots.length)];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), stashMat);
        mesh.position.set(spot.x, 0.5, spot.z);
        mesh.rotation.y = rng() * Math.PI;
        mesh.visible = savedStashes.indexOf(k) === -1;
        scene.add(mesh);
        this.stashes.push({ mesh: mesh, x: spot.x, z: spot.z, id: k, taken: savedStashes.indexOf(k) !== -1 });
        if (mesh.visible === false) this.stashCollected++;
      }
      this.startStory();
    },

    startStory: function () {
      if (this.index >= STORY.length) {
        this.active = false;
        this.objectiveText = 'Story complete — free roam. Taxi fares, courier runs and stashes pay cash.';
        this.setMarker(null);
        return;
      }
      this.active = true;
      this.step = 0;
      const m = STORY[this.index];
      CB.HUD.banner(m.title, m.intro);
      CB.AudioSys.missionSting();
      this.applyStep();
    },

    applyStep: function () {
      const m = STORY[this.index];
      const s = m.steps[this.step];
      this.stepTimer = s.time || 0;
      this.objectiveText = s.text;
      if (s.loc) {
        const loc = this.city.locations[s.loc];
        this.setMarker(loc);
      } else {
        this.setMarker(null);
      }
      // A step can open with heat on (m3: 3 stars, m5: 4 stars).
      if (s.setWanted) {
        CB.Police.setWanted(s.setWanted);
      }
    },

    setMarker: function (loc) {
      this.markerPos = loc || null;
      this.beacon.visible = !!loc;
      this.beaconRing.visible = !!loc;
      if (loc) {
        this.beacon.position.set(loc.x, 21, loc.z);
        this.beaconRing.position.set(loc.x, 0.15, loc.z);
      }
    },

    completeStep: function () {
      CB.AudioSys.chime();
      const m = STORY[this.index];
      // Grabbing the vault trips the alarm: three stars the moment you leave.
      if (m.steps[this.step].kind === 'vault') {
        CB.Police.setWanted(3);
        CB.HUD.flashObjective('The vault alarm is screaming — the PD is coming!');
      }
      this.step++;
      if (this.step >= m.steps.length) {
        const reward = CFG.missionRewards[this.index];
        CB.Game.addCash(reward);
        CB.HUD.banner('MISSION COMPLETE', m.title + ' — +$' + reward);
        CB.AudioSys.missionSting();
        this.index++;
        // Save AFTER the index moves, or a returning player replays the
        // mission they just finished (cash was saved pre-increment).
        CB.Game.save();
        if (this.onMissionComplete) this.onMissionComplete(this.index);
        const self = this;
        setTimeout(function () { self.startStory(); }, 2200);
        this.active = false;
        this.objectiveText = '';
        this.setMarker(null);
      } else {
        this.applyStep();
      }
    },

    failMission: function (why) {
      CB.AudioSys.failSting();
      CB.HUD.banner('MISSION FAILED', why);
      const self = this;
      setTimeout(function () {
        self.step = 0;
        self.applyStep();
        CB.HUD.banner(STORY[self.index].title, 'Try again — ' + STORY[self.index].intro);
      }, 2200);
      this.active = false;
      this.setMarker(null);
    },

    // Called every frame with the player's state.
    update: function (dt, player) {
      // Beacon pulse.
      if (this.beacon.visible) {
        const s = 1 + Math.sin(CB.Game.time * 3) * 0.12;
        this.beaconRing.scale.set(s, s, 1);
        this.beacon.material.opacity = 0.28 + Math.sin(CB.Game.time * 3) * 0.08;
      }
      if (this.active === true) {
        const cur = STORY[this.index];
        const step = cur.steps[this.step];
        if (!step) { this.active = false; return; }
        if (step.time) {
          this.stepTimer = this.stepTimer - dt;
          if (this.stepTimer <= 0) { this.failMission('Out of time — ' + cur.title + ' ran out.'); return; }
        }
        let done = false;
        const kind = step.kind || '';
        if (kind === 'stealVan') {
          done = player.inCar && !!player.car && player.car.carClass === 'van';
        } else if (kind === 'loseHeat' && step.loc) {
          const lp = this.city.locations[step.loc];
          done = CB.Police.wanted === 0 && Math.hypot(player.x - lp.x, player.z - lp.z) < step.radius;
        } else if (step.loc) {
          const lp = this.city.locations[step.loc];
          const dd = Math.hypot(player.x - lp.x, player.z - lp.z);
          done = dd < step.radius && (!step.inCar || player.inCar) && (!step.onFoot || !player.inCar);
        } else if (kind === 'stealCar') {
          done = player.inCar && player.carStolen;
        } else if (kind === 'inCar') {
          done = player.inCar;
        } else if (kind === 'loseHeat') {
          done = CB.Police.wanted === 0;
        }
        if (done) this.completeStep();
      }
      // Taxi fares: a fare appears after the first mission, every so often.
      this.taxiCooldown -= dt;
      if (this.index >= 1 && !this.taxi && !this.courier && this.taxiCooldown <= 0) {
        this.spawnTaxi();
      }
      if (this.taxi) this.updateTaxi(dt, player);
      // Courier runs: a timed parcel delivery, unlocked after mission 2.
      this.courierCooldown -= dt;
      if (this.index >= 2 && !this.courier && !this.taxi && this.courierCooldown <= 0) {
        this.spawnCourier();
      }
      if (this.courier) this.updateCourier(dt, player);
      // Stashes: walk over one to collect it.
      for (const st of this.stashes) {
        if (st.taken) continue;
        if (Math.hypot(player.x - st.x, player.z - st.z) < 2.2) {
          st.taken = true;
          st.mesh.visible = false;
          this.stashCollected++;
          CB.Game.addCash(CFG.stashReward);
          CB.HUD.flashObjective('Stash found! +$' + CFG.stashReward +
            ' (' + this.stashCollected + '/' + CFG.stashCount + ')');
          CB.AudioSys.chime();
          CB.Game.save();
        }
      }
    },

    spawnTaxi: function () {
      const ped = CB.People.nearest(
        CB.Game.player.x + CB.range(this.rng, -40, 40),
        CB.Game.player.z + CB.range(this.rng, -40, 40), 60);
      if (!ped) { this.taxiCooldown = 8; return; }
      const dest = this.city.intersections[Math.floor(this.rng() * this.city.intersections.length)];
      const fare = CB.range(this.rng, CFG.taxiFare[0], CFG.taxiFare[1]) | 0;
      this.taxi = { state: 'waiting', ped: ped, dest: dest, fare: fare, timer: 0 };
      ped.state = 'waitTaxi';
      CB.HUD.flashObjective('Taxi fare waiting nearby — drive up to pick them up');
      this.setMarker({ x: ped.x, z: ped.z });
    },

    updateTaxi: function (dt, player) {
      const t = this.taxi;
      if (t.state === 'waiting') {
        this.setMarker({ x: t.ped.x, z: t.ped.z });
        if (Math.hypot(player.x - t.ped.x, player.z - t.ped.z) < 3.5 && player.inCar) {
          t.state = 'riding';
          t.timer = 75;
          CB.HUD.flashObjective('Fare aboard! Drive to the marker — $' + t.fare);
          CB.AudioSys.chime();
          this.setMarker({ x: t.dest.x, z: t.dest.z });
        }
      } else if (t.state === 'riding') {
        t.timer -= dt;
        this.setMarker({ x: t.dest.x, z: t.dest.z });
        // The passenger rides in the car: keep them near the player.
        t.ped.x = player.x; t.ped.z = player.z;
        t.ped.mesh.position.set(player.x, 0, player.z);
        t.ped.mesh.visible = false;
        if (Math.hypot(player.x - t.dest.x, player.z - t.dest.z) < 8 && player.inCar) {
          CB.Game.addCash(t.fare);
          CB.HUD.flashObjective('Fare complete! +$' + t.fare);
          CB.AudioSys.chime();
          this.endTaxi();
        } else if (t.timer <= 0) {
          CB.HUD.flashObjective('The fare gave up and walked off.');
          this.endTaxi();
        }
      }
    },

    endTaxi: function () {
      if (this.taxi && this.taxi.ped) {
        const ped = this.taxi.ped;
        ped.mesh.visible = true;
        ped.state = 'walk';
        ped.target = null;
      }
      this.taxi = null;
      this.taxiCooldown = 25;
      if (this.active) this.applyStep(); else this.setMarker(null);
    },

    taxiTimerText: function () {
      if (this.taxi && this.taxi.state === 'riding') return Math.ceil(this.taxi.timer) + 's';
      return '';
    },

    courierTimerText: function () {
      if (this.courier && this.courier.state === 'deliver') return Math.ceil(this.courier.timer) + 's';
      return '';
    },

    // Step-by-step tracker data for the HUD panel: title, each step's text,
    // which are done and which is current, plus any live side job.
    trackerData: function () {
      const steps = [];
      if (this.index >= STORY.length) {
        steps.push({ text: 'Story complete — the city is yours.', done: true, current: false });
      } else {
        const m = STORY[this.index];
        for (let i = 0; i < m.steps.length; i++) {
          steps.push({ text: m.steps[i].text, done: i < this.step, current: this.active && i === this.step });
        }
        if (!this.active) steps.push({ text: 'Next mission starting…', done: false, current: true });
      }
      if (this.taxi) {
        steps.push({ text: this.taxi.state === 'waiting' ?
          'Taxi fare waiting — pick them up' :
          'Taxi fare aboard — drop them off ($' + this.taxi.fare + ')', done: false, current: true });
      }
      if (this.courier) {
        steps.push({ text: this.courier.state === 'pickup' ?
          'Courier parcel waiting — grab it' :
          'Courier run — deliver it fast ($' + this.courier.fare + ')', done: false, current: true });
      }
      return { title: this.index >= STORY.length ? 'FREE ROAM' : STORY[this.index].title, steps: steps };
    },

    // ---- courier runs ------------------------------------------------------
    spawnCourier: function () {
      const spots = this.city.sidewalkSpots;
      const near = spots[Math.floor(this.rng() * spots.length)];
      const dest = this.city.intersections[Math.floor(this.rng() * this.city.intersections.length)];
      const fare = Math.round(CB.range(this.rng, CFG.courierFare[0], CFG.courierFare[1]));
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1),
        new THREE.MeshLambertMaterial({ color: 0xe67e22, emissive: 0x7e5109 }));
      crate.position.set(near.x, 0.6, near.z);
      this.scene.add(crate);
      this.courier = { state: 'pickup', crate: crate, pickup: { x: near.x, z: near.z },
        dest: dest, fare: fare, timer: 0 };
      CB.HUD.flashObjective('Courier parcel waiting nearby — grab it, then deliver fast');
      this.setMarker({ x: near.x, z: near.z });
    },

    updateCourier: function (dt, player) {
      const c = this.courier;
      if (c.state === 'pickup') {
        this.setMarker({ x: c.pickup.x, z: c.pickup.z });
        c.crate.rotation.y += dt * 1.5;
        if (Math.hypot(player.x - c.pickup.x, player.z - c.pickup.z) < 3) {
          c.state = 'deliver';
          c.timer = CFG.courierTime;
          c.crate.visible = false;
          CB.HUD.flashObjective('Parcel aboard! Deliver it in ' + CFG.courierTime + 's — $' + c.fare);
          CB.AudioSys.chime();
          this.setMarker({ x: c.dest.x, z: c.dest.z });
        }
      } else if (c.state === 'deliver') {
        c.timer -= dt;
        this.setMarker({ x: c.dest.x, z: c.dest.z });
        if (Math.hypot(player.x - c.dest.x, player.z - c.dest.z) < 8) {
          CB.Game.addCash(c.fare);
          CB.HUD.flashObjective('Parcel delivered! +$' + c.fare);
          CB.AudioSys.chime();
          this.endCourier();
        } else if (c.timer <= 0) {
          CB.HUD.flashObjective('Too slow — the client cancelled the run.');
          this.endCourier();
        }
      }
    },

    endCourier: function () {
      if (this.courier) {
        this.scene.remove(this.courier.crate);
        this.courier = null;
      }
      this.courierCooldown = CFG.courierCooldown;
      if (this.active) this.applyStep(); else this.setMarker(null);
    },

    missionTimerText: function () {
      if (this.active) {
        const m = STORY[this.index];
        const s = m.steps[this.step];
        if (s.time) return Math.ceil(this.stepTimer) + 's';
      }
      return '';
    },
  };

  CB.Missions = Missions;
})();

// ---- Coral Bay v3: street races --------------------------------------------
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;

  CB.Missions.race = null;
  CB.Missions.raceCooldown = 20;
  CB.Missions.raceBest = null;
  try {
    const saved = localStorage.getItem('coralbay-race-best');
    if (saved) CB.Missions.raceBest = parseFloat(saved);
  } catch (e) {}

  const baseUpdate = CB.Missions.update;
  CB.Missions.update = function (dt, player) {
    baseUpdate.call(this, dt, player);
    const M = CB.Missions;
    if (M.raceCooldown > 0) M.raceCooldown -= dt;
    if (!M.race) {
      const g = this.city.locations.raceGate;
      if (player.inCar && M.raceCooldown <= 0 && g &&
        Math.hypot(player.x - g.x, player.z - g.z) < 6) {
        M.race = { cp: 0, t: 0 };
        CB.HUD.flashObjective('Street race! Hit all 4 checkpoints — beat 75s for a bonus.');
        CB.AudioSys.chime();
        const first = CFG.raceCheckpoints[0];
        this.setMarker({ x: first[0], z: first[1] });
      }
      return;
    }
    M.race.t += dt;
    const cp = CFG.raceCheckpoints[M.race.cp];
    this.setMarker({ x: cp[0], z: cp[1] });
    if (Math.hypot(player.x - cp[0], player.z - cp[1]) < 9) {
      M.race.cp += 1;
      CB.AudioSys.chime();
      if (M.race.cp >= CFG.raceCheckpoints.length) {
        const t = M.race.t;
        const prize = CFG.racePrize + (t < CFG.raceParTime ? CFG.raceParBonus : 0);
        CB.Game.addCash(prize);
        if (CB.AudioSys.raceFanfare) CB.AudioSys.raceFanfare();
        if (M.raceBest === null || t < M.raceBest) {
          M.raceBest = Math.round(t * 10) / 10;
          try { localStorage.setItem('coralbay-race-best', String(M.raceBest)); } catch (e) {}
        }
        CB.HUD.banner('RACE WON', 'Finished in ' + t.toFixed(1) + 's — +$' + prize +
          (M.raceBest === Math.round(t * 10) / 10 ? ' · new best!' : ''));
        M.race = null;
        M.raceCooldown = 20;
        if (M.active) M.applyStep();
        else M.setMarker(null);
      } else {
        CB.HUD.flashObjective('Checkpoint ' + M.race.cp + '/4 — keep going!');
      }
    }
  };
})();
