const AI_API_URL = 'https://christus-s-apis.vercel.app/api/na/ai/gemini';

let currentGameMode = 'solo';
let playersList = [];
let currentPlayerIndex = 0;
let localScores = [];

let questionsList = [];
let currentIndex = 0;
let score = 0;
let streak = 0;
let timer = null;
let timeLeft = 30;
let loadingInterval = null;

const loadingMessages = [
    "🤖 L'IA rassemble les données et forge tes questions...",
    "⚡ Connexion aux serveurs neuronaux en cours...",
    "🔥 Ajustement de la difficulté, prépare-toi...",
    "✨ Analyse des pièges et génération des options..."
];

function setGameMode(mode) {
    currentGameMode = mode;
    document.getElementById('btn-mode-solo').classList.toggle('selected', mode === 'solo');
    document.getElementById('btn-mode-local').classList.toggle('selected', mode === 'local');
    document.getElementById('local-players-group').classList.toggle('hidden', mode !== 'local');
}

function showScreen(screenId) {
    ['setup-screen', 'pass-screen', 'loading-screen', 'quiz-screen', 'score-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (id === screenId) {
            el.classList.remove('hidden');
            setTimeout(() => el.classList.add('active'), 10);
        } else {
            el.classList.remove('active');
            setTimeout(() => el.classList.add('hidden'), 300);
        }
    });
}

async function startQuizSession() {
    try {
        const category = document.getElementById('category-input').value.trim() || "Culture Générale";
        const questionCount = document.getElementById('count-select').value;
        const difficulty = document.getElementById('difficulty-select').value;

        if (currentGameMode === 'local') {
            const rawPlayers = document.getElementById('players-input').value;
            playersList = rawPlayers.split(',').map(p => p.trim()).filter(p => p.length > 0);
            if (playersList.length === 0) playersList = ['Joueur 1', 'Joueur 2'];
        } else {
            playersList = ['Joueur'];
        }

        currentPlayerIndex = 0;
        localScores = [];

        showScreen('loading-screen');
        
        let msgIdx = 0;
        const msgElement = document.getElementById('loading-msg');
        msgElement.innerText = loadingMessages[0];
        
        if (loadingInterval) clearInterval(loadingInterval);
        loadingInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % loadingMessages.length;
            msgElement.innerText = loadingMessages[msgIdx];
        }, 2200);

        const prompt = `Génère exactement ${questionCount} questions de quiz uniques sur le thème "${category}" avec un niveau de difficulté "${difficulty}". 
        Réponds STRICTEMENT sous forme d'un tableau JSON (aucun texte avant ou après, pas de markdown).
        Structure attendue :
        [
          {
            "question": "Énoncé de la question",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Option A"
          }
        ]`;

        const res = await fetch(AI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!res.ok) {
            throw new Error(`Erreur HTTP Serveur: ${res.status}`);
        }
        
        const data = await res.json();
        let rawText = data?.result?.answer || data?.result || data?.answer || data;

        if (typeof rawText === 'object') {
            questionsList = Array.isArray(rawText) ? rawText : (rawText.questions || []);
        } else {
            let cleaned = String(rawText).replace(/```json/gi, "").replace(/```/g, "").trim();
            const start = cleaned.indexOf('[');
            const end = cleaned.lastIndexOf(']');
            if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
            questionsList = JSON.parse(cleaned);
        }

        if (!Array.isArray(questionsList) || questionsList.length === 0) {
            throw new Error("L'IA n'a pas retourné une liste de questions valide.");
        }

        clearInterval(loadingInterval);

        if (currentGameMode === 'local') {
            promptNextPlayer();
        } else {
            startCurrentPlayerTurn();
        }

    } catch (err) {
        clearInterval(loadingInterval);
        console.error("Erreur API / JSON:", err);
        alert("Erreur lors de la création du quiz : " + err.message);
        resetToSetup();
    }
}

function promptNextPlayer() {
    const name = playersList[currentPlayerIndex];
    document.getElementById('pass-msg').innerText = `Passe le téléphone à ${name} !\nIl va jouer la même série de questions.`;
    showScreen('pass-screen');
}

