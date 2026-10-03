// ════════════════════════════════════════════════════════
//  THE LONGEST RUN — App Logic (Dönem Kartları & Kalıcı Koleksiyon)
// ════════════════════════════════════════════════════════
const E = window.LongestRunEngine;
const R = window.LongestRunRewards;
const SLOTS = ['Guard', 'Wing', 'Big'];
const SLOT_ICON = { Guard: '🎯', Wing: '🦅', Big: '🛡️' };

function bbrefImg(id) { 
  return `https://www.basketball-reference.com/req/202106291/images/players/${id}.jpg`; 
}
function fallbackImg(el) { 
  el.onerror = null; 
  el.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#182030"/><text x="50" y="56" font-size="40" text-anchor="middle" fill="#3a4860">🏀</text></svg>'
  ); 
}

const UserAccount = {
  tickets: +(localStorage.getItem('tlr_tickets') || 3),
  tokens: +(localStorage.getItem('tlr_tokens') || 0),
  bestStreak: +(localStorage.getItem('tlr_best') || 0),
  totalWins: +(localStorage.getItem('tlr_total_wins') || 0),
  binder: JSON.parse(localStorage.getItem('tlr_binder') || '[]'),

  save() {
    localStorage.setItem('tlr_tickets', this.tickets);
    localStorage.setItem('tlr_tokens', this.tokens);
    localStorage.setItem('tlr_best', this.bestStreak);
    localStorage.setItem('tlr_total_wins', this.totalWins);
    localStorage.setItem('tlr_binder', JSON.stringify(this.binder));
  },
  addCardToBinder(cardId) {
    if (!this.binder.includes(cardId)) {
      this.binder.push(cardId);
      this.save();
    }
  }
};

const Game = {
  rng: E.mulberry32(Date.now() % 2147483647),
  team: { Guard: null, Wing: null, Big: null },
  draftIdx: 0,
  draftPicks: [],
  draftCands: [],
  streak: 0,
  shields: 0,
  anchorOvr: 0,
  lastOpponent: null,
  lastResult: null,
  currentOpponent: null,
  currentIsBoss: false,
};

