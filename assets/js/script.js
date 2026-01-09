// بيانات التطبيق
let subjectsData = [];
let currentSubject = null;
let quizData = [];
let userAnswers = [];
let score = 0;
let isRandomQuiz = false;
let startTime = null;
let elapsedTime = 0;
let timerInterval = null;
const APP_VERSION = '2.1.0';
let progressManager = {
    saveResult: function(subjectId, fileType, fileNumber, score, total) {
        const history = this.getHistory();
        const result = {
            date: new Date().toISOString(),
            subjectId,
            subjectName: subjectsData.find(s => s.id === subjectId)?.name || subjectId,
            fileType,
            fileNumber,
            score,
            total,
            percentage: Math.round((score/total)*100)
        };
        history.unshift(result);
        localStorage.setItem('quizHistory', JSON.stringify(history)); // Store all history
        
        // Also update 'best scores' map for quick lookup
        const bestScores = this.getBestScores();
        const key = `${subjectId}_${fileType}_${fileNumber}`;
        if (!bestScores[key] || result.percentage > bestScores[key]) {
            bestScores[key] = result.percentage;
            localStorage.setItem('quizBestScores', JSON.stringify(bestScores));
        }
    },
    getHistory: function() {
        return JSON.parse(localStorage.getItem('quizHistory') || '[]');
    },
    getBestScores: function() {
        return JSON.parse(localStorage.getItem('quizBestScores') || '{}');
    },
    getBestScore: function(subjectId, fileType, fileNumber) {
        const bestScores = this.getBestScores();
        return bestScores[`${subjectId}_${fileType}_${fileNumber}`];
    }
};

// عناصر DOM
const appHomePage = document.getElementById('appHomePage');
const subjectPage = document.getElementById('subjectPage');
const subjectGrid = document.getElementById('subjectGrid');
const pageTitle = document.getElementById('pageTitle');
const heroIllustration = document.querySelector('.hero-illustration img');

const fileTypeSelect = document.getElementById('fileType');
const fileNumberSelect = document.getElementById('fileNumber');
const questionsContainer = document.getElementById('questions');
const statsContainer = document.getElementById('stats');
const loadingElement = document.getElementById('loading');
const fileSelector = document.getElementById('fileSelector');
const startBtn = document.getElementById('startBtn');
const backButton = document.getElementById('backButton'); // زر العودة في صفحة الاختبار
const homeButton = document.getElementById('homeButton'); // زر الهوم العلوي

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', async () => {
    await loadSubjects();

    // التحقق من وجود "موضوع محفوظ" في السابق (اختياري)
    // حالياً سنبدأ دائماً من القائمة الرئيسية
    
    // Search Listener
    document.getElementById('subjectSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = subjectsData.filter(s => s.name.toLowerCase().includes(term));
        renderSubjectGrid(filtered);
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

async function loadSubjects() {
    try {
        const response = await fetch('data/subjects.json');
        if (!response.ok) throw new Error('فشل تحميل قائمة المواد');
        subjectsData = await response.json();
        renderSubjectGrid();
    } catch (error) {
        console.error(error);
        subjectGrid.innerHTML = `
            <div class="error-msg" style="text-align: center; color: #ef4444; padding: 20px;">
                <p>حدث خطأ في تحميل المواد.</p>
                <p style="font-size: 0.8rem; direction: ltr;">${error.message}</p>
                <p>يرجى التأكد من رفع مجلد "data" بشكل صحيح إلى GitHub.</p>
                <button class="btn" onclick="location.reload()" style="margin-top: 10px; width: auto; display: inline-flex;">تحديث الصفحة</button>
            </div>`;
    }
}

function renderSubjectGrid(data = subjectsData) {
    subjectGrid.innerHTML = '';
    if (data.length === 0) {
        subjectGrid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-secondary);">لا توجد مواد مطابقة للبحث.</p>';
        return;
    }
    data.forEach(subject => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.onclick = () => selectSubject(subject.id);

        card.innerHTML = `
            <img src="${subject.image}" alt="${subject.name}" class="subject-icon">
            <h3 class="subject-title">${subject.name}</h3>
            <p class="subject-desc">${subject.description}</p>
        `;
        subjectGrid.appendChild(card);
    });
}

