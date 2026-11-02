// SmashScore frontend: navigation, scoring rules, timer, undo, and PHP calls.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let match = null;
let timerId = null;

/* ---------- Rules (pure) ---------- */
// A game ends at the target with a two-point lead, or at the cap (target + 9).
function gameWinner(a, b, target) {
  const cap = target + 9;
  if (a >= cap) return 0;
  if (b >= cap) return 1;
  if (a >= target && a - b >= 2) return 0;
  if (b >= target && b - a >= 2) return 1;
  return null;
}

/* ---------- Navigation ---------- */
function go(id) {
  $$('.view').forEach((v) => { v.hidden = v.id !== id; });
  $('#back-live').hidden = !match || id === 'live';
  if (id === 'home') loadSummary();
  if (id === 'history') loadHistory();
  if (id === 'players') loadPlayers();
  if (id === 'leaderboard') loadLeaderboard();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  if (match && !match.saved && b.dataset.go === 'setup' && !confirm('Leave this match? It has not been saved.')) return;
  go(b.dataset.go);
});

/* ---------- Setup ---------- */
$$('input[name=type]').forEach((r) => r.addEventListener('change', () => {
  const doubles = $('input[name=type]:checked').value === 'doubles';
  $$('.partner').forEach((p) => { p.hidden = !doubles; });
  $('#a2').required = $('#b2').required = doubles;
}));

$('#setup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('input[name=type]:checked').value;
  const side = (p, q) => {
    const first = $(p).value.trim();
    return type === 'doubles' ? `${first} / ${$(q).value.trim()}` : first;
  };
  const names = [side('#a1', '#a2'), side('#b1', '#b2')];
  const err = $('#setup-error');
  if (!$('#a1').value.trim() || !$('#b1').value.trim()
    || (type === 'doubles' && (!$('#a2').value.trim() || !$('#b2').value.trim()))) {
    err.textContent = 'Enter every player name.';
    return;
  }
  if (names[0].toLowerCase() === names[1].toLowerCase()) {
    err.textContent = 'The two sides must have different names.';
    return;
  }
  err.textContent = '';
  match = {
    type, names,
    bestOf: Number($('#best').value),
    target: Number($('#pts').value),
    event: $('#event').value.trim(),
    finished: [], score: [0, 0], server: 0, firstServer: 0,
    history: [], log: [], over: false, saved: false, elapsed: 0,
  };
  startTimer();
  go('live');
  render();
});

