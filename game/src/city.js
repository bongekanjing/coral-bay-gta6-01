// Coral Bay — city.js
// One clear job: build the whole city of Coral Bay — ground with painted roads,
// procedural buildings, palm trees, the beach and ocean, the sky, street props
// and the road graph traffic drives on. Everything is generated from a seed;
// no image or model file is loaded.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 1;
    return t;
  }

  // Facade texture: warm wall colour with a grid of windows, some lit.
  // litRatio is higher downtown, so the towers glow at golden hour.
  function facadeTexture(rng, base, litRatio) {
    const lit = litRatio === undefined ? 0.28 : litRatio;
    return makeCanvas(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
      const cols = 5, rows = 11;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 8 + c * 24, y = 10 + r * 22;
          const isLit = rng() < lit;
          g.fillStyle = isLit ? '#ffd98a' : 'rgba(20,30,44,0.85)';
          g.fillRect(x, y, 16, 13);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(x, y, 16, 3);
        }
      }
    });
  }

  // A neon sign texture: glowing letters on a dark board, drawn on canvas.
  function neonSignTexture(text, color) {
    return makeCanvas(256, 64, function (g, w, h) {
      g.fillStyle = '#101018';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.font = 'bold 34px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = color;
      g.shadowBlur = 18;
      g.fillStyle = color;
      g.fillText(text, w / 2, h / 2 + 1);
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.fillText(text, w / 2, h / 2 + 1);
    });
  }

  // One big ground texture: sidewalks, asphalt streets with dashes, crosswalks,
  // block paving and the sand of the south beach, painted in world space.
  function groundTexture(rng) {
    const S = 1024, WORLD = 640; // world -320..320 maps to 0..1024
    const toPx = function (v) { return (v + WORLD / 2) / WORLD * S; };
    return makeCanvas(S, S, function (g, w, h) {
      g.fillStyle = '#b9b3a4'; g.fillRect(0, 0, w, h); // sidewalk base
      // Block paving, slightly varied per block.
      for (let i = -3; i < 3; i++) {
        for (let j = -3; j < 3; j++) {
          const x0 = toPx(i * CFG.pitch + CFG.streetHalf);
          const z0 = toPx(j * CFG.pitch + CFG.streetHalf);
          const s = toPx((i + 1) * CFG.pitch - CFG.streetHalf) - x0;
          g.fillStyle = CB.pick(rng, ['#b3aa97', '#a8a28f', '#bdb5a2', '#a49e8c']);
          g.fillRect(x0, z0, s, s);
        }
      }
      // Beach sand, south edge.
      const sand = g.createLinearGradient(0, toPx(CFG.beachZ), 0, h);
      sand.addColorStop(0, '#e8d5a4'); sand.addColorStop(1, '#dfc489');
      g.fillStyle = sand;
      g.fillRect(0, toPx(CFG.beachZ), w, h - toPx(CFG.beachZ));
      // Streets.
      g.fillStyle = '#3a3d42';
      for (let i = -3; i <= 3; i++) {
        const c = toPx(i * CFG.pitch);
        const hw = toPx(CFG.streetHalf) - toPx(0);
        g.fillRect(0, c - hw, w, hw * 2);       // east-west street
        g.fillRect(c - hw, 0, hw * 2, h);       // north-south street
      }
      // Centre dashes: thin, like paint.
      g.fillStyle = '#e8c84a';
      for (let i = -3; i <= 3; i++) {
        const c = toPx(i * CFG.pitch);
        for (let d = -300; d < 300; d += 16) {
          g.fillRect(toPx(d), c - 0.75, 8, 1.5);
          g.fillRect(c - 0.75, toPx(d), 1.5, 8);
        }
      }
      // Crosswalks at every intersection: narrow stripes across the street.
      g.fillStyle = 'rgba(240,240,235,0.85)';
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          const cx = toPx(i * CFG.pitch), cz = toPx(j * CFG.pitch);
          for (let k = -2; k <= 2; k++) {
            g.fillRect(cx + k * 5 - 1, cz - 12, 2, 5);
            g.fillRect(cx + k * 5 - 1, cz + 7, 2, 5);
            g.fillRect(cx - 12, cz + k * 5 - 1, 5, 2);
            g.fillRect(cx + 7, cz + k * 5 - 1, 5, 2);
          }
        }
      }
      // Boardwalk planks on the sand.
      g.fillStyle = 'rgba(120,90,60,0.5)';
      for (let x = -300; x < 300; x += 10) g.fillRect(toPx(x), toPx(258), 6, 3);
    });
  }

  // Two meshes only (trunk + crown) so dozens of palms stay cheap to draw.
  // Short palms are bushier and squatter, for planters and the park edge.
  function palmTree(rng, short) {
    const g = new THREE.Group();
    const trunkH = short ? CB.range(rng, 2.6, 3.6) : CB.range(rng, 5, 7);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = CB.range(rng, -0.12, 0.12);
    g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(short ? 2.4 : 1.9, 8, 5),
      new THREE.MeshLambertMaterial({ color: 0x2f9e4f }));
    crown.scale.y = 0.45;
    crown.position.y = trunkH + 0.3;
    g.add(crown);
    return g;
  }

  // Fill an InstancedMesh from a list of {x, y, z, sx, sy, sz, ry}.
  function fillInstances(mesh, list) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    list.forEach(function (p, i) {
      e.set(0, p.ry || 0, 0);
      q.setFromEuler(e);
      v.set(p.x, p.y, p.z);
      s.set(p.sx || 1, p.sy || 1, p.sz || 1);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  const City = {
    build: function (scene, rng) {
      const city = {
        colliders: [],
        intersections: [],
        sidewalkSpots: [],
        parkedSpots: [],
        locations: {
          plaza: { x: 36, z: 36 },
          marcoPier: { x: 24, z: 262 },
          garage: { x: -132, z: 132 },
          hotel: { x: 132, z: 228 },
          safehouse: { x: 204, z: 204 },
          hospital: { x: 204, z: -204 },
          policeStation: { x: -204, z: -204 },
          bank: { x: -132, z: -132 },
          bankVault: { x: -120, z: -126 },
          park: { x: -144, z: -36 },
        },
      };

      // Sky, fog and sun.
      scene.background = new THREE.Color(CFG.skyTop);
      scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);
      const hemi = new THREE.HemisphereLight(CFG.hemiSky, CFG.hemiGround, CFG.hemiIntensity);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(CFG.sunColor, CFG.sunIntensity);
      sun.position.set(CFG.sunPos[0], CFG.sunPos[1], CFG.sunPos[2]);
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0xffe0b8, 0.25));

      // Ground.
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(640, 640),
        new THREE.MeshLambertMaterial({ map: groundTexture(rng) }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, 0);
      scene.add(ground);

      // Ocean, south of the beach, and a foam strip at the waterline.
      const ocean = new THREE.Mesh(
        new THREE.PlaneGeometry(900, 260),
        new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(0, -0.4, CFG.waterZ + 130);
      scene.add(ocean);
      const foam = new THREE.Mesh(
        new THREE.PlaneGeometry(900, 6),
        new THREE.MeshLambertMaterial({ color: 0xeaf6f6, transparent: true, opacity: 0.75 }));
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(0, -0.2, CFG.waterZ + 1);
      scene.add(foam);

      // Clouds: flat white puffs drifting high up, one instanced mesh.
      const cloudPuffs = [];
      for (let i = 0; i < 9; i++) {
        const cx = CB.range(rng, -280, 280), cy = CB.range(rng, 85, 130), cz = CB.range(rng, -280, 260);
        const n = 3 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const r = CB.range(rng, 6, 12);
          cloudPuffs.push({ x: cx + k * 9 - n * 4, y: cy + CB.range(rng, -1, 1), z: cz + CB.range(rng, -4, 4), sx: r, sy: r * 0.35, sz: r });
        }
      }
      const clouds = fillInstances(new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }),
        cloudPuffs.length), cloudPuffs);
      scene.add(clouds);

      // Buildings, block by block. The centre block is the plaza; (-2,1) is a park.
      // Downtown towers (near the centre) get the brighter, more-lit facades.
      const facades = CFG.buildingPalette.map(function (c) {
        return facadeTexture(rng, '#' + c.toString(16).padStart(6, '0'));
      });
      const downtownFacades = CFG.buildingPalette.map(function (c) {
        return facadeTexture(rng, '#' + c.toString(16).padStart(6, '0'), 0.55);
      });
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });
      const acMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a3 });
      const tankMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
      const plazaBlock = { i: 0, j: 0 };
      const parkBlock = { i: -2, j: 1 };
      for (let i = -3; i < 3; i++) {
        for (let j = -3; j < 3; j++) {
          const isPlaza = (i === plazaBlock.i && j === plazaBlock.j);
          const isPark = (i === parkBlock.i && j === parkBlock.j);
          if (isPlaza) { this.buildPlaza(scene, rng, i, j); continue; }
          if (isPark) { this.buildPark(scene, rng, i, j); continue; }
          const distC = Math.abs(i + 0.5) + Math.abs(j + 0.5);
          const tall = distC <= 2;
          const x0 = i * CFG.pitch + CFG.streetHalf + CFG.blockMargin;
          const z0 = j * CFG.pitch + CFG.streetHalf + CFG.blockMargin;
          const bw = CFG.pitch - 2 * CFG.streetHalf - 2 * CFG.blockMargin;
          const nB = rng() < 0.4 ? 1 : (rng() < 0.6 ? 2 : 4);
          const spots = nB === 1 ? [[0.5, 0.5, 0.86]] :
            nB === 2 ? [[0.25, 0.5, 0.42], [0.75, 0.5, 0.42]] :
            [[0.25, 0.25, 0.42], [0.75, 0.25, 0.42], [0.25, 0.75, 0.42], [0.75, 0.75, 0.42]];
          for (const s of spots) {
            const w = bw * s[2], d = bw * s[2];
            const hgt = tall ? CB.range(rng, 26, 68) : CB.range(rng, 9, 30);
            const cx = x0 + bw * s[0], cz = z0 + bw * s[1];
            const mat = new THREE.MeshLambertMaterial({ map: CB.pick(rng, tall ? downtownFacades : facades) });
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d),
              [mat, mat, roofMat, roofMat, mat, mat]);
            b.position.set(cx, hgt / 2, cz);
            scene.add(b);
            city.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
            // Rooftop box, for skyline variety.
            if (rng() < 0.5) {
              const rb = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 2.5, d * 0.3), roofMat);
              rb.position.set(cx + w * 0.15, hgt + 1.2, cz - d * 0.1);
              scene.add(rb);
            }
            // Rooftop props: AC units on most roofs, a water tower on tall ones.
            const nAc = 1 + Math.floor(rng() * 3);
            for (let a = 0; a < nAc; a++) {
              const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.6), acMat);
              ac.position.set(cx + CB.range(rng, -w / 3, w / 3), hgt + 0.55, cz + CB.range(rng, -d / 3, d / 3));
              ac.rotation.y = rng() * Math.PI;
              scene.add(ac);
            }
            if (tall && rng() < 0.45) {
              const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4, 10), tankMat);
              tank.position.set(cx - w * 0.28, hgt + 3.4, cz + d * 0.25);
              scene.add(tank);
              const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 10), roofMat);
              cap.position.set(cx - w * 0.28, hgt + 6.2, cz + d * 0.25);
              scene.add(cap);
            }
          }
        }
      }

      // The hotel tower on the beachfront, taller than the rest.
      const hotelMat = new THREE.MeshLambertMaterial({ map: CB.pick(rng, facades) });
      const hotel = new THREE.Mesh(new THREE.BoxGeometry(34, 58, 26),
        [hotelMat, hotelMat, roofMat, roofMat, hotelMat, hotelMat]);
      hotel.position.set(132, 29, 246);
      scene.add(hotel);
      city.colliders.push({ minX: 115, maxX: 149, minZ: 233, maxZ: 259 });
      // Hotel rooftop: AC units and a glowing sign band.
      for (const ax of [122, 132, 142]) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2.2),
          new THREE.MeshLambertMaterial({ color: 0x9aa0a3 }));
        ac.position.set(ax, 58.7, 244);
        scene.add(ac);
      }
      const hotelSign = new THREE.Mesh(new THREE.PlaneGeometry(22, 4),
        new THREE.MeshBasicMaterial({ map: neonSignTexture('CORAL HOTEL', '#29e6ff') }));
      hotelSign.position.set(132, 52, 232.8);
      hotelSign.rotation.y = Math.PI;
      scene.add(hotelSign);

      // Pier planks out over the water at Marco's spot.
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.6, 26),
        new THREE.MeshLambertMaterial({ color: 0x9a7b52 }));
      pier.position.set(24, 0.4, CFG.waterZ + 8);
      scene.add(pier);
      for (let k = 0; k < 4; k++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
        post.position.set(24 + (k % 2 === 0 ? -4.5 : 4.5), 0.5, CFG.waterZ + (k < 2 ? 2 : 16));
        scene.add(post);
      }

      // Beach umbrellas and towels on the sand, for colour at the shoreline.
      const umbrellaColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22];
      for (let k = 0; k < 8; k++) {
        const ux = CB.range(rng, -260, 260);
        const uz = CB.range(rng, CFG.beachZ + 6, CFG.beachZ + 26);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6),
          new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
        pole.position.set(ux, 1.2, uz);
        scene.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.8, 8),
          new THREE.MeshLambertMaterial({ color: CB.pick(rng, umbrellaColors) }));
        top.position.set(ux, 2.6, uz);
        scene.add(top);
        const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6),
          new THREE.MeshLambertMaterial({ color: CB.pick(rng, umbrellaColors) }));
        towel.rotation.x = -Math.PI / 2;
        towel.rotation.z = rng() * Math.PI;
        towel.position.set(ux + CB.range(rng, 1.5, 3), 0.06, uz + CB.range(rng, -1, 2));
        scene.add(towel);
      }

      // Palms: beach row, plaza ring and park.
      for (let x = -280; x <= 280; x += 28) {
        const p = palmTree(rng);
        p.position.set(x + CB.range(rng, -4, 4), 0, CFG.beachZ + CB.range(rng, 4, 14));
        scene.add(p);
      }
      for (let a = 0; a < 8; a++) {
        const p = palmTree(rng);
        const ang = (a / 8) * Math.PI * 2;
        p.position.set(36 + Math.cos(ang) * 22, 0, 36 + Math.sin(ang) * 22);
        scene.add(p);
      }

      // Planters along the sidewalks: a concrete box with a bush, and every
      // third one a short palm instead, for variety down the avenues.
      const planterMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
      const bushMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
      const bushMat2 = new THREE.MeshLambertMaterial({ color: 0x6fae4e });
      for (let k = 0; k < 18; k++) {
        const horizontal = rng() < 0.5;
        const street = Math.floor(CB.range(rng, -3, 4)) * CFG.pitch;
        const along = CB.range(rng, -200, 200);
        const off = (rng() < 0.5 ? -1 : 1) * (CFG.streetHalf + 2.2); // on the sidewalk
        const px = horizontal ? along : street + off;
        const pz = horizontal ? street + off : along;
        if (k % 3 === 2) {
          const p = palmTree(rng, true);
          p.position.set(px, 0, pz);
          scene.add(p);
        } else {
          const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.1), planterMat);
          box.position.set(px, 0.35, pz);
          box.rotation.y = horizontal ? 0 : Math.PI / 2;
          scene.add(box);
          const bush = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
            k % 2 === 0 ? bushMat : bushMat2);
          bush.scale.y = 0.6;
          bush.position.set(px, 0.9, pz);
          scene.add(bush);
        }
      }

      // Streetlights at intersections, two instanced meshes (poles + lamps).
      const poleSpots = [];
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          poleSpots.push({ x: i * CFG.pitch + CFG.streetHalf + 1, z: j * CFG.pitch + CFG.streetHalf + 1 });
        }
      }
      const poles = fillInstances(new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.12, 0.16, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 }), poleSpots.length),
        poleSpots.map(function (p) { return { x: p.x, y: 3.5, z: p.z }; }));
      scene.add(poles);
      const lamps = fillInstances(new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a }), poleSpots.length),
        poleSpots.map(function (p) { return { x: p.x, y: 7.1, z: p.z }; }));
      scene.add(lamps);

      // Neon downtown strip: glowing signs on poles along the east-west
      // avenue through the centre (z = 0), so the drive downtown reads at
      // golden hour. A few coloured point lights sell the glow.
      const neonWords = ['CORAL', 'PIER 24', 'HOTEL', 'TACOS', 'CLUB NEON', '24H', 'DINE', 'SURF', 'BAR', 'CASINO'];
      const neonColors = ['#ff4fa3', '#29e6ff', '#a8ff3e', '#ff9f1c', '#c77dff', '#ff5a4e'];
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
      for (let k = 0; k < 10; k++) {
        const x = -162 + k * 36;
        const side = k % 2 === 0 ? 1 : -1;
        const color = neonColors[k % neonColors.length];
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 6), poleMat);
        pole.position.set(x, 3.25, side * 9.6);
        scene.add(pole);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75),
          new THREE.MeshBasicMaterial({ map: neonSignTexture(neonWords[k], color) }));
        sign.position.set(x, 5.6, side * 9.6 + (side > 0 ? -0.35 : 0.35));
        if (side > 0) sign.rotation.y = Math.PI; // face the street
        scene.add(sign);
      }
      const neonLights = [[-72, 0xff4fa3], [0, 0x29e6ff], [72, 0xff9f1c]];
      for (const nl of neonLights) {
        const pl = new THREE.PointLight(nl[1], 0.9, 55);
        pl.position.set(nl[0], 6, 0);
        scene.add(pl);
      }

      // Road graph: intersections and neighbours for traffic. Neighbours are
      // references to the same node objects, so a car can keep walking the
      // graph from whichever node it just reached.
      const grid = {};
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          const node = { x: i * CFG.pitch, z: j * CFG.pitch, n: [] };
          grid[i + ',' + j] = node;
          city.intersections.push(node);
        }
      }
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          const node = grid[i + ',' + j];
          if (i > -3) node.n.push(grid[(i - 1) + ',' + j]);
          if (i < 3) node.n.push(grid[(i + 1) + ',' + j]);
          if (j > -3) node.n.push(grid[i + ',' + (j - 1)]);
          if (j < 3) node.n.push(grid[i + ',' + (j + 1)]);
        }
      }

      // Sidewalk spots for pedestrians: along street edges.
      for (let k = 0; k < 160; k++) {
        const horizontal = rng() < 0.5;
        const street = Math.floor(CB.range(rng, -3, 4)) * CFG.pitch;
        const along = CB.range(rng, -216, 216);
        const off = (rng() < 0.5 ? -1 : 1) * (CFG.streetHalf + CB.range(rng, 1.5, 4));
        city.sidewalkSpots.push(horizontal ?
          { x: along, z: street + off } : { x: street + off, z: along });
      }

      // Parked-car spots along curbs.
      for (let k = 0; k < 40; k++) {
        const horizontal = rng() < 0.5;
        const street = Math.floor(CB.range(rng, -3, 4)) * CFG.pitch;
        const along = CB.range(rng, -200, 200);
        const off = (rng() < 0.5 ? -1 : 1) * (CFG.streetHalf - 2.2);
        city.parkedSpots.push(horizontal ?
          { x: along, z: street + off, heading: off > 0 ? Math.PI / 2 : -Math.PI / 2 } :
          { x: street + off, z: along, heading: off > 0 ? Math.PI : 0 });
      }

      return city;
    },

    buildPlaza: function (scene, rng, i, j) {
      const cx = i * CFG.pitch + CFG.pitch / 2;
      const cz = j * CFG.pitch + CFG.pitch / 2;
      // Fountain: stone ring and animated-looking water disc.
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 1.1, 20),
        new THREE.MeshLambertMaterial({ color: 0x9a938a }));
      ring.position.set(cx, 0.55, cz);
      scene.add(ring);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.4, 20),
        new THREE.MeshLambertMaterial({ color: 0x35a7d8 }));
      water.position.set(cx, 0.9, cz);
      scene.add(water);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 3.2, 8),
        new THREE.MeshLambertMaterial({ color: 0xdfe9ea }));
      jet.position.set(cx, 2.4, cz);
      scene.add(jet);
      // Benches around the plaza.
      const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + 0.3;
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
        bench.position.set(cx + Math.cos(ang) * 14, 0.5, cz + Math.sin(ang) * 14);
        bench.rotation.y = -ang + Math.PI / 2;
        scene.add(bench);
      }
    },

    buildPark: function (scene, rng, i, j) {
      const x0 = i * CFG.pitch + CFG.streetHalf;
      const z0 = j * CFG.pitch + CFG.streetHalf;
      const s = CFG.pitch - 2 * CFG.streetHalf;
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(s, s),
        new THREE.MeshLambertMaterial({ color: 0x5da24a }));
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(x0 + s / 2, 0.05, z0 + s / 2);
      scene.add(grass);
      const treeSpots = [];
      for (let k = 0; k < 10; k++) {
        treeSpots.push({
          x: x0 + CB.range(rng, 6, s - 6),
          z: z0 + CB.range(rng, 6, s - 6),
          r: CB.range(rng, 2.2, 3.4),
        });
      }
      const trunks = fillInstances(new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.25, 0.4, 3.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x6b4a2a }), treeSpots.length),
        treeSpots.map(function (t) { return { x: t.x, y: 1.7, z: t.z }; }));
      scene.add(trunks);
      const tops = fillInstances(new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x3f8f3a }), treeSpots.length),
        treeSpots.map(function (t) { return { x: t.x, y: 4.6, z: t.z, sx: t.r, sy: t.r, sz: t.r }; }));
      scene.add(tops);
    },
  };

  CB.City = City;
})();