function startCurrentPlayerTurn() {
    currentIndex = 0;
    score = 0;
    streak = 0;
    document.getElementById('current-player-name').innerText = playersList[currentPlayerIndex];
    showScreen('quiz-screen');
    loadQuestion();
}

function loadQuestion() {
    if (currentIndex >= questionsList.length) {
        endPlayerTurn();
        return;
    }

    const q = questionsList[currentIndex];
    document.getElementById('progress-indicator').innerText = `${currentIndex + 1} / ${questionsList.length}`;
    document.getElementById('score-text').innerText = `Score : ${score}`;
    document.getElementById('streak-text').innerText = `🔥 ${streak}`;

    const target = document.getElementById('typed-question');
    target.innerText = "";
    let i = 0;
    const fullText = q.question;
    
    function typeWriter() {
        if (i < fullText.length) {
            target.innerText += fullText.charAt(i);
            i++;
            setTimeout(typeWriter, 15);
        }
    }
    typeWriter();

    const container = document.getElementById('options-container');
    container.innerHTML = '';

    q.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerText = opt;
        btn.onclick = () => selectAnswer(opt, btn);
        container.appendChild(btn);
    });

    startTimer();
}

function startTimer() {
    clearInterval(timer);
    timeLeft = 30;
    const bar = document.getElementById('timer-bar');
    bar.style.width = '100%';

    timer = setInterval(() => {
        timeLeft--;
        bar.style.width = `${(timeLeft / 30) * 100}%`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleTimeOut();
        }
    }, 1000);
}

function selectAnswer(selected, btnElement) {
    clearInterval(timer);
    const q = questionsList[currentIndex];
    const buttons = document.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.disabled = true);

    const isCorrect = selected.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (isCorrect) {
        score++;
        streak++;
        btnElement.classList.add('correct');
    } else {
        streak = 0;
        btnElement.classList.add('wrong');
        buttons.forEach(b => {
            if (b.innerText.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
                b.classList.add('correct');
            }
        });
    }

    setTimeout(() => {
        currentIndex++;
        loadQuestion();
    }, 1500);
}

function handleTimeOut() {
    const q = questionsList[currentIndex];
    const buttons = document.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.disabled = true);
    streak = 0;

    buttons.forEach(b => {
        if (b.innerText.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
            b.classList.add('correct');
        }
    });

    setTimeout(() => {
        currentIndex++;
        loadQuestion();
    }, 1500);
}

function confirmQuit() {
    if (confirm("Tu veux vraiment stopper la session ?")) {
        clearInterval(timer);
        endPlayerTurn();
    }
}

function endPlayerTurn() {
    clearInterval(timer);
    localScores.push({ name: playersList[currentPlayerIndex], score });

    currentPlayerIndex++;

    if (currentGameMode === 'local' && currentPlayerIndex < playersList.length) {
        promptNextPlayer();
    } else {
        showFinalLeaderboard();
    }
}

function showFinalLeaderboard() {
    showScreen('score-screen');
    document.getElementById('progress-indicator').innerText = 'Classement';
    
    localScores.sort((a, b) => b.score - a.score);

    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '';

    if (currentGameMode === 'solo') {
        document.getElementById('end-title').innerText = "🏆 Session Terminée !";
        document.getElementById('final-score-text').innerText = `Tu as obtenu ${localScores[0].score} / ${questionsList.length} bonnes réponses !`;
    } else {
        document.getElementById('end-title').innerText = `🥇 ${localScores[0].name} Remporte la Partie !`;
        document.getElementById('final-score-text').innerText = `Classement général des joueurs :`;

        localScores.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = `rank-item ${idx === 0 ? 'winner' : ''}`;
            item.innerHTML = `
                <span class="rank-name">${idx === 0 ? '👑 ' : `#${idx + 1} `}${p.name}</span>
                <span class="rank-score">${p.score} / ${questionsList.length} pts</span>
            `;
            container.appendChild(item);
        });
    }
}

function resetToSetup() {
    showScreen('setup-screen');
    document.getElementById('progress-indicator').innerText = 'Config';
        }