/* ---------- Timer ---------- */
function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!match || match.over) return;
    match.elapsed += 1;
    renderTimer();
  }, 1000);
}
function renderTimer() {
  const s = match.elapsed;
  $('#timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- Scoring ---------- */
const snapshot = () => JSON.stringify({
  finished: match.finished, score: match.score, server: match.server, log: match.log, over: match.over,
});
const wins = () => [0, 1].map((s) => match.finished.filter((g) => (g[0] > g[1] ? 0 : 1) === s).length);

function addPoint(side) {
  if (!match || match.over) return;
  match.history.push(snapshot());
  match.score[side] += 1;
  match.server = side; // rally point: the rally winner serves next
  const n = match.finished.length + 1;
  match.log.unshift(`Game ${n}: ${match.names[side]} won the rally (${match.score[0]}–${match.score[1]})`);
  const winner = gameWinner(match.score[0], match.score[1], match.target);
  if (winner !== null) {
    match.finished.push([...match.score]);
    match.log.unshift(`Game ${n} to ${match.names[winner]}, ${match.score[0]}–${match.score[1]}`);
    if (wins()[winner] === Math.ceil(match.bestOf / 2)) {
      match.over = true;
      match.log.unshift(`Match to ${match.names[winner]}`);
    } else {
      match.score = [0, 0];
      match.server = winner; // the game winner serves first in the next game
    }
  }
  render();
}
function undo() {
  if (!match || !match.history.length || match.saved) return;
  Object.assign(match, JSON.parse(match.history.pop()));
  render();
}
function resetGame() {
  if (!match || match.over) return;
  if (!confirm('Reset the current game to 0–0?')) return;
  match.history.push(snapshot());
  match.score = [0, 0];
  match.log.unshift(`Game ${match.finished.length + 1} reset`);
  render();
}

/* ---------- Render ---------- */
function render() {
  const w = wins();
  [0, 1].forEach((s) => {
    const el = $(`#side-${s}`);
    $('.name', el).textContent = match.names[s];
    const shown = match.over ? match.finished.at(-1)[s] : match.score[s];
    $('.score', el).textContent = shown;
    $('.games', el).textContent = `Games won: ${w[s]}`;
    el.classList.toggle('serving', !match.over && match.server === s);
    $('.plus', el).disabled = match.over;
  });
  $('#game-label').textContent = match.over
    ? 'Match complete'
    : `Game ${match.finished.length + 1} of ${match.bestOf === 1 ? 1 : 'best of 3'} · to ${match.target}`;
  const [a, b] = match.score;
  let status = '';
  if (match.over) {
    const win = w[0] > w[1] ? 0 : 1;
    status = match.saved ? 'Result saved.' : `${match.names[win]} wins ${Math.max(...w)}–${Math.min(...w)}. Save the result to keep it.`;
  } else if (a === match.target + 8 && b === a) {
    status = 'Next point wins the game.';
  } else if (a >= match.target - 1 && a === b) {
    status = 'Deuce: a two-point lead is needed.';
  }
  $('#status').textContent = status;
  $('#undo').disabled = !match.history.length || match.saved;
  $('#reset').disabled = match.over;
  $('#save').hidden = !match.over || match.saved;
  $('#log').innerHTML = match.log.map((l) => `<li>${esc(l)}</li>`).join('');
  renderTimer();
}

$$('.plus').forEach((b) => b.addEventListener('click', () => addPoint(Number(b.dataset.side))));
$('#undo').addEventListener('click', undo);
$('#reset').addEventListener('click', resetGame);
$('#newmatch').addEventListener('click', () => {
  if (match && !match.saved && !confirm('Leave this match? It has not been saved.')) return;
  match = null;
  clearInterval(timerId);
  $('#setup-form').reset();
  $$('.partner').forEach((p) => { p.hidden = true; });
  go('setup');
});

/* ---------- Save and reports ---------- */
async function api(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

$('#save').addEventListener('click', async () => {
  const btn = $('#save');
  btn.disabled = true;
  try {
    await api('save_match.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: match.event, match_type: match.type,
        side_a: match.names[0], side_b: match.names[1],
        best_of: match.bestOf, points_per_game: match.target,
        game_scores: match.finished, duration_seconds: match.elapsed,
      }),
    });
    match.saved = true;
    clearInterval(timerId);
    render();
  } catch (e) {
    $('#status').textContent = `Not saved: ${e.message}. Try again.`;
  } finally {
    btn.disabled = false;
  }
});

function table(view, headers, rows, empty) {
  const box = $(`#${view} .report`);
  if (!rows.length) { box.innerHTML = `<p class="muted">${empty}</p>`; return; }
  box.innerHTML = `<table><thead><tr>${headers.map(([h, c]) => `<th class="${c || ''}">${h}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((v, i) => `<td class="${headers[i][1] || ''}">${esc(v)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}
async function load(view, url, build) {
  const box = $(`#${view} .report`);
  box.innerHTML = '<p class="muted">Loading…</p>';
  try { build(await api(url)); } catch (e) { box.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}
const loadHistory = () => load('history', 'data.php?view=history', (rows) => table('history',
  [['Date'], ['Event'], ['Match'], ['Scores'], ['Winner']],
  rows.map((m) => [new Date(m.created_at).toLocaleDateString(), m.event_name || '—', `${m.side_a} vs ${m.side_b}`,
    m.game_scores.map((g) => g.join('–')).join(', '), `${m.winner} (${Math.max(m.games_a, m.games_b)}–${Math.min(m.games_a, m.games_b)})`]),
  'No saved matches yet.'));
const loadPlayers = () => load('players', 'data.php?view=players', (rows) => table('players',
  [['Name'], ['Type'], ['Matches', 'num']],
  rows.map((p) => [p.name, p.match_type, p.played]), 'No players yet.'));
const loadLeaderboard = () => load('leaderboard', 'data.php?view=leaderboard', (rows) => table('leaderboard',
  [['#', 'num'], ['Name'], ['Type'], ['Played', 'num'], ['Wins', 'num'], ['Losses', 'num'], ['Games +/−', 'num']],
  rows.map((p, i) => [i + 1, p.name, p.match_type, p.played, p.wins, p.losses, `${p.games_won}/${p.games_lost}`]),
  'No results yet.'));
async function loadSummary() {
  try {
    const s = await api('data.php?view=summary');
    $('#summary').textContent = `${s.matches} matches saved · ${s.players} players`;
  } catch { $('#summary').textContent = ''; }
}
loadSummary();
