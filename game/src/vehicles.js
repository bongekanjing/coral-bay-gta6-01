// Coral Bay — vehicles.js
// One clear job: cars. The low-poly car model factory (civilian and police),
// the traffic system that drives cars around the road graph, parked cars, and
// the circle-vs-building collision the cars and the player share.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  function makeWheel() {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10),
      new THREE.MeshLambertMaterial({ color: 0x141414 }));
    wheel.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0xb8bcc0 }));
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    return wheel;
  }

  // Roll a car class from the weights in config: mostly sedans, some
  // sports cars, a few vans.
  function pickClass(rng) {
    const w = CFG.carClassWeights;
    const roll = rng();
    if (roll < w.sport) return 'sport';
    if (roll < w.sport + w.sedan) return 'sedan';
    return 'van';
  }

  // Handling numbers for a class name, falling back to the sedan defaults.
  function classStats(cls) {
    return CFG.carClasses[cls] || CFG.carClasses.sedan;
  }

  // A readable low-poly car: body, cabin, wheels, lights, bumpers. No text, no
  // borrowed brand shapes — just a generic modern silhouette, stretched or
  // boxed out by class: sport is low and long, van is tall and square.
  function makeCar(color, isPolice, carClass) {
    const cls = isPolice ? 'sedan' : (carClass || 'sedan');
    const dims = cls === 'sport' ? { bw: 1.9, bh: 0.5, bl: 4.7, cw: 1.6, ch: 0.42, cl: 2.0, cy: 1.08 } :
      cls === 'van' ? { bw: 2.1, bh: 0.95, bl: 4.9, cw: 1.9, ch: 0.8, cl: 3.4, cy: 1.32 } :
      { bw: 2.0, bh: 0.62, bl: 4.4, cw: 1.7, ch: 0.55, cl: 2.2, cy: 1.18 };
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(dims.bw, dims.bh, dims.bl), bodyMat);
    body.position.y = cls === 'van' ? 0.78 : 0.62;
    g.add(body);
    const cabinMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f0f0 : 0x1c2733 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(dims.cw, dims.ch, dims.cl), cabinMat);
    cabin.position.set(0, dims.cy, cls === 'van' ? 0.1 : -0.25);
    g.add(cabin);
    // Glass band.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(dims.cw + 0.04, dims.ch * 0.6, dims.cl - 0.2),
      new THREE.MeshLambertMaterial({ color: 0x2c4a63 }));
    glass.position.set(0, dims.cy - 0.02, cls === 'van' ? 0.1 : -0.25);
    g.add(glass);
    // Sport cars get a rear spoiler; vans get a roof rack.
    if (cls === 'sport') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.35),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      spoiler.position.set(0, 1.02, 2.15);
      g.add(spoiler);
    } else if (cls === 'van') {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 2.6),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      rack.position.set(0, 1.78, 0.1);
      g.add(rack);
    }
    // Police livery: white doors band and a light bar.
    if (isPolice) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.34, 2.4),
        new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
      band.position.set(0, 0.66, 0.1);
      g.add(band);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      bar.position.set(0, 1.55, -0.25);
      g.add(bar);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.28),
        new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
      red.position.set(-0.28, 1.66, -0.25);
      g.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.28),
        new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x0033aa }));
      blue.position.set(0.28, 1.66, -0.25);
      g.add(blue);
      g.userData.lightRed = red;
      g.userData.lightBlue = blue;
    }
    // Headlights and taillights, at the ends of the body for this class.
    const hlMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0x332e0a });
    const tlMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x4a0000 });
    g.userData.headlightMat = hlMat;
    const endZ = dims.bl / 2 + 0.02;
    for (const sx of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hlMat);
      hl.position.set(sx, 0.72, -endZ);
      g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tlMat);
      tl.position.set(sx, 0.72, endZ);
      g.add(tl);
    }
    // Bumpers.
    const bumpMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const z of [-endZ, endZ]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.22, 0.12), bumpMat);
      b.position.set(0, 0.42, z);
      g.add(b);
    }
    // Wheels.
    const wheels = [];
    const wpos = [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]];
    for (const p of wpos) {
      const w = makeWheel();
      w.position.set(p[0], 0.36, p[1]);
      g.add(w);
      wheels.push(w);
    }
    g.userData.wheels = wheels;
    g.userData.carClass = cls;
    // Fake blob shadow.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.0),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    return g;
  }

  // Push a circle (x, z, radius) out of every building AABB it overlaps.
  // Returns true when a collision happened; mutates pos in place.
  function collideBuildings(city, pos, radius) {
    let hit = false;
    for (const b of city.colliders) {
      const cx = CB.clamp(pos.x, b.minX, b.maxX);
      const cz = CB.clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = pos.x - (b.minX - radius), pr = (b.maxX + radius) - pos.x;
          const pt = pos.z - (b.minZ - radius), pb = (b.maxZ + radius) - pos.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) pos.x = b.minX - radius;
          else if (m === pr) pos.x = b.maxX + radius;
          else if (m === pt) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    return hit;
  }

  function clampToBounds(pos, radius) {
    const b = CFG.bounds;
    pos.x = CB.clamp(pos.x, -b, b);
    pos.z = CB.clamp(pos.z, -b, CFG.beachZ + 6);
  }

  const Vehicles = {
    makeCar: makeCar,
    pickClass: pickClass,
    classStats: classStats,
    collideBuildings: collideBuildings,
    clampToBounds: clampToBounds,

    // Traffic: cars that follow the road graph, one lane over, stopping at
    // intersections sometimes, braking for the car ahead.
    traffic: [],
    parked: [],

    init: function (scene, city, rng) {
      this.traffic = [];
      this.parked = [];
      // Parked cars along curbs, using the city's spots. Each rolls a class,
      // so the street has quick sports cars, plain sedans and slow vans.
      for (let k = 0; k < 16; k++) {
        const s = city.parkedSpots[Math.floor(rng() * city.parkedSpots.length)];
        const carClass = pickClass(rng);
        const mesh = makeCar(CB.pick(rng, CFG.carPalette), false, carClass);
        mesh.position.set(s.x, 0, s.z);
        mesh.rotation.y = s.heading;
        scene.add(mesh);
        this.parked.push({ mesh: mesh, x: s.x, z: s.z, heading: s.heading, stolen: false, carClass: carClass });
      }
      // Moving traffic.
      for (let k = 0; k < CFG.trafficCount; k++) {
        const node = city.intersections[Math.floor(rng() * city.intersections.length)];
        const carClass = pickClass(rng);
        const mesh = makeCar(CB.pick(rng, CFG.carPalette), false, carClass);
        mesh.position.set(node.x, 0, node.z);
        scene.add(mesh);
        const car = {
          mesh: mesh,
          x: node.x, z: node.z,
          heading: rng() * Math.PI * 2,
          speed: 0,
          carClass: carClass,
          targetSpeed: classStats(carClass).topSpeed * 0.24 * CB.range(rng, 0.8, 1.15),
          node: node,
          next: null,
          wait: CB.range(rng, 0, 2),
        };
        this.pickNext(city, rng, car);
        this.traffic.push(car);
      }
    },

    pickNext: function (city, rng, car) {
      const opts = car.node.n.filter(function (n) {
        return !(car.next && n.x === car.next.x && n.z === car.next.z);
      });
      const next = opts.length ? CB.pick(rng, opts) :
        car.node.n[Math.floor(rng() * car.node.n.length)];
      car.next = next;
      // Lane offset: drive on the right side of the road.
      const dx = next.x - car.node.x, dz = next.z - car.node.z;
      const len = Math.hypot(dx, dz) || 1;
      car.laneX = -dz / len * 3.4;
      car.laneZ = dx / len * 3.4;
    },

    update: function (dt, city, rng, playerCar) {
      for (const car of this.traffic) {
        if (car.wait > 0) { car.wait -= dt; continue; }
        const tx = car.next.x + car.laneX, tz = car.next.z + car.laneZ;
        const dx = tx - car.x, dz = tz - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += CB.clamp(dh, -2.2 * dt, 2.2 * dt);
        // Brake for the car ahead (traffic or the player).
        let slow = 1;
        for (const other of this.traffic) {
          if (other === car) continue;
          const ox = other.x - car.x, oz = other.z - car.z;
          const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
          const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
          if (ahead > 0 && ahead < 9 && side < 2.4) { slow = 0; break; }
        }
        if (playerCar) {
          const px = playerCar.x - car.x, pz = playerCar.z - car.z;
          const ahead = px * Math.sin(car.heading) + pz * Math.cos(car.heading);
          const side = Math.abs(px * Math.cos(car.heading) - pz * Math.sin(car.heading));
          if (ahead > 0 && ahead < 8 && side < 2.6) slow = 0;
        }
        const target = slow ? car.targetSpeed : 0;
        car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        if (dist < 3.5) {
          car.node = car.next;
          this.pickNext(city, rng, car);
          if (rng() < 0.18) car.wait = CB.range(rng, 0.5, 2.0);
        }
        // Gentle separation between traffic cars.
        for (const other of this.traffic) {
          if (other === car) continue;
          const ox = car.x - other.x, oz = car.z - other.z;
          const d2 = ox * ox + oz * oz;
          if (d2 < 12 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            car.x += (ox / d) * (3.5 - d) * 0.5;
            car.z += (oz / d) * (3.5 - d) * 0.5;
          }
        }
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        // Wheel spin.
        for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      }
    },

    // Nearest parked or traffic car to a point, within maxDist.
    nearestCar: function (x, z, maxDist, includeTraffic) {
      let best = null, bestD = maxDist;
      const consider = function (c, isTraffic) {
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bestD) { bestD = d; best = { car: c, isTraffic: isTraffic, d: d }; }
      };
      for (const p of this.parked) if (!p.stolen && !p.wrecked) consider(p, false);
      if (includeTraffic) {
        for (const t of this.traffic) {
          if (Math.abs(t.speed) < 1) consider(t, true);
        }
      }
      return best;
    },
  };

  CB.Vehicles = Vehicles;
})();

