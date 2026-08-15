/* Unit tests for the matching engine — run: node build/test-matching.js */
const assert = require('assert');
const D = require('../src/data.js');
const M = require('../src/matching.js');

const demoTrip = {
  dir: 'arriving', timeMin: M.toMin('22:10'), flex: 45, mode: 'either',
  vibes: ['quiet', 'music'], open: 'everyone', visibleTo: 'everyone',
  gender: null, verified: false,
  spot: { lat: 59.9227, lon: 10.7597 }, areaLabel: 'Grünerløkka',
};
const verifiedTrip = { ...demoTrip, verified: true };
const fullTrip = { ...demoTrip, verified: true, gender: 'F' };

// 1. haversine sanity: Grünerløkka → Tøyen ≈ 1.2–1.4 km
const gt = M.haversineM(59.9227, 10.7597, 59.9139, 10.7743);
assert(gt > 1150 && gt < 1450, 'Grünerløkka→Tøyen distance off: ' + gt);

// 2a. unverified, gender unstated → ingrid (verified-only) and amina
//     (women-only) are hidden by THEIR privacy; 3 remain
const res0 = M.computeMatches(demoTrip, D.TRAVELLERS, D.FLIGHTS, D.FARES);
assert.deepStrictEqual(res0.map(r => r.t.id).sort(), ['henrik', 'jonas', 'maya'].sort(), 'unverified set wrong');
const ph0 = M.privacyHidden(demoTrip, D.TRAVELLERS, D.FLIGHTS);
assert.deepStrictEqual(ph0.hiddenFromYou.map(t => t.id).sort(), ['amina', 'ingrid'].sort(), 'privacy-hidden count wrong');

// 2b. BankID verification reveals ingrid
const resV = M.computeMatches(verifiedTrip, D.TRAVELLERS, D.FLIGHTS, D.FARES);
assert(resV.map(r => r.t.id).includes('ingrid'), 'verification must reveal verified-only ingrid');
assert(!resV.map(r => r.t.id).includes('amina'), 'amina stays hidden until gender F');

// 2c. verified + woman → the full designed five, jonas first
const res = M.computeMatches(fullTrip, D.TRAVELLERS, D.FLIGHTS, D.FARES);
const ids = res.map(r => r.t.id);
assert.deepStrictEqual([...ids].sort(), ['amina', 'henrik', 'ingrid', 'jonas', 'maya'].sort(), 'eligible set wrong: ' + ids);
assert.strictEqual(ids[0], 'jonas', 'jonas (same flight, 200 m apart) should rank first');

// 2d. the mirror: user visible to women only → male jonas/henrik can't see her
const mirrored = M.computeMatches({ ...fullTrip, visibleTo: 'women' }, D.TRAVELLERS, D.FLIGHTS, D.FARES);
assert.deepStrictEqual(mirrored.map(r => r.t.id).sort(), ['amina', 'ingrid', 'maya'].sort(), 'mirror visibility wrong');

// 3. both-windows rule: nora lands +25 min away but her flex is 15 → excluded
assert(!ids.includes('nora'), 'nora must be filtered by HER window');
// hanna: Δ35 within user's 45 but outside her flex 30 → excluded
assert(!ids.includes('hanna'), 'hanna must be filtered by her 30 min window');

// 4. distance rule: elias (Tøyen, ~1.3 km) excluded even though time fits
assert(!ids.includes('elias'), 'elias must be filtered by the 1 km rule');

// 5. mode compatibility: user "cab" must drop train-only ingrid
const cabTrip = { ...fullTrip, mode: 'cab' };
const cabIds = M.computeMatches(cabTrip, D.TRAVELLERS, D.FLIGHTS, D.FARES).map(r => r.t.id);
assert(!cabIds.includes('ingrid'), 'train-only ingrid must not match a cab-only user');
assert(cabIds.includes('maya'), 'cab-cab maya must still match');

// 6. openness filter (user's own preference, on top of privacy)
const wTrip = { ...fullTrip, open: 'women' };
const wIds = M.computeMatches(wTrip, D.TRAVELLERS, D.FLIGHTS, D.FARES).map(r => r.t.id);
assert.deepStrictEqual([...wIds].sort(), ['amina', 'ingrid', 'maya'].sort(), 'women-only filter wrong: ' + wIds);

// 7. departing direction matches only departing travellers
const depTrip = { ...fullTrip, dir: 'departing', timeMin: M.toMin('23:05'), spot: { lat: 59.9227, lon: 10.7597 } };
const depRes = M.computeMatches(depTrip, D.TRAVELLERS, D.FLIGHTS, D.FARES);
assert(depRes.length >= 2 && depRes.every(r => r.t.dir === 'departing'), 'departing matching broken');
assert(depRes.map(r => r.t.id).includes('noa'), 'noa should match the departing demo');

// 8. fare maths
const cab = M.fareFor('cab', D.FARES);
assert.strictEqual(cab.each, 375);
assert.strictEqual(cab.saving, 374);
const train = M.fareFor('train', D.FARES);
assert.strictEqual(train.saving, 0);

// 9. handoff window: both land 22:10 → 22:18–22:25 (the plan's exact example)
const hw = M.handoffWindow(M.toMin('22:10'), M.toMin('22:10'));
assert.strictEqual(hw.from + '–' + hw.to, '22:18–22:25');

// 10. widen-window unlock counts grow monotonically
const c45 = M.countEligibleAt(demoTrip, 45, D.TRAVELLERS, D.FLIGHTS, D.FARES);
const c90 = M.countEligibleAt(demoTrip, 90, D.TRAVELLERS, D.FLIGHTS, D.FARES);
assert(c90 >= c45, 'widening the window must never lose matches');

// 11. receipt data present on every match
for (const r of res) {
  assert(r.deltaLabel && r.fare && r.handoff && typeof r.distM === 'number');
}

console.log('all matching tests passed ·', res.length, 'matches on demo trip ·',
  'order:', ids.join(' > '), '· widen 45→90 unlocks +' + (c90 - c45));
