// ════════════════════════════════════════════════════════
//  THE LONGEST RUN — Ödül Sistemi (Diminishing Returns & Badges)
// ════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LongestRunRewards = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const DIMS = ['scoring','range','inside','playmaking','ball_care','rebounding','perimeter_def','rim_protection'];

// Azalan Verimler Katsayıları (Kalan mesafeye göre artış)
const TIER_RATE = { Rotation: 0.16, Star: 0.24, Legend: 0.35 };

function tierProbs(streak) {
  const legendary = Math.min(0.35, 0.05 + streak * 0.015);
  const common = Math.max(0.20, 0.65 - streak * 0.02);
  const rare = Math.max(0.10, 1 - legendary - common);
  return { Rotation: common, Star: rare, Legend: legendary };
}

function rollTier(rng, streak) {
  const p = tierProbs(streak);
  const r = rng();
  if (r < p.Legend) return 'Legend';
  if (r < p.Legend + p.Star) return 'Star';
  return 'Rotation';
}

function calculateBoost(currentVal, tier) {
  const remaining = Math.max(0, 99 - currentVal);
  if (remaining === 0) return 0; // 99 ise ek sayı artışı yok, rozet tetiklenir
  const rate = TIER_RATE[tier] || 0.2;
  return Math.max(1, Math.min(remaining, Math.round(remaining * rate)));
}

function makeCard(rng, streak, donorPool, currentTeam) {
  const tier = rollTier(rng, streak);
  const pool = donorPool.filter((d) => d.tier === tier);
  const donor = pool[Math.floor(rng() * pool.length)];

  // Donörün en güçlü olduğu boyutu seç
  const sortedDims = DIMS.slice().sort((a, b) => donor[b] - donor[a]);
  const primaryDim = sortedDims[0];
  const secondaryDim = tier === 'Legend' ? sortedDims[1] : null;

  const currentPrimaryVal = currentTeam ? currentTeam[donor.slot].dims[primaryDim] : 75;
  const primaryBoost = calculateBoost(currentPrimaryVal, tier);

  return {
    id: donor.id + ':' + primaryDim,
    slot: donor.slot,
    tier,
    sourceDonor: donor.name,
    sourceDonorId: donor.bbrefId,
    era: donor.era,
    primaryDim,
    secondaryDim,
    primaryBoost,
    secondaryBoost: secondaryDim ? Math.max(1, Math.round(primaryBoost * 0.5)) : 0
  };
}

function rollCardOptions(rng, streak, donorPool, currentTeam, n) {
  n = n || 3;
  const out = []; let guard = 0;
  const seen = new Set();
  while (out.length < n && guard++ < 40) {
    const c = makeCard(rng, streak, donorPool, currentTeam);
    const key = c.slot + ':' + c.primaryDim;
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}

function applyCard(team, card) {
  const build = team[card.slot];
  const oldVal = build.dims[card.primaryDim];
  
  build.dims[card.primaryDim] = Math.min(99, oldVal + card.primaryBoost);
  if (card.secondaryDim) {
    build.dims[card.secondaryDim] = Math.min(99, build.dims[card.secondaryDim] + card.secondaryBoost);
  }

  // 99 Tavanı Aşımı: HOF Rozeti Ekle
  build.badges = build.badges || [];
  if (build.dims[card.primaryDim] >= 99 && !build.badges.includes(card.primaryDim)) {
    build.badges.push(card.primaryDim);
  }

  build.absorbed = build.absorbed || [];
  build.absorbed.push(`${card.sourceDonor} (${card.era})`);
  return build;
}

function isBossWin(streak) { return streak > 0 && streak % 5 === 0; }
function isShieldMilestone(streak) { return streak > 0 && streak % 10 === 0; }

return { DIMS, rollCardOptions, applyCard, isBossWin, isShieldMilestone };
}));