function selectSubject(subjectId) {
    currentSubject = subjectsData.find(s => s.id === subjectId);
    if (!currentSubject) return;

    // تحديث الواجهة
    appHomePage.style.display = 'none';
    subjectPage.style.display = 'block';

    // تحديث العناوين والصور
    document.getElementById('subjectTitle').textContent = `اختبارات مادة ${currentSubject.name}`;
    if (heroIllustration) heroIllustration.src = currentSubject.image;

    // إعادة تعيين المحددات
    fileTypeSelect.value = 'test';
    updateFileNumbers();
    updateQuizTitle();

    // تمرير للأعلى
    window.scrollTo(0, 0);
}

function goToAppHome() {
    // العودة لقائمة المواد
    stopTimer();
    currentSubject = null;
    appHomePage.style.display = 'block';
    subjectPage.style.display = 'none';
    document.getElementById('subjectTitle').textContent = 'نظام الاختبارات الجامعية الشامل';
    if (heroIllustration) heroIllustration.src = 'assets/images/quiz_illustration_ai.png'; // صورة افتراضية أو شعار عام

    // إخفاء أي اختبار نشط
    resetQuizView();
}

// ==================== Quiz Logic (Adapted) ====================

function updateFileNumbers() {
    const fileType = fileTypeSelect.value;
    const fileNumberSelect = document.getElementById('fileNumber');

    if (fileType === 'random') {
        fileNumberSelect.parentElement.style.display = 'none';
        return;
    } else {
        fileNumberSelect.parentElement.style.display = 'block';
    }

    fileNumberSelect.innerHTML = '';
    let maxNumber = 3;
    if (fileType === 'homework') maxNumber = 3;
    else if (fileType === 'assessment') maxNumber = 3;
    else if (fileType === 'test') maxNumber = 14;

    for (let i = 1; i <= maxNumber; i++) {
        const option = document.createElement('option');
        option.value = i;
        const best = progressManager.getBestScore(currentSubject.id, fileType, i);
        option.textContent = `رقم ${i} ${best !== undefined ? `(🏆 ${best}%)` : ''}`;
        fileNumberSelect.appendChild(option);
    }
}

function updateQuizTitle() {
    // تحديث نص الزر أو العنوان الفرعي إذا وجد
    const fileType = fileTypeSelect.value;
    const titleMap = {
        "homework": "الواجبات",
        "assessment": "الأسئلة الذاتية للمتعلم",
        "test": "الاختبار الذاتي",
        "random": "الاختبار العشوائي"
    };
    const title = titleMap[fileType] || "الاختبار";
    startBtn.innerHTML = `<i class="fas fa-play"></i> بدء ${title}`;
}

async function loadQuiz() {
    if (!currentSubject) return;

    const fileType = fileTypeSelect.value;
    isRandomQuiz = (fileType === 'random');

    // إعداد الواجهة للتحميل
    loadingElement.style.display = 'flex';
    fileSelector.style.display = 'none';
    questionsContainer.innerHTML = '';
    statsContainer.style.display = 'none';
    backButton.style.display = 'none';

    try {
        let data = [];
        if (isRandomQuiz) {
            data = await fetchRandomQuestions();
        } else {
            const fileNumber = fileNumberSelect.value;
            const fileName = `${fileType}_${fileNumber}.json`;
            const response = await fetch(`${currentSubject.dataPath}/${fileName}`);
            if (!response.ok) throw new Error('لم يتم العثور على الملف');
            data = await response.json();
        }

        if (!data || data.length === 0) throw new Error('لا توجد أسئلة');

        // تجهيز الأسئلة
        quizData = shuffleQuestionOptions(data);
        if (isRandomQuiz) quizData = quizData.slice(0, 50); // Take 50 for random

        userAnswers = new Array(quizData.length).fill(null);

        // عرض الأسئلة
        renderQuestions();
        startTimer();

        loadingElement.style.display = 'none';
        document.getElementById('progressContainer').style.display = 'block';
        updateProgress();
        updateStats();
        statsContainer.style.display = 'flex';
        document.getElementById('finishButton').style.display = 'block';
        backButton.style.display = 'block'; // زر العودة للقائمة (داخل المادة)

    } catch (error) {
        console.error(error);
        loadingElement.style.display = 'none';
        questionsContainer.innerHTML = `<div class="question" style="color:red;text-align:center;"><h3>خطأ: ${error.message}</h3></div>`;
        setTimeout(() => showFileSelector(), 2000);
    }
}

