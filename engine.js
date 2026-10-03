// ════════════════════════════════════════════════════════
//  THE LONGEST RUN — Motor v2 (Dengelenmiş Dinamik Eğri)
// ════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LongestRunEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const DIMS = ['scoring','range','inside','playmaking','ball_care','rebounding','perimeter_def','rim_protection'];
const TIER_COST = { Rotation: 1, Star: 3, Legend: 5 };
const BUILD_BUDGET = 10;
const SLOT_ORDER = ['Guard', 'Wing', 'Big'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blendBuild(donorPicks) {
  const totalW = donorPicks.reduce((s, d) => s + d.weight, 0) || 1;
  const prof = {};
  DIMS.forEach((k) => {
    prof[k] = Math.round(donorPicks.reduce((s, d) => s + d.donor[k] * d.weight, 0) / totalW);
  });
  const cost = donorPicks.reduce((s, d) => s + TIER_COST[d.donor.tier], 0);
  return { 
    dims: prof, 
    donors: donorPicks.map((d) => ({ id: d.donor.id, name: d.donor.name, weight: d.weight, tier: d.donor.tier })), 
    cost 
  };
}

function validateBuild(build) {
  if (build.cost > BUILD_BUDGET) return { ok: false, reason: 'budget_asildi', over: build.cost - BUILD_BUDGET };
  if (build.donors.length > 3) return { ok: false, reason: 'cok_fazla_donor' };
  return { ok: true };
}

const DEFAULT_WEIGHTS = [0.5, 0.3, 0.2];

const OVR_W = { 
  scoring: .12, range: .14, inside: .12, playmaking: .12, 
  ball_care: .08, rebounding: .14, perimeter_def: .14, rim_protection: .14 
};

function overall(dims) {
  const raw = DIMS.reduce((s, k) => s + dims[k] * OVR_W[k], 0);
  return Math.round(raw);
}
function teamOverall(team) { 
  return Math.round(team.reduce((s, p) => s + overall(p.dims), 0) / team.length); 
}

const K = { turnover: 0.15, shot3: 0.60, shot2: 0.88, reboundBase: 0.26, homeEdge: 0.02 };
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function pickShooter(rng, off) {
  const w = off.map((p) => Math.pow(10, (p.dims.scoring * 0.7 + p.dims.playmaking * 0.3) / 50));
  const sum = w.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < off.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return off.length - 1;
}

function simulatePossession(rng, off, def, myScore, oppScore, offIsHome, clock) {
  const offAvg = (k) => off.reduce((s, p) => s + p.dims[k], 0) / off.length;
  const defAvg = (k) => def.reduce((s, p) => s + p.dims[k], 0) / def.length;

  const ballSecurity = offAvg('ball_care') * 0.65 + offAvg('playmaking') * 0.35;
  const defPressure = defAvg('perimeter_def') * 0.5 + defAvg('rim_protection') * 0.5;
  const tov = sigmoid((ballSecurity - defPressure) / -36) * K.turnover;
  if (rng() < tov) return { type: 'turnover' };

  const shooterIdx = pickShooter(rng, off);
  const shooter = off[shooterIdx];
  const is3 = rng() < sigmoid((shooter.dims.range - shooter.dims.inside) / 22) * 0.55 + 0.12;

  const off_skill = 0.60 * (is3 ? shooter.dims.range : shooter.dims.inside) + 0.22 * shooter.dims.scoring + 0.18 * offAvg('playmaking');
  const def_wall = is3 ? defAvg('perimeter_def') : defAvg('rim_protection');
  let makeProb = (is3 ? K.shot3 : K.shot2) * sigmoid((off_skill - def_wall) / 30);
  if (offIsHome) makeProb += K.homeEdge;
  const clutch = clock === 'late' && Math.abs(myScore - oppScore) <= 2;
  if (clutch) makeProb += sigmoid((shooter.dims.scoring - defAvg('perimeter_def')) / 30) * 0.05;
  makeProb = Math.min(0.92, Math.max(0.08, makeProb));

  if (rng() < makeProb) return { type: 'make', pts: is3 ? 2 : 1, shooter: shooter.name, is3 };

  const orbP = K.reboundBase + (offAvg('rebounding') - defAvg('rebounding')) / 260;
  const offReb = rng() < Math.min(0.55, Math.max(0.08, orbP));
  return { type: 'miss', offReb };
}

function playMatch(rng, teamA, teamB, target) {
  target = target || 11;
  const homeIsA = rng() < 0.5;
  let scoreA = 0, scoreB = 0, aHasBall = rng() < 0.5, poss = 0, log = [];
  while (scoreA < target && scoreB < target && poss < 300) {
    poss++;
    const clock = (Math.max(scoreA, scoreB) >= target - 2) ? 'late' : 'normal';
    const offIsHome = aHasBall ? homeIsA : !homeIsA;
    const ev = simulatePossession(rng, aHasBall ? teamA : teamB, aHasBall ? teamB : teamA, aHasBall ? scoreA : scoreB, aHasBall ? scoreB : scoreA, offIsHome, clock);
    if (ev.type === 'make') { 
      if (aHasBall) scoreA += ev.pts; else scoreB += ev.pts; 
      log.push({ ...ev, side: aHasBall ? 'A' : 'B' }); 
      aHasBall = !aHasBall; 
    } else if (ev.type === 'turnover') { 
      log.push({ ...ev, side: aHasBall ? 'A' : 'B' }); 
      aHasBall = !aHasBall; 
    } else { 
      log.push({ ...ev, side: aHasBall ? 'A' : 'B' }); 
      if (!ev.offReb) aHasBall = !aHasBall; 
    }
  }
  return { win: scoreA > scoreB, scoreA, scoreB, poss, log };
}

// ---------- RAKİP OVR HESAPLAMASI (54'TE KİLİTLENMEYEN AKICI EĞRİ) ----------
function calculateTargetOvr(anchorOvr, streak, liveOvr) {
  // 54'te kilitlenme sorununu çözen kademeli zorluk:
  // İlk maç oyuncu OVR'ından 5 puan geride başlar, her galibiyette +1.2 OVR tırmanır.
  const baseTarget = (anchorOvr - 5) + (streak * 1.25);
  // Uzun serilerde takımın gerçek gelişimini de yumuşakça dahil et
  const liveInfluence = Math.min(0.3, streak / 40);
  const blended = baseTarget * (1 - liveInfluence) + (liveOvr || anchorOvr) * liveInfluence;
  return Math.min(96, Math.max(62, Math.round(blended)));
}

function buildOpponent(rng, anchorOvr, streak, donorPool, liveOvr) {
  const targetOvr = calculateTargetOvr(anchorOvr, streak, liveOvr);
  const picks = SLOT_ORDER.map((slot) => {
    const pool = donorPool.filter((d) => d.slot === slot);
    const sorted = pool.map((d) => ({ d, diff: Math.abs(overall(d) - targetOvr) })).sort((a, b) => a.diff - b.diff);
    const cand = sorted.slice(0, 5);
    const base = cand[Math.floor(rng() * cand.length)].d;

    const baseOvr = overall(base);
    let dims = { ...base };
    const diff = targetOvr - baseOvr;
    if (Math.abs(diff) > 1) {
      DIMS.forEach((k) => {
        dims[k] = Math.min(99, Math.max(35, Math.round(base[k] + diff * 0.75)));
      });
    }
    return { dims, name: base.name, era: base.era, bbrefId: base.bbrefId };
  });
  return { players: picks, ovr: teamOverall(picks.map((p) => ({ dims: p.dims }))) };
}

function buildBossOpponent(anchorOvr, streak, donorPool, liveOvr) {
  const targetOvr = calculateTargetOvr(anchorOvr, streak, liveOvr) + 4; // Boss +4 OVR daha güçlü
  const picks = SLOT_ORDER.map((slot) => {
    const pool = donorPool.filter((d) => d.slot === slot && d.tier === 'Legend');
    const candPool = pool.length ? pool : donorPool.filter((d) => d.slot === slot);
    const sorted = candPool.map((d) => ({ d, diff: Math.abs(overall(d) - targetOvr) })).sort((a, b) => a.diff - b.diff);
    const base = sorted[0].d;
    return { dims: { ...base }, name: base.name, era: base.era, bbrefId: base.bbrefId, isBoss: true };
  });
  return { players: picks, ovr: teamOverall(picks.map((p) => ({ dims: p.dims }))), isBoss: true };
}

return { 
  DIMS, TIER_COST, BUILD_BUDGET, DEFAULT_WEIGHTS, mulberry32, blendBuild, validateBuild,
  overall, teamOverall, simulatePossession, playMatch, buildOpponent, buildBossOpponent, K 
};
}));