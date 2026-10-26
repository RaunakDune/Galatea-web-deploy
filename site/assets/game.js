/* Where on the Moon?: LunarSim place-recognition game. No dependencies. */
(function () {
  'use strict';
  var ROUND_SECONDS = 30;
  var MISSION = ['C0', 'C0', 'C3', 'C1', 'C4', 'C4', 'C2', 'C5', 'C5', 'C6'];
  var COND = {
    C0: { name: 'Same Sun as the map', short: 'Same Sun', level: 1,
      tip: 'Only the viewpoint changed here: the rover stands up to 3 m away and may face slightly differently. Match the shapes of craters, rocks and the horizon.' },
    C1: { name: 'Lower Sun (15°)', short: 'Lower Sun', level: 2,
      tip: 'The Sun is lower than when the map was made, so every shadow is longer. Crater rims and the horizon keep their shape.' },
    C2: { name: 'Grazing Sun (6°)', short: 'Grazing Sun', level: 5,
      tip: 'With the Sun only 6° above the horizon, long black shadows hide much of the ground, and distant hills can shade the rover itself. Even the best AI struggles here.' },
    C3: { name: 'High Sun (60°)', short: 'High Sun', level: 2,
      tip: 'A high Sun makes shadows short and the scene flat and low in contrast. Look for bright crater rims and the outline of the horizon.' },
    C4: { name: 'Sun moved 90° sideways', short: 'Sun rotated 90°', level: 3,
      tip: 'The Sun has swung a quarter of the way around the sky, so shadows point sideways compared with the map. Ignore the shadows and match the terrain.' },
    C5: { name: 'Sun behind (180°)', short: 'Shadows flipped', level: 4,
      tip: 'The Sun is on the opposite side of the sky. Every shadow points the other way, and slopes that were bright on the map are now dark.' },
    C6: { name: 'Sun behind and grazing', short: 'Flipped + grazing', level: 5,
      tip: 'The hardest case: shadows are flipped and very long. The horizon line is often the only cue that survives.' }
  };
  var $ = function (id) { return document.getElementById(id); };
  var data = null, config = { collect: false }, bank = {}, used = {};
  var state = null, timerId = null, sid = null;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function imgUrl(t, name) { return '/data/img/' + t + '/' + name + '.webp'; }
  function show(id) { ['screen-start', 'screen-round', 'screen-end'].forEach(function (s) { $(s).hidden = s !== id; }); window.scrollTo(0, 0); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }

  function pick(cond) {
    var list = bank[cond], u = used[cond] || (used[cond] = {});
    if (Object.keys(u).length >= list.length - 1) used[cond] = u = {};
    var i; do { i = rnd(list.length); } while (u[i]);
    u[i] = 1; return list[i];
  }
  function preload(tr) { [imgUrl(tr.t, tr.q)].concat(tr.o.map(function (o) { return imgUrl(tr.t, o); })).forEach(function (s) { var im = new Image(); im.src = s; }); }

  function start(conds, mode) {
    state = { mode: mode, conds: conds, trials: conds.map(pick), i: 0, score: 0, streak: 0, results: [],
      consent: config.collect && $('consent').checked };
    $('r-total').textContent = conds.length;
    state.trials.slice(0, 2).forEach(preload);
    show('screen-round');
    round();
  }

  function round() {
    var tr = state.trials[state.i], c = COND[tr.c];
    if (state.trials[state.i + 1]) preload(state.trials[state.i + 1]);
    $('r-num').textContent = state.i + 1;
    $('r-score').textContent = state.score;
    $('r-streak').textContent = state.streak;
    $('r-cond').innerHTML = '<span class="pill accent">Level ' + c.level + ' · ' + c.name + '</span>';
    $('q-img').src = imgUrl(tr.t, tr.q);
    $('q-sun').textContent = 'Sun at azimuth ' + tr.az + '°, elevation ' + tr.el + '°';
    var box = $('opts'); box.innerHTML = '';
    tr.o.forEach(function (o, k) {
      var b = document.createElement('button');
      b.className = 'opt'; b.type = 'button'; b.setAttribute('aria-label', 'Map image ' + (k + 1));
      b.innerHTML = '<img alt="" src="' + imgUrl(tr.t, o) + '"><span class="num">' + (k + 1) + '</span><span class="tags"></span>';
      b.addEventListener('click', function () { answer(k); });
      box.appendChild(b);
    });
    $('reveal').hidden = true;
    state.t0 = performance.now(); state.answered = false;
    tick();
  }

  function tick() {
    cancelAnimationFrame(timerId);
    var step = function () {
      if (state.answered) return;
      var left = ROUND_SECONDS - (performance.now() - state.t0) / 1000;
      var f = $('timer-fill');
      f.style.width = Math.max(0, 100 * left / ROUND_SECONDS) + '%';
      f.className = 'timer-fill' + (left < 8 ? ' low' : '');
      if (left <= 0) { answer(null); return; }
      timerId = requestAnimationFrame(step);
    };
    timerId = requestAnimationFrame(step);
  }

  function answer(k) {
    if (state.answered) return;
    state.answered = true; cancelAnimationFrame(timerId);
    var tr = state.trials[state.i], rt = performance.now() - state.t0;
    var ok = k === tr.a, galOk = tr.g === tr.a, terrOk = tr.z === tr.a;
    var left = Math.max(0, ROUND_SECONDS - rt / 1000), gained = 0;
    if (ok) { gained = 100 + Math.round(50 * left / ROUND_SECONDS); state.streak++; } else state.streak = 0;
    state.score += gained;
    state.results.push({ tr: tr, k: k, ok: ok, galOk: galOk, terrOk: terrOk, rt: rt });
    var btns = $('opts').children;
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j], tags = [];
      b.disabled = true;
      if (j === tr.a) b.classList.add('correct');
      else if (j === k) b.classList.add('wrong'); else b.classList.add('dim');
      if (j === k) tags.push('<span class="tag you">You</span>');
      if (j === tr.g) tags.push('<span class="tag">Rover AI</span>');
      if (j === tr.z) tags.push('<span class="tag">Earth AI</span>');
      b.querySelector('.tags').innerHTML = tags.join('');
    }
    var v = $('verdict');
    if (k === null) { v.className = 'verdict no'; v.innerHTML = 'Time is up.'; }
    else if (ok) { v.className = 'verdict ok'; v.innerHTML = 'Correct! +' + gained + (galOk ? '' : ' <span class="pill good">You beat the rover AI</span>'); }
    else { v.className = 'verdict no'; v.innerHTML = 'Not this time. The right place is outlined in green.'; }
    var who = 'Rover AI: ' + (galOk ? 'right' : 'wrong') + ' · Earth-trained AI: ' + (terrOk ? 'right' : 'wrong') + '. ';
    $('explain').textContent = who + COND[tr.c].tip;
    $('btn-next').textContent = state.i + 1 < state.trials.length ? 'Next round' : 'See results';
    $('reveal').hidden = false;
    $('r-score').textContent = state.score; $('r-streak').textContent = state.streak;
    $('btn-next').focus({ preventScroll: true });
    if (state.consent) log(tr, k, ok, rt);
  }

  function log(tr, k, ok, rt) {
    var body = JSON.stringify({ sid: sid, mode: state.mode, round: state.i, t: tr.t, q: tr.q, c: tr.c,
      choice: k === null ? -1 : k, answer: tr.a, correct: ok ? 1 : 0, rt_ms: Math.round(rt), gal: tr.g, terr: tr.z,
      v: data.version || 1 });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(config.endpoint, new Blob([body], { type: 'application/json' }));
      else fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) { /* logging is best-effort */ }
  }

  function next() {
    if (!state || !state.answered) return;
    state.i++;
    if (state.i < state.trials.length) round(); else end();
  }

  function end() {
    var R = state.results, n = R.length;
    var you = R.filter(function (r) { return r.ok; }).length, gal = R.filter(function (r) { return r.galOk; }).length,
      terr = R.filter(function (r) { return r.terrOk; }).length, beat = R.filter(function (r) { return r.ok && !r.galOk; }).length;
    $('e-you').textContent = you + '/' + n; $('e-gal').textContent = gal + '/' + n; $('e-terr').textContent = terr + '/' + n;
    $('end-title').textContent = state.mode === 'mission' ? 'Mission complete' : 'Practice complete';
    var msg = 'Score ' + state.score + '. ';
    if (you > gal) msg += 'You beat the rover AI on this set of rounds.';
    else if (you === gal) msg += 'You tied with the rover AI.';
    else if (you >= terr) msg += 'You did better than (or as well as) the Earth-trained AI, but the lunar-trained rover AI was ahead.';
    else msg += 'The shadows won this time. Try looking at the horizon line, which does not change with the Sun.';
    if (beat) msg += ' You found ' + beat + ' place' + (beat > 1 ? 's' : '') + ' that the rover AI missed.';
    $('end-summary').textContent = msg;
    var rc = $('recap'); rc.innerHTML = '';
    R.forEach(function (r, i) {
      var d = document.createElement('div'); d.className = 'cell ' + (r.ok ? 'ok' : 'no');
      d.innerHTML = '<img alt="" src="' + imgUrl(r.tr.t, r.tr.q) + '"><span class="lbl">' + (i + 1) + ' · ' + r.tr.c + '</span>';
      rc.appendChild(d);
    });
    if (state.mode === 'mission') {
      var best = parseInt(store('wotm_best') || '0', 10);
      if (state.score > best) { store('wotm_best', String(state.score)); }
    }
    state.share = 'Where on the Moon? I found the rover ' + you + '/' + n + ' times (rover AI: ' + gal + '/' + n + ', Earth AI: ' + terr + '/' + n + '). Score ' + state.score + '.\n' +
      R.map(function (r) { return r.ok ? '🟩' : '🟥'; }).join('') + '\nhttps://lunarsim.org/play/';
    $('share-msg').textContent = '';
    show('screen-end');
    bestLine();
  }

  function bestLine() {
    var best = parseInt(store('wotm_best') || '0', 10);
    $('best-line').textContent = best ? 'Your best mission score on this device: ' + best : '';
  }

  function share() {
    var done = function () { $('share-msg').textContent = 'Copied to the clipboard.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(state.share).then(done, function () { $('share-msg').textContent = state.share; });
    else $('share-msg').textContent = state.share;
  }

  function init() {
    sid = uuid();
    var chips = $('practice-chips');
    ['C0', 'C3', 'C1', 'C4', 'C5', 'C2', 'C6'].forEach(function (c) {
      var b = document.createElement('button'); b.className = 'chip'; b.type = 'button';
      b.innerHTML = COND[c].name + (data ? ' <small>rover AI ' + Math.round(data.ai_acc[c].gal) + '%</small>' : '');
      b.addEventListener('click', function () { var a = []; for (var i = 0; i < 10; i++) a.push(c); start(a, 'practice-' + c); });
      chips.appendChild(b);
    });
    $('btn-mission').addEventListener('click', function () { start(MISSION.slice(), 'mission'); });
    $('btn-next').addEventListener('click', next);
    $('btn-again').addEventListener('click', function () { show('screen-start'); });
    $('btn-share').addEventListener('click', share);
    document.addEventListener('keydown', function (e) {
      if ($('screen-round').hidden || !state) return;
      if (!state.answered && e.key >= '1' && e.key <= '6') answer(parseInt(e.key, 10) - 1);
      else if (state.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
    });
    if (config.collect) {
      $('consent-box').hidden = false;
      $('consent-text').textContent = config.consent_text || '';
    }
    bestLine();
  }

  Promise.all([
    fetch('/data/trials.json').then(function (r) { return r.json(); }),
    fetch('/data/config.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (res) {
    data = res[0]; config = Object.assign({ collect: false, endpoint: '/api/log' }, res[1] || {});
    data.trials.forEach(function (tr) { (bank[tr.c] = bank[tr.c] || []).push(tr); });
    init();
  }).catch(function () {
    $('screen-start').insertAdjacentHTML('beforeend', '<p class="callout">Could not load the game data. Please reload the page.</p>');
  });
})();
