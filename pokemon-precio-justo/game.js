const API_BASE = 'https://api.pokemontcg.io/v2/cards';
const BATCH_SIZE = 250; // máximo que admite la API por página
const REFILL_THRESHOLD = 5; // cuando quedan pocas cartas en cola, se rellena en segundo plano

const state = {
  players: [],
  totalRounds: 10,
  currentRound: 0,
  totalCardCount: null,
  currentCard: null,
  currentPrice: null,
  cardQueue: [],
};

let prefetchPromise = null;

const el = (id) => document.getElementById(id);

const screenSetup = el('screen-setup');
const screenRound = el('screen-round');
const screenFinal = el('screen-final');
const errorBox = el('error-box');

el('num-players').addEventListener('change', renderPlayerNameInputs);
el('btn-start').addEventListener('click', startGame);
el('btn-reveal').addEventListener('click', reveal);
el('btn-next').addEventListener('click', goToNextRound);
el('btn-restart').addEventListener('click', restart);
el('btn-retry').addEventListener('click', loadCard);

renderPlayerNameInputs();
fetchBatch(); // precarga en segundo plano mientras el jugador rellena la configuración

function renderPlayerNameInputs() {
  const n = Number(el('num-players').value);
  const container = el('player-names');
  container.innerHTML = '';
  for (let i = 1; i <= n; i++) {
    const label = document.createElement('label');
    label.textContent = `Nombre jugador ${i}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `player-name-${i}`;
    input.placeholder = `Jugador ${i}`;
    label.appendChild(input);
    container.appendChild(label);
  }
}

function startGame() {
  const n = Number(el('num-players').value);
  state.players = [];
  for (let i = 1; i <= n; i++) {
    const input = el(`player-name-${i}`);
    const name = input.value.trim() || `Jugador ${i}`;
    state.players.push({ name, score: 0 });
  }
  state.totalRounds = Number(el('num-rounds').value);
  state.currentRound = 1;

  screenSetup.hidden = true;
  screenFinal.hidden = true;
  screenRound.hidden = false;

  startRound();
}

function startRound() {
  el('round-info').textContent = `Ronda ${state.currentRound} / ${state.totalRounds}`;
  el('btn-reveal').hidden = false;
  el('btn-next').hidden = true;
  el('reveal-area').hidden = true;
  el('reveal-area').innerHTML = '';
  loadCard();
}

async function getTotalCount() {
  if (state.totalCardCount) return state.totalCardCount;
  const res = await fetch(`${API_BASE}?pageSize=1`);
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  const data = await res.json();
  state.totalCardCount = data.totalCount;
  return state.totalCardCount;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pide un lote grande de cartas de golpe (en vez de 1 carta por ronda): las
// páginas profundas de 1 en 1 son muy lentas en esta API, y con 250 cartas
// de una vez suele bastar para toda la partida.
function fetchBatch() {
  if (prefetchPromise) return prefetchPromise; // ya hay una petición en curso: reutilizarla
  prefetchPromise = (async () => {
    try {
      const total = await getTotalCount();
      const maxPage = Math.max(1, Math.ceil(total / BATCH_SIZE));
      const page = 1 + Math.floor(Math.random() * maxPage);
      const res = await fetch(`${API_BASE}?pageSize=${BATCH_SIZE}&page=${page}`);
      if (!res.ok) throw new Error(`API respondió ${res.status}`);
      const data = await res.json();
      const cards = (data.data || [])
        .map(card => {
          const price = card?.cardmarket?.prices?.trendPrice || card?.cardmarket?.prices?.averageSellPrice;
          return price ? { card, price } : null;
        })
        .filter(Boolean);
      state.cardQueue.push(...shuffle(cards));
    } finally {
      prefetchPromise = null;
    }
  })();
  return prefetchPromise;
}

function preloadImages(items) {
  items.forEach(item => {
    const img = new Image();
    img.src = item.card.images.large || item.card.images.small;
  });
}

async function loadCard() {
  errorBox.hidden = true;
  el('card-image').src = '';
  el('card-meta').textContent = 'Cargando carta...';
  el('guess-form').innerHTML = '';
  el('btn-reveal').disabled = true;

  try {
    for (let attempt = 0; state.cardQueue.length === 0 && attempt < 3; attempt++) {
      await fetchBatch();
    }
    if (state.cardQueue.length === 0) {
      throw new Error('No se encontraron cartas con precio');
    }

    const { card, price } = state.cardQueue.shift();
    state.currentCard = card;
    state.currentPrice = price;

    el('card-image').src = card.images.large || card.images.small;
    el('card-image').alt = card.name;
    el('card-meta').textContent = `${card.name} — ${card.set.name} — ${card.rarity || 'Rareza desconocida'}`;

    renderGuessForm();
    el('btn-reveal').disabled = false;

    preloadImages(state.cardQueue.slice(0, 2));
    if (state.cardQueue.length < REFILL_THRESHOLD) {
      fetchBatch(); // en segundo plano, no bloquea la ronda actual
    }
  } catch (err) {
    showError('No se pudo cargar la carta. Comprueba tu conexión e inténtalo de nuevo. ' + err.message);
  }
}

function renderGuessForm() {
  const form = el('guess-form');
  form.innerHTML = '';
  state.players.forEach((player, i) => {
    const row = document.createElement('div');
    row.className = 'guess-row';

    const label = document.createElement('label');
    label.textContent = player.name;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `guess-${i}`;
    input.min = '0';
    input.step = '0.01';
    input.placeholder = '€';

    row.appendChild(label);
    row.appendChild(input);
    form.appendChild(row);
  });
}

function pointsForGuess(guess, real) {
  if (real <= 0) return 0;
  const errorPct = Math.abs(guess - real) / real * 100;
  return Math.max(0, Math.round(100 - errorPct));
}

function reveal() {
  const real = state.currentPrice;
  const results = state.players.map((player, i) => {
    const input = el(`guess-${i}`);
    const guess = Number(input.value) || 0;
    const points = pointsForGuess(guess, real);
    player.score += points;
    return { name: player.name, guess, points };
  });

  const maxPoints = Math.max(...results.map(r => r.points));

  const area = el('reveal-area');
  area.innerHTML = '';

  const priceLine = document.createElement('div');
  priceLine.className = 'real-price';
  priceLine.textContent = `Precio real (Cardmarket): ${real.toFixed(2)} €`;
  area.appendChild(priceLine);

  results.forEach(r => {
    const row = document.createElement('div');
    row.className = 'result-row' + (r.points === maxPoints ? ' winner' : '');
    row.textContent = `${r.name}: ${r.guess.toFixed(2)} € → ${r.points} pts`;
    area.appendChild(row);
  });

  area.hidden = false;
  el('btn-reveal').hidden = true;
  el('btn-next').hidden = false;
}

function goToNextRound() {
  state.currentRound++;
  if (state.currentRound > state.totalRounds) {
    showFinal();
  } else {
    startRound();
  }
}

function showFinal() {
  screenRound.hidden = true;
  screenFinal.hidden = false;

  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  const container = el('final-ranking');
  container.innerHTML = '';
  ranking.forEach((player, i) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    row.textContent = `${i + 1}. ${player.name} — ${player.score} pts`;
    container.appendChild(row);
  });
}

function restart() {
  screenFinal.hidden = true;
  screenSetup.hidden = false;
}

function showError(msg) {
  el('error-msg').textContent = msg;
  errorBox.hidden = false;
}
