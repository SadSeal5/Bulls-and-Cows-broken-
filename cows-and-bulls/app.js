/**
 * İnekler ve Boğalar (Cows & Bulls) - Sayı Bulmaca & Yapay Zeka Çözücü
 * Author: Antigravity AI
 */

// ==========================================
// 1. GAME SETTINGS & STATE
// ==========================================
const state = {
    settings: {
        digitLength: 4,
        allowDuplicates: false,
        allowLeadingZero: true
    },
    soundEnabled: true,

    // AI Solver Mode State
    ai: {
        allCandidates: [],
        remainingCandidates: [],
        currentGuess: "",
        history: [], // { step, guess, bulls, cows, remainingCount }
        selectedBulls: 0,
        selectedCows: 0,
        secretNumber: "",
        isWon: false
    },

    // Play vs AI Mode State
    player: {
        secretNumber: "",
        currentInput: "",
        history: [], // { step, guess, bulls, cows }
        isWon: false,
        stepCount: 0
    },

    // Analyzer Mode State
    analyzer: {
        moves: [], // { guess, bulls, cows }
        remainingCandidates: []
    }
};

// Initialize Lucide Icons
if (window.lucide) {
    window.lucide.createIcons();
}

// ==========================================
// 2. CORE COWS & BULLS LOGIC & SOLVER ENGINE
// ==========================================

/**
 * Calculates Bulls (+) and Cows (-) for secret vs guess strings.
 */
function calcFeedback(secret, guess) {
    let bulls = 0;
    let cows = 0;

    const secretArr = secret.split('');
    const guessArr = guess.split('');
    const len = secretArr.length;

    const secretUsed = new Array(len).fill(false);
    const guessUsed = new Array(len).fill(false);

    // 1. First Pass: Count Bulls (exact match)
    for (let i = 0; i < len; i++) {
        if (secretArr[i] === guessArr[i]) {
            bulls++;
            secretUsed[i] = true;
            guessUsed[i] = true;
        }
    }

    // 2. Second Pass: Count Cows (value match in wrong position)
    for (let i = 0; i < len; i++) {
        if (!guessUsed[i]) {
            for (let j = 0; j < len; j++) {
                if (!secretUsed[j] && guessArr[i] === secretArr[j]) {
                    cows++;
                    secretUsed[j] = true;
                    guessUsed[i] = true;
                    break;
                }
            }
        }
    }

    return { bulls, cows };
}

/**
 * Generates all valid candidate numbers based on current game settings.
 */
function generateCandidates(digitLength, allowDuplicates, allowLeadingZero) {
    const candidates = [];
    const maxVal = Math.pow(10, digitLength);

    for (let i = 0; i < maxVal; i++) {
        let str = i.toString().padStart(digitLength, '0');

        // Check leading zero constraint
        if (!allowLeadingZero && str[0] === '0') {
            continue;
        }

        // Check duplicates constraint
        if (!allowDuplicates) {
            const uniqueDigits = new Set(str);
            if (uniqueDigits.size !== digitLength) {
                continue;
            }
        }

        candidates.push(str);
    }

    return candidates;
}

/**
 * Finds the mathematically optimal next guess using Minimax (Donald Knuth heuristic)
 * Minimizes the maximum possible size of the remaining candidate pool after feedback.
 */
function findBestGuess(remainingCandidates, allPossibleCandidates) {
    if (remainingCandidates.length === 0) return "";
    if (remainingCandidates.length === 1) return remainingCandidates[0];
    if (remainingCandidates.length === 2) return remainingCandidates[0];

    // Speed optimization: For large candidate sets, use pre-calculated ideal standard opening
    const totalAll = allPossibleCandidates.length;
    if (remainingCandidates.length === totalAll) {
        // Standard first guess for 4-digit unique digits
        if (state.settings.digitLength === 4 && !state.settings.allowDuplicates) {
            return state.settings.allowLeadingZero ? "0123" : "1234";
        }
    }

    // Evaluate candidates pool (sample if set is extremely large for instantaneous response)
    const evalPool = remainingCandidates.length > 300 
        ? remainingCandidates.slice(0, 300) 
        : remainingCandidates;

    let bestGuess = remainingCandidates[0];
    let minMaxGroupSize = Infinity;

    for (const guess of evalPool) {
        const groups = {};

        for (const target of remainingCandidates) {
            const { bulls, cows } = calcFeedback(target, guess);
            const key = `${bulls},${cows}`;
            groups[key] = (groups[key] || 0) + 1;
        }

        // Find maximum group size for this guess
        let maxGroupSize = 0;
        for (const key in groups) {
            if (groups[key] > maxGroupSize) {
                maxGroupSize = groups[key];
            }
        }

        if (maxGroupSize < minMaxGroupSize) {
            minMaxGroupSize = maxGroupSize;
            bestGuess = guess;
        }
    }

    return bestGuess;
}

