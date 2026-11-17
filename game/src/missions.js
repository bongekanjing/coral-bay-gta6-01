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
        { text: 'Lose the heat — get your wanted level to zero', kind: 'loseHeat' },
        { text: 'Reach the safehouse on Gull Street', loc: 'safehouse', radius: 7 },
      ],
    },
  ];

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
    stashes: [],
    stashCollected: 0,
    objectiveText: '',
    onMissionComplete: null,

    init: function (scene, city, rng, save) {
      this.scene = scene;
      this.city = city;
      this.rng = rng;
      this.index = save && save.missionsDone ? Math.min(save.missionsDone, 3) : 0;
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
        this.objectiveText = 'Story complete — free roam. Taxi fares and stashes pay cash.';
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
      if (m.id === 'm3' && this.step === 0) {
        CB.Police.setWanted(3);
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
      this.step++;
      if (this.step >= m.steps.length) {
        const reward = CFG.missionRewards[this.index];
        CB.Game.addCash(reward);
        CB.HUD.banner('MISSION COMPLETE', m.title + ' — +$' + reward);
        CB.AudioSys.missionSting();
        this.index++;
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
      // Story step logic.
      if (this.active) {
        const m = STORY[this.index];
        const s = m.steps[this.step];
        if (!s) { this.active = false; return; }
        if (s.time) {
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) {
            this.failMission('Out of time on ' + m.title + '.');
            return;
          }
        }
        if (s.loc) {
          const loc = this.city.locations[s.loc];
          const d = Math.hypot(player.x - loc.x, player.z - loc.z);
          if (d < s.radius && (!s.inCar || player.inCar)) this.completeStep();
        } else if (s.kind === 'stealCar' && player.inCar && player.carStolen) {
          this.completeStep();
        } else if (s.kind === 'inCar' && player.inCar) {
          this.completeStep();
        } else if (s.kind === 'loseHeat' && CB.Police.wanted === 0) {
          this.completeStep();
        }
      }
      // Taxi fares: a fare appears after the first mission, every so often.
      this.taxiCooldown -= dt;
      if (this.index >= 1 && !this.taxi && this.taxiCooldown <= 0) {
        this.spawnTaxi();
      }
      if (this.taxi) this.updateTaxi(dt, player);
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
