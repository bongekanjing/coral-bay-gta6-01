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
      // One shared glow light that hovers over the nearest cop car and
      // alternates red/blue with the light bars, so a chase reads at night
      // and at golden hour alike.
      this.sirenLight = new THREE.PointLight(0xff2222, 0, 42);
      this.sirenLight.position.set(0, 4, 0);
      scene.add(this.sirenLight);
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
        // Flashing light bar: a proper wig-wag — red on, both off, blue on,
        // both off — speeding up as the wanted level climbs, so 5 stars
        // strobe visibly faster than 1. The glow light matches the bar.
        const cycle = (this.flashT * (7 + this.wanted * 2.5)) % 1;
        const redOn = cycle < 0.4;
        const blueOn = cycle >= 0.5 && cycle < 0.9;
        cop.mesh.userData.lightRed.material.emissive.setHex(redOn ? 0xff0000 : 0x220000);
        cop.mesh.userData.lightBlue.material.emissive.setHex(blueOn ? 0x0022ff : 0x000022);
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
      // The glow light follows the nearest cop and matches the bar's colour.
      if (this.cops.length && this.wanted > 0) {
        let near = this.cops[0], nd = Infinity;
        for (const cop of this.cops) {
          const d = Math.hypot(cop.x - player.x, cop.z - player.z);
          if (d < nd) { nd = d; near = cop; }
        }
        const cycle = (this.flashT * (7 + this.wanted * 2.5)) % 1;
        this.sirenLight.position.set(near.x, 3.2, near.z);
        this.sirenLight.color.setHex(cycle < 0.4 ? 0xff2222 : cycle < 0.9 ? 0x2266ff : 0xff2222);
        this.sirenLight.intensity = (cycle < 0.4 || (cycle >= 0.5 && cycle < 0.9)) ? 1.4 : 0;
      } else {
        this.sirenLight.intensity = 0;
      }
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

// ---- Coral Bay v3: police helicopter ---------------------------------------
(function () {
  'use strict';
  const CB = window.CB;
  const THREE = window.THREE;

  function buildHeli(scene) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2f4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.5, 4.6), bodyMat);
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9fd4ff }));
    glass.position.set(0, 0.35, 1.6);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.2), bodyMat);
    tail.position.set(0, 0.3, -4.2);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 1.1), bodyMat);
    fin.position.set(0, 1.0, -6.0);
    g.add(fin);
    for (const sx of [-1.2, 1.2]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      skid.position.set(sx, -1.0, 0);
      g.add(skid);
    }
    const rotor = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    mast.position.y = 0.3;
    rotor.add(mast);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const ry of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.07, 0.55), bladeMat);
      blade.rotation.y = ry;
      rotor.add(blade);
    }
    rotor.position.y = 1.05;
    g.add(rotor);
    g.userData.rotor = rotor;
    const beam = new THREE.SpotLight(0xfff6c8, 0, 70, 0.42, 0.5, 1.1);
    scene.add(beam);
    const beamTarget = new THREE.Object3D();
    scene.add(beamTarget);
    beam.target = beamTarget;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 20, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true,
        opacity: 0.15, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(cone);
    g.userData.beam = beam;
    g.userData.beamTarget = beamTarget;
    g.userData.cone = cone;
    scene.add(g);
    return g;
  }

  function removeHeli(P) {
    if (!P.heli) return;
    const H = P.heli;
    P.scene.remove(H.mesh);
    P.scene.remove(H.beam);
    P.scene.remove(H.cone);
    P.scene.remove(H.target);
    P.heli = null;
    const warn = document.getElementById('heli-warn');
    if (warn) warn.style.display = 'none';
    if (CB.AudioSys.rotorSet) CB.AudioSys.rotorSet(false);
  }

  const baseUpdate = CB.Police.update;
  CB.Police.update = function (dt, player) {
    baseUpdate.call(this, dt, player);
    if (this.wanted >= CB.CFG.heliSpawnStars && !this.heli) {
      const mesh = buildHeli(this.scene);
      this.heli = { mesh: mesh, angle: -0.66, beam: mesh.userData.beam,
        cone: mesh.userData.cone, target: mesh.userData.beamTarget };
      const warn = document.getElementById('heli-warn');
      if (warn) warn.style.display = 'block';
      CB.HUD.banner('POLICE HELICOPTER', 'Air support is overhead — break line of sight and lay low.');
      if (CB.AudioSys.rotorSet) CB.AudioSys.rotorSet(true);
    } else if (this.wanted < CB.CFG.heliSpawnStars && this.heli) {
      removeHeli(this);
    }
    if (this.heli) {
      const H = this.heli;
      H.angle += dt * 0.3;
      const hx = player.x + Math.sin(H.angle) * CB.CFG.heliOrbitRadius;
      const hz = player.z + Math.cos(H.angle) * CB.CFG.heliOrbitRadius;
      const hy = CB.CFG.heliHeight + Math.sin(CB.Game.time * 0.7) * 1.5;
      H.mesh.position.set(hx, hy, hz);
      H.mesh.rotation.y = Math.atan2(player.x - hx, player.z - hz);
      H.mesh.userData.rotor.rotation.y += dt * 26;
      H.beam.position.set(hx, hy - 0.5, hz);
      H.beam.intensity = 3;
      H.target.position.set(player.x, 0.5, player.z);
      const dx = hx - player.x, dy = hy - 0.5, dz = hz - player.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const cone = H.cone;
      cone.position.set((hx + player.x) / 2, (hy + 0.5) / 2, (hz + player.z) / 2);
      cone.scale.set(1, dist / 20, 1);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(dx / dist, dy / dist, dz / dist));
    }
  };

  const baseClear = CB.Police.clearAll;
  CB.Police.clearAll = function () {
    removeHeli(this);
    baseClear.call(this);
  };
})();
