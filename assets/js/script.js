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
});

async function loadSubjects() {
    try {
        const response = await fetch('data/subjects.json');
        if (!response.ok) throw new Error('فشل تحميل قائمة المواد');
        subjectsData = await response.json();
        renderSubjectGrid();
    } catch (error) {
        console.error(error);
        subjectGrid.innerHTML = `<p class="error-msg">حدث خطأ في تحميل المواد. يرجى تحديث الصفحة.</p>`;
    }
}

function renderSubjectGrid() {
    subjectGrid.innerHTML = '';
    subjectsData.forEach(subject => {
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
        option.textContent = `رقم ${i}`;
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

// Original Audio Context logic (simplified)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playCorrectSound() {
    // Implementation omitted for brevity, stick to simple beep or original logic
    // Using simple oscillator
    if (localStorage.getItem('soundEnabled') === 'false') return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
}
function playWrongSound() {
    if (localStorage.getItem('soundEnabled') === 'false') return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) { }
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
};

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
