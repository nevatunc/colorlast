// =============================
// Game state and constants
// =============================
const gridSize = 10;
const gridElement = document.getElementById('grid');
const piecesContainer = document.getElementById('pieces');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('bestScore');
const difficultySelect = document.getElementById('difficultySelect');
const comboMessage = document.getElementById('comboMessage');
const overlay = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');
const modeLabel = document.getElementById('modeLabel');
const timerEl = document.getElementById('timer');

const clearLineBtn = document.getElementById('clearLineBtn');
const swapBtn = document.getElementById('swapBtn');
const hintBtn = document.getElementById('hintBtn');
const bombBtn = document.getElementById('bombBtn');
const countEls = {
  clearLine: document.getElementById('clearLineCount'),
  pieceSwap: document.getElementById('swapCount'),
  hint: document.getElementById('hintCount'),
  bomb: document.getElementById('bombCount'),
};

const classicBtn = document.getElementById('classicBtn');
const timeBtn = document.getElementById('timeBtn');
const restartBtn = document.getElementById('restartBtn');

let grid = createEmptyGrid();
let availablePieces = [];
let score = 0;
let comboLevel = 0;
let difficulty = 'normal';
let mode = 'classic';
let timerSeconds = 120;
let timerInterval = null;
let draggingPiece = null;
let dragPreviewCells = [];
let activePower = null;

const powerups = {
  clearLine: 0,
  pieceSwap: 0,
  hint: 0,
  bomb: 0,
};

const rewardSteps = {
  clearLine: 80,
  pieceSwap: 60,
  hint: 100,
  bomb: 150,
};
const nextReward = { ...rewardSteps };

const pastelColors = ['#F28FB5', '#8FD3F4', '#FFD580', '#A0E7A0', '#C9B6E4', '#FFB3C1'];

const templates = [
  [[1]],
  [[1, 1]],
  [[1, 1, 1]],
  [[1, 1, 1, 1]],
  [[1], [1]],
  [[1], [1], [1]],
  [[1], [1], [1], [1]],
  [[1, 1], [1, 1]],
  [[1, 0], [1, 1]],
  [[0, 1], [1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
  [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
  [[1, 1, 1], [1, 1, 1]],
];

const difficultyWeights = {
  easy: [0, 1, 2, 4, 7],
  normal: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13],
  hard: [2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
};

// =============================
// Initialization
// =============================
createGridCells();
setupEventListeners();
startGame();

function createEmptyGrid() {
  return Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
}

function createGridCells() {
  gridElement.innerHTML = '';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      gridElement.appendChild(cell);
    }
  }
}

function setupEventListeners() {
  difficultySelect.addEventListener('change', () => {
    difficulty = difficultySelect.value;
    startGame();
  });

  classicBtn.addEventListener('click', () => switchMode('classic'));
  timeBtn.addEventListener('click', () => switchMode('time'));

  clearLineBtn.addEventListener('click', () => activatePower('clearLine'));
  swapBtn.addEventListener('click', () => activatePower('pieceSwap'));
  hintBtn.addEventListener('click', () => {
    if (powerups.hint > 0) {
      powerups.hint -= 1;
      updatePowerupUI();
      showHint();
    }
  });
  bombBtn.addEventListener('click', () => activatePower('bomb'));

  gridElement.addEventListener('pointerdown', handleGridPointerDown);
  gridElement.addEventListener('click', handleGridClick);
  restartBtn.addEventListener('click', startGame);
}

function switchMode(selected) {
  if (mode === selected) return;
  mode = selected;
  classicBtn.classList.toggle('active', mode === 'classic');
  timeBtn.classList.toggle('active', mode === 'time');
  modeLabel.textContent = mode === 'classic' ? 'Classic' : 'Time Attack';
  startGame();
}

// =============================
// Game setup and rendering
// =============================
function startGame() {
  grid = createEmptyGrid();
  availablePieces = [];
  score = 0;
  comboLevel = 0;
  activePower = null;
  Object.keys(powerups).forEach(key => powerups[key] = 0);
  Object.keys(nextReward).forEach(key => nextReward[key] = rewardSteps[key]);
  overlay.classList.add('hidden');
  clearInterval(timerInterval);
  timerSeconds = 120;
  if (mode === 'time') {
    startTimer();
  } else {
    timerEl.textContent = '∞';
  }
  updateBestScore();
  updateScore(0);
  renderGrid();
  generatePieces();
  updatePowerupUI();
}

function renderGrid() {
  const cells = gridElement.children;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      const cell = cells[idx];
      const value = grid[r][c];
      cell.classList.remove('filled');
      cell.style.removeProperty('--cell-color');
      if (value) {
        cell.classList.add('filled');
        cell.style.setProperty('--cell-color', value.color);
      }
    }
  }
}

