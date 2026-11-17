// Coral Bay — audio.js
// One clear job: every sound the game makes, synthesised with WebAudio so the
// game ships no audio files. Engine hum, police siren, gunshots, pickups, UI
// blips and a low-key bass groove. Created on the first user gesture.
(function () {
  'use strict';
  const CB = window.CB;

  const AudioSys = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: null,
    musicStep: 0,
    muted: false,

    init: function () {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },

    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMuted: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    // Continuous engine hum: two detuned saws through a low-pass, pitch follows speed.
    engineStart: function () {
      if (!this.ctx || this.engineOsc) return;
      const ctx = this.ctx;
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 28;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      osc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      osc2.start();
      this.engineOsc2 = osc2;
    },

    engineSet: function (speedRatio, on) {
      if (!this.ctx || !this.engineOsc) return;
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(28 + speedRatio * 82, t, 0.08);
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.06 : 0.0, t, 0.1);
    },

    engineStop: function () {
      if (!this.engineOsc) return;
      try { this.engineOsc.stop(); this.engineOsc2.stop(); } catch (e) {}
      this.engineOsc = null;
      this.engineOsc2 = null;
    },

    // Two-tone police siren, looped while any cop is near.
    sirenStart: function () {
      if (!this.ctx || this.sirenOsc) return;
      const ctx = this.ctx;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    },

    sirenSet: function (on) {
      if (!this.ctx || !this.sirenOsc) return;
      this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, this.ctx.currentTime, 0.2);
    },

    // One-shot helpers.
    blip: function (freq, dur, type, vol) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(ctx.currentTime + (dur || 0.12));
    },

    shot: function () {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const len = ctx.sampleRate * 0.14;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      this.blip(160, 0.08, 'square', 0.18);
    },

    crash: function (hard) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const len = ctx.sampleRate * 0.25;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = hard ? 900 : 500;
      const g = ctx.createGain();
      g.gain.value = hard ? 0.5 : 0.25;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
    },

    chime: function () {
      this.blip(880, 0.12, 'sine', 0.16);
      const self = this;
      setTimeout(function () { self.blip(1318, 0.18, 'sine', 0.16); }, 90);
    },

    // Pickup chime: a brighter, quicker three-note sparkle than the mission
    // chime, so grabbing health/ammo/repair reads as its own event.
    pickupChime: function () {
      const self = this;
      [1046, 1318, 1568].forEach(function (n, i) {
        setTimeout(function () { self.blip(n, 0.1, 'triangle', 0.14); }, i * 60);
      });
    },

    // Jump: a quick rising whoosh; land: a soft low thud.
    jump: function () {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(280, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.16);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(ctx.currentTime + 0.18);
    },

    land: function () {
      this.blip(95, 0.12, 'sine', 0.14);
    },

    missionSting: function () {
      const notes = [523, 659, 784, 1046];
      const self = this;
      notes.forEach(function (n, i) {
        setTimeout(function () { self.blip(n, 0.22, 'triangle', 0.18); }, i * 110);
      });
    },

    failSting: function () {
      const self = this;
      [330, 262, 196].forEach(function (n, i) {
        setTimeout(function () { self.blip(n, 0.3, 'sawtooth', 0.12); }, i * 140);
      });
    },

    // A quiet bass groove: a 8-step loop, scheduled with setInterval.
    musicStart: function () {
      if (!this.ctx || this.musicTimer) return;
      const bass = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
      const self = this;
      this.musicTimer = setInterval(function () {
        if (self.muted) return;
        const n = bass[self.musicStep % bass.length];
        self.musicStep++;
        if (n) self.blip(n, 0.32, 'triangle', 0.07);
        if (self.musicStep % 4 === 2) self.blip(220, 0.1, 'sine', 0.03);
      }, 300);
    },

    musicStop: function () {
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    },
  };

  CB.AudioSys = AudioSys;
})();
