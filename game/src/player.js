// Coral Bay — player.js
// One clear job: Dario Cole. Walking and running on foot, stealing and driving
// cars with arcade physics, the chase camera, the pistol (aim, fire, reload,
// tracers), and getting in and out of cars. It reads input; main.js owns the
// input listeners and the camera object.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  const Player = {
    x: 36, z: 44,
    heading: 0,
    footSpeed: 0,
    health: CFG.playerHealth,
    cash: 0,
    inCar: false,
    car: null,          // the vehicle object being driven
    carSpeed: 0,
    carHealth: CFG.carHealth,
    carStolen: false,
    mesh: null,
    camYaw: 0,          // extra orbit around the player, from mouse drag
    camPitch: 0.32,
    camDist: CFG.camDistFoot,
    walkPhase: 0,
    ammo: CFG.pistolMag,
    reloading: false,
    reloadTimer: 0,
    fireTimer: 0,
    effects: [],

    init: function (scene) {
      this.mesh = CB.People.makePerson(0x1f8a70, 0x2c3e50, 0xc98d64);
      this.mesh.position.set(this.x, 0, this.z);
      scene.add(this.mesh);
      this.scene = scene;
      // Muzzle flash light (reused).
      this.flashLight = new THREE.PointLight(0xffcc66, 0, 18);
      this.scene.add(this.flashLight);
      // Tracer material (reused line).
      this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.tracer = new THREE.Line(geo, this.tracerMat);
      this.tracer.visible = false;
      this.scene.add(this.tracer);
    },

    reset: function (x, z, heading) {
      this.x = x; this.z = z; this.heading = heading || 0;
      this.health = CFG.playerHealth;
      this.inCar = false;
      this.car = null;
      this.carSpeed = 0;
      this.carHealth = CFG.carHealth;
      this.mesh.visible = true;
      this.mesh.rotation.x = 0;
      this.mesh.position.set(x, 0, z);
    },

    // ---- driving -----------------------------------------------------------
    enterCar: function (found) {
      const c = found.car;
      if (found.isTraffic) {
        // Pull the stopped traffic car out of traffic and make it the player's.
        const i = CB.Vehicles.traffic.indexOf(c);
        if (i >= 0) CB.Vehicles.traffic.splice(i, 1);
        c.stolen = true;
      } else {
        c.stolen = true;
      }
      this.car = { mesh: c.mesh, x: c.x, z: c.z, heading: c.heading, speed: 0, health: c.health || CFG.carHealth, wrecked: false, source: c, wasTraffic: found.isTraffic };
      this.inCar = true;
      this.carSpeed = 0;
      this.carHealth = this.car.health;
      this.carStolen = true;
      this.mesh.visible = false;
      this.heading = c.heading;
      this.x = c.x; this.z = c.z;
      CB.AudioSys.engineStart();
      CB.AudioSys.blip(660, 0.1, 'sine', 0.12);
    },

    exitCar: function () {
      if (!this.car) return;
      // Step out on the driver's side.
      const sx = Math.cos(this.heading), sz = -Math.sin(this.heading);
      this.x = this.car.x + sx * 2.2;
      this.z = this.car.z + sz * 2.2;
      CB.Vehicles.collideBuildings(CB.Game.city, this, CFG.playerRadius);
      // The car stays where it stopped and can be stolen again — unless wrecked.
      const car = this.car;
      if (car.wasTraffic) {
        CB.Vehicles.parked.push({ mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, stolen: false, wrecked: car.wrecked });
      } else {
        car.source.stolen = false;
        car.source.wrecked = car.wrecked;
        car.source.x = car.x; car.source.z = car.z; car.source.heading = car.heading;
      }
      this.inCar = false;
      this.car = null;
      this.carSpeed = 0;
      this.mesh.visible = true;
      this.mesh.position.set(this.x, 0, this.z);
      CB.AudioSys.engineStop();
    },

    updateDriving: function (dt, input) {
      const car = this.car;
      const fwd = (input.w ? 1 : 0) - (input.s ? 1 : 0);
      const steerIn = (input.a ? 1 : 0) - (input.d ? 1 : 0);
      const handbrake = input.space;
      // Acceleration.
      if (fwd > 0) car.speed += CFG.carAccel * dt * (1 - car.speed / CFG.carTopSpeed);
      else if (fwd < 0) {
        if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
        else car.speed -= CFG.carReverse * dt;
      } else {
        car.speed -= car.speed * 1.2 * dt; // rolling drag
      }
      car.speed = CB.clamp(car.speed, -CFG.carTopReverse, CFG.carTopSpeed);
      // Steering: less at speed, more with the handbrake.
      const steerScale = CB.clamp(Math.abs(car.speed) / 10, 0.25, 1);
      const grip = handbrake ? CFG.handbrakeGrip : CFG.carGrip;
      const yawRate = steerIn * CFG.carSteer * steerScale * (handbrake ? 1.7 : 1) *
        (car.speed >= 0 ? 1 : -1);
      car.heading += yawRate * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.2);
      // Move.
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const probe = { x: nx, z: nz };
      const hitWall = CB.Vehicles.collideBuildings(CB.Game.city, probe, CFG.carRadius);
      CB.Vehicles.clampToBounds(probe, CFG.carRadius);
      if (hitWall && Math.abs(car.speed) > 6) {
        CB.AudioSys.crash(Math.abs(car.speed) > 20);
        car.health -= Math.abs(car.speed) * 0.55;
        CB.Game.damagePlayer(Math.abs(car.speed) * 0.25);
      }
      if (hitWall) car.speed *= 0.45;
      car.x = probe.x; car.z = probe.z;
      this.x = car.x; this.z = car.z;
      this.heading = car.heading;
      this.carSpeed = car.speed;
      this.carHealth = car.health;
      // Traffic collisions: bounce off, damage both.
      for (const t of CB.Vehicles.traffic) {
        const dx = car.x - t.x, dz = car.z - t.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.4 && d > 0.01) {
          const push = (3.4 - d) / 2;
          car.x += (dx / d) * push; car.z += (dz / d) * push;
          t.x -= (dx / d) * push; t.z -= (dz / d) * push;
          if (Math.abs(car.speed) > 4) {
            car.health -= 4;
            CB.AudioSys.crash(false);
            car.speed *= 0.7;
          }
        }
      }
      // Running over pedestrians.
      for (const ped of CB.People.peds) {
        if (ped.state !== 'walk' && ped.state !== 'flee' && ped.state !== 'waitTaxi') continue;
        const d = Math.hypot(ped.x - car.x, ped.z - car.z);
        if (d < 2.2 && Math.abs(car.speed) > 3) {
          if (CB.People.knockDown(ped)) {
            CB.Police.addWanted(1);
            CB.HUD.flashObjective('You ran someone over! The cops saw that.');
            CB.AudioSys.crash(true);
          }
        }
      }
      // Wrecked?
      if (car.health <= 0) {
        CB.HUD.flashObjective('The car is wrecked — find another ride.');
        car.wrecked = true;
        this.exitCar();
        return;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) {
        w.rotation.x += car.speed * dt * 2.4;
        if (w === car.mesh.userData.wheels[0] || w === car.mesh.userData.wheels[1]) {
          w.rotation.y = steerIn * 0.35;
        }
      }
      CB.AudioSys.engineSet(Math.abs(car.speed) / CFG.carTopSpeed, true);
    },

    // ---- on foot -----------------------------------------------------------
    updateOnFoot: function (dt, input, camera) {
      const run = input.shift;
      const speed = run ? CFG.runSpeed : CFG.walkSpeed;
      // Movement relative to the camera yaw.
      const camYaw = this.camYaw + this.heading;
      let mx = 0, mz = 0;
      if (input.w) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
      if (input.s) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
      if (input.a) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
      if (input.d) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
        this.heading = Math.atan2(mx, mz);
        this.footSpeed = speed;
        this.walkPhase += dt * (run ? 11 : 7);
        CB.People.animateWalk(this.mesh, this.walkPhase, 1);
      } else {
        this.footSpeed = 0;
        CB.People.animateIdle(this.mesh, CB.Game.time);
      }
      const probe = { x: this.x, z: this.z };
      CB.Vehicles.collideBuildings(CB.Game.city, probe, CFG.playerRadius);
      CB.Vehicles.clampToBounds(probe, CFG.playerRadius);
      this.x = probe.x; this.z = probe.z;
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      // Firing the pistol.
      this.fireTimer -= dt;
      if (this.reloading) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) { this.reloading = false; this.ammo = CFG.pistolMag; }
      }
      if (input.mouseDown && !this.reloading && this.fireTimer <= 0) {
        this.shoot(camera);
      }
      if (input.reloadPressed) {
        input.reloadPressed = false;
        if (this.ammo < CFG.pistolMag && !this.reloading) {
          this.reloading = true;
          this.reloadTimer = CFG.reloadTime;
          CB.AudioSys.blip(220, 0.08, 'square', 0.08);
        }
      }
    },

    shoot: function (camera) {
      if (this.ammo <= 0) {
        this.reloading = true;
        this.reloadTimer = CFG.reloadTime;
        CB.AudioSys.blip(180, 0.1, 'square', 0.1);
        return;
      }
      this.ammo--;
      this.fireTimer = CFG.pistolRate;
      CB.AudioSys.shot();
      CB.Police.addWanted(0); // firing alone does not raise stars; a hit does
      // Muzzle position: the player's right hand, roughly.
      const mx = this.x + Math.sin(this.heading) * 0.5;
      const mz = this.z + Math.cos(this.heading) * 0.5;
      this.flashLight.position.set(mx, 1.4, mz);
      this.flashLight.intensity = 6;
      // Aim: camera forward from screen centre; nearest ped inside a small cone.
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      let best = null, bestD = CFG.pistolRange;
      for (const ped of CB.People.peds) {
        if (ped.state !== 'walk' && ped.state !== 'flee' && ped.state !== 'waitTaxi') continue;
        const dx = ped.x - camera.position.x;
        const dz = ped.z - camera.position.z;
        const dy = 1.2 - camera.position.y;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > CFG.pistolRange) continue;
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
        if (dot > 0.995 && d < bestD) { bestD = d; best = ped; }
      }
      const end = new THREE.Vector3();
      if (best) {
        end.set(best.x, 1.2, best.z);
        if (CB.People.knockDown(best)) {
          CB.Police.addWanted(1);
          CB.HUD.flashObjective('You shot a civilian! Wanted level up.');
        }
        CB.Game.onPedShot(best);
      } else {
        end.copy(camera.position).add(dir.multiplyScalar(50));
        end.y = Math.max(0.2, end.y);
      }
      // Tracer line from the muzzle to the hit point.
      const pos = this.tracer.geometry.attributes.position;
      pos.setXYZ(0, mx, 1.4, mz);
      pos.setXYZ(1, end.x, end.y, end.z);
      pos.needsUpdate = true;
      this.tracer.visible = true;
      this.tracerMat.opacity = 0.9;
      this.effects.push({ kind: 'tracer', t: 0.08 });
      this.effects.push({ kind: 'flash', t: 0.06 });
      // Nearby peds panic.
      CB.Game.lastDanger = { x: this.x, z: this.z, radius: 26, kind: 'shot' };
    },

    updateEffects: function (dt) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.t -= dt;
        if (e.t <= 0) {
          if (e.kind === 'tracer') { this.tracer.visible = false; this.tracerMat.opacity = 0; }
          if (e.kind === 'flash') this.flashLight.intensity = 0;
          this.effects.splice(i, 1);
        }
      }
    },

    // ---- camera ------------------------------------------------------------
    updateCamera: function (dt, camera) {
      const zoom = this.zoom || 1;
      const targetDist = (this.inCar ? CFG.camDistCar : CFG.camDistFoot) * zoom;
      const targetH = this.inCar ? CFG.camHeightCar : CFG.camHeightFoot;
      this.camDist += (targetDist - this.camDist) * Math.min(1, dt * 4);
      // The orbit offset eases back behind the player when not dragging
      // (except in shot mode, where the staged angle must hold).
      if (!CB.Game.shot) this.camYaw *= Math.max(0, 1 - dt * 0.25);
      const yaw = this.heading + this.camYaw;
      const cx = this.x - Math.sin(yaw) * this.camDist;
      const cz = this.z - Math.cos(yaw) * this.camDist;
      const cy = targetH + this.camPitch * 4;
      camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 7);
      camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 7);
      camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 7);
      camera.lookAt(this.x, this.inCar ? 1.4 : 1.5, this.z);
    },
  };

  CB.Player = Player;
})();