// ==========================================
// 3. AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================
class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx && window.AudioContext) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playClick() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }

    playBull() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08); // E5

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.16);
    }

    playCow() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(329.63, this.ctx.currentTime); // E4
        osc.frequency.exponentialRampToValueAtTime(261.63, this.ctx.currentTime + 0.12); // C4

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playWin() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.1);

            gain.gain.setValueAtTime(0.25, this.ctx.currentTime + idx * 0.1);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + idx * 0.1 + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + idx * 0.1);
            osc.stop(this.ctx.currentTime + idx * 0.1 + 0.25);
        });
    }

    playError() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.setValueAtTime(140, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.16);
    }
}

const audio = new SoundFX();

// ==========================================
// 4. UI INITIALIZATION & RENDERERS
// ==========================================

function initApp() {
    // Generate initial candidate set
    state.ai.allCandidates = generateCandidates(
        state.settings.digitLength,
        state.settings.allowDuplicates,
        state.settings.allowLeadingZero
    );

    resetAISolver();
    resetPlayerGame();
    resetAnalyzer();
    setupEventListeners();
    updateStatusBanner();
}

function updateStatusBanner() {
    document.getElementById('badge-digits').textContent = state.settings.digitLength;
    document.getElementById('badge-duplicates').textContent = state.settings.allowDuplicates ? "İzinli" : "Benzersiz";
    document.getElementById('badge-zero').textContent = state.settings.allowLeadingZero ? "İzinli" : "Yasak";
}

// ------------------------------------------
// AI SOLVER UI LOGIC
// ------------------------------------------

function resetAISolver() {
    state.ai.remainingCandidates = [...state.ai.allCandidates];
    state.ai.history = [];
    state.ai.isWon = false;
    state.ai.selectedBulls = 0;
    state.ai.selectedCows = 0;

    document.getElementById('ai-win-card').classList.add('hidden');
    document.getElementById('feedback-input-section').classList.remove('hidden');

    renderFeedbackPickers();
    calculateNextAIGuess();
    renderAIHistory();
    renderCandidatesGrid();
}

function calculateNextAIGuess() {
    if (state.ai.remainingCandidates.length === 0) {
        alert("Hata: Girdiğiniz geri bildirimler çelişkili! Hiçbir geçerli sayı kalmadı.");
        audio.playError();
        return;
    }

    if (state.ai.remainingCandidates.length === 1 && state.ai.history.length > 0) {
        // AI found the number!
        const secretCandidate = state.ai.remainingCandidates[0];
        const lastMove = state.ai.history[state.ai.history.length - 1];

        if (lastMove && lastMove.guess === secretCandidate && lastMove.bulls === state.settings.digitLength) {
            handleAIWin();
            return;
        }
    }

    state.ai.currentGuess = findBestGuess(state.ai.remainingCandidates, state.ai.allCandidates);

    // Auto-evaluate if user typed auto secret
    const autoSecretInput = document.getElementById('auto-secret-input').value.trim();
    if (autoSecretInput.length === state.settings.digitLength) {
        const { bulls, cows } = calcFeedback(autoSecretInput, state.ai.currentGuess);
        state.ai.selectedBulls = bulls;
        state.ai.selectedCows = cows;
    } else {
        state.ai.selectedBulls = 0;
        state.ai.selectedCows = 0;
    }

    renderAIDigitSlots();
    renderFeedbackPickers();
    renderCandidateCounter();
    document.getElementById('ai-step-indicator').textContent = `${state.ai.history.length + 1}. Hamle`;
}

function renderAIDigitSlots() {
    const container = document.getElementById('ai-digit-slots');
    container.innerHTML = '';

    const guessStr = state.ai.currentGuess || '?'.repeat(state.settings.digitLength);
    for (let char of guessStr) {
        const slot = document.createElement('div');
        slot.className = 'digit-slot';
        slot.textContent = char;
        container.appendChild(slot);
    }
}