function renderPieces() {
  piecesContainer.innerHTML = '';
  availablePieces.forEach(piece => {
    const pieceEl = document.createElement('div');
    pieceEl.className = 'piece';
    pieceEl.dataset.id = piece.id;
    pieceEl.style.setProperty('--piece-color', piece.color);

    const rows = piece.shape.length;
    const cols = piece.shape[0].length;
    const gridEl = document.createElement('div');
    gridEl.className = 'piece-grid';
    gridEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;

    piece.shape.forEach(row => {
      row.forEach(cellVal => {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        if (!cellVal) {
          cell.style.visibility = 'hidden';
        }
        gridEl.appendChild(cell);
      });
    });

    pieceEl.appendChild(gridEl);
    pieceEl.addEventListener('pointerdown', (e) => startDrag(e, piece));
    piecesContainer.appendChild(pieceEl);
  });
}

// =============================
// Piece generation
// =============================
function generatePieces() {
  while (availablePieces.length < 3) {
    const template = getTemplateByDifficulty();
    availablePieces.push(createPiece(template));
  }
  renderPieces();
}

function getTemplateByDifficulty() {
  const list = difficultyWeights[difficulty];
  const index = list[Math.floor(Math.random() * list.length)];
  return templates[index];
}

function createPiece(shapeTemplate) {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    shape: shapeTemplate,
    color: pastelColors[Math.floor(Math.random() * pastelColors.length)],
  };
}