// ---- Coral Bay v3: day/night, the port, traffic lights, race gate ----------
// Fresh systems layered on the v2 builder: the original build runs first,
// then the wrapper below adds the new district and the new controls.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;
  const THREE = window.THREE;

  function todFromQuery() {
    try {
      const q = new URLSearchParams(window.location.search).get('tod');
      if (!q) return null;
      const named = { night: 22, dusk: 18.5, dawn: 6, day: 12 };
      if (named[q] !== undefined) return named[q];
      const h = parseFloat(q);
      return Number.isFinite(h) ? h : null;
    } catch (e) { return null; }
  }

  const START_HOUR = todFromQuery();

  function skyStops() {
    const C = function (h) { return new THREE.Color(h); };
    return [
      { h: 0, sky: C(0x0a1428), fog: C(0x0a1428), sun: 0.04, sunCol: C(0x8fa8ff), hemi: 0.22, amb: 0.1 },
      { h: 5, sky: C(0x0a1428), fog: C(0x0a1428), sun: 0.04, sunCol: C(0x8fa8ff), hemi: 0.22, amb: 0.1 },
      { h: 6.5, sky: C(0xe8a06a), fog: C(0xd89a7a), sun: 0.35, sunCol: C(0xffb27a), hemi: 0.4, amb: 0.18 },
      { h: 9, sky: C(0x7ec8e8), fog: C(0xf2c98f), sun: 1.15, sunCol: C(0xffd9a8), hemi: 0.75, amb: 0.25 },
      { h: 15, sky: C(0x7ec8e8), fog: C(0xf2c98f), sun: 1.15, sunCol: C(0xffd9a8), hemi: 0.75, amb: 0.25 },
      { h: 17.5, sky: C(0x9a7ab0), fog: C(0xe09a6a), sun: 0.7, sunCol: C(0xff9a5a), hemi: 0.55, amb: 0.2 },
      { h: 18.5, sky: C(0x4a3a6e), fog: C(0xa06a72), sun: 0.3, sunCol: C(0xff7a4a), hemi: 0.4, amb: 0.15 },
      { h: 20, sky: C(0x0a1428), fog: C(0x0a1428), sun: 0.05, sunCol: C(0x8fa8ff), hemi: 0.22, amb: 0.1 },
      { h: 24, sky: C(0x0a1428), fog: C(0x0a1428), sun: 0.04, sunCol: C(0x8fa8ff), hemi: 0.22, amb: 0.1 },
    ];
  }

  const STOPS = skyStops();

  function applyDayNight(city) {
    const L = city.lights;
    if (!L || !L.sun) return;
    const hour = city.timeOfDay;
    let a = STOPS[0], b = STOPS[STOPS.length - 1];
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (hour >= STOPS[i].h && hour <= STOPS[i + 1].h) { a = STOPS[i]; b = STOPS[i + 1]; break; }
    }
    const span = (b.h - a.h) || 1;
    const t = CB.clamp((hour - a.h) / span, 0, 1);
    const scene = city.sceneRef;
    if (scene) {
      scene.background.lerpColors(a.sky, b.sky, t);
      if (scene.fog) scene.fog.color.lerpColors(a.fog, b.fog, t);
    }
    L.sun.intensity = CB.lerp(a.sun, b.sun, t);
    L.sun.color.lerpColors(a.sunCol, b.sunCol, t);
    const ang = ((hour - 6) / 12) * Math.PI;
    L.sun.position.set(180 * Math.cos(ang), Math.max(24, 140 * Math.sin(ang)), 120);
    if (L.hemi) L.hemi.intensity = CB.lerp(a.hemi, b.hemi, t);
    if (L.amb) L.amb.intensity = CB.lerp(a.amb, b.amb, t);
    const night = hour >= 19 || hour < 5.5;
    city.isNight = night;
    if (city.lampMat) city.lampMat.emissiveIntensity = night ? 1.9 : 0.55;
    if (city.neonLights) for (const pl of city.neonLights) pl.intensity = night ? 1.7 : 0.7;
    if (city.portLampMats) for (const m of city.portLampMats) m.emissiveIntensity = night ? 2.2 : 0.7;
    if (city.portLights) for (const pl of city.portLights) pl.intensity = night ? 1.1 : 0;
  }

  CB.City.setTimeOfDay = function (city, hours) {
    if (!city) return;
    const h = ((hours % 24) + 24) % 24;
    city.daySeconds = ((h - 15 + 24) % 24) * (CFG.dayLength / 24);
    city.timeOfDay = h;
    applyDayNight(city);
  };

  CB.City.updateDayNight = function (city, dt) {
    if (!city || !city.lights) return;
    if (CB.Game.state === 'paused') return;
    city.daySeconds = (city.daySeconds || 0) + dt;
    city.timeOfDay = (15 + city.daySeconds / (CFG.dayLength / 24)) % 24;
    applyDayNight(city);
  };

  function paintHead(head, go, yellow) {
    head.g.emissive.setHex(go ? 0x2aff66 : 0x0a2a12);
    head.y.emissive.setHex(yellow ? 0xffd21a : 0x2a220a);
    head.r.emissive.setHex(!go && !yellow ? 0xff2a2a : 0x2a0a0a);
  }

  CB.City.updateLights = function (city) {
    if (!city.trafficLights) return;
    const ph = CB.Game.time % 20;
    for (const L of city.trafficLights) {
      L.ewGo = ph < 8;
      L.ewYellow = ph >= 8 && ph < 10;
      L.nsGo = ph >= 10 && ph < 18;
      L.nsYellow = ph >= 18;
      paintHead(L.ew, L.ewGo, L.ewYellow);
      paintHead(L.ns, L.nsGo, L.nsYellow);
    }
  };

  function boardTexture(words, fg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#0e0e16';
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = fg; g.lineWidth = 3;
    g.strokeRect(4, 4, 248, 56);
    g.font = 'bold 32px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 16;
    g.fillStyle = fg;
    g.fillText(words, 128, 33);
    g.shadowBlur = 0; g.fillStyle = '#ffffff';
    g.fillText(words, 128, 33);
    return new THREE.CanvasTexture(c);
  }

  function buildPort(scene, city, rng) {
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 226),
      new THREE.MeshLambertMaterial({ color: 0x8f8a80 }));
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(-242, 0.03, 0);
    scene.add(slab);
    city.locations.port = { x: -238, z: 0 };
    const boxCols = [0xa34a32, 0x2e6a8a, 0x3f8f3a, 0xc97a1e, 0x7a7a7a, 0x8a4a6a];
    const rows = [-90, -54, -18, 18, 54, 90];
    const cols = [-256, -249, -242];
    for (const rz of rows) {
      for (const cx of cols) {
        const high = 1 + Math.floor(rng() * 3);
        const mat = new THREE.MeshLambertMaterial({ color: boxCols[Math.floor(rng() * boxCols.length)] });
        for (let k = 0; k < high; k++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.6, 2.6), mat);
          box.position.set(cx, 1.3 + k * 2.6, rz);
          box.rotation.y = (rng() - 0.5) * 0.06;
          scene.add(box);
        }
        city.colliders.push({ minX: cx - 3.2, maxX: cx + 3.2, minZ: rz - 1.5, maxZ: rz + 1.5 });
      }
    }
    for (const cz of [-72, 72]) {
      const steel = new THREE.MeshLambertMaterial({ color: 0xd8a018 });
      for (const lx of [-258, -236]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 17, 1.4), steel);
        leg.position.set(lx, 8.5, cz);
        scene.add(leg);
        city.colliders.push({ minX: lx - 0.9, maxX: lx + 0.9, minZ: cz - 0.9, maxZ: cz + 0.9 });
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 1.6, 2.2), steel);
      beam.position.set(-247, 17.6, cz);
      scene.add(beam);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      cab.position.set(-247, 15.4, cz);
      scene.add(cab);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      cable.position.set(-240, 11, cz);
      scene.add(cable);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshLambertMaterial({ color: 0x888888 }));
      hook.position.set(-240, 6.2, cz);
      scene.add(hook);
    }
    const ware = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 12),
      new THREE.MeshLambertMaterial({ color: 0x9a938a }));
    ware.position.set(-252, 4.5, 100);
    scene.add(ware);
    city.colliders.push({ minX: -261, maxX: -243, minZ: 94, maxZ: 106 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.2),
      new THREE.MeshBasicMaterial({ map: boardTexture('PORT', '#ffb02e') }));
    sign.position.set(-242.8, 6.4, 100);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    city.portLampMats = [];
    city.portLights = [];
    for (const lz of [-81, -27, 27, 81]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      pole.position.set(-228, 3.5, lz);
      scene.add(pole);
      const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(-228, 7.2, lz);
      scene.add(lamp);
      city.portLampMats.push(lampMat);
    }
    for (const lz of [-40, 40]) {
      const pl = new THREE.PointLight(0xffd9a0, 0, 60);
      pl.position.set(-240, 9, lz);
      scene.add(pl);
      city.portLights.push(pl);
    }
  }

  function signalHead(scene, x, y, z, ry) {
    const g = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.5, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    g.add(housing);
    const mk = function (col, dy) {
      const m = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: col });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), m);
      s.position.set(0, dy, -0.32);
      g.add(s);
      return m;
    };
    const head = { r: mk(0x2a0a0a, 0.8), y: mk(0x2a220a, 0), g: mk(0x2aff66, -0.8) };
    g.position.set(x, y, z);
    g.rotation.y = ry;
    scene.add(g);
    return head;
  }

  function buildSignals(scene, city) {
    city.trafficLights = [];
    city.lightByKey = {};
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const x = i * CFG.pitch, z = j * CFG.pitch;
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7.5, 6), poleMat);
        pole.position.set(x + 10, 3.75, z - 10);
        scene.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 9), poleMat);
        arm.position.set(x + 10, 7.2, z - 5.5);
        scene.add(arm);
        const ew = signalHead(scene, x + 10, 6.4, z - 1.5, 0);
        const ns = signalHead(scene, x + 10, 6.4, z - 9.5, Math.PI / 2);
        const L = { i: i, j: j, x: x, z: z, ewGo: true, ewYellow: false, nsGo: false, nsYellow: false, ew: ew, ns: ns };
        city.trafficLights.push(L);
        city.lightByKey[i + ',' + j] = L;
      }
    }
  }

  function checkTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const g = c.getContext('2d');
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 8; k++) {
        g.fillStyle = (r + k) % 2 === 0 ? '#111111' : '#f5f5f5';
        g.fillRect(k * 16, r * 16, 16, 16);
      }
    }
    return new THREE.CanvasTexture(c);
  }

  function buildRaceGate(scene, city) {
    city.locations.raceGate = { x: 36, z: 0 };
    const postMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    for (const pz of [-8.5, 8.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 5.4, 8), postMat);
      post.position.set(36, 2.7, pz);
      scene.add(post);
      city.colliders.push({ minX: 35.2, maxX: 36.8, minZ: pz - 0.8, maxZ: pz + 0.8 });
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(17, 2.2),
      new THREE.MeshBasicMaterial({ map: checkTexture(), side: THREE.DoubleSide }));
    flag.rotation.y = Math.PI / 2;
    flag.position.set(36, 5.0, 0);
    scene.add(flag);
  }

  const baseBuild = CB.City.build;
  CB.City.build = function (scene, rng) {
    const city = baseBuild.call(CB.City, scene, rng);
    city.sceneRef = scene;
    for (const n of city.intersections) {
      n.i = Math.round(n.x / CFG.pitch);
      n.j = Math.round(n.z / CFG.pitch);
    }
    city.lights = {};
    for (const o of scene.children) {
      if (o.isDirectionalLight) city.lights.sun = o;
      else if (o.isHemisphereLight) city.lights.hemi = o;
      else if (o.isAmbientLight) city.lights.amb = o;
      else if (o.isPointLight) {
        city.neonLights = city.neonLights || [];
        city.neonLights.push(o);
      } else if (o.isInstancedMesh && o.material && o.material.emissive &&
        o.material.emissive.getHex() === 0xffdf8a) {
        city.lampMat = o.material;
      }
    }
    const startHour = START_HOUR === null ? 15 : START_HOUR;
    city.daySeconds = ((startHour - 15 + 24) % 24) * (CFG.dayLength / 24);
    city.timeOfDay = startHour;
    city.isNight = startHour >= 19 || startHour < 5.5;
    buildPort(scene, city, rng);
    buildSignals(scene, city);
    buildRaceGate(scene, city);
    applyDayNight(city);
    return city;
  };
})();