function renderFeedbackPickers() {
    const bullsPicker = document.getElementById('bulls-picker');
    const cowsPicker = document.getElementById('cows-picker');

    bullsPicker.innerHTML = '';
    cowsPicker.innerHTML = '';

    const maxVal = state.settings.digitLength;

    for (let i = 0; i <= maxVal; i++) {
        // Bull button
        const bBtn = document.createElement('button');
        bBtn.className = `picker-btn ${state.ai.selectedBulls === i ? 'active' : ''}`;
        bBtn.textContent = i;
        bBtn.addEventListener('click', () => {
            state.ai.selectedBulls = i;
            // Ensure Bulls + Cows <= maxVal
            if (state.ai.selectedBulls + state.ai.selectedCows > maxVal) {
                state.ai.selectedCows = maxVal - state.ai.selectedBulls;
            }
            audio.playBull();
            renderFeedbackPickers();
        });
        bullsPicker.appendChild(bBtn);

        // Cow button
        const cBtn = document.createElement('button');
        cBtn.className = `picker-btn ${state.ai.selectedCows === i ? 'active' : ''}`;
        cBtn.textContent = i;
        cBtn.addEventListener('click', () => {
            state.ai.selectedCows = i;
            if (state.ai.selectedBulls + state.ai.selectedCows > maxVal) {
                state.ai.selectedBulls = maxVal - state.ai.selectedCows;
            }
            audio.playCow();
            renderFeedbackPickers();
        });
        cowsPicker.appendChild(cBtn);
    }
}

function submitAIFeedback() {
    const bulls = state.ai.selectedBulls;
    const cows = state.ai.selectedCows;
    const currentGuess = state.ai.currentGuess;

    if (bulls === state.settings.digitLength) {
        // Win!
        state.ai.history.push({
            step: state.ai.history.length + 1,
            guess: currentGuess,
            bulls,
            cows,
            remainingCount: 1
        });
        handleAIWin();
        return;
    }

    // Filter remaining candidates
    const filtered = state.ai.remainingCandidates.filter(candidate => {
        const fb = calcFeedback(candidate, currentGuess);
        return fb.bulls === bulls && fb.cows === cows;
    });

    if (filtered.length === 0) {
        alert("Girdiğiniz geri bildirime uygun hiçbir olası sayı kalmadı! Lütfen geri bildiriminizi kontrol edin.");
        audio.playError();
        return;
    }

    state.ai.history.push({
        step: state.ai.history.length + 1,
        guess: currentGuess,
        bulls,
        cows,
        remainingCount: filtered.length
    });

    state.ai.remainingCandidates = filtered;

    renderAIHistory();
    renderCandidatesGrid();
    calculateNextAIGuess();
}

function handleAIWin() {
    state.ai.isWon = true;
    audio.playWin();

    document.getElementById('feedback-input-section').classList.add('hidden');
    document.getElementById('ai-win-card').classList.remove('hidden');
    document.getElementById('win-step-count').textContent = state.ai.history.length;

    renderAIHistory();
    renderCandidatesGrid();
    renderCandidateCounter();
}

function undoAIStep() {
    if (state.ai.history.length === 0) return;

    state.ai.history.pop();
    state.ai.isWon = false;
    document.getElementById('ai-win-card').classList.add('hidden');
    document.getElementById('feedback-input-section').classList.remove('hidden');

    // Recompute remaining candidates from scratch
    let candidates = [...state.ai.allCandidates];
    for (const item of state.ai.history) {
        candidates = candidates.filter(cand => {
            const fb = calcFeedback(cand, item.guess);
            return fb.bulls === item.bulls && fb.cows === item.cows;
        });
    }

    state.ai.remainingCandidates = candidates;

    renderAIHistory();
    renderCandidatesGrid();
    calculateNextAIGuess();
    audio.playClick();
}

function renderAIHistory() {
    const tbody = document.getElementById('ai-history-body');
    tbody.innerHTML = '';

    state.ai.history.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${item.step}</td>
            <td><strong>${item.guess}</strong></td>
            <td><span class="badge-bull">+${item.bulls} 🐂</span></td>
            <td><span class="badge-cow">-${item.cows} 🐄</span></td>
            <td>${item.remainingCount}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('btn-undo-ai-step').disabled = state.ai.history.length === 0;
}