// =============================
// Drag and drop handling
// =============================
function startDrag(e, piece) {
  e.preventDefault();
  if (draggingPiece) return;
  draggingPiece = { piece };

  const ghost = createGhostElement(piece);
  document.body.appendChild(ghost);
  draggingPiece.ghost = ghost;

  const move = (ev) => handleDragMove(ev);
  const up = (ev) => {
    endDrag(ev);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  handleDragMove(e);
}

function handleDragMove(e) {
  if (!draggingPiece) return;
  const ghost = draggingPiece.ghost;
  ghost.style.left = `${e.clientX - 30}px`;
  ghost.style.top = `${e.clientY - 30}px`;

  const target = getGridPositionFromPointer(e);
  clearPreview();
  if (!target) return;
  const { row, col } = target;
  const valid = canPlace(draggingPiece.piece, row, col);
  applyPreview(draggingPiece.piece, row, col, valid);
}

function endDrag(e) {
  if (!draggingPiece) return;
  const target = getGridPositionFromPointer(e);
  const piece = draggingPiece.piece;
  draggingPiece.ghost.remove();
  clearPreview();
  draggingPiece = null;

  if (!target) return;
  const { row, col } = target;
  if (canPlace(piece, row, col)) {
    placePiece(piece, row, col);
  }
}

function createGhostElement(piece) {
  const el = document.createElement('div');
  el.className = 'piece';
  el.style.position = 'fixed';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0.8';
  el.style.zIndex = '20';
  el.style.setProperty('--piece-color', piece.color);

  const gridEl = document.createElement('div');
  gridEl.className = 'piece-grid';
  gridEl.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, auto)`;
  piece.shape.forEach(row => row.forEach(val => {
    const cell = document.createElement('div');
    cell.className = 'piece-cell';
    if (!val) cell.style.visibility = 'hidden';
    gridEl.appendChild(cell);
  }));
  el.appendChild(gridEl);
  return el;
}

function getGridPositionFromPointer(e) {
  const rect = gridElement.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
    return null;
  }
  const cellSizeX = rect.width / gridSize;
  const cellSizeY = rect.height / gridSize;
  const col = Math.floor((e.clientX - rect.left) / cellSizeX);
  const row = Math.floor((e.clientY - rect.top) / cellSizeY);
  return { row, col };
}

function applyPreview(piece, startRow, startCol, valid) {
  const cells = gridElement.children;
  piece.shape.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      if (!val) return;
      const r = startRow + rIdx;
      const c = startCol + cIdx;
      if (r < 0 || c < 0 || r >= gridSize || c >= gridSize) return;
      const idx = r * gridSize + c;
      const cell = cells[idx];
      cell.classList.add(valid ? 'preview' : 'invalid');
      dragPreviewCells.push(cell);
    });
  });
}

function clearPreview() {
  dragPreviewCells.forEach(cell => cell.classList.remove('preview', 'invalid'));
  dragPreviewCells = [];
}

// =============================
// Placement and validation
// =============================
function canPlace(piece, startRow, startCol) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[0].length; c++) {
      if (!piece.shape[r][c]) continue;
      const gridRow = startRow + r;
      const gridCol = startCol + c;
      if (gridRow < 0 || gridCol < 0 || gridRow >= gridSize || gridCol >= gridSize) return false;
      if (grid[gridRow][gridCol]) return false;
    }
  }
  return true;
}

function placePiece(piece, startRow, startCol) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[0].length; c++) {
      if (!piece.shape[r][c]) continue;
      const gridRow = startRow + r;
      const gridCol = startCol + c;
      grid[gridRow][gridCol] = { color: piece.color };
    }
  }
  availablePieces = availablePieces.filter(p => p.id !== piece.id);
  renderGrid();
  renderPieces();
  afterPlacement(piece);
}

function afterPlacement(piece) {
  updateScore(pieceCells(piece.shape));
  const cleared = clearFullLines();
  handleCombo(cleared);
  checkRewards();
  if (availablePieces.length === 0) generatePieces();
  if (!hasValidMove()) endGame();
}

function pieceCells(shape) {
  let count = 0;
  shape.forEach(row => row.forEach(val => { if (val) count += 1; }));
  return count;
}

function clearFullLines() {
  const fullRows = [];
  const fullCols = [];

  for (let r = 0; r < gridSize; r++) {
    if (grid[r].every(cell => cell)) fullRows.push(r);
  }
  for (let c = 0; c < gridSize; c++) {
    let full = true;
    for (let r = 0; r < gridSize; r++) {
      if (!grid[r][c]) { full = false; break; }
    }
    if (full) fullCols.push(c);
  }

  const cells = gridElement.children;
  fullRows.forEach(r => {
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      cells[idx].classList.add('flash');
    }
  });
  fullCols.forEach(c => {
    for (let r = 0; r < gridSize; r++) {
      const idx = r * gridSize + c;
      cells[idx].classList.add('flash');
    }
  });

  const totalLines = fullRows.length + fullCols.length;
  if (totalLines === 0) {
    comboLevel = 0;
    return 0;
  }

  setTimeout(() => {
    fullRows.forEach(r => {
      for (let c = 0; c < gridSize; c++) {
        grid[r][c] = null;
        const idx = r * gridSize + c;
        cells[idx].classList.remove('flash');
      }
    });
    fullCols.forEach(c => {
      for (let r = 0; r < gridSize; r++) {
        grid[r][c] = null;
        const idx = r * gridSize + c;
        cells[idx].classList.remove('flash');
      }
    });
    renderGrid();
  }, 200);

  updateScore(totalLines * 10);
  if (totalLines === 2) updateScore(10, true);
  else if (totalLines === 3) updateScore(25, true);
  else if (totalLines >= 4) {
    updateScore(50, true);
    showComboMessage('Mega Combo!');
  }

  comboLevel = totalLines > 0 ? comboLevel + 1 : 0;
  if (comboLevel > 1) updateScore(comboLevel * 2, true);

  return totalLines;
}

function handleCombo(lines) {
  if (lines > 1 && lines < 4) showComboMessage(`Combo x${lines}!`);
}

// =============================
// Scoring and rewards
// =============================
function updateScore(delta, silent = false) {
  score += delta;
  if (score < 0) score = 0;
  scoreEl.textContent = score;
  updateBestScore();
  if (!silent) checkRewards();
}

function updateBestScore() {
  const key = mode === 'classic' ? 'colorblastBestClassic' : 'colorblastBestTime';
  const best = Number(localStorage.getItem(key) || 0);
  if (score > best) {
    localStorage.setItem(key, score);
  }
  bestEl.textContent = Number(localStorage.getItem(key) || 0);
}

function checkRewards() {
  Object.keys(nextReward).forEach(key => {
    while (score >= nextReward[key]) {
      powerups[key] += 1;
      nextReward[key] += rewardSteps[key];
    }
  });
  updatePowerupUI();
}

function updatePowerupUI() {
  Object.keys(countEls).forEach(key => {
    countEls[key].textContent = powerups[key];
  });
  clearLineBtn.disabled = powerups.clearLine === 0;
  swapBtn.disabled = powerups.pieceSwap === 0;
  hintBtn.disabled = powerups.hint === 0;
  bombBtn.disabled = powerups.bomb === 0;
}

// =============================
// Power-ups
// =============================
function activatePower(type) {
  if (powerups[type] <= 0) return;
  activePower = type;
  document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('active'));
  const btn = { clearLine: clearLineBtn, pieceSwap: swapBtn, hint: hintBtn, bomb: bombBtn }[type];
  if (btn) btn.classList.add('active');
}

function handleGridPointerDown(e) {
  if (!activePower) return;
  if (activePower === 'clearLine') {
    useClearLine(e);
  } else if (activePower === 'bomb') {
    useBomb(e);
  }
}

function useClearLine(e) {
  if (powerups.clearLine <= 0) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (e.altKey) {
    clearColumn(col);
  } else {
    clearRow(row);
  }
  updateScore(10);
  powerups.clearLine -= 1;
  deactivatePower();
  renderGrid();
  updatePowerupUI();
  if (!hasValidMove()) endGame();
}

function clearRow(row) {
  for (let c = 0; c < gridSize; c++) {
    if (grid[row][c]) updateScore(1, true);
    grid[row][c] = null;
  }
}

function clearColumn(col) {
  for (let r = 0; r < gridSize; r++) {
    if (grid[r][col]) updateScore(1, true);
    grid[r][col] = null;
  }
}

function useBomb(e) {
  if (powerups.bomb <= 0) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const centerRow = Number(cell.dataset.row);
  const centerCol = Number(cell.dataset.col);
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      if (r < 0 || c < 0 || r >= gridSize || c >= gridSize) continue;
      if (grid[r][c]) updateScore(1, true);
      grid[r][c] = null;
    }
  }
  powerups.bomb -= 1;
  deactivatePower();
  renderGrid();
  updatePowerupUI();
  if (!hasValidMove()) endGame();
}

function handleGridClick(e) {
  if (activePower === 'pieceSwap') return; // handled on pieces
}

function deactivatePower() {
  activePower = null;
  document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('active'));
}

function showHint() {
  deactivatePower();
  const cells = gridElement.children;
  const found = availablePieces.some(piece => {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (canPlace(piece, r, c)) {
          piece.shape.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
              if (!val) return;
              const idx = (r + rIdx) * gridSize + (c + cIdx);
              cells[idx].classList.add('hint');
              setTimeout(() => cells[idx].classList.remove('hint'), 800);
            });
          });
          return true;
        }
      }
    }
    return false;
  });
  if (!found) showComboMessage('No moves available');
}

piecesContainer.addEventListener('click', (e) => {
  if (activePower !== 'pieceSwap') return;
  const pieceEl = e.target.closest('.piece');
  if (!pieceEl) return;
  const id = pieceEl.dataset.id;
  const idx = availablePieces.findIndex(p => p.id === id);
  if (idx !== -1 && powerups.pieceSwap > 0) {
    powerups.pieceSwap -= 1;
    const template = getTemplateByDifficulty();
    availablePieces[idx] = createPiece(template);
    renderPieces();
    deactivatePower();
    updatePowerupUI();
  }
});

// =============================
// Game over logic
// =============================
function hasValidMove() {
  return availablePieces.some(piece => {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (canPlace(piece, r, c)) return true;
      }
    }
    return false;
  });
}

function endGame() {
  clearInterval(timerInterval);
  overlay.classList.remove('hidden');
  finalScoreEl.textContent = score;
  const key = mode === 'classic' ? 'colorblastBestClassic' : 'colorblastBestTime';
  const best = Number(localStorage.getItem(key) || 0);
  finalBestEl.textContent = Math.max(score, best);
  updateBestScore();
}

// =============================
// Timer (Time Attack)
// =============================
function startTimer() {
  timerSeconds = 120;
  updateTimerDisplay();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds -= 1;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const secs = String(timerSeconds % 60).padStart(2, '0');
  timerEl.textContent = `${mins}:${secs}`;
}

// =============================
// Utility UI helpers
// =============================
function showComboMessage(text) {
  comboMessage.textContent = text;
  comboMessage.classList.add('show');
  setTimeout(() => comboMessage.classList.remove('show'), 1200);
}

// =============================
// Event helpers
// =============================
function handleGridClickPlacement(piece, row, col) {
  if (canPlace(piece, row, col)) {
    placePiece(piece, row, col);
  }
}

// Prevent context menu interference on mobile dragging
window.addEventListener('contextmenu', e => e.preventDefault());
