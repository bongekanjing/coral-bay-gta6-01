// Coral Bay — police.js
// One clear job: the wanted system and the Coral Bay PD. Stars rise when the
// player steals, shoots or mows people down; police cars spawn at the city
// edge, chase and ram the player, and on foot a cop that stays close busts
// them. Stars fall when the player stays out of sight and out of trouble.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  const Police = {
    wanted: 0,
    cops: [],
    scene: null,
    city: null,
    rng: null,
    lastCrimeAt: -100,
    hiddenTimer: 0,
    bustedTimer: 0,
    nearestCopDist: 999,
    flashT: 0,

    init: function (scene, city, rng) {
      this.scene = scene;
      this.city = city;
      this.rng = rng;
      this.cops = [];
      this.wanted = 0;
    },

    setWanted: function (n) {
      const before = this.wanted;
      this.wanted = CB.clamp(Math.round(n), 0, CFG.maxWanted);
      if (this.wanted > before) this.lastCrimeAt = CB.Game.time;
    },

    addWanted: function (n) {
      this.setWanted(this.wanted + n);
      this.lastCrimeAt = CB.Game.time;
    },

    wantedCount: function () {
      // 1 star: 1 car; 2: 2; 3: 3; 4-5: 4.
      return this.wanted === 0 ? 0 : Math.min(4, this.wanted);
    },

    spawnCop: function (nearX, nearZ) {
      const rng = this.rng;
      // Spawn on a road at the city edge, roughly behind the player.
      let x = 0, z = 0;
      for (let tries = 0; tries < 10; tries++) {
        const edge = Math.floor(rng() * 4);
        const along = CB.range(rng, -200, 200);
        if (edge === 0) { x = along; z = -216; }
        if (edge === 1) { x = along; z = 216; }
        if (edge === 2) { x = -216; z = along; }
        if (edge === 3) { x = 216; z = along; }
        if (Math.hypot(x - nearX, z - nearZ) > 60) break;
      }
      const mesh = CB.Vehicles.makeCar(0, true);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const cop = {
        mesh: mesh, x: x, z: z,
        heading: Math.atan2(nearX - x, nearZ - z),
        speed: 0,
        stuckTimer: 0,
        lastX: x, lastZ: z,
      };
      this.cops.push(cop);
      return cop;
    },

    removeCop: function (cop) {
      this.scene.remove(cop.mesh);
      const i = this.cops.indexOf(cop);
      if (i >= 0) this.cops.splice(i, 1);
    },

    update: function (dt, player) {
      const rng = this.rng;
      this.flashT += dt;
      // Keep the right number of cop cars on the road.
      const want = this.wantedCount();
      while (this.cops.length < want) this.spawnCop(player.x, player.z);
      while (this.cops.length > want) this.removeCop(this.cops[this.cops.length - 1]);

      this.nearestCopDist = 999;
      let bustedNear = false;
      for (const cop of this.cops) {
        const dx = player.x - cop.x, dz = player.z - cop.z;
        const dist = Math.hypot(dx, dz);
        this.nearestCopDist = Math.min(this.nearestCopDist, dist);
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - cop.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        // Cops steer hard but not perfectly, so a good driver can lose them.
        cop.heading += CB.clamp(dh, -2.6 * dt, 2.6 * dt);
        const target = this.wanted >= 4 ? CFG.copTopSpeed : CFG.copTopSpeed - 3;
        cop.speed += (target - cop.speed) * Math.min(1, dt * 0.9);
        cop.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.z += Math.cos(cop.heading) * cop.speed * dt;
        // Buildings stop cops too.
        const before = { x: cop.x, z: cop.z };
        if (CB.Vehicles.collideBuildings(this.city, cop, 1.7)) {
          cop.speed *= 0.5;
        }
        CB.Vehicles.clampToBounds(cop, 1.7);
        // Stuck detection: if barely moving, reverse out for a moment.
        const moved = Math.hypot(cop.x - cop.lastX, cop.z - cop.lastZ);
        if (moved < 0.4 * dt * 10 && cop.speed > 5) {
          cop.stuckTimer += dt;
          if (cop.stuckTimer > 1.2) {
            cop.heading += Math.PI * 0.7;
            cop.stuckTimer = 0;
          }
        } else {
          cop.stuckTimer = 0;
        }
        cop.lastX = cop.x; cop.lastZ = cop.z;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        for (const w of cop.mesh.userData.wheels) w.rotation.x += cop.speed * dt * 2.4;
        // Flashing light bar.
        const on = Math.sin(this.flashT * 10) > 0;
        cop.mesh.userData.lightRed.material.emissive.setHex(on ? 0xff0000 : 0x220000);
        cop.mesh.userData.lightBlue.material.emissive.setHex(on ? 0x000022 : 0x0022ff);
        // Ramming the player.
        if (dist < 3.4) {
          if (player.inCar) {
            const px = dx / (dist || 1), pz = dz / (dist || 1);
            player.x += px * 6 * dt;
            player.z += pz * 6 * dt;
            player.carSpeed *= 0.82;
            player.carHealth -= CFG.copRamDamage * dt * 2;
            CB.AudioSys.crash(false);
          } else {
            // On foot the cop pulls up alongside and holds you: no shove, so
            // the busted timer below can actually accumulate.
            cop.speed *= 0.8;
            bustedNear = dist < 3.2;
          }
        }
        void before;
      }

      // Busted: on foot, a cop parked on top of you for a while.
      if (!player.inCar && this.wanted > 0 && this.nearestCopDist < 3.2) {
        this.bustedTimer += dt;
        if (this.bustedTimer >= CFG.bustedHold) {
          this.bustedTimer = 0;
          CB.Game.busted();
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }

      // Wanted decay: hidden and quiet for a while, stars bleed off.
      if (this.wanted > 0) {
        const quietFor = CB.Game.time - this.lastCrimeAt;
        if (this.nearestCopDist > 55 && quietFor > CFG.wantedDecayDelay) {
          this.hiddenTimer += dt;
          if (this.hiddenTimer >= CFG.wantedDecayStep) {
            this.hiddenTimer = 0;
            this.setWanted(this.wanted - 1);
            CB.HUD.flashObjective('The heat is cooling off…');
          }
        } else {
          this.hiddenTimer = 0;
        }
      }

      // Siren when a cop is close.
      CB.AudioSys.sirenSet(this.wanted > 0 && this.nearestCopDist < 90);
    },

    clearAll: function () {
      while (this.cops.length) this.removeCop(this.cops[0]);
      this.wanted = 0;
      this.bustedTimer = 0;
      this.hiddenTimer = 0;
    },
  };

  CB.Police = Police;
})();
