// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const nextBtn = document.getElementById('next-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const bpmInput = document.getElementById('bpm-input');
const beatCircle = document.getElementById('beat-animation');
const statusText = document.getElementById('status-text');
const inputSection = document.getElementById('input-section');
const feedbackSection = document.getElementById('feedback-section');

// Audio Context setup
let audioContext = null;
let currentBPM;
let beatCount;
let isPlaying = false;
let roundScores = [];

// Game state
const TOTAL_ROUNDS = 5;
const BEATS_PER_ROUND = 10;
let currentRound = 1;
let totalScore = 0;
let selectedMode = 'student';
let selectedPitch = 440; // Default to A4

// Game mode configurations
const GAME_MODES = {
    student: {
        minBPM: 60,
        maxBPM: 160,
        scoring: {
            perfect: { range: 4, points: 100 },    // Within 4 BPM
            excellent: { range: 8, points: 85 },   // Within 8 BPM
            good: { range: 15, points: 70 },       // Within 15 BPM
            fair: { range: 25, points: 50 },       // Within 25 BPM
            poor: { range: 40, points: 30 }        // Within 40 BPM
        }
    },
    professional: {
        minBPM: 40,
        maxBPM: 208,
        scoring: {
            perfect: { range: 4, points: 100 },    // Within 4 BPM
            excellent: { range: 6, points: 85 },   // Within 6 BPM
            good: { range: 12, points: 70 },       // Within 12 BPM
            fair: { range: 20, points: 50 },       // Within 20 BPM
            poor: { range: 30, points: 30 }        // Within 30 BPM
        }
    }
};

// High scores
const HIGH_SCORES = {
    student: [],
    professional: []
};

// Load high scores from localStorage
function loadHighScores() {
    const savedScores = localStorage.getItem('beatMasterHighScores');
    if (savedScores) {
        Object.assign(HIGH_SCORES, JSON.parse(savedScores));
        updateHighScoreDisplay();
    }
}

// Save high scores to localStorage
function saveHighScores() {
    localStorage.setItem('beatMasterHighScores', JSON.stringify(HIGH_SCORES));
}

// Update high score display
function updateHighScoreDisplay() {
    ['student', 'professional'].forEach(mode => {
        const scoreList = document.getElementById(`${mode}-scores`);
        const scores = HIGH_SCORES[mode]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((score, index) => `
                <div class="score-entry">
                    <span>${index + 1}. ${score.name}</span>
                    <span>${score.score} points</span>
                </div>
            `).join('');
        scoreList.innerHTML = scores || '<p>No scores yet</p>';
    });
}

// Generate a random BPM within the current mode's range
function generateBPM() {
    const mode = GAME_MODES[selectedMode];
    const previousBPM = currentBPM;
    let newBPM;
    
    do {
        newBPM = Math.floor(Math.random() * (mode.maxBPM - mode.minBPM + 1)) + mode.minBPM;
    } while (previousBPM && Math.abs(newBPM - previousBPM) < 20); // Ensure significant tempo change
    
    return newBPM;
}

// Create and play a beep sound
function playBeep() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = selectedPitch;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
    
    beatCircle.classList.add('pulse');
    setTimeout(() => beatCircle.classList.remove('pulse'), 100);
}

// Calculate score based on guess accuracy
function calculateScore(guess) {
    const difference = Math.abs(currentBPM - guess);
    const scoring = GAME_MODES[selectedMode].scoring;
    
    let scoreText = '';
    let points = 0;
    
    if (difference <= scoring.perfect.range) {
        points = scoring.perfect.points;
        scoreText = 'Perfect! ';
    } else if (difference <= scoring.excellent.range) {
        points = scoring.excellent.points;
        scoreText = 'Excellent! ';
    } else if (difference <= scoring.good.range) {
        points = scoring.good.points;
        scoreText = 'Good! ';
    } else if (difference <= scoring.fair.range) {
        points = scoring.fair.points;
        scoreText = 'Fair ';
    } else if (difference <= scoring.poor.range) {
        points = scoring.poor.points;
        scoreText = 'Keep practicing! ';
    } else {
        points = Math.max(10, Math.floor(30 * (1 - (difference - scoring.poor.range) / 50))); // Gradual decrease
        scoreText = 'Keep trying! ';
    }
    
    return {
        points: points,
        text: scoreText
    };
}