async function fetchRandomQuestions() {
    // تجميع أسئلة عشوائية من جميع ملفات المادة الحالية
    const files = [
        'test_1', 'test_2', 'test_3', 'test_4', 'test_5', 'test_6', 'test_7',
        'test_8', 'test_9', 'test_10', 'test_11', 'test_12', 'test_13', 'test_14',
        'assessment_1', 'assessment_2', 'assessment_3',
        'homework_1', 'homework_2', 'homework_3'
    ];

    let allQuestions = [];
    for (const file of files) {
        try {
            const res = await fetch(`${currentSubject.dataPath}/${file}.json`);
            if (res.ok) {
                const q = await res.json();
                allQuestions.push(...q);
            }
        } catch (e) { /* ignore missing files */ }
    }

    return shuffleArray(allQuestions);
}

function showFileSelector() {
    // العودة لقائمة اختيار الملفات داخل المادة
    stopTimer();
    fileSelector.style.display = 'block';
    questionsContainer.innerHTML = '';
    statsContainer.style.display = 'none';
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('finishButton').style.display = 'none';
    document.getElementById('resultsPage').style.display = 'none';
    backButton.style.display = 'none';
    resetQuizView();
}

function resetQuizView() {
    quizData = [];
    userAnswers = [];
    score = 0;
    elapsedTime = 0;
    document.getElementById('timer').textContent = '00:00';
}

// ... (Rest of format/shuffle/render logic from original script, simplified) ...
// Helper functions
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function shuffleQuestionOptions(questions) {
    return questions.map(q => {
        const shuffled = shuffleArray(q.options);
        const newCorrect = shuffled.indexOf(q.options[q.correct]);
        return { ...q, options: shuffled, correct: newCorrect };
    });
}

function renderQuestions() {
    questionsContainer.innerHTML = '';
    quizData.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question';
        div.innerHTML = `
            <h3><span class="question-number">${index + 1}</span> ${q.text}</h3>
            <div class="options">
                ${q.options.map((opt, i) => `
                    <div class="option" onclick="selectAnswer(${index}, ${i})">
                        <input type="radio" name="q${index}" ${userAnswers[index] === i ? 'checked' : ''}>
                        <span>${opt}</span>
                    </div>
                `).join('')}
            </div>
            <div id="feedback-${index}" class="feedback-container"></div>
        `;
        // Add tabindex to allow focus
        div.tabIndex = 0;
        div.addEventListener('click', () => {
             // Optional: visual indication of focus? 
             // Browser default outline is usually enough, but we can enhance in CSS
        });
        questionsContainer.appendChild(div);
    });
}

function selectAnswer(qIndex, optIndex) {
    if (userAnswers[qIndex] !== null) return; // Prevent changing answer

    userAnswers[qIndex] = optIndex;
    const q = quizData[qIndex];
    const isCorrect = (optIndex === q.correct);

    // UI Update
    const optionsDiv = questionsContainer.children[qIndex].querySelector('.options');
    const selectedOpt = optionsDiv.children[optIndex];
    selectedOpt.classList.add('selected');
    selectedOpt.classList.add(isCorrect ? 'correct' : 'incorrect');

    // Show correct answer if wrong
    /* if (!isCorrect) {
        optionsDiv.children[q.correct].classList.add('correct');
    } */
    // ^ Optional: Show correct immediately? logic in original was slightly different. 
    // Original script showed feedback div.

    const feedbackDiv = document.getElementById(`feedback-${qIndex}`);
    feedbackDiv.innerHTML = `
        <div class="feedback ${isCorrect ? 'correct-answer' : 'hint'}" style="display:block">
            <h4>${isCorrect ? '<i class="fas fa-check"></i> إجابة صحيحة' : '<i class="fas fa-times"></i> إجابة خاطئة'}</h4>
            ${!isCorrect ? `<p>الإجابة الصحيحة: ${q.options[q.correct]}</p>` : ''}
            ${q.hint ? `<p>تلميح: ${q.hint}</p>` : ''}
        </div>
    `;

    // Remove focus ability after answering to skip it in tab navigation? 
    // Maybe better to keep it so user can review.
    
    // Auto-scroll logic or focus next?
    // Let's rely on shortcuts for navigation.

    // Sound
    if (isCorrect) playCorrectSound();
    else playWrongSound();

    // Update Score
    if (isCorrect) score++;
    updateStats();
    updateProgress();
}

