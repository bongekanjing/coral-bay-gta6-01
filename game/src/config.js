// Coral Bay — config.js
// One clear job: every tunable number, colour and name the game uses, plus the
// seeded random number generator that makes the city identical for a seed.
// Nothing here touches the scene; other files read CFG and makeRng.
(function () {
  'use strict';

  // Seeded RNG (mulberry32): the same seed builds the same city, so screenshots
  // taken with ?seed=N are reproducible.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const CFG = {
    gameTitle: 'CORAL BAY',
    gameSubtitle: 'an open-world crime story',
    seed: 7,

    // City grid: streets on a pitch, blocks between them.
    pitch: 72,            // distance between parallel street centrelines
    streetHalf: 8,        // half the road width (asphalt)
    blocks: 3,            // streets at i*pitch for i in -3..3
    blockMargin: 3,       // gap between a block edge and its buildings
    beachZ: 252,          // south edge of the city: sand starts here
    waterZ: 292,          // ocean plane starts here
    bounds: 260,          // play area half-size (north/west/east hard walls)

    // Golden-hour look.
    skyTop: 0x7ec8e8,
    skyBottom: 0xffd9a0,
    fogColor: 0xf2c98f,
    fogNear: 180,
    fogFar: 620,
    sunColor: 0xffd9a8,
    sunIntensity: 1.15,
    sunPos: [180, 140, 120],
    hemiSky: 0x9fd4ff,
    hemiGround: 0x8a6a4a,
    hemiIntensity: 0.75,

    // Player on foot.
    walkSpeed: 6,
    runSpeed: 10,
    playerRadius: 0.55,
    playerHealth: 100,
    jumpVelocity: 8.5,   // Space on foot: vertical launch speed
    gravity: 22,         // pulls the player back down after a jump
    jumpCooldown: 0.25,  // seconds between jumps

    // Driving (arcade). The per-class table below overrides these defaults;
    // the numbers here are the sedan's, kept as the fallback.
    carAccel: 26,
    carBrake: 42,
    carReverse: 14,
    carTopSpeed: 42,      // ~150 km/h feel
    carTopReverse: 12,
    carSteer: 0.55,       // radians per second at full lock, scaled by speed
    carGrip: 6.5,
    handbrakeGrip: 1.6,
    carRadius: 1.6,
    carHealth: 100,

    // Car classes: sport is quick and twitchy, sedan is the all-rounder,
    // van is slow but sturdy. Traffic and parked cars roll a class; the
    // player's handling follows the car they stole.
    carClasses: {
      sport: { topSpeed: 54, accel: 36, steer: 0.66, grip: 7.6, reverse: 13, label: 'SPORT' },
      sedan: { topSpeed: 42, accel: 26, steer: 0.55, grip: 6.5, reverse: 12, label: 'SEDAN' },
      van:   { topSpeed: 33, accel: 19, steer: 0.46, grip: 5.4, reverse: 11, label: 'VAN' },
    },
    carClassWeights: { sport: 0.25, sedan: 0.55, van: 0.2 },

    // Traffic and pedestrians.
    trafficCount: 14,
    trafficSpeed: 9,
    pedCount: 26,
    pedSpeed: 1.6,

    // Police and wanted.
    maxWanted: 5,
    wantedDecayDelay: 8,  // seconds with no crime and no cop near before decay
    wantedDecayStep: 6,   // seconds per star lost while hidden
    copTopSpeed: 40,
    copRamDamage: 8,
    bustedHold: 2.5,      // seconds a cop must stay close on foot to bust you
    bustFine: 100,
    wastedFine: 150,

    // Combat.
    pistolDamage: 34,
    pistolRange: 70,
    pistolRate: 0.22,     // seconds between shots
    pistolMag: 12,
    reloadTime: 1.2,

    // Missions and money.
    missionRewards: [300, 500, 800, 1000, 1200],
    taxiFare: [40, 80],
    stashReward: 100,
    stashCount: 10,
    // Courier runs: repeatable timed deliveries, unlocked after mission 2.
    courierFare: [120, 220],
    courierTime: 90,      // seconds to reach the drop-off once the parcel is aboard
    courierCooldown: 20,  // seconds between courier offers

    // Pickups scattered around the city: health, ammo and car repair.
    // Each type respawns a while after being taken.
    pickupCounts: { health: 6, ammo: 6, repair: 5 },
    pickupRespawn: 45,    // seconds before a taken pickup comes back
    healthPickupAmount: 40,
    ammoPickupAmount: 12, // refills the pistol magazine
    repairPickupAmount: 50,

    // Camera.
    camDistCar: 10.5,
    camDistFoot: 6.5,
    camHeightCar: 4.2,
    camHeightFoot: 3.0,

    // Colours.
    carPalette: [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22,
      0x1abc9c, 0xecf0f1, 0x2c3e50, 0xd35400, 0x7f8c8d, 0x16a085],
    pedPalette: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c,
      0xd35400, 0xfd79a8, 0x00b894, 0x6c5ce7],
    buildingPalette: [0xe8dcc8, 0xd9c1a3, 0xc9b8a6, 0xb8c4c9, 0xe3cfa8, 0xcfd8dc,
      0xe6b8a2, 0xa8c6a0, 0xd7ccc8, 0xf0e6d2],
  };

  window.CB = window.CB || {};
  window.CB.CFG = CFG;
  window.CB.makeRng = makeRng;
  window.CB.pick = pick;
  window.CB.range = range;
  window.CB.clamp = clamp;
  window.CB.lerp = lerp;
})();