function renderCandidatesGrid() {
    const container = document.getElementById('candidate-grid');
    container.innerHTML = '';

    const filterText = document.getElementById('candidate-search').value.trim();
    let displayList = state.ai.remainingCandidates;

    if (filterText) {
        displayList = displayList.filter(c => c.includes(filterText));
    }

    // Limit visible candidates to top 150 for DOM performance
    const renderLimit = Math.min(displayList.length, 150);

    for (let i = 0; i < renderLimit; i++) {
        const chip = document.createElement('div');
        chip.className = 'candidate-chip';
        chip.textContent = displayList[i];
        container.appendChild(chip);
    }

    if (displayList.length > 150) {
        const moreChip = document.createElement('div');
        moreChip.className = 'candidate-chip';
        moreChip.style.color = 'var(--text-muted)';
        moreChip.textContent = `+${displayList.length - 150} daha`;
        container.appendChild(moreChip);
    }

    renderCandidateCounter();
}

function renderCandidateCounter() {
    document.getElementById('candidate-count').textContent = state.ai.remainingCandidates.length;
}

// ------------------------------------------
// PLAYER VS AI MODE UI LOGIC
// ------------------------------------------

function resetPlayerGame() {
    state.player.secretNumber = generateRandomSecret();
    state.player.currentInput = "";
    state.player.history = [];
    state.player.isWon = false;
    state.player.stepCount = 0;

    document.getElementById('player-win-card').classList.add('hidden');
    document.getElementById('player-hint-box').classList.add('hidden');
    document.getElementById('keypad').classList.remove('hidden');

    renderPlayerDigitSlots();
    renderPlayerTimeline();
    updatePlayerStepCounter();
}