// Analyze performance trends
function analyzePerformance() {
    const differences = roundScores.map(score => score.guess - score.actual);
    const averageDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
    const averageAccuracy = roundScores.reduce((a, b) => a + b.points, 0) / roundScores.length;
    
    let tendencyText = '';
    if (Math.abs(averageDiff) < 2) {
        tendencyText = "Your tempo estimates were very well balanced!";
    } else {
        tendencyText = `You tend to ${averageDiff > 0 ? 'overestimate' : 'underestimate'} tempos by about ${Math.abs(Math.round(averageDiff))} BPM`;
    }
    
    let accuracyText = `Average accuracy: ${Math.round(averageAccuracy)}%`;
    if (averageAccuracy >= 80) {
        accuracyText += " - Excellent rhythm recognition!";
    } else if (averageAccuracy >= 60) {
        accuracyText += " - Good performance with room for improvement.";
    } else {
        accuracyText += " - Keep practicing to improve your tempo recognition.";
    }
    
    document.getElementById('tempo-tendency').textContent = tendencyText;
    document.getElementById('accuracy-stats').textContent = accuracyText;
}

// Check for new high score
function checkHighScore(score) {
    const scores = HIGH_SCORES[selectedMode];
    const isHighScore = scores.length < 5 || score > scores[scores.length - 1]?.score || false;
    
    if (isHighScore) {
        const notification = document.querySelector('.high-score-notification');
        notification.classList.remove('hidden');
        const playerNameInput = document.getElementById('player-name');
        playerNameInput.value = ''; // Clear any previous input
        playerNameInput.focus();
    }
}

// Save new high score
function saveNewHighScore() {
    const playerNameInput = document.getElementById('player-name');
    const playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        alert('Please enter your name to save your score!');
        playerNameInput.focus();
        return;
    }
    
    HIGH_SCORES[selectedMode].push({
        name: playerName,
        score: totalScore,
        date: new Date().toISOString()
    });
    
    // Sort and keep top 5 scores
    HIGH_SCORES[selectedMode].sort((a, b) => b.score - a.score);
    if (HIGH_SCORES[selectedMode].length > 5) {
        HIGH_SCORES[selectedMode].pop();
    }
    
    saveHighScores();
    updateHighScoreDisplay();
    
    // Hide the notification and clear the input
    document.querySelector('.high-score-notification').classList.add('hidden');
    playerNameInput.value = '';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Game control buttons
    startBtn.addEventListener('click', startGame);
    submitBtn.addEventListener('click', submitGuess);
    nextBtn.addEventListener('click', nextRound);
    playAgainBtn.addEventListener('click', resetGame);
    
    // Mode selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedMode = btn.dataset.mode;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.mode-desc').forEach(desc => desc.classList.remove('active'));
            document.getElementById(`${selectedMode}-desc`).classList.add('active');
        });
    });

    // Pitch selection
    document.querySelectorAll('.pitch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedPitch = parseInt({
                'high': 880,
                'medium': 440,
                'low': 220
            }[btn.dataset.pitch]);
            document.querySelectorAll('.pitch-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // High score tabs
    document.querySelectorAll('.score-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.tab;
            document.querySelectorAll('.score-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.score-list').forEach(l => l.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`${mode}-scores`).classList.remove('hidden');
        });
    });

    // Save high score button
    document.getElementById('save-score-btn')?.addEventListener('click', saveNewHighScore);

    // Enter key for BPM input
    bpmInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitBtn.click();
        }
    });

    // Load high scores
    loadHighScores();
});

// Initialize Audio Context on user interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Play a sequence of beats
function playBeats() {
    if (!isPlaying) return;
    
    beatCount++;
    
    if (beatCount <= BEATS_PER_ROUND) {
        playBeep();
        setTimeout(playBeats, (60 / currentBPM) * 1000);
    } else {
        isPlaying = false;
        showGuessInput();
    }
}