function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('total').textContent = quizData.length;
    document.getElementById('correctCount').textContent = score;
}

function updateProgress() {
    const answered = userAnswers.filter(a => a !== null).length;
    const pct = Math.round((answered / quizData.length) * 100) || 0;
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = `${pct}%`;
    document.getElementById('progressPercentage').textContent = `${pct}%`;
}

// Timer
function startTimer() {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        const mins = Math.floor(elapsedTime / 60000);
        const secs = Math.floor((elapsedTime % 60000) / 1000);
        document.getElementById('timer').textContent =
            `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
    document.getElementById('timerContainer').style.display = 'flex';
}
function stopTimer() { clearInterval(timerInterval); }

// Event Listeners
fileTypeSelect.addEventListener('change', () => {
    updateFileNumbers();
    updateQuizTitle();
});
fileNumberSelect.addEventListener('change', updateQuizTitle);

// Back Buttons
// زر العودة الموجود داخل صفحة الأسئلة يرجع لصفحة اختيار الملفات
backButton.addEventListener('click', () => {
    showFileSelector();
});

// زر الهوم العلوي:
// إذا كنا داخل اختبار -> يطلب تأكيد ويعود لاختيار الملفات
// إذا كنا في اختيار الملفات -> يعود للصفحة الرئيسية (اختيار المواد)
homeButton.addEventListener('click', async () => {
    if (questionsContainer.innerHTML !== '') {
        const confirm = window.confirm('هل أنت متأكد من الخروج؟ سيتم فقدان التقدم.');
        if (confirm) showFileSelector();
    } else {
        goToAppHome();
    }
});

// Original Audio Context logic (lazy init)
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playCorrectSound() {
    if (localStorage.getItem('soundEnabled') === 'false') return;
    try {
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) { console.warn('Audio error', e); }
}

function playWrongSound() {
    if (localStorage.getItem('soundEnabled') === 'false') return;
    try {
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) { console.warn('Audio error', e); }
}

// Results logic
window.showResults = function () { // Expose to global for HTML button
    stopTimer();
    document.getElementById('resultsPage').style.display = 'block';

    // Hide others
    questionsContainer.innerHTML = '';
    statsContainer.style.display = 'none';
    document.getElementById('finishButton').style.display = 'none';
    fileSelector.style.display = 'none';

    // Calc stats
    const correct = userAnswers.filter((a, i) => a === quizData[i].correct).length;
    const wrong = quizData.length - correct;
    const pct = Math.round((correct / quizData.length) * 100);

    document.getElementById('scorePercentage').textContent = `${pct}%`;
    document.getElementById('resultCorrectCount').textContent = correct;
    document.getElementById('resultWrongCount').textContent = wrong;
    document.getElementById('scoreMessage').textContent = pct > 70 ? 'ممتاز!' : 'حاول مرة أخرى';

    // Chart
    if (window.Chart) {
        new Chart(document.getElementById('resultsChart'), {
            type: 'doughnut',
            data: {
                labels: ['صحيح', 'خاطئ'],
                datasets: [{ data: [correct, wrong], backgroundColor: ['#10b981', '#ef4444'] }]
            }
        });
    }

    if (pct > 70 && window.confetti) window.confetti();

    // SAVE PROGRESS
    if (currentSubject) {
        progressManager.saveResult(
            currentSubject.id, 
            document.getElementById('fileType').value, 
            document.getElementById('fileNumber').value, 
            score, 
            quizData.length
        );
    }
};

// ==================== KEYBOARD SHORTCUTS ====================
function handleKeyboardShortcuts(e) {
    // Only active if quiz is visible and no modals are open
    if (questionsContainer.style.display === 'none' && subjectPage.style.display !== 'block') return;
    if (document.getElementById('resultsPage').style.display === 'block') return;
    
    const key = e.key;
    
    // Check if a question is focused
    const focusedElement = document.activeElement;
    const isQuestionFocused = focusedElement.classList.contains('question');
    
    if (isQuestionFocused) {
        // Find index
        const index = Array.from(questionsContainer.children).indexOf(focusedElement);
        if (index === -1) return;

        if (['1', '2', '3', '4'].includes(key)) {
            e.preventDefault();
            const optionIndex = parseInt(key) - 1;
            // Check if option exists
            if (quizData[index].options[optionIndex]) {
                 selectAnswer(index, optionIndex);
            }
        } else if (key === 'Enter') {
            e.preventDefault();
            // Move to next question
            const nextQuestion = questionsContainer.children[index + 1];
            if (nextQuestion) {
                nextQuestion.focus();
                nextQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // If last question, maybe show finish button?
                document.getElementById('finishButton').scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
}

// Global functions for HTML access
window.showHistoryModal = function() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    const history = progressManager.getHistory();
    
    modal.style.display = 'flex';
    
    if (history.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">لا يوجد سجل اختبارات حتى الآن.</p>';
        return;
    }
    
    list.innerHTML = history.map(h => `
        <div class="history-item" style="background: var(--bg-color); padding: 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h4 style="margin: 0; color: var(--primary-color);">${h.subjectName}</h4>
                <p style="margin: 5px 0; font-size: 0.9rem; color: var(--text-secondary);">
                    ${getQuizTypeName(h.fileType)} #${h.fileNumber}
                </p>
                <small style="color: var(--text-secondary); opacity: 0.7;">${new Date(h.date).toLocaleDateString('ar-SA')}</small>
            </div>
            <div style="text-align: center;">
                <span style="display: block; font-size: 1.2rem; font-weight: bold; color: ${h.percentage >= 60 ? 'var(--correct-color)' : 'var(--wrong-color)'}">
                    ${h.percentage}%
                </span>
                <span style="font-size: 0.8rem;">${h.score}/${h.total}</span>
            </div>
        </div>
    `).join('');
};

window.closeHistoryModal = function() {
    document.getElementById('historyModal').style.display = 'none';
};

// Helper for history display
function getQuizTypeName(type) {
    const map = {
        'test': 'اختبار ذاتي',
        'assessment': 'أسئلة ذاتية',
        'homework': 'واجب',
        'random': 'عشوائي'
    };
    return map[type] || type;
}

document.getElementById('retryBtn').addEventListener('click', () => {
    document.getElementById('resultsPage').style.display = 'none';
    loadQuiz(); // Reload same quiz
});
document.getElementById('newQuizBtn').addEventListener('click', () => {
    document.getElementById('resultsPage').style.display = 'none';
    showFileSelector();
});
document.getElementById('reviewBtn').addEventListener('click', () => {
    // Show review mode
    const reviewPage = document.getElementById('reviewPage');
    if (reviewPage) {
        reviewPage.style.display = 'block';
        document.getElementById('resultsPage').style.display = 'none';
        renderReview();
    }
});
document.getElementById('backToResultsBtn').addEventListener('click', () => {
    document.getElementById('reviewPage').style.display = 'none';
    document.getElementById('resultsPage').style.display = 'block';
});

function renderReview() {
    const container = document.getElementById('reviewContainer');
    container.innerHTML = '';
    quizData.forEach((q, i) => {
        const ans = userAnswers[i];
        const correct = q.correct;
        const div = document.createElement('div');
        div.className = `review-item ${ans === correct ? 'correct' : 'wrong'}`;
        div.innerHTML = `
            <h4>سؤال ${i + 1}: ${q.text}</h4>
            <p>إجابتك: ${q.options[ans] || 'لم تجب'} ${ans === correct ? '✅' : '❌'}</p>
            ${ans !== correct ? `<p>الصحيح: ${q.options[correct]}</p>` : ''}
            <p class="hint">${q.hint || ''}</p>
        `;
        container.appendChild(div);
    });
}
