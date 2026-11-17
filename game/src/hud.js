// Coral Bay — hud.js
// One clear job: everything drawn on top of the 3D view — the HUD (cash,
// health, wanted stars, speed, objective), the live minimap, the start,
// pause, wasted and busted screens, and the banners and toasts that tell the
// story. It reads game state; it never simulates it.
(function () {
  'use strict';
  const CB = window.CB;
  const CFG = CB.CFG;

  function el(id) { return document.getElementById(id); }

  const HUD = {
    minimap: null,
    mctx: null,
    bannerTimer: null,
    toastTimer: null,
    trackerKey: '',

    init: function () {
      this.minimap = el('minimap');
      this.mctx = this.minimap.getContext('2d');
    },

    show: function (id, on) { el(id).style.display = on ? 'flex' : 'none'; },
    showHud: function (on) { el('hud').style.display = on ? 'block' : 'none'; },

    showTitle: function (hasSave) {
      this.show('screen-title', true);
      this.showHud(false);
      el('btn-continue').style.display = hasSave ? 'inline-block' : 'none';
    },

    hideTitle: function () { this.show('screen-title', false); this.showHud(true); },

    banner: function (title, sub) {
      const b = el('banner');
      el('banner-title').textContent = title;
      el('banner-sub').textContent = sub || '';
      b.classList.remove('show');
      void b.offsetWidth; // restart the CSS animation
      b.classList.add('show');
      if (this.bannerTimer) clearTimeout(this.bannerTimer);
      const self = this;
      this.bannerTimer = setTimeout(function () { b.classList.remove('show'); }, 4200);
    },

    flashObjective: function (text) {
      const t = el('toast');
      t.textContent = text;
      t.classList.add('show');
      if (this.toastTimer) clearTimeout(this.toastTimer);
      const self = this;
      this.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4000);
    },

    setInteract: function (text) {
      const p = el('interact');
      if (text) { p.textContent = text; p.style.display = 'block'; }
      else p.style.display = 'none';
    },

    update: function (player) {
      el('cash').textContent = '$' + Math.floor(player.cash).toLocaleString('en-US');
      el('health-fill').style.width = Math.max(0, player.health) + '%';
      el('health-fill').style.background = player.health > 50 ? '#2ecc71' :
        player.health > 25 ? '#f39c12' : '#e74c3c';
      // Wanted stars.
      let stars = '';
      for (let i = 0; i < CFG.maxWanted; i++) stars += i < CB.Police.wanted ? '★' : '☆';
      el('stars').textContent = stars;
      el('stars').style.color = CB.Police.wanted > 0 ? '#ffd21a' : 'rgba(255,255,255,0.35)';
      // Speedometer: big readout, class badge, and a bar that fills with speed.
      const kmh = Math.round(Math.abs(player.inCar ? player.carSpeed : player.footSpeed) * 3.6);
      el('speed').textContent = player.inCar ? kmh + ' km/h' : '';
      el('speed-label').textContent = player.inCar ? 'SPEED' : '';
      const top = player.inCar && player.car && player.car.stats ? player.car.stats.topSpeed : 1;
      el('speed-fill').style.width = player.inCar ?
        Math.round(Math.min(100, Math.abs(player.carSpeed) / top * 100)) + '%' : '0%';
      el('speed-class').textContent = player.inCar && player.car && player.car.stats ?
        player.car.stats.label + ' · ' + Math.round(top * 3.6) + ' TOP' : '';
      // Objective tracker panel: mission steps with done/current marks.
      this.updateTracker();
      // Objective and timers.
      el('objective').textContent = CB.Missions.objectiveText;
      const timer = CB.Missions.missionTimerText() || CB.Missions.taxiTimerText() || CB.Missions.courierTimerText();
      el('timer').textContent = timer;
      el('timer').style.display = timer ? 'block' : 'none';
      // Crosshair only on foot with the pistol out.
      el('crosshair').style.display = (!player.inCar && CB.Game.state === 'playing') ? 'block' : 'none';
      // Damage vignette.
      el('damage').style.opacity = player.health < 100 ?
        String((1 - player.health / 100) * 0.55) : '0';
      this.drawMinimap(player);
    },

    // Mission-objective tracker: rebuilds only when the steps change.
    updateTracker: function () {
      const data = CB.Missions.trackerData();
      const key = data.title + '|' + data.steps.map(function (s) {
        return (s.done ? '1' : '0') + (s.current ? '1' : '0') + s.text;
      }).join('|');
      if (key === this.trackerKey) return;
      this.trackerKey = key;
      el('tracker-title').textContent = data.title;
      const box = el('tracker-steps');
      box.innerHTML = '';
      for (const s of data.steps) {
        const row = document.createElement('div');
        row.className = 'tracker-step' + (s.done ? ' done' : '') + (s.current ? ' current' : '');
        row.textContent = (s.done ? '✓ ' : s.current ? '▸ ' : '· ') + s.text;
        box.appendChild(row);
      }
    },

    drawMinimap: function (player) {
      const ctx = this.mctx;
      const S = 190, HALF = 268;
      const px = function (x) { return (x + HALF) / (HALF * 2) * S; };
      const pz = function (z) { return (z + HALF) / (HALF * 2) * S; };
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(10,16,24,0.82)';
      ctx.fillRect(0, 0, S, S);
      // Ocean strip (south).
      ctx.fillStyle = '#1e7fa8';
      ctx.fillRect(0, pz(CFG.beachZ), S, S - pz(CFG.beachZ));
      // Blocks.
      ctx.fillStyle = '#3d4450';
      for (let i = -3; i < 3; i++) {
        for (let j = -3; j < 3; j++) {
          ctx.fillRect(px(i * CFG.pitch + CFG.streetHalf), pz(j * CFG.pitch + CFG.streetHalf),
            px((i + 1) * CFG.pitch - CFG.streetHalf) - px(i * CFG.pitch + CFG.streetHalf),
            pz((j + 1) * CFG.pitch - CFG.streetHalf) - pz(j * CFG.pitch + CFG.streetHalf));
        }
      }
      // Roads.
      ctx.strokeStyle = '#8a929e';
      ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(0, pz(i * CFG.pitch)); ctx.lineTo(S, pz(i * CFG.pitch)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px(i * CFG.pitch), 0); ctx.lineTo(px(i * CFG.pitch), S); ctx.stroke();
      }
      // Mission marker: pulsing yellow diamond.
      const marker = CB.Missions.markerPos;
      if (marker) {
        const pulse = 5 + Math.sin(CB.Game.time * 4) * 1.5;
        ctx.fillStyle = '#ffc21a';
        ctx.beginPath();
        ctx.moveTo(px(marker.x), pz(marker.z) - pulse);
        ctx.lineTo(px(marker.x) + pulse, pz(marker.z));
        ctx.lineTo(px(marker.x), pz(marker.z) + pulse);
        ctx.lineTo(px(marker.x) - pulse, pz(marker.z));
        ctx.closePath(); ctx.fill();
      }
      // Traffic cars: grey dots.
      ctx.fillStyle = '#c8ccd2';
      for (const car of CB.Vehicles.traffic) {
        ctx.fillRect(px(car.x) - 1.5, pz(car.z) - 1.5, 3, 3);
      }
      // Police: flashing red/blue dots.
      for (const cop of CB.Police.cops) {
        ctx.fillStyle = (Math.floor(CB.Game.time * 4) % 2 === 0) ? '#ff3333' : '#3388ff';
        ctx.beginPath(); ctx.arc(px(cop.x), pz(cop.z), 3.5, 0, Math.PI * 2); ctx.fill();
      }
      // Player arrow, rotated to heading.
      ctx.save();
      ctx.translate(px(player.x), pz(player.z));
      ctx.rotate(player.heading);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  };

  CB.HUD = HUD;
})();
