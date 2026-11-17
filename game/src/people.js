// Coral Bay — people.js
// One clear job: the people. A low-poly person model factory (the player and
// every pedestrian share it), the pedestrian crowd that strolls the sidewalks,
// and the way peds react — fleeing from gunfire and near-miss cars, falling
// when shot or hit.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  // A simple readable person: head, torso, arms, legs, in one colour scheme.
  // The player's figure wears a teal jacket; peds wear random colours.
  function makePerson(jacket, trousers, skin) {
    const g = new THREE.Group();
    const jacketMat = new THREE.MeshLambertMaterial({ color: jacket });
    const trouserMat = new THREE.MeshLambertMaterial({ color: trousers });
    const skinMat = new THREE.MeshLambertMaterial({ color: skin || 0xc98d64 });
    // Legs.
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.22), trouserMat);
    legL.position.set(-0.14, 0.4, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    g.add(legL); g.add(legR);
    // Torso.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacketMat);
    torso.position.y = 1.16;
    g.add(torso);
    // Arms.
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), jacketMat);
    armL.position.set(-0.4, 1.16, 0);
    const armR = armL.clone();
    armR.position.x = 0.4;
    g.add(armL); g.add(armR);
    // Head.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
    head.position.y = 1.78;
    g.add(head);
    // Hair cap.
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshLambertMaterial({ color: 0x2a1a12 }));
    hair.position.y = 1.82;
    g.add(hair);
    // Blob shadow.
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR, torso: torso, head: head };
    return g;
  }

  function animateWalk(person, phase, speedRatio) {
    const u = person.userData;
    const swing = Math.sin(phase) * 0.55 * speedRatio;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
  }

  function animateIdle(person, t) {
    const u = person.userData;
    u.legL.rotation.x = 0; u.legR.rotation.x = 0;
    u.armL.rotation.x = Math.sin(t * 1.4) * 0.05;
    u.armR.rotation.x = -Math.sin(t * 1.4) * 0.05;
  }

  const People = {
    makePerson: makePerson,
    animateWalk: animateWalk,
    animateIdle: animateIdle,
    peds: [],

    init: function (scene, city, rng) {
      this.peds = [];
      for (let k = 0; k < CFG.pedCount; k++) {
        const spot = city.sidewalkSpots[Math.floor(rng() * city.sidewalkSpots.length)];
        const mesh = makePerson(
          CB.pick(rng, CFG.pedPalette),
          CB.pick(rng, [0x2c3e50, 0x34495e, 0x5d4037, 0x1a1a1a, 0x7f8c8d]),
          CB.pick(rng, [0xc98d64, 0x8d5524, 0xffdbac, 0xf1c27d]));
        mesh.position.set(spot.x, 0, spot.z);
        scene.add(mesh);
        this.peds.push({
          mesh: mesh,
          x: spot.x, z: spot.z,
          heading: rng() * Math.PI * 2,
          speed: CFG.pedSpeed * CB.range(rng, 0.7, 1.3),
          state: 'walk',          // walk | flee | down
          target: null,
          phase: rng() * 6,
          downTimer: 0,
          panicTimer: 0,
          spot: spot,
        });
      }
    },

    // A fresh destination on a nearby sidewalk.
    newDestination: function (city, rng, ped) {
      for (let tries = 0; tries < 8; tries++) {
        const s = city.sidewalkSpots[Math.floor(rng() * city.sidewalkSpots.length)];
        if (Math.hypot(s.x - ped.x, s.z - ped.z) < 120) {
          ped.target = s;
          return;
        }
      }
      ped.target = city.sidewalkSpots[0];
    },

    update: function (dt, city, rng, danger) {
      // danger: {x, z, radius, kind} or null — gunfire / speeding car nearby.
      for (const ped of this.peds) {
        if (ped.state === 'down') {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) {
            ped.mesh.visible = false;
            ped.state = 'gone';
          }
          continue;
        }
        if (ped.state === 'gone') continue;
        if (ped.state === 'waitTaxi') {
          // Waiting for a taxi pickup: stand still, look around.
          animateIdle(ped.mesh, CB.Game.time + ped.phase);
          ped.mesh.position.set(ped.x, 0, ped.z);
          ped.mesh.rotation.y = ped.heading;
          continue;
        }
        if (danger) {
          const d = Math.hypot(ped.x - danger.x, ped.z - danger.z);
          if (d < danger.radius) {
            ped.state = 'flee';
            ped.panicTimer = 3;
            ped.fleeFrom = { x: danger.x, z: danger.z };
          }
        }
        if (ped.state === 'flee') {
          ped.panicTimer -= dt;
          const dx = ped.x - ped.fleeFrom.x, dz = ped.z - ped.fleeFrom.z;
          const d = Math.hypot(dx, dz) || 1;
          const want = Math.atan2(dx, dz);
          let dh = want - ped.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          ped.heading += CB.clamp(dh, -4 * dt, 4 * dt);
          ped.x += Math.sin(ped.heading) * 3.4 * dt;
          ped.z += Math.cos(ped.heading) * 3.4 * dt;
          ped.phase += dt * 9;
          animateWalk(ped.mesh, ped.phase, 1);
          if (ped.panicTimer <= 0) ped.state = 'walk';
        } else {
          if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 2) {
            this.newDestination(city, rng, ped);
          }
          const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
          const want = Math.atan2(dx, dz);
          let dh = want - ped.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          ped.heading += CB.clamp(dh, -2.5 * dt, 2.5 * dt);
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
          ped.phase += dt * 5;
          animateWalk(ped.mesh, ped.phase, 0.7);
        }
        CB.Vehicles.collideBuildings(city, ped, 0.5);
        CB.Vehicles.clampToBounds(ped, 0.5);
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }
    },

    // Knock a ped down (shot or run over). Returns true if it was standing.
    knockDown: function (ped) {
      if (ped.state === 'down' || ped.state === 'gone') return false;
      ped.state = 'down';
      ped.downTimer = 6;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.4;
      return true;
    },

    // Nearest standing ped to a point.
    nearest: function (x, z, maxDist) {
      let best = null, bestD = maxDist;
      for (const ped of this.peds) {
        if (ped.state !== 'walk' && ped.state !== 'flee') continue;
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < bestD) { bestD = d; best = ped; }
      }
      return best;
    },

    countStanding: function () {
      let n = 0;
      for (const p of this.peds) if (p.state === 'walk' || p.state === 'flee') n++;
      return n;
    },
  };

  CB.People = People;
})();