function teamArr() {
  return SLOTS.map((s) => ({ dims: Game.team[s].dims, name: Game.team[s].name }));
}
function liveOvr() { return E.teamOverall(teamArr()); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function updateHeaderUI() {
  document.getElementById('user-tickets').textContent = UserAccount.tickets;
  document.getElementById('user-tokens').textContent = UserAccount.tokens;
  document.getElementById('menu-best').textContent = UserAccount.bestStreak;
  document.getElementById('menu-total-wins').textContent = UserAccount.totalWins;
}

// ---------- DRAFT ----------
function startDraft() {
  if (UserAccount.tickets <= 0) {
    alert('Biletleriniz bitti! Günlük görevleri tamamlayarak veya yarın giriş yaparak bilet kazanabilirsiniz.');
    return;
  }
  UserAccount.tickets--;
  UserAccount.save();
  updateHeaderUI();

  Game.team = { Guard: null, Wing: null, Big: null };
  Game.draftIdx = 0;
  Game.streak = 0;
  Game.shields = 0;
  Game.rng = E.mulberry32(Date.now() % 2147483647);
  showScreen('screen-draft');
  renderDraftSlot();
}

function sampleCandidates(slot, n) {
  const pool = DONORS_DATA.filter((d) => d.slot === slot);
  const shuffled = pool.slice().sort(() => 0.5 - Game.rng());
  return shuffled.slice(0, n);
}

function renderDraftSlot() {
  const slot = SLOTS[Game.draftIdx];
  Game.draftPicks = [];
  Game.draftCands = sampleCandidates(slot, 6);
  document.getElementById('draft-slot-title').textContent = `${SLOT_ICON[slot]} Draft your ${slot}`;
  const grid = document.getElementById('draft-cards');
  grid.innerHTML = '';
  Game.draftCands.forEach((d) => grid.appendChild(donorCard(d, false)));
  updateDraftFooter();
}

function donorCard(donor, selected) {
  const el = document.createElement('div');
  el.className = 'donor-card tier-' + donor.tier.toLowerCase() + (selected ? ' selected' : '');
  const topDims = E.DIMS.slice().sort((a, b) => donor[b] - donor[a]).slice(0, 2);
  el.innerHTML = `
    <img class="avatar-circle" src="${bbrefImg(donor.bbrefId)}" onerror="fallbackImg(this)">
    <div class="dc-name">${donor.name}</div>
    <div class="dc-era">${donor.era}</div>
    <div class="dc-tier">${donor.tier}</div>
    <div class="dc-stats">${topDims.map((k) => `<span>${dimLabel(k)}${donor[k]}</span>`).join('')}</div>`;
  el.addEventListener('click', () => toggleDonor(donor, el));
  return el;
}

function dimLabel(k) {
  return { 
    scoring: 'SCR', range: 'RNG', inside: 'INS', playmaking: 'PLY', 
    ball_care: 'BCR', rebounding: 'REB', perimeter_def: 'PER', rim_protection: 'RIM' 
  }[k] || k;
}

function toggleDonor(donor, el) {
  const idx = Game.draftPicks.findIndex((p) => p.donor.id === donor.id);
  if (idx >= 0) { 
    Game.draftPicks.splice(idx, 1); 
    el.classList.remove('selected'); 
  } else {
    if (Game.draftPicks.length >= 3) return;
    Game.draftPicks.push({ donor, weight: 0 });
    el.classList.add('selected');
  }
  const w = E.DEFAULT_WEIGHTS;
  Game.draftPicks.forEach((p, i) => { p.weight = w[i] || 0; });
  updateDraftFooter();
}

function updateDraftFooter() {
  const cost = Game.draftPicks.reduce((s, p) => s + E.TIER_COST[p.donor.tier], 0);
  const bar = document.getElementById('budget-fill');
  const pct = Math.min(100, (cost / E.BUILD_BUDGET) * 100);
  bar.style.width = pct + '%';
  bar.classList.toggle('over', cost > E.BUILD_BUDGET);
  document.getElementById('budget-label').textContent = `Build Budget: ${cost} / ${E.BUILD_BUDGET}`;
  const previewEl = document.getElementById('draft-preview');
  const btn = document.getElementById('btn-confirm-slot');
  if (Game.draftPicks.length === 0) { previewEl.innerHTML = ''; btn.disabled = true; return; }
  const build = E.blendBuild(Game.draftPicks);
  const valid = E.validateBuild(build);
  btn.disabled = !valid.ok;
  previewEl.innerHTML = `
    <div class="preview-title">${Game.draftPicks.map((p) => p.donor.name).join(' + ')}</div>
    <div class="preview-stats">${E.DIMS.map((k) => `<div class="ps"><span>${dimLabel(k)}</span><b>${build.dims[k]}</b></div>`).join('')}</div>
    ${valid.ok ? '' : `<div class="warn">⚠ Over budget by ${valid.over}</div>`}`;
}

function confirmSlot() {
  const slot = SLOTS[Game.draftIdx];
  const build = E.blendBuild(Game.draftPicks);
  const leadDonor = Game.draftPicks[0].donor;
  Game.team[slot] = { 
    dims: build.dims, 
    donors: build.donors, 
    leadBbrefId: leadDonor.bbrefId,
    badges: [],
    absorbed: Game.draftPicks.map((p) => `${p.donor.name} (${p.donor.era})`), 
    name: leadDonor.name + (Game.draftPicks.length > 1 ? ' Hybrid' : '') 
  };
  Game.draftIdx++;
  if (Game.draftIdx < 3) renderDraftSlot();
  else finishDraft();
}

function finishDraft() {
  Game.anchorOvr = liveOvr();
  showScreen('screen-teamready');
  const box = document.getElementById('team-summary');
  box.innerHTML = SLOTS.map((s) => {
    const t = Game.team[s];
    return `
      <div class="squad-hybrid-card">
        <img class="avatar-circle" src="${bbrefImg(t.leadBbrefId)}" onerror="fallbackImg(this)">
        <div class="sh-info">
          <div class="sh-slot">${SLOT_ICON[s]} ${s}</div>
          <div class="sh-name">${t.name}</div>
          <div class="sh-donors">${t.absorbed.join(' + ')}</div>
        </div>
        <div class="sh-ovr">${E.overall(t.dims)}</div>
      </div>`;
  }).join('') + `<div class="team-total">Squad Starting OVR: <b>${Game.anchorOvr}</b></div>`;
}

// ---------- VERSUS SHOWCASE ----------
function prepareUpcomingOpponent() {
  const nextStreak = Game.streak + 1;
  const isBoss = R.isBossWin(nextStreak);
  Game.currentIsBoss = isBoss;
  const opp = isBoss
    ? E.buildBossOpponent(Game.anchorOvr, Game.streak, DONORS_DATA, liveOvr())
    : E.buildOpponent(Game.rng, Game.anchorOvr, Game.streak, DONORS_DATA, liveOvr());
  Game.currentOpponent = opp;

  showScreen('screen-versus');
  document.getElementById('vs-boss-banner').classList.toggle('hidden', !isBoss);
  document.getElementById('opp-type-tag').textContent = isBoss ? '🔥 BOSS SQUAD' : `Match ${nextStreak} Competitors`;
  document.getElementById('opp-ovr-tag').textContent = `OVR ${opp.ovr}`;
  
  const slotsGrid = document.getElementById('opp-slots-grid');
  slotsGrid.innerHTML = '';
  const btnStartMatch = document.getElementById('btn-start-match-direct');
  btnStartMatch.disabled = true;

  if (isBoss) {
    // Slot Makinesi Animasyonu
    opp.players.forEach((p, idx) => {
      const reel = document.createElement('div');
      reel.className = 'slot-reel spinning';
      reel.innerHTML = `
        <div class="slot-reel-strip">
          <div class="opp-player-row"><div class="avatar-circle" style="display:flex;align-items:center;justify-content:center;">🎰</div><div class="opp-p-info"><div class="opp-p-name">Rolling Legend...</div></div></div>
          <div class="opp-player-row"><div class="avatar-circle" style="display:flex;align-items:center;justify-content:center;">🏀</div><div class="opp-p-info"><div class="opp-p-name">Locking Target...</div></div></div>
        </div>`;
      slotsGrid.appendChild(reel);

      setTimeout(() => {
        reel.classList.remove('spinning');
        reel.innerHTML = `
          <div class="opp-player-row">
            <img class="avatar-circle" src="${bbrefImg(p.bbrefId)}" onerror="fallbackImg(this)">
            <div class="opp-p-info">
              <div class="opp-p-name">${p.name} ⭐</div>
              <div class="opp-p-pos">${p.era} · ${SLOTS[idx]}</div>
            </div>
            <div class="opp-p-ovr">${E.overall(p.dims)}</div>
          </div>`;
        if (idx === opp.players.length - 1) btnStartMatch.disabled = false;
      }, 600 + idx * 500);
    });
  } else {
    opp.players.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'opp-player-row';
      row.innerHTML = `
        <img class="avatar-circle" src="${bbrefImg(p.bbrefId)}" onerror="fallbackImg(this)">
        <div class="opp-p-info">
          <div class="opp-p-name">${p.name}</div>
          <div class="opp-p-pos">${p.era || ''} · ${SLOTS[idx]}</div>
        </div>
        <div class="opp-p-ovr">${E.overall(p.dims)}</div>`;
      slotsGrid.appendChild(row);
    });
    setTimeout(() => { btnStartMatch.disabled = false; }, 400);
  }
}

