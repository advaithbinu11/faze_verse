/* FaZe Verse: demo-mode interactivity for the static pages.
   Ports the React app's fake data layer (src/data/fake.js + seed.js) to vanilla JS.
   State lives in localStorage so it carries across pages; pages still render their static markup without JS. */
(() => {
  'use strict';

  const KEY = 'fv_state_v1';
  const THEME_KEY = 'fv_theme';
  const SIZE = 5;
  const MAX_FAVORITES = 10;
  const MAX_POST = 240;
  const STEAM_ID = /^7656119\d{10}$/;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PLAYER_PATTERN = /^[\w .-]{1,30}$/;
  const TEAMS = ['FaZe', 'Valorant', 'Rocket League', 'Apex', 'Fortnite'];
  const REGIONS = ['NA', 'EU', 'APAC', 'LATAM', 'MENA'];
  const TX_LABELS = { prediction: 'Prediction', payout: 'Payout', refund: 'Refund', watch_time: 'Watch bonus', redemption: 'Redemption', signup_bonus: 'Welcome bonus' };
  const CLUSTERS = [
    { game_id: '730', game_name: 'Counter-Strike 2', players: 184, shared_regions: ['NA'], shared_teams: ['FaZe'] },
    { game_id: '570', game_name: 'Dota 2', players: 41, shared_regions: ['NA'], shared_teams: [] },
    { game_id: '252490', game_name: 'Rust', players: 17, shared_regions: [], shared_teams: ['FaZe'] },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => n.toLocaleString('en-US');
  const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
  const page = document.body.dataset.page;

  /* ---------- state ---------- */
  const seed = () => ({
    session: 'demo-user',
    accounts: {}, // email -> { id, hash }
    users: {
      'demo-user': {
        id: 'demo-user', name: 'DemoPlayer', email: '', points: 1200, teams: ['FaZe'], regions: ['NA'], discord: '', favs: [],
        games: [{ appid: 730, name: 'Counter-Strike 2' }, { appid: 570, name: 'Dota 2' }, { appid: 252490, name: 'Rust' }],
        watched: [], postCount: 0, predictions: {},
        tx: [{ id: 't0', points: 1000, source: 'signup_bonus', at: new Date().toISOString() }],
      },
    },
    events: [
      { id: 'evt-live', title: 'Grand Final, Map 2', a: 'FaZe', b: 'Team Nova', game: 'Counter-Strike 2', start: hours(-0.5), status: 'live', tot: 18400, pa: 11200, pb: 7200 },
      { id: 'evt-next', title: 'Semifinal', a: 'FaZe', b: 'Northwind', game: 'Counter-Strike 2', start: hours(26), status: 'upcoming', tot: 5200, pa: 2600, pb: 2600 },
      { id: 'evt-later', title: 'Group Stage, Day 3', a: 'FaZe', b: 'Ironclad', game: 'Rocket League', start: hours(72), status: 'upcoming', tot: 900, pa: 700, pb: 200 },
    ],
    parties: [
      { id: 'p-1', game_id: '730', game: 'Counter-Strike 2', region: 'NA', people: ['a', 'b', 'c'] },
      { id: 'p-2', game_id: '570', game: 'Dota 2', region: 'NA', people: ['d'] },
    ],
    posts: [
      { id: 'post-1', author: 'ClutchOrKick', text: 'That eco round call on Map 1 was unreal.', likes: 24, likedBy: [], at: hours(-3) },
      { id: 'post-2', author: 'northside_nia', text: 'Who is queueing CS2 tonight? NA, chill vibes.', likes: 9, likedBy: [], at: hours(-6) },
    ],
    perks: [
      { id: 'perk-wallpaper', title: 'Desktop wallpaper pack', body: 'Four exclusive wallpapers.', cost: 300 },
      { id: 'perk-badge', title: 'Profile badge', body: 'Show a Vault badge next to your name.', cost: 800 },
      { id: 'perk-raffle', title: 'Signed jersey raffle entry', body: 'One entry per redemption.', cost: 5000 },
    ],
  });

  let S;
  const memory = {};
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return memory[k] ?? null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { memory[k] = v; } },
    del: (k) => { try { localStorage.removeItem(k); } catch { delete memory[k]; } },
  };
  const load = () => { try { return JSON.parse(store.get(KEY)) ?? seed(); } catch { return seed(); } };
  const save = () => store.set(KEY, JSON.stringify(S));
  const me = () => S.users[S.session] ?? null;

  const ledger = (u, points, source, extra = {}) => {
    u.points += points;
    u.tx.unshift({ id: uid(), points, source, at: new Date().toISOString(), ...extra });
  };

  // Passwords are never stored in the clear; this is still a demo, not real auth.
  const hash = async (s) => {
    if (crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return String(h);
  };

  /* ---------- shared UI ---------- */
  let toastTimer;
  function toast(message, kind = 'info') {
    let wrap = $('#toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.className = 'toast-wrap';
      wrap.innerHTML = '<div class="toast" hidden></div>';
      document.body.append(wrap);
    }
    wrap.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const el = wrap.firstChild;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  const sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = () => sysDark() !== $('#theme').checked;

  function applyStoredTheme() {
    const want = store.get(THEME_KEY);
    if (want) $('#theme').checked = (want === 'dark') !== sysDark();
  }

  function renderHeader() {
    const box = $('#top-actions');
    const u = me();
    box.innerHTML = `
      <span class="chip chip-off">Demo data</span>
      ${u ? `<span class="chip chip-accent"><span id="chip-points">${fmt(u.points)}</span>&nbsp;Points</span>` : ''}
      ${u ? '<button type="button" class="btn" id="signout">Sign out</button>' : '<a href="login.html" class="btn">Sign in</a><a href="signup.html" class="btn btn-primary">Sign up</a>'}
      <button type="button" class="btn" id="theme-btn" aria-pressed="${isDark()}">${isDark() ? 'Light' : 'Dark'} mode</button>`;
  }
  const refreshPoints = () => { const c = $('#chip-points'); if (c && me()) c.textContent = fmt(me().points); };

  document.addEventListener('click', (e) => {
    if (e.target.closest('#signout')) {
      S.session = null; save(); renderHeader(); render();
    } else if (e.target.closest('#theme-btn')) {
      const box = $('#theme');
      box.checked = !box.checked;
      store.set(THEME_KEY, isDark() ? 'dark' : 'light');
      renderHeader();
    }
  });

  function fieldError(input, msg) {
    const field = input.closest('.field') ?? input.parentElement;
    let err = document.getElementById(`${input.id}-err`);
    if (msg) {
      if (!err) { err = document.createElement('span'); err.id = `${input.id}-err`; err.className = 'err'; field.append(err); }
      err.textContent = msg;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
    } else {
      err?.remove();
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }
  const formAlert = (msg) => { const a = $('#form-alert'); a.textContent = msg; a.hidden = !msg; };
  const busy = (btn, on) => { btn.disabled = on; if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy'); };

  const empty = (title, body, action = '') => `<div class="frame empty"><div class="label">${esc(title)}</div><p class="body-sm muted">${esc(body)}</p>${action}</div>`;
  const signInCta = (id = 'steam-cta') => `<div><button type="button" class="btn btn-primary" id="${id}">Sign in with Steam</button></div>`;
  const pillBtn = (label, pressed, attrs = '') => `<button type="button" class="pill-btn" aria-pressed="${pressed}" ${attrs}>${esc(label)}</button>`;
  const initials = (s) => esc(s.slice(0, 2).toUpperCase());

  // Demo stand-in for the Steam OAuth redirect: signs in as the seeded player.
  function steamLogin() { S.session = 'demo-user'; save(); location.href = 'profile.html'; }
  document.addEventListener('click', (e) => { if (e.target.closest('#steam-cta, #steam-btn')) { e.preventDefault(); steamLogin(); } });

  /* ---------- home ---------- */
  function renderHome() {
    const ev = S.events.find((e) => e.status === 'live') ?? S.events.find((e) => e.status === 'upcoming');
    $('#next-box').innerHTML = ev
      ? `<a href="live.html" class="frame next"><div class="label">${ev.status === 'live' ? 'Live now' : 'Upcoming'} · ${esc(ev.game)}</div><div class="t">${esc(ev.a)} vs ${esc(ev.b)}</div><div class="small muted" style="font-weight:400">${esc(ev.title)}</div></a>`
      : '<p class="muted">No matches scheduled yet. Check back soon.</p>';
  }

  /* ---------- live ---------- */
  let picked = null;
  let pollTimer;
  const odds = (total, side) => (side ? `${(total / side).toFixed(2)}x` : 'n/a');
  const barH = (share) => (((0.25 + 2.6 * share) / 2.85) * 100).toFixed(1);
  const openEvents = () => S.events.filter((e) => e.status === 'live' || e.status === 'upcoming');
  const currentEvent = () => { const o = openEvents(); return o.find((e) => e.id === picked) ?? o[0]; };

  let watchFor;
  function renderLive() {
    // Rebuilding the watch card would destroy the player, so only do it when the signed-in user changes.
    if (watchFor !== (me()?.id ?? null)) { watchFor = me()?.id ?? null; renderWatch(); }
    const root = $('#match-col');
    const open = openEvents();
    const ev = currentEvent();
    if (!ev) { root.innerHTML = empty('No matches right now', 'When the next match is scheduled it will show up here with its prediction pool.'); return; }
    root.innerHTML = `
      ${open.length > 1 ? `<div class="wrap-row" role="group" aria-label="Choose a match">${open.map((e) => pillBtn(`${e.a} vs ${e.b}`, e.id === ev.id, `data-event="${e.id}"`)).join('')}</div>` : ''}
      <div class="match-panel" style="display:grid">
        <div>
          <div class="label">${ev.status === 'live' ? 'Live now' : `Starts ${esc(new Date(ev.start).toLocaleString())}`} · ${esc(ev.game)}</div>
          <h1 class="h-xl">${esc(ev.a)} vs ${esc(ev.b)}</h1>
          <p class="body-sm muted">${esc(ev.title)}</p>
        </div>
        <div class="pool" role="img" id="pool"><div class="pool-bars" aria-hidden="true"><div class="bar bar-a" id="bar-a"></div><div class="bar bar-b" id="bar-b"></div></div></div>
        <dl class="stats" aria-label="Pool breakdown">
          <div><dt class="label">${esc(ev.a)}</dt><dd id="st-a"></dd></div>
          <div><dt class="label">${esc(ev.b)}</dt><dd id="st-b"></dd></div>
          <div><dt class="label">Total pool</dt><dd id="st-t"></dd></div>
        </dl>
        <div id="predict"></div>
      </div>`;
    updatePools();
    renderPredict();
  }

  function updatePools() {
    const ev = currentEvent();
    if (!ev || !$('#pool')) return;
    const share = ev.tot ? ev.pa / ev.tot : 0.5;
    $('#bar-a').style.setProperty('--h', `${barH(share)}%`);
    $('#bar-b').style.setProperty('--h', `${barH(ev.tot ? ev.pb / ev.tot : 0.5)}%`);
    $('#pool').setAttribute('aria-label', `Prediction pools: ${ev.a} ${fmt(ev.pa)} points, ${ev.b} ${fmt(ev.pb)} points`);
    $('#st-a').textContent = `${fmt(ev.pa)} pts · ${odds(ev.tot, ev.pa)}`;
    $('#st-b').textContent = `${fmt(ev.pb)} pts · ${odds(ev.tot, ev.pb)}`;
    $('#st-t').textContent = `${fmt(ev.tot)} pts`;
  }

  function renderPredict() {
    const box = $('#predict');
    const ev = currentEvent();
    const u = me();
    if (!u) { box.innerHTML = empty('Sign in to predict', 'Link your Steam account to get a points balance and lock in a call.', signInCta()); return; }
    const mine = u.predictions[ev.id];
    if (mine) {
      const pool = mine.team === 'team_a' ? ev.pa : ev.pb;
      box.innerHTML = `<div class="panel-box" role="status"><div class="label">Your call</div>
        <p class="mt-1">You put <b>${fmt(mine.points)}</b> points on <b>${esc(mine.team === 'team_a' ? ev.a : ev.b)}</b>.</p>
        ${pool > 0 ? `<p class="small muted" style="font-weight:400">At the current pool you would collect about ${fmt(Math.floor((mine.points * ev.tot) / pool))} points if they win.</p>` : ''}</div>`;
      return;
    }
    if (ev.status !== 'upcoming') { box.innerHTML = empty('Calls are closed', 'This match has started, so the pool is locked. Come back for the next one.'); return; }
    box.innerHTML = `<form class="stack-sm panel-box" id="predict-form" novalidate style="gap:12px">
      <div role="group" aria-labelledby="pick-l" class="stack-sm" style="gap:6px"><span id="pick-l" style="font-size:13px;font-weight:600">Who takes it?</span>
        <div class="wrap-row">${pillBtn(ev.a, true, 'data-team="team_a"')}${pillBtn(ev.b, false, 'data-team="team_b"')}</div></div>
      <div class="field"><label for="stake">Points to stake (you have ${fmt(u.points)})</label><input id="stake" class="input w-200" inputmode="numeric" value="100"></div>
      <div><button type="submit" class="btn btn-primary">Lock in</button></div></form>`;
  }

  function placePrediction(ev, team, n) {
    const u = me();
    if (ev.status !== 'upcoming') throw new Error('Event is not open for predictions');
    if (u.predictions[ev.id]) throw new Error('You already predicted this event');
    if (n > u.points) throw new Error('Insufficient points');
    if (team === 'team_a') ev.pa += n; else ev.pb += n;
    ev.tot += n;
    ledger(u, -n, 'prediction', { event_id: ev.id });
    u.predictions[ev.id] = { team, points: n };
    save();
  }

  function setupLive() {
    const col = $('#match-col');
    col.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-event]');
      if (pick) { picked = pick.dataset.event; renderLive(); return; }
      const team = e.target.closest('[data-team]');
      if (team) $$('[data-team]', col).forEach((b) => b.setAttribute('aria-pressed', String(b === team)));
    });
    col.addEventListener('submit', (e) => {
      e.preventDefault();
      const ev = currentEvent();
      const input = $('#stake');
      const u = me();
      const n = Number(input.value);
      const max = Math.min(u.points, 100000);
      if (!Number.isInteger(n) || n < 1) return fieldError(input, 'Enter a whole number of points, 1 or more.');
      if (n > max) return fieldError(input, `You can stake up to ${fmt(max)} points.`);
      fieldError(input, '');
      const team = $('[data-team][aria-pressed="true"]', col).dataset.team;
      try {
        placePrediction(ev, team, n);
        toast(`Locked in ${fmt(n)} points on ${team === 'team_a' ? ev.a : ev.b}.`);
        refreshPoints(); updatePools(); renderPredict();
      } catch (err) { fieldError(input, err.message); }
    });
    // Other fans keep predicting, so odds drift between polls (demo only, as in the React fake layer).
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      for (const e of S.events.filter((x) => x.status !== 'completed')) {
        const add = Math.floor(Math.random() * 120);
        if (Math.random() < 0.5) e.pa += add; else e.pb += add;
        e.tot += add;
      }
      save(); updatePools();
      if (me()?.predictions[currentEvent()?.id]) renderPredict();
    }, 5000);
  }

  /* watch to earn: YouTube iframe API, awards once per video in demo mode */
  let ytPromise;
  const loadYouTube = () => (ytPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytPromise = undefined; reject(new Error('Could not load the video player.')); };
    document.head.append(s);
  }));
  let player; let beat;
  function renderWatch() {
    const videoId = $('meta[name="fv-video-id"]')?.content;
    const box = $('#watch-box');
    const u = me();
    clearInterval(beat); player?.destroy?.(); player = null;
    const head = '<h2 id="watch-h" class="h-lg">Watch to earn</h2><p class="body-sm muted mb-3">Play the featured video to the end for bonus points, once per video.</p>';
    if (!videoId) { box.innerHTML = head + empty('No video scheduled', 'A featured video appears here once one is registered for points.'); return; }
    if (!u) { box.innerHTML = head + empty('Sign in to earn', 'Watch time only counts for signed-in accounts.'); return; }
    box.innerHTML = `${head}<div class="video"><div id="yt-host"></div></div><p role="alert" class="small" style="color:var(--color-danger);margin-top:8px" id="yt-err" hidden></p>`;
    const STATES = { 0: 'ENDED', 1: 'PLAYING', 2: 'PAUSED', 3: 'BUFFERING' };
    let started = false;
    const send = (state) => {
      if (!started) { if (state !== 'PLAYING') return; started = true; }
      const pos = player.getCurrentTime();
      if (state === 'ENDED' && pos > 100 && !u.watched.includes('demo')) {
        u.watched.push('demo'); ledger(u, 40, 'watch_time'); save(); refreshPoints();
        toast('+40 points for finishing the video.');
      }
    };
    loadYouTube().then((YT) => {
      player = new YT.Player('yt-host', {
        videoId, playerVars: { rel: 0, playsinline: 1 },
        events: { onStateChange: (e) => {
          const state = STATES[e.data];
          clearInterval(beat);
          if (!state) return;
          send(state);
          if (state === 'PLAYING') beat = setInterval(() => send('PLAYING'), 15000);
        } },
      });
    }).catch((err) => { const el = $('#yt-err'); el.textContent = err.message; el.hidden = false; });
  }

  /* ---------- feed ---------- */
  function renderFeed() {
    const root = $('#feed-root');
    const u = me();
    root.innerHTML = `
      <h1 class="h-xl">Fan feed</h1>
      <p class="body-sm muted mb-3">Say something about the match. Your first 3 posts earn 3 points each.</p>
      <div id="feed-form" class="mb-6">${u
        ? `<form class="stack-sm" style="gap:8px" novalidate><label for="post" class="sr-only">Write a post</label>
            <textarea id="post" rows="3" maxlength="${MAX_POST}" class="input" placeholder="What was your read on that last round?"></textarea>
            <div class="row"><button type="submit" class="btn btn-primary" disabled>Post</button><span class="small muted" style="font-weight:400" aria-live="polite" id="post-left">${MAX_POST} left</span></div></form>`
        : empty('Sign in to post', 'Reading is open to everyone. Posting needs a linked account.', signInCta())}</div>
      <div id="feed-list"></div>`;
    renderPosts();
  }
  function renderPosts() {
    const u = me();
    const list = $('#feed-list');
    if (!S.posts.length) { list.innerHTML = empty('Quiet in here', 'Be the first to post about the match.'); return; }
    list.innerHTML = S.posts.map((p) => {
      const liked = Boolean(u && p.likedBy.includes(u.id));
      return `<article class="post"><div class="avatar" aria-hidden="true">${initials(p.author)}</div><div class="grow">
        <div style="font-weight:700">${esc(p.author)} <time datetime="${p.at}">${esc(new Date(p.at).toLocaleString())}</time></div>
        <p class="body-sm">${esc(p.text)}</p>
        <button type="button" class="like" data-like="${p.id}" aria-pressed="${liked}">${liked ? 'Liked' : 'Like'} · ${p.likes}<span class="sr-only"> likes</span></button></div></article>`;
    }).join('');
  }
  function setupFeed() {
    const root = $('#feed-root');
    root.addEventListener('input', (e) => {
      if (e.target.id !== 'post') return;
      $('#post-left').textContent = `${MAX_POST - e.target.value.length} left`;
      $('#feed-form button[type=submit]').disabled = !e.target.value.trim();
    });
    root.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = me(); const area = $('#post');
      const text = area.value.trim();
      if (!text) return;
      S.posts.unshift({ id: uid(), author: u.name, text, likes: 0, likedBy: [], at: new Date().toISOString() });
      const bonus = u.postCount++ < 3 ? 3 : 0;
      if (bonus) ledger(u, bonus, 'watch_time');
      save(); refreshPoints();
      toast(bonus ? `Posted. +${bonus} points.` : 'Posted.');
      renderFeed();
    });
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-like]');
      if (!btn) return;
      const u = me();
      if (!u) return toast('Sign in to like posts.', 'error');
      const p = S.posts.find((x) => x.id === btn.dataset.like);
      const i = p.likedBy.indexOf(u.id);
      if (i < 0) { p.likedBy.push(u.id); p.likes++; } else { p.likedBy.splice(i, 1); p.likes--; }
      save(); renderPosts();
    });
  }

  /* ---------- party ---------- */
  const slots = (n) => `<ul class="slots" aria-label="${n} of ${SIZE} spots filled">${Array.from({ length: SIZE }, (_, i) =>
    `<li><div class="avatar sm${i >= n ? ' empty-slot' : ''}" aria-hidden="true">${i >= n ? '+' : 'P'}</div><span>${i < n ? 'Taken' : 'Open spot'}</span></li>`).join('')}</ul>`;

  function renderParty() {
    const root = $('#party-root');
    const u = me();
    if (!u) { root.className = ''; root.innerHTML = empty('Sign in to find players', 'Parties are matched from the games in your Steam library, so we need you to link it first.', signInCta()); return; }
    root.className = 'cols';
    root.innerHTML = `
      <section aria-labelledby="cl-h">
        <h1 id="cl-h" class="h-xl">Players like you</h1>
        <p class="body-sm muted mb-4">Grouped by games you both own, plus a shared region or followed team. Location is never used.</p>
        <ul class="list">${CLUSTERS.map((c) => `<li><div class="grow"><div style="font-weight:700">${esc(c.game_name)}</div>
          <div class="wrap-row small muted mt-1" style="gap:6px;font-weight:400;align-items:center"><span>${c.players} players</span>${[...c.shared_regions, ...c.shared_teams].map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>
          <button type="button" class="btn btn-primary" data-match="${c.game_id}" aria-label="Find a ${esc(c.game_name)} party">Find party</button></li>`).join('')}</ul>
        <p class="note">13+ only. No private DMs. Players under 18 only see other under-18s.</p>
      </section>
      <section aria-labelledby="pb-h">
        <h2 id="pb-h" class="h-xl">Party board</h2>
        <p class="body-sm muted mb-4">Open parties, up to ${SIZE} players each.</p>
        ${S.parties.length ? `<ul class="stack">${S.parties.map((p) => {
          const joined = p.people.includes(u.id);
          const full = p.people.length >= SIZE;
          return `<li class="card"><div class="party-head"><div><h3 class="h-lg">${esc(p.game)}</h3><div class="label">${esc(p.region)}</div></div>
            ${joined ? `<button type="button" class="btn" data-leave="${p.id}">Leave</button>`
              : `<button type="button" class="btn btn-primary" data-join="${p.id}" ${full ? 'disabled' : ''} aria-label="Join ${esc(p.game)} party">${full ? 'Full' : 'Join'}</button>`}</div>
            <div class="mt-3">${slots(p.people.length)}</div></li>`;
        }).join('')}</ul>` : empty('Nobody is queued', 'Use Find party on a game to start one.')}
      </section>`;
  }
  function setupParty() {
    $('#party-root').addEventListener('click', (e) => {
      const u = me();
      const match = e.target.closest('[data-match]');
      const join = e.target.closest('[data-join]');
      const leave = e.target.closest('[data-leave]');
      try {
        if (match) {
          const c = CLUSTERS.find((x) => x.game_id === match.dataset.match);
          const game = u.games.find((g) => String(g.appid) === c.game_id);
          if (!game) throw new Error('You must own this game on Steam');
          const open = S.parties.find((p) => p.game_id === c.game_id && p.people.length < SIZE && !p.people.includes(u.id));
          if (open) open.people.push(u.id);
          else S.parties.push({ id: uid(), game_id: c.game_id, game: game.name, region: c.shared_regions[0] ?? 'GLOBAL', people: [u.id] });
          toast(`Matched into a ${c.game_name} party.`);
        } else if (join) {
          const p = S.parties.find((x) => x.id === join.dataset.join);
          if (!p || p.people.length >= SIZE || p.people.includes(u.id)) throw new Error('Party is full or you already joined');
          p.people.push(u.id); toast('You joined the party.');
        } else if (leave) {
          const p = S.parties.find((x) => x.id === leave.dataset.leave);
          if (!p?.people.includes(u.id)) throw new Error('You are not in this party');
          p.people = p.people.filter((x) => x !== u.id);
          if (!p.people.length) S.parties = S.parties.filter((x) => x !== p);
          toast('You left the party.');
        } else return;
        save(); renderParty();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---------- rewards ---------- */
  function renderRewards() {
    const root = $('#rewards-root');
    const u = me();
    root.innerHTML = `
      <h1 class="h-xl">Rewards</h1>
      <p class="body-sm muted mb-4">Spend the points you earn. They have no cash value.</p>
      ${S.perks.length ? `<ul class="list">${S.perks.map((p) => {
        const short = u && u.points < p.cost;
        return `<li><div class="grow"><div style="font-weight:700">${esc(p.title)}</div><div class="body-sm muted">${esc(p.body)}</div></div>
          <span class="accent" style="font-weight:700;white-space:nowrap">${fmt(p.cost)} pts</span>
          ${u ? `<button type="button" class="btn btn-primary" data-redeem="${p.id}" ${short ? 'disabled' : ''} aria-label="Redeem ${esc(p.title)}">${short ? 'Not enough' : 'Redeem'}</button>`
            : '<button type="button" class="btn" id="steam-cta">Sign in</button>'}</li>`;
      }).join('')}</ul>` : empty('Nothing to redeem yet', 'New rewards will be listed here.')}
      <dialog class="dlg" id="redeem-dlg" aria-labelledby="dlg-title">
        <h2 id="dlg-title" class="h-lg">Confirm redemption</h2>
        <p class="body-sm mt-3" id="dlg-body"></p>
        <div class="row" style="margin-top:16px;gap:8px"><button type="button" class="btn btn-primary" id="dlg-ok">Spend points</button><button type="button" class="btn" id="dlg-cancel">Cancel</button></div>
      </dialog>`;
  }
  function setupRewards() {
    const root = $('#rewards-root');
    let target = null;
    root.addEventListener('click', (e) => {
      const dlg = $('#redeem-dlg');
      const btn = e.target.closest('[data-redeem]');
      if (btn) {
        target = S.perks.find((p) => p.id === btn.dataset.redeem);
        $('#dlg-body').innerHTML = `Spend ${fmt(target.cost)} points on <b>${esc(target.title)}</b>? This cannot be undone.`;
        dlg.showModal();
      } else if (e.target.id === 'dlg-cancel' || e.target === dlg) {
        dlg.close();
      } else if (e.target.id === 'dlg-ok') {
        const u = me();
        try {
          if (target.cost > u.points) throw new Error('Insufficient points');
          ledger(u, -target.cost, 'redemption'); save(); refreshPoints();
          toast(`Redeemed: ${target.title}.`);
          dlg.close(); renderRewards();
        } catch (err) { toast(err.message, 'error'); }
      }
    });
  }

  /* ---------- profile ---------- */
  function renderProfile() {
    const root = $('#profile-root');
    const u = me();
    if (!u) { root.className = ''; root.innerHTML = empty('Sign in to see your profile', 'Your balance, history and matching preferences live here.', signInCta()); return; }
    root.className = 'cols';
    root.innerHTML = `
      <section aria-labelledby="pf-h">
        <div class="frame mb-6" style="padding:20px"><div class="label">Signed in as</div><h1 id="pf-h" class="h-xl" style="overflow-wrap:anywhere">${esc(u.name)}</h1>
          <p class="body-sm muted">${fmt(u.points)} points · ${u.games.length} Steam games linked</p></div>
        <form class="stack" id="profile-form" novalidate>
          <fieldset><legend>Teams you follow</legend><div class="wrap-row">${TEAMS.map((t) => pillBtn(t, u.teams.includes(t), `data-team="${esc(t)}"`)).join('')}</div></fieldset>
          <fieldset><legend>Regions</legend><div class="wrap-row">${REGIONS.map((r) => pillBtn(r, u.regions.includes(r), `data-region="${r}"`)).join('')}</div></fieldset>
          <div class="field"><label for="discord">Discord user ID (optional, for reminders)</label><input id="discord" class="input w-xs" inputmode="numeric" value="${esc(u.discord)}"></div>
          <div><button type="submit" class="btn btn-primary">Save profile</button></div>
        </form>
      </section>
      <section aria-labelledby="tx-h"><h2 id="tx-h" class="h-xl">Points history</h2>
        ${u.tx.length ? `<ul class="list tight mt-3">${u.tx.map((t) => `<li class="body-sm"><span><b>${esc(TX_LABELS[t.source] ?? t.source)}</b> <time class="muted" datetime="${t.at}">${esc(new Date(t.at).toLocaleDateString())}</time></span>
          <span class="${t.points < 0 ? 'credit-neg' : 'credit-pos'}">${t.points > 0 ? '+' : ''}${fmt(t.points)}</span></li>`).join('')}</ul>`
          : empty('No activity yet', 'Predictions, watch bonuses and redemptions show up here.')}</section>`;
  }
  function setupProfile() {
    const root = $('#profile-root');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-team], [data-region]');
      if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
    root.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = me(); const input = $('#discord');
      const discord = input.value.trim();
      if (discord && !/^\d{15,25}$/.test(discord)) return fieldError(input, 'A Discord user ID is 15 to 25 digits.');
      fieldError(input, '');
      u.teams = $$('[data-team][aria-pressed="true"]', root).map((b) => b.dataset.team);
      u.regions = $$('[data-region][aria-pressed="true"]', root).map((b) => b.dataset.region);
      u.discord = discord;
      save(); toast('Profile saved.');
    });
  }

  /* ---------- login / signup ---------- */
  function setupLogin() {
    if (me()) { location.replace('profile.html'); return; }
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#li-email').value.trim().toLowerCase();
      const password = $('#li-password').value;
      const btn = $('button[type=submit]', e.target);
      formAlert('');
      if (!email || !password) return formAlert('Enter your email and password.');
      busy(btn, true);
      const acct = S.accounts[email];
      const ok = acct && acct.hash === await hash(`${email}:${password}`);
      busy(btn, false);
      if (!ok) return formAlert('Email or password is incorrect');
      S.session = acct.id; save(); location.href = 'profile.html';
    });
  }

  function setupSignup() {
    if (me()) { location.replace('profile.html'); return; }
    const form = $('#signup-form');
    const checks = () => $$('input[name="favorite_players"]', form);
    const chosen = () => checks().filter((c) => c.checked);
    const syncFavs = () => {
      const n = chosen().length;
      $('#fp-help').textContent = `Pick up to ${MAX_FAVORITES}. ${n} chosen.`;
      checks().forEach((c) => { c.disabled = n >= MAX_FAVORITES && !c.checked; });
    };
    form.addEventListener('change', (e) => { if (e.target.name === 'favorite_players') syncFavs(); });

    const custom = $('#su-custom');
    const addCustom = () => {
      const name = custom.value.trim();
      if (!name) return;
      if (!PLAYER_PATTERN.test(name)) return fieldError(custom, 'Use letters, numbers, spaces, . _ - (30 max).');
      if (checks().some((c) => c.value.toLowerCase() === name.toLowerCase())) return fieldError(custom, 'Already in your list.');
      if (chosen().length >= MAX_FAVORITES) return fieldError(custom, `You can pick up to ${MAX_FAVORITES}.`);
      const label = document.createElement('label');
      label.className = 'pill';
      label.innerHTML = `<input type="checkbox" name="favorite_players" checked><span></span>`;
      label.firstChild.value = name;
      label.lastChild.textContent = name;
      $('#su-extra').append(label);
      $('#su-extra-wrap').hidden = false;
      custom.value = ''; fieldError(custom, ''); syncFavs();
    };
    $('#su-add').addEventListener('click', addCustom);
    custom.addEventListener('input', () => fieldError(custom, ''));
    custom.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } });

    const pw = $('#su-password');
    $('#su-pw-toggle').addEventListener('click', (e) => {
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      e.currentTarget.textContent = show ? 'Hide' : 'Show';
      e.currentTarget.setAttribute('aria-pressed', String(show));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = { name: $('#su-name').value.trim(), email: $('#su-email').value.trim().toLowerCase(), password: pw.value, steam: $('#su-steam_id').value.trim() };
      const errs = {};
      if (v.name.length < 2) errs.name = 'Use at least 2 characters.';
      else if (v.name.length > 30) errs.name = 'Use 30 characters or fewer.';
      if (!EMAIL.test(v.email)) errs.email = 'Enter a valid email address.';
      if (v.password.length < 10) errs.password = 'Use at least 10 characters.';
      else if (v.password.length > 128) errs.password = 'Use 128 characters or fewer.';
      if (v.steam && !STEAM_ID.test(v.steam)) errs.steam_id = 'Enter the 17-digit Steam ID. It starts with 7656119.';
      if (!errs.email && S.accounts[v.email]) errs.email = 'Already registered. Try signing in.';
      for (const k of ['name', 'email', 'password', 'steam_id']) fieldError($(`#su-${k}`), errs[k] ?? '');
      formAlert(Object.keys(errs).length ? 'Fix the highlighted fields and try again.' : '');
      const first = Object.keys(errs)[0];
      if (first) return $(`#su-${first}`).focus();

      const btn = $('button[type=submit]', form);
      busy(btn, true);
      const id = uid();
      S.accounts[v.email] = { id, hash: await hash(`${v.email}:${v.password}`) };
      S.users[id] = { id, name: v.name, email: v.email, points: 0, teams: [], regions: [], discord: '', favs: chosen().map((c) => c.value),
        steamUnverified: v.steam || undefined, games: [], watched: [], postCount: 0, predictions: {}, tx: [] };
      ledger(S.users[id], 1000, 'signup_bonus');
      S.session = id; save();
      location.href = 'profile.html';
    });
  }

  /* ---------- boot ---------- */
  const PAGES = { index: renderHome, live: renderLive, feed: renderFeed, party: renderParty, rewards: renderRewards, profile: renderProfile };
  const SETUP = { live: setupLive, feed: setupFeed, party: setupParty, rewards: setupRewards, profile: setupProfile, login: setupLogin, signup: setupSignup };
  const render = () => PAGES[page]?.();

  S = load();
  applyStoredTheme();
  renderHeader();
  SETUP[page]?.();
  render();
  save();
})();