// ---- Coral Bay v3: taxis, the port van, headlights, traffic lights ---------
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  function taxiSign(mesh, carClass) {
    const roofY = carClass === 'van' ? 1.86 : carClass === 'sport' ? 1.42 : 1.58;
    const zc = carClass === 'van' ? 0.1 : -0.25;
    const signMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, emissive: 0x664411 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.42), signMat);
    sign.position.set(0, roofY, zc);
    mesh.add(sign);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.1, 0.46),
      new THREE.MeshLambertMaterial({ color: 0xffd21a, emissive: 0xaa8800 }));
    glow.position.set(0, roofY + 0.18, zc);
    mesh.add(glow);
  }

  function toTaxi(scene, entry) {
    const cls = entry.carClass || (entry.mesh.userData && entry.mesh.userData.carClass) || 'sedan';
    const old = entry.mesh;
    scene.remove(old);
    const mesh = CB.Vehicles.makeCar(0xf7c600, false, cls);
    mesh.position.copy(old.position);
    mesh.rotation.y = old.rotation.y;
    scene.add(mesh);
    entry.mesh = mesh;
    entry.isTaxi = true;
    taxiSign(mesh, cls);
  }

  const baseInit = CB.Vehicles.init;
  CB.Vehicles.init = function (scene, city, rng) {
    baseInit.call(this, scene, city, rng);
    if (this.traffic.length) toTaxi(scene, this.traffic[0]);
    if (this.parked.length) toTaxi(scene, this.parked[0]);
    for (const car of this.traffic) {
      if (!car.isTaxi && rng() < CFG.taxiChance) toTaxi(scene, car);
    }
    for (const p of this.parked) {
      if (!p.isTaxi && rng() < CFG.taxiChance) toTaxi(scene, p);
    }
    // One van always waits at the port, so the harbour job never depends
    // on the random draw: repurpose the last parked car, keeping the count.
    const last = this.parked[this.parked.length - 1];
    if (last) {
      scene.remove(last.mesh);
      const van = CB.Vehicles.makeCar(0xd8d8d8, false, 'van');
      van.position.set(-230, 0, 24);
      van.rotation.y = Math.PI;
      scene.add(van);
      last.mesh = van;
      last.x = -230;
      last.z = 24;
      last.heading = Math.PI;
      last.carClass = 'van';
      last.isTaxi = false;
      last.stolen = false;
      last.wrecked = false;
    }
  };

  function lightHold(city, car) {
    if (!city.lightByKey) return false;
    const key = Math.round(car.next.x / CFG.pitch) + ',' + Math.round(car.next.z / CFG.pitch);
    const L = city.lightByKey[key];
    if (!L) return false;
    const ew = Math.abs(car.next.x - car.node.x) > Math.abs(car.next.z - car.node.z);
    const go = ew ? L.ewGo : L.nsGo;
    if (go) return false;
    const tx = car.next.x + (car.laneX || 0);
    const tz = car.next.z + (car.laneZ || 0);
    return Math.hypot(tx - car.x, tz - car.z) < 18;
  }

  const baseUpdate = CB.Vehicles.update;
  CB.Vehicles.update = function (dt, city, rng, playerCar) {
    if (city.trafficLights) CB.City.updateLights(city);
    for (const car of this.traffic) {
      if (lightHold(city, car)) {
        if (car._heldTarget === undefined) car._heldTarget = car.targetSpeed;
        car.targetSpeed = 0;
      } else if (car._heldTarget !== undefined) {
        car.targetSpeed = car._heldTarget;
        car._heldTarget = undefined;
      }
    }
    baseUpdate.call(this, dt, city, rng, playerCar);
    const hex = city.isNight ? 0xfff2b0 : 0x332e0a;
    const shine = function (mesh) {
      if (!mesh) return;
      const m = mesh.userData && mesh.userData.headlightMat;
      if (m) m.emissive.setHex(hex);
    };
    for (const car of this.traffic) shine(car.mesh);
    for (const p of this.parked) shine(p.mesh);
    const pl = CB.Game.player;
    if (pl && pl.inCar && pl.car) shine(pl.car.mesh);
    // Nose-to-nose deadlock breaker: two cars stopped facing each other
    // (each braking for the other) never clear on their own, so slide the
    // second one into its right-hand lane and let both roll on.
    for (let i = 0; i < this.traffic.length; i++) {
      for (let j = i + 1; j < this.traffic.length; j++) {
        const a = this.traffic[i], b = this.traffic[j];
        if (Math.abs(a.speed) > 0.5 || Math.abs(b.speed) > 0.5) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        if (dx * dx + dz * dz > 49) continue;
        const facing = Math.sin(a.heading) * Math.sin(b.heading) + Math.cos(a.heading) * Math.cos(b.heading);
        if (facing > -0.7) continue;
        const side = Math.abs(dx * Math.cos(a.heading) - dz * Math.sin(a.heading));
        if (side > 2.4) continue;
        const rx = -Math.cos(b.heading), rz = Math.sin(b.heading);
        b.x += rx * 3.5;
        b.z += rz * 3.5;
        b.mesh.position.set(b.x, 0, b.z);
      }
    }
  };
})();