// Show the guess input after beats finish playing
function showGuessInput() {
    console.log('Showing guess input...'); // Debug log
    statusText.textContent = "What's your guess?";
    inputSection.classList.remove('hidden');
    feedbackSection.classList.add('hidden');
    bpmInput.value = ''; // Clear any previous input
    bpmInput.focus();
}

function submitGuess() {
    console.log('Submitting guess...'); // Debug log
    
    const guess = parseInt(bpmInput.value);
    if (isNaN(guess) || guess < 30 || guess > 208) {
        alert('Please enter a valid BPM between 30 and 208');
        bpmInput.focus();
        return;
    }
    
    // Calculate score
    const score = calculateScore(guess);
    console.log(`Guess: ${guess}, Actual: ${currentBPM}, Points: ${score.points}`); // Debug log
    
    // Store round result
    roundScores.push({
        round: currentRound,
        guess: guess,
        actual: currentBPM,
        points: score.points
    });
    
    totalScore += score.points;
    
    // Show feedback
    inputSection.classList.add('hidden');
    feedbackSection.classList.remove('hidden');
    
    const feedbackText = document.getElementById('feedback-text');
    feedbackText.innerHTML = `
        <h3>Round ${currentRound} Results:</h3>
        <p class="score-text">${score.text}</p>
        <p>Your guess: ${guess} BPM</p>
        <p>Actual tempo: ${currentBPM} BPM</p>
        <p>Points earned: ${score.points}</p>
        <p class="score-total">Total score: ${totalScore}</p>
    `;
    
    if (currentRound === TOTAL_ROUNDS) {
        nextBtn.textContent = 'Show Final Results';
    } else {
        nextBtn.textContent = 'Next Round';
    }
}

function nextRound() {
    console.log('Moving to next round...'); // Debug log
    
    if (currentRound === TOTAL_ROUNDS) {
        showResults();
        return;
    }
    
    currentRound++;
    beatCount = 0;
    currentBPM = generateBPM();
    
    statusText.textContent = `Round ${currentRound} of ${TOTAL_ROUNDS}`;
    feedbackSection.classList.add('hidden');
    
    // Start new round after a short delay
    setTimeout(() => {
        isPlaying = true;
        beatCount = 0;
        playBeats();
    }, 1000);
}

function showResults() {
    console.log('Showing final results...'); // Debug log
    
    gameScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    
    document.getElementById('total-score').textContent = totalScore;
    
    // Create score breakdown
    const breakdown = roundScores.map((score, index) => `
        <div class="score-entry">
            <strong>Round ${index + 1}:</strong> ${score.points} points
            <br>
            <small>Your guess: ${score.guess} BPM | Actual: ${score.actual} BPM</small>
        </div>
    `).join('');
    
    document.getElementById('score-breakdown').innerHTML = breakdown;
    
    analyzePerformance();
    
    // Check for high score
    const scores = HIGH_SCORES[selectedMode];
    const isHighScore = scores.length < 5 || totalScore > scores[scores.length - 1]?.score || false;
    
    if (isHighScore) {
        const notification = document.querySelector('.high-score-notification');
        notification.classList.remove('hidden');
        const playerNameInput = document.getElementById('player-name');
        playerNameInput.value = ''; // Clear any previous input
        playerNameInput.focus();
    }
}

function resetGame() {
    currentRound = 1;
    totalScore = 0;
    roundScores = [];
    document.getElementById('score').textContent = '0';
    resultScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function startGame() {
    console.log('Starting game...'); // Debug log
    initAudioContext();
    
    if (!audioContext) {
        console.error('Failed to initialize audio context');
        return;
    }
    
    currentRound = 1;
    totalScore = 0;
    roundScores = [];
    
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    resultScreen.classList.add('hidden');
    
    // Reset game state
    isPlaying = false;
    beatCount = 0;
    currentBPM = generateBPM();
    
    // Update UI
    statusText.textContent = `Round ${currentRound} of ${TOTAL_ROUNDS}`;
    inputSection.classList.add('hidden');
    feedbackSection.classList.add('hidden');
    
    console.log('Starting beats...'); // Debug log
    // Start playing beats after a short delay
    setTimeout(() => {
        isPlaying = true;
        beatCount = 0;
        playBeats();
    }, 1000);
}