function generateRandomSecret() {
    const pool = [...state.ai.allCandidates];
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

function renderPlayerDigitSlots() {
    const container = document.getElementById('player-digit-slots');
    container.innerHTML = '';

    const maxLen = state.settings.digitLength;
    for (let i = 0; i < maxLen; i++) {
        const slot = document.createElement('div');
        const char = state.player.currentInput[i] || '';
        slot.className = `player-slot ${char ? 'filled' : ''}`;
        slot.textContent = char;
        container.appendChild(slot);
    }
}

function handleKeypress(key) {
    if (state.player.isWon) return;

    if (key === 'backspace') {
        state.player.currentInput = state.player.currentInput.slice(0, -1);
        audio.playClick();
    } else if (key === 'enter') {
        submitPlayerGuess();
    } else if (state.player.currentInput.length < state.settings.digitLength) {
        // Validation check for duplicates if disabled
        if (!state.settings.allowDuplicates && state.player.currentInput.includes(key)) {
            audio.playError();
            return;
        }
        // Validation check for leading zero
        if (!state.settings.allowLeadingZero && state.player.currentInput.length === 0 && key === '0') {
            audio.playError();
            return;
        }

        state.player.currentInput += key;
        audio.playClick();
    }

    renderPlayerDigitSlots();
}

function submitPlayerGuess() {
    const guess = state.player.currentInput;
    if (guess.length !== state.settings.digitLength) {
        alert(`${state.settings.digitLength} basamaklı bir sayı girmelisiniz!`);
        audio.playError();
        return;
    }

    const { bulls, cows } = calcFeedback(state.player.secretNumber, guess);
    state.player.stepCount++;

    state.player.history.unshift({
        step: state.player.stepCount,
        guess,
        bulls,
        cows
    });

    state.player.currentInput = "";
    renderPlayerDigitSlots();
    renderPlayerTimeline();
    updatePlayerStepCounter();

    if (bulls === state.settings.digitLength) {
        // Player Wins!
        state.player.isWon = true;
        audio.playWin();
        document.getElementById('player-win-card').classList.remove('hidden');
        document.getElementById('player-win-steps').textContent = state.player.stepCount;
        document.getElementById('keypad').classList.add('hidden');
    } else {
        if (bulls > 0) audio.playBull();
        else if (cows > 0) audio.playCow();
        else audio.playClick();
    }
}

function renderPlayerTimeline() {
    const container = document.getElementById('player-timeline');
    container.innerHTML = '';

    if (state.player.history.length === 0) {
        container.innerHTML = `<div class="empty-state">Henüz bir tahmin yapmadın. Sayıları girerek başla!</div>`;
        return;
    }

    state.player.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.innerHTML = `
            <span class="timeline-guess">${item.guess}</span>
            <div class="timeline-badges">
                <span class="badge-pill bull-pill">🐂 +${item.bulls} Boğa</span>
                <span class="badge-pill cow-pill">🐄 -${item.cows} İnek</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function updatePlayerStepCounter() {
    document.getElementById('player-step-counter').textContent = `${state.player.stepCount} Tahmin`;
}

function givePlayerHint() {
    if (state.player.isWon) return;

    // Filter remaining candidates based on player's history
    let validPool = [...state.ai.allCandidates];
    for (const item of state.player.history) {
        validPool = validPool.filter(cand => {
            const fb = calcFeedback(cand, item.guess);
            return fb.bulls === item.bulls && fb.cows === item.cows;
        });
    }

    if (validPool.length === 0) {
        document.getElementById('hint-text').textContent = "Çelişkili bir durum oluştu!";
        return;
    }

    const recommendedGuess = findBestGuess(validPool, state.ai.allCandidates);
    document.getElementById('hint-text').textContent = 
        `Yapay Zeka Önerisi: '${recommendedGuess}' tahminini yapman geriye kalan ${validPool.length} olasılığı en hızlı şekilde eleyecektir!`;

    document.getElementById('player-hint-box').classList.remove('hidden');
    audio.playClick();
}

function revealPlayerSecret() {
    if (confirm(`Gizli Sayı: ${state.player.secretNumber}\nOyunu sonlandırıp yeni oyuna geçmek istiyor musunuz?`)) {
        resetPlayerGame();
    }
}

// ------------------------------------------
// ANALYZER MODE UI LOGIC
// ------------------------------------------

function resetAnalyzer() {
    state.analyzer.moves = [];
    state.analyzer.remainingCandidates = [...state.ai.allCandidates];

    document.getElementById('analyzer-guess-input').value = '';
    document.getElementById('analyzer-bulls-input').value = '0';
    document.getElementById('analyzer-cows-input').value = '0';

    renderAnalyzerTable();
    renderAnalyzerCandidates();
}

function addAnalyzerRow() {
    const guess = document.getElementById('analyzer-guess-input').value.trim();
    const bulls = parseInt(document.getElementById('analyzer-bulls-input').value, 10) || 0;
    const cows = parseInt(document.getElementById('analyzer-cows-input').value, 10) || 0;

    if (guess.length !== state.settings.digitLength) {
        alert(`${state.settings.digitLength} basamaklı bir sayı girin!`);
        return;
    }

    state.analyzer.moves.push({ guess, bulls, cows });

    // Filter candidates
    state.analyzer.remainingCandidates = state.analyzer.remainingCandidates.filter(cand => {
        const fb = calcFeedback(cand, guess);
        return fb.bulls === bulls && fb.cows === cows;
    });

    document.getElementById('analyzer-guess-input').value = '';
    renderAnalyzerTable();
    renderAnalyzerCandidates();
    audio.playClick();
}

function removeAnalyzerRow(index) {
    state.analyzer.moves.splice(index, 1);

    // Recompute
    let cand = [...state.ai.allCandidates];
    for (const move of state.analyzer.moves) {
        cand = cand.filter(c => {
            const fb = calcFeedback(c, move.guess);
            return fb.bulls === move.bulls && fb.cows === move.cows;
        });
    }

    state.analyzer.remainingCandidates = cand;
    renderAnalyzerTable();
    renderAnalyzerCandidates();
    audio.playClick();
}

function renderAnalyzerTable() {
    const tbody = document.getElementById('analyzer-history-body');
    tbody.innerHTML = '';

    state.analyzer.moves.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.guess}</strong></td>
            <td><span class="badge-bull">+${item.bulls} 🐂</span></td>
            <td><span class="badge-cow">-${item.cows} 🐄</span></td>
            <td><button class="small-btn" onclick="removeAnalyzerRow(${idx})">Sil</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAnalyzerCandidates() {
    const container = document.getElementById('analyzer-candidate-grid');
    container.innerHTML = '';

    const list = state.analyzer.remainingCandidates;
    document.getElementById('analyzer-cand-count').textContent = list.length;

    const renderLimit = Math.min(list.length, 100);
    for (let i = 0; i < renderLimit; i++) {
        const chip = document.createElement('div');
        chip.className = 'candidate-chip';
        chip.textContent = list[i];
        container.appendChild(chip);
    }
}

// ==========================================
// 5. EVENT LISTENERS & MODALS
// ==========================================

function setupEventListeners() {
    // Mode Switching Tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const mode = tab.getAttribute('data-mode');
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.mode-section').forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`mode-${mode}`).classList.add('active');
            audio.playClick();
        });
    });

    // Sound Toggle Button
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        const icon = document.getElementById('btn-sound-toggle').querySelector('i');
        if (state.soundEnabled) {
            icon.setAttribute('data-lucide', 'volume-2');
            audio.playClick();
        } else {
            icon.setAttribute('data-lucide', 'volume-x');
        }
        if (window.lucide) window.lucide.createIcons();
    });

    // Modals
    document.getElementById('btn-settings').addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('hidden');
        audio.playClick();
    });
    document.getElementById('btn-rules').addEventListener('click', () => {
        document.getElementById('rules-modal').classList.remove('hidden');
        audio.playClick();
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-close');
            document.getElementById(targetId).classList.add('hidden');
            audio.playClick();
        });
    });

    // Settings Segmented Control for Digit Length
    document.querySelectorAll('#digit-length-selector .segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#digit-length-selector .segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            audio.playClick();
        });
    });

    // Save Settings Button
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const activeDigitBtn = document.querySelector('#digit-length-selector .segment-btn.active');
        state.settings.digitLength = parseInt(activeDigitBtn.getAttribute('data-val'), 10);
        state.settings.allowDuplicates = document.getElementById('setting-allow-duplicates').checked;
        state.settings.allowLeadingZero = document.getElementById('setting-allow-leading-zero').checked;

        document.getElementById('settings-modal').classList.add('hidden');

        // Re-initialize app with new settings
        initApp();
        audio.playClick();
    });

    // AI Solver Action Buttons
    document.getElementById('btn-submit-feedback').addEventListener('click', () => {
        submitAIFeedback();
    });
    document.getElementById('btn-reset-ai').addEventListener('click', () => {
        resetAISolver();
        audio.playClick();
    });
    document.getElementById('btn-ai-win-restart').addEventListener('click', () => {
        resetAISolver();
        audio.playClick();
    });
    document.getElementById('btn-undo-ai-step').addEventListener('click', () => {
        undoAIStep();
    });
    document.getElementById('candidate-search').addEventListener('input', () => {
        renderCandidatesGrid();
    });

    // Secret Input Mask Toggle
    document.getElementById('btn-toggle-secret-visibility').addEventListener('click', () => {
        const input = document.getElementById('auto-secret-input');
        input.type = input.type === 'password' ? 'text' : 'password';
        audio.playClick();
    });

    document.getElementById('auto-secret-input').addEventListener('input', () => {
        calculateNextAIGuess();
    });

    // Player Mode Keypad & Actions
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            handleKeypress(key);
        });
    });

    document.addEventListener('keydown', (e) => {
        // Only register if Player Mode is active
        const playerSection = document.getElementById('mode-play-vs-ai');
        if (!playerSection.classList.contains('active')) return;

        if (e.key >= '0' && e.key <= '9') {
            handleKeypress(e.key);
        } else if (e.key === 'Backspace') {
            handleKeypress('backspace');
        } else if (e.key === 'Enter') {
            handleKeypress('enter');
        }
    });

    document.getElementById('btn-new-player-game').addEventListener('click', () => {
        resetPlayerGame();
        audio.playClick();
    });
    document.getElementById('btn-player-win-restart').addEventListener('click', () => {
        resetPlayerGame();
        audio.playClick();
    });
    document.getElementById('btn-player-hint').addEventListener('click', () => {
        givePlayerHint();
    });
    document.getElementById('btn-player-reveal').addEventListener('click', () => {
        revealPlayerSecret();
    });

    // Analyzer Actions
    document.getElementById('btn-add-analyzer-row').addEventListener('click', () => {
        addAnalyzerRow();
    });
    document.getElementById('btn-clear-analyzer').addEventListener('click', () => {
        resetAnalyzer();
        audio.playClick();
    });
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});