// ---------- MATCH SIMULATION (~30s & SYNC SCORE) ----------
function startMatchSimulation() {
  const opp = Game.currentOpponent;
  const isBoss = Game.currentIsBoss;
  Game.lastOpponent = opp;

  const result = E.playMatch(Game.rng, teamArr(), opp.players.map((p) => ({ dims: p.dims, name: p.name })));
  Game.lastResult = result;

  showScreen('screen-match');
  document.getElementById('match-boss-banner').classList.toggle('hidden', !isBoss);
  document.getElementById('match-oppname').textContent = isBoss ? `BOSS MATCH · ${opp.players.map(p => p.name).join(' / ')}` : `Street Rivals (OVR ${opp.ovr})`;
  document.getElementById('match-feed').innerHTML = '';
  document.getElementById('score-you').textContent = '0';
  document.getElementById('score-opp').textContent = '0';
  document.getElementById('match-time-fill').style.width = '0%';
  document.getElementById('match-win-banner').classList.add('hidden');

  const totalEvents = result.log.length;
  const targetTotalTimeMs = 30000; 
  const delayPerEvent = Math.max(650, Math.floor(targetTotalTimeMs / (totalEvents || 1)));

  animateMatchPossessions(result, 0, 0, 0, delayPerEvent);
}

function feedLine(text, cls) {
  const feed = document.getElementById('match-feed');
  const div = document.createElement('div');
  div.className = 'feed-line ' + (cls || '');
  div.textContent = text;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function animateMatchPossessions(result, i, scoreA, scoreB, delay) {
  const timeBar = document.getElementById('match-time-fill');
  const pct = Math.min(100, Math.round(((i + 1) / result.log.length) * 100));
  timeBar.style.width = pct + '%';

  if (i >= result.log.length) {
    document.getElementById('score-you').textContent = result.scoreA;
    document.getElementById('score-opp').textContent = result.scoreB;
    setTimeout(() => { finishMatch(result); }, 500);
    return;
  }

  const ev = result.log[i];
  let curA = scoreA;
  let curB = scoreB;

  if (ev.type === 'make') {
    if (ev.side === 'A') curA += ev.pts; else curB += ev.pts;
    feedLine(`🏀 ${ev.shooter} ${ev.is3 ? 'strikes from downtown! (+2)' : 'drives and scores! (+1)'}`, 'make');
  } else if (ev.type === 'turnover') {
    feedLine('⚠ Defensive swipe forces a turnover!', 'tov');
  } else {
    feedLine(ev.offReb ? '🔁 Offense snatches the rebound back!' : '🧹 Defense clears the glass.', 'reb');
  }

  document.getElementById('score-you').textContent = curA;
  document.getElementById('score-opp').textContent = curB;

  setTimeout(() => {
    animateMatchPossessions(result, i + 1, curA, curB, delay);
  }, delay);
}

function finishMatch(result) {
  if (result.win) {
    const banner = document.getElementById('match-win-banner');
    banner.classList.remove('hidden');
    document.getElementById('btn-claim-reward').onclick = () => { onWin(); };
  } else {
    onLoss();
  }
}

function onWin() {
  Game.streak++;
  UserAccount.totalWins++;
  UserAccount.tokens += 15;

  if (Game.streak > UserAccount.bestStreak) {
    UserAccount.bestStreak = Game.streak;
  }
  if (R.isShieldMilestone(Game.streak)) Game.shields++;

  UserAccount.save();
  updateHeaderUI();
  showRewardScreen();
}

function onLoss() {
  if (Game.shields > 0) {
    Game.shields--;
    feedLine('🛡 Shield used — the run continues!', 'shield');
    setTimeout(() => prepareUpcomingOpponent(), 1000);
    return;
  }

  showScreen('screen-gameover');
  document.getElementById('go-streak').textContent = Game.streak;
  const newBest = Game.streak >= UserAccount.bestStreak && Game.streak > 0;
  document.getElementById('go-newbest').classList.toggle('hidden', !newBest);

  document.getElementById('go-team').innerHTML = SLOTS.map((s) => {
    const t = Game.team[s];
    return `
      <div class="squad-hybrid-card">
        <img class="avatar-circle" src="${bbrefImg(t.leadBbrefId)}" onerror="fallbackImg(this)">
        <div class="sh-info"><div class="sh-slot">${SLOT_ICON[s]} ${s}</div><div class="sh-name">${t.name}</div></div>
        <div class="sh-ovr">OVR ${E.overall(t.dims)}</div>
      </div>`;
  }).join('');

  const opp = Game.lastOpponent;
  if (opp) {
    document.getElementById('go-opp-team').innerHTML = opp.players.map((p, idx) => `
      <div class="opp-player-row">
        <img class="avatar-circle" src="${bbrefImg(p.bbrefId)}" onerror="fallbackImg(this)">
        <div class="opp-p-info"><div class="opp-p-name">${p.name}</div><div class="opp-p-pos">${p.era || ''} · ${SLOTS[idx]}</div></div>
        <div class="opp-p-ovr">OVR ${E.overall(p.dims)}</div>
      </div>`).join('');
  }
}

// ---------- REWARD SCREEN (DIMINISHING RETURNS PREVIEW) ----------
function showRewardScreen() {
  showScreen('screen-reward');
  document.getElementById('reward-streak').textContent = Game.streak;
  const cards = R.rollCardOptions(Game.rng, Game.streak, DONORS_DATA, Game.team);
  const grid = document.getElementById('reward-cards');
  grid.innerHTML = '';
  cards.forEach((c) => grid.appendChild(rewardCard(c)));
}

function rewardCard(card) {
  const el = document.createElement('div');
  el.className = 'reward-card tier-' + card.tier.toLowerCase();
  
  const currentStatVal = Game.team[card.slot].dims[card.primaryDim];
  const newStatVal = Math.min(99, currentStatVal + card.primaryBoost);
  const isMaxBadge = newStatVal >= 99;

  el.innerHTML = `
    <img class="avatar-circle" src="${bbrefImg(card.sourceDonorId)}" onerror="fallbackImg(this)">
    <div class="rc-body">
      <div class="rc-slot-tag">${SLOT_ICON[card.slot]} ${card.slot} · DNA Upgrade</div>
      <div class="rc-donor-name">${card.sourceDonor}</div>
      <div class="rc-era">${card.era}</div>
      <div class="rc-stat-comparison">
        <span>${dimLabel(card.primaryDim)}:</span>
        <span class="rc-current-val">${currentStatVal}</span>
        <span class="rc-arrow">➜</span>
        <span class="rc-boost-val">${newStatVal} (+${card.primaryBoost})</span>
        ${isMaxBadge ? '<span class="rc-badge-unlock">🔥 HOF BADGE UNLOCKED!</span>' : ''}
      </div>
    </div>
    <div class="rc-tier-badge">${card.tier}</div>`;

  el.addEventListener('click', () => {
    R.applyCard(Game.team, card);
    // Kazanılan dönemi kalıcı albüme kaydet
    const foundDonor = DONORS_DATA.find(d => d.name === card.sourceDonor);
    if (foundDonor) UserAccount.addCardToBinder(foundDonor.id);
    prepareUpcomingOpponent();
  });
  return el;
}

// ---------- BINDER / ALBUM MODAL ----------
function openBinderModal() {
  const modal = document.getElementById('modal-binder');
  modal.classList.remove('hidden');
  const grid = document.getElementById('binder-cards-grid');
  grid.innerHTML = '';

  DONORS_DATA.forEach((card) => {
    const isOwned = UserAccount.binder.includes(card.id);
    const div = document.createElement('div');
    div.className = 'binder-card' + (isOwned ? '' : ' locked');
    div.style.opacity = isOwned ? '1' : '0.4';
    div.style.filter = isOwned ? 'none' : 'grayscale(1)';
    div.innerHTML = `
      <img class="avatar-circle" src="${bbrefImg(card.bbrefId)}" onerror="fallbackImg(this)">
      <div class="bc-name">${card.name}</div>
      <div class="bc-era">${card.era}</div>
      <div style="font-size:10px;font-weight:bold;margin-top:2px;color:var(--accent2);">${isOwned ? '✅ Collected' : '🔒 Incomplete'}</div>`;
    grid.appendChild(div);
  });
}

function shareRun() {
  const shareText = `🏀 Street Legend Run: Won ${Game.streak} games with my custom NBA era hybrid! Best: ${UserAccount.bestStreak}. Can you top my street streak in The Longest Run?`;
  if (navigator.share) {
    navigator.share({ title: 'The Longest Run', text: shareText }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      alert('📋 Run summary copied to clipboard!');
    });
  }
}

// ---------- INITIALIZATION ----------
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderUI();
  document.getElementById('btn-start').addEventListener('click', startDraft);
  document.getElementById('btn-confirm-slot').addEventListener('click', confirmSlot);
  document.getElementById('btn-begin-run').addEventListener('click', prepareUpcomingOpponent);
  document.getElementById('btn-start-match-direct').addEventListener('click', startMatchSimulation);
  document.getElementById('btn-play-again').addEventListener('click', startDraft);
  document.getElementById('btn-share-run').addEventListener('click', shareRun);

  document.getElementById('btn-open-binder').addEventListener('click', openBinderModal);
  document.getElementById('btn-close-binder').addEventListener('click', () => {
    document.getElementById('modal-binder').classList.add('hidden');
  });

  document.getElementById('btn-daily-challenge').addEventListener('click', () => {
    alert('📅 Bugünün Sokak Meydan Okuması: "Sadece 90\'lar Efsaneleri!". Özel turnuva yakında açılıyor.');
  });
});