// ===== Spanish Flashcards App =====
(function () {
    'use strict';

    const STORAGE_KEY = 'flashcards_progress';
    const SURPRISE_COUNT = 20;

    const $homeScreen = document.getElementById('home-screen');
    const $practiceScreen = document.getElementById('practice-screen');
    const $completionScreen = document.getElementById('completion-screen');
    const $wordbankScreen = document.getElementById('wordbank-screen');
    const $categoriesGrid = document.getElementById('categories-grid');
    const $surpriseBtn = document.getElementById('surprise-btn');
    const $wordbankBtn = document.getElementById('wordbank-btn');
    const $backBtn = document.getElementById('back-btn');
    const $wordbankBackBtn = document.getElementById('wordbank-back-btn');
    const $resetBtn = document.getElementById('reset-btn');
    const $practiceTitle = document.getElementById('practice-title');
    const $progressCurrent = document.getElementById('progress-current');
    const $progressTotal = document.getElementById('progress-total');
    const $progressFill = document.getElementById('progress-fill');
    const $flashcard = document.getElementById('flashcard');
    const $cardFrontText = document.getElementById('card-front-text');
    const $cardExample = document.getElementById('card-example');
    const $cardBackText = document.getElementById('card-back-text');
    const $cardBackEnglish = document.getElementById('card-back-english');
    const $backLabel = document.getElementById('back-label');
    const $answerButtons = document.getElementById('answer-buttons');
    const $correctBtn = document.getElementById('correct-btn');
    const $wrongBtn = document.getElementById('wrong-btn');
    const $completionMessage = document.getElementById('completion-message');
    const $completionStats = document.getElementById('completion-stats');
    const $completionHomeBtn = document.getElementById('completion-home-btn');
    const $statsBar = document.getElementById('stats-bar');
    const $wordbankSummary = document.getElementById('wordbank-summary');
    const $wordbankList = document.getElementById('wordbank-list');
    const $wordbankSearchInput = document.getElementById('wordbank-search-input');

    let progress = {};
    let currentSession = null;

    // --- Storage ---
    function loadProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) progress = JSON.parse(raw);
        } catch (_) {
            progress = {};
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch (_) {}
    }

    function getCategoryProgress(catId) {
        return progress[catId] || {};
    }

    function setWordLearned(catId, wordIdx) {
        if (!progress[catId]) progress[catId] = {};
        progress[catId][wordIdx] = { remaining: 0, learned: true };
        saveProgress();
    }

    function resetCategoryProgress(catId) {
        delete progress[catId];
        saveProgress();
    }

    // --- Stats ---
    function getTotalStats() {
        let totalWords = 0;
        let learnedWords = 0;
        CATEGORIES.forEach(cat => {
            totalWords += cat.words.length;
            const catProg = getCategoryProgress(cat.id);
            learnedWords += Object.values(catProg).filter(w => w.learned).length;
        });
        return { totalWords, learnedWords };
    }

    function renderStatsBar() {
        const { totalWords, learnedWords } = getTotalStats();
        const pct = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;
        $statsBar.innerHTML = `
            <div class="stats-numbers">
                <span class="stats-learned">${learnedWords}</span>
                <span class="stats-separator">/</span>
                <span class="stats-total">${totalWords}</span>
                <span class="stats-label">מילים נלמדו</span>
            </div>
            <div class="stats-progress-bar">
                <div class="stats-progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="stats-pct">${pct}%</span>
        `;
    }

    // --- Screen Navigation ---
    function showScreen(screen) {
        [$homeScreen, $practiceScreen, $completionScreen, $wordbankScreen].forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
        window.scrollTo(0, 0);
    }

    // --- Home Screen ---
    function renderCategories() {
        $categoriesGrid.innerHTML = '';
        if (typeof CATEGORIES === 'undefined') return;

        CATEGORIES.forEach(cat => {
            const catProg = getCategoryProgress(cat.id);
            const totalWords = cat.words.length;
            const learnedCount = Object.values(catProg).filter(w => w.learned).length;
            const percent = totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0;
            const isComplete = learnedCount === totalWords && totalWords > 0;

            const card = document.createElement('div');
            card.className = 'category-card' + (isComplete ? ' completed' : '');
            card.innerHTML = `
                <span class="icon">${cat.icon}</span>
                <span class="name">${cat.name}</span>
                <span class="word-count">${totalWords} מילים</span>
                <div class="category-progress">
                    <div class="category-progress-fill" style="width:${percent}%"></div>
                </div>
                <span class="category-percent">${learnedCount}/${totalWords}</span>
            `;
            card.addEventListener('click', () => startCategory(cat.id));
            $categoriesGrid.appendChild(card);
        });

        renderStatsBar();
    }

    // --- Session Logic ---
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function startCategory(catId) {
        const cat = CATEGORIES.find(c => c.id === catId);
        if (!cat) return;

        const catProg = getCategoryProgress(catId);
        const wordsToLearn = [];
        cat.words.forEach((w, idx) => {
            const wp = catProg[idx];
            if (!wp || !wp.learned) {
                wordsToLearn.push({ ...w, idx });
            }
        });

        if (wordsToLearn.length === 0) {
            showConfirm('כל המילים בקטגוריה זו נלמדו! לאפס ולהתחיל מחדש?', () => {
                resetCategoryProgress(catId);
                renderCategories();
                startCategory(catId);
            });
            return;
        }

        const deck = shuffle(wordsToLearn.map((_, i) => ({ wordRef: i, remaining: null })));

        currentSession = {
            categoryId: catId,
            categoryName: cat.name,
            words: wordsToLearn,
            deck,
            completedCount: 0,
            totalToLearn: wordsToLearn.length,
            stats: { correct: 0, wrong: 0 },
            seenWords: new Set(),
            isSurprise: false
        };

        $practiceTitle.textContent = cat.name;
        $resetBtn.style.display = '';
        showScreen($practiceScreen);
        showNextCard();
    }

    function startSurprise() {
        if (typeof CATEGORIES === 'undefined' || CATEGORIES.length === 0) return;

        let allWords = [];
        CATEGORIES.forEach(cat => {
            const catProg = getCategoryProgress(cat.id);
            cat.words.forEach((w, idx) => {
                const wp = catProg[idx];
                allWords.push({
                    ...w,
                    catId: cat.id, idx,
                    learned: !!(wp && wp.learned)
                });
            });
        });

        const unlearned = allWords.filter(w => !w.learned);
        let pool = unlearned.length >= SURPRISE_COUNT ? unlearned : allWords;
        shuffle(pool);
        const picked = pool.slice(0, SURPRISE_COUNT);

        const wordsForSession = picked.map((w, i) => ({ ...w, origIdx: w.idx, idx: i }));
        const deck = shuffle(wordsForSession.map((_, i) => ({ wordRef: i, remaining: null })));

        currentSession = {
            categoryId: '__surprise__',
            categoryName: '!הפתע אותי',
            words: wordsForSession,
            deck,
            completedCount: 0,
            totalToLearn: wordsForSession.length,
            stats: { correct: 0, wrong: 0 },
            seenWords: new Set(),
            isSurprise: true
        };

        $practiceTitle.textContent = '🎲 !הפתע אותי';
        $resetBtn.style.display = 'none';
        showScreen($practiceScreen);
        showNextCard();
    }

    function showNextCard() {
        const session = currentSession;
        if (!session) return;

        if (session.deck.length === 0) {
            showCompletion();
            return;
        }

        const item = session.deck[0];
        const word = session.words[item.wordRef];

        session.seenWords.add(item.wordRef);
        updateProgressDisplay();

        $answerButtons.classList.add('hidden');
        $flashcard.classList.remove('flipped');

        $cardFrontText.textContent = word.es;
        $cardExample.textContent = word.ex || '';
        $cardBackText.textContent = '';
        $cardBackEnglish.textContent = '';
        $backLabel.textContent = '';

        currentSession._currentWord = word;
    }

    function updateProgressDisplay() {
        const session = currentSession;
        if (!session) return;

        const learned = session.completedCount;
        const total = session.totalToLearn;
        const pct = total > 0 ? Math.round((learned / total) * 100) : 0;

        $progressFill.style.width = pct + '%';
        $progressCurrent.textContent = learned;
        $progressTotal.textContent = total;
    }

    function handleFlip() {
        if (!currentSession) return;
        if (!$flashcard.classList.contains('flipped')) {
            const word = currentSession._currentWord;
            if (word) {
                $cardBackText.textContent = word.he;
                $cardBackEnglish.textContent = word.en || '';
                $backLabel.textContent = 'עברית';
            }
            $flashcard.classList.add('flipped');
            $answerButtons.classList.remove('hidden');
        }
    }

    function handleAnswer(correct) {
        if (!currentSession) return;

        const session = currentSession;
        const item = session.deck.shift();

        if (correct) {
            session.stats.correct++;
            if (item.remaining === null) {
                item.remaining = 2;
            } else {
                item.remaining--;
            }

            if (item.remaining > 0) {
                const minPos = Math.min(3, session.deck.length);
                const maxPos = Math.min(6, session.deck.length);
                const insertAt = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
                session.deck.splice(insertAt, 0, item);
            } else {
                session.completedCount++;
                markWordLearned(item);
            }
        } else {
            session.stats.wrong++;
            item.remaining = 6;
            const minPos = Math.min(2, session.deck.length);
            const maxPos = Math.min(4, session.deck.length);
            const insertAt = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
            session.deck.splice(insertAt, 0, item);
        }

        showNextCard();
    }

    function markWordLearned(item) {
        if (!currentSession.isSurprise) {
            setWordLearned(currentSession.categoryId, currentSession.words[item.wordRef].idx);
        } else {
            const word = currentSession.words[item.wordRef];
            if (word.catId) {
                setWordLearned(word.catId, word.origIdx);
            }
        }
    }

    function showCompletion() {
        const session = currentSession;
        const totalAnswers = session.stats.correct + session.stats.wrong;
        const { learnedWords } = getTotalStats();

        $completionMessage.textContent = session.isSurprise
            ? `סיימת ${session.totalToLearn} מילים אקראיות!`
            : `סיימת את הקטגוריה "${session.categoryName}"!`;

        $completionStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-value">${session.stats.correct}</span>
                <span class="stat-label">תשובות נכונות</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${session.stats.wrong}</span>
                <span class="stat-label">תשובות שגויות</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${totalAnswers > 0 ? Math.round((session.stats.correct / totalAnswers) * 100) : 0}%</span>
                <span class="stat-label">אחוז הצלחה</span>
            </div>
            <div class="stat-item highlight">
                <span class="stat-value">${learnedWords}</span>
                <span class="stat-label">סה״כ מילים באוצר שלך</span>
            </div>
        `;

        showScreen($completionScreen);
    }

    // --- Word Bank ---
    function showWordBank() {
        const { totalWords, learnedWords } = getTotalStats();
        const pct = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;

        $wordbankSummary.innerHTML = `
            <div class="wb-stat-row">
                <div class="wb-stat">
                    <span class="wb-stat-num">${learnedWords}</span>
                    <span class="wb-stat-label">נלמדו</span>
                </div>
                <div class="wb-stat">
                    <span class="wb-stat-num">${totalWords - learnedWords}</span>
                    <span class="wb-stat-label">נותרו</span>
                </div>
                <div class="wb-stat">
                    <span class="wb-stat-num">${pct}%</span>
                    <span class="wb-stat-label">התקדמות</span>
                </div>
            </div>
        `;

        renderWordBankList('all', '');
        showScreen($wordbankScreen);
    }

    function renderWordBankList(filter, search) {
        $wordbankList.innerHTML = '';
        const searchLower = search.toLowerCase();

        CATEGORIES.forEach(cat => {
            const catProg = getCategoryProgress(cat.id);
            const matchingWords = [];

            cat.words.forEach((w, idx) => {
                const wp = catProg[idx];
                const isLearned = !!(wp && wp.learned);

                if (filter === 'learned' && !isLearned) return;
                if (filter === 'remaining' && isLearned) return;

                if (search && !w.es.toLowerCase().includes(searchLower)
                    && !w.he.includes(search)
                    && !(w.en && w.en.toLowerCase().includes(searchLower))) {
                    return;
                }

                matchingWords.push({ ...w, isLearned });
            });

            if (matchingWords.length === 0) return;

            const section = document.createElement('div');
            section.className = 'wb-section';

            const header = document.createElement('div');
            header.className = 'wb-section-header';
            header.textContent = `${cat.icon} ${cat.name}`;
            section.appendChild(header);

            matchingWords.forEach(w => {
                const row = document.createElement('div');
                row.className = 'wb-word' + (w.isLearned ? ' learned' : '');
                row.innerHTML = `
                    <span class="wb-status">${w.isLearned ? '✓' : '○'}</span>
                    <span class="wb-es">${w.es}</span>
                    <span class="wb-he">${w.he}</span>
                    <span class="wb-en">${w.en || ''}</span>
                `;
                section.appendChild(row);
            });

            $wordbankList.appendChild(section);
        });

        if ($wordbankList.children.length === 0) {
            $wordbankList.innerHTML = '<div class="wb-empty">לא נמצאו מילים</div>';
        }
    }

    // --- Confirm Dialog ---
    function showConfirm(message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="confirm-cancel">ביטול</button>
                    <button class="confirm-ok">אישור</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.confirm-cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.confirm-ok').addEventListener('click', () => {
            overlay.remove();
            onConfirm();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    function handleReset() {
        if (!currentSession || currentSession.isSurprise) return;
        showConfirm('לאפס את ההתקדמות בקטגוריה זו?', () => {
            resetCategoryProgress(currentSession.categoryId);
            goHome();
        });
    }

    function goHome() {
        currentSession = null;
        renderCategories();
        showScreen($homeScreen);
    }

    // --- Event Listeners ---
    $flashcard.addEventListener('click', handleFlip);
    $correctBtn.addEventListener('click', () => handleAnswer(true));
    $wrongBtn.addEventListener('click', () => handleAnswer(false));
    $backBtn.addEventListener('click', goHome);
    $resetBtn.addEventListener('click', handleReset);
    $surpriseBtn.addEventListener('click', startSurprise);
    $completionHomeBtn.addEventListener('click', goHome);
    $wordbankBtn.addEventListener('click', showWordBank);
    $wordbankBackBtn.addEventListener('click', goHome);

    // Word bank filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderWordBankList(btn.dataset.filter, $wordbankSearchInput.value);
        });
    });

    // Word bank search
    $wordbankSearchInput.addEventListener('input', () => {
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        renderWordBankList(activeFilter, $wordbankSearchInput.value);
    });

    // Prevent double-tap zoom on buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.click();
        });
    });

    // --- Init ---
    loadProgress();
    renderCategories();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

})();
