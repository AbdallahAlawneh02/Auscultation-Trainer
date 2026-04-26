/**
 * Heart & Lung Auscultation Trainer Pro - Main JavaScript
 * Finalized hardware-first version with safer RFID scan handling
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Global Data & State ---

    // Hardware RFID Tag to Point ID Mapping
    // Supports both legacy long-form tags and current RC522 short-form tags
    const RFID_MAP = {
        // 1 - Aortic valve
        "04 A8 3C 3E C1 2A 81": 1,
        "88 04 A8 3C 18": 1,
        "04 A8 3C": 1,

        // 2 - Pulmonic valve
        "04 3D 42 3E C1 2A 81": 2,
        "88 04 3D 42 1D": 2,
        "04 3D 42": 2,

        // 3 - Erbs point
        "04 4B 47 3E C1 2A 81": 3,
        "88 04 4B 47 22": 3,
        "04 4B 47": 3,

        // 4 - Tricuspid area
        "04 12 4C 3E C1 2A 81": 4,
        "88 04 12 4C 29": 4,
        "04 12 4C": 4,

        // 5 - Mitral area
        "04 3D 56 3E C1 2A 81": 5,
        "88 04 3D 56 E7": 5,
        "04 3D 56": 5,

        // 6 - Left Upper Lobe(posterior)
        "04 2E 5B 3E C1 2A 81": 6,
        "88 04 2E 5B EB": 6,
        "04 2E 5B": 6,

        // 7 - Right Upper Lobe(posterior)
        "04 F4 61 3E C1 2A 81": 7,
        "88 04 F4 61 08": 7,
        "04 F4 61": 7,

        // 8 - Left Upper Lobe(interscapular)
        "04 65 67 3E C1 2A 81": 8,
        "88 04 65 67 8E": 8,
        "04 65 67": 8,

        // 9 - Right Upper Lobe(interscapular)
        "04 69 72 3E C1 2A 81": 9,
        "88 04 69 72 EF": 9,
        "04 69 72": 9,

        // 10 - Left Lower Lobe(posterior base)
        "04 53 76 3E C1 2A 81": 10,
        "88 04 53 76 5D": 10,
        "04 53 76": 10,

        // 11 - Right Lower Lobe(posterior base)
        "04 B7 7C 3E C1 2A 81": 11,
        "88 04 B7 7C 47": 11,
        "04 B7 7C": 11,

        // 12 - First right intercostal space
        "04 85 83 3E C1 2A 81": 12,
        "88 04 85 83 8A": 12,
        "04 85 83": 12,

        // 13 - First left intercostal space
        "04 6D 8E 3E C1 2A 81": 13,
        "88 04 6D 8E 6F": 13,
        "04 6D 8E": 13,

        // 14 - Left Midaxillary
        "04 58 95 3E C1 2A 81": 14,
        "88 04 58 95 41": 14,
        "04 58 95": 14,

        // 15 - Right Midaxillary
        "04 39 9C 3E C1 2A 81": 15,
        "88 04 39 9C 75": 15,
        "04 39 9C": 15,
    };

    const ALL_POINTS = [
        { id: 1, name: "Aortic valve", location: "Right 2nd ICS", type: "heart", desc: "Best location to hear sounds from the aortic valve, including aortic stenosis (systolic murmur) or aortic regurgitation (diastolic murmur)." },
        { id: 2, name: "Pulmonic valve", location: "Left 2nd ICS", type: "heart", desc: "Best area for listening to pulmonic valve murmurs and the S2 split." },
        { id: 3, name: "Erbs point", location: "Left 3rd ICS", type: "heart", desc: "Traditional auscultatory area in the 3rd left intercostal space. Good for observing S1/S2." },
        { id: 4, name: "Tricuspid area", location: "Left 4th ICS", type: "heart", desc: "Located at the lower left sternal border. Best for hearing tricuspid regurgitation." },
        { id: 5, name: "Mitral area", location: "Left 5th ICS, MCL", type: "heart", desc: "Apex of the heart. Best area for hearing S1, mitral regurgitation, and mitral stenosis." },
        { id: 6, name: "Left Upper Lobe(posterior)", location: "Posterior Upper Chest", type: "lung", desc: "Typically bronchovesicular sounds. Abnormal sounds like wheezing or crackles can indicate pathology." },
        { id: 7, name: "Right Upper Lobe(posterior)", location: "Posterior Upper Chest", type: "lung", desc: "Similar to left upper lung. Bronchovesicular breath sounds are normally heard here." },
        { id: 8, name: "Left Upper Lobe(interscapular)", location: "Between Scapulae", type: "lung", desc: "Vesicular sounds. Commonly affected in lobe pneumonia." },
        { id: 9, name: "Right Upper Lobe(interscapular)", location: "Between Scapulae", type: "lung", desc: "Vesicular breath sounds. Important for assessing upper lung zones." },
        { id: 10, name: "Left Lower Lobe(posterior base)", location: "Posterior Lower Back", type: "lung", desc: "Vesicular sounds. Crackles or diminished sounds may indicate effusion or consolidation." },
        { id: 11, name: "Right Lower Lobe(posterior base)", location: "Posterior Lower Back", type: "lung", desc: "Vesicular sounds at the base. Dependent area where fluid/crackles often present first." },
        { id: 12, name: "First right intercostal space", location: "Anterior Right Chest", type: "lung", desc: "Assess anterior right upper lung field." },
        { id: 13, name: "First left intercostal space", location: "Anterior Left Chest", type: "lung", desc: "Assess anterior left upper lung field." },
        { id: 14, name: "Left Midaxillary", location: "Left Lateral Chest", type: "lung", desc: "Assess lateral lung fields for vesicular sounds." },
        { id: 15, name: "Right Midaxillary", location: "Right Lateral Chest", type: "lung", desc: "Assess lateral lung fields for vesicular sounds." }
    ];

    let pollInterval = null;

    let examConfig = [];
    let examResults = [];
    let currentQuestionIndex = 0;
    let attemptsLeft = 2;
    let numCorrect = 0;
    let numIncorrect = 0;
    let isExamActive = false;
    let currentAudio = null;

    // Safer exam/scan state
    let totalLocationPoints = 0;
    let currentQuestionAttempts = 0;
    let currentPhase = 'idle';
    let scanResolved = false;
    let lastProcessedScan = null;
    let lastProcessedAt = 0;

    // Web debug state
    window.lastUnknownTag = null;
    const debugState = {
        backend: 'checking',
        rfidAvailable: false,
        phase: 'idle',
        uid: '-',
        rawUid: '-',
        matchedAlias: '-',
        mappedPoint: '-',
        expectedPoint: '-',
        note: '-'
    };

    function playSound(pointId, pointName, status) {
        // Play sound on the Raspberry Pi server side
        fetch('/play-sound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pointId: pointId,
                pointName: pointName,
                status: status
            })
        }).catch(e => console.error('Server audio playback failed:', e));
    }

    function stopSound() {
        fetch('/stop-sound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).catch(e => console.error('Server audio stop failed:', e));
    }

    // --- Navigation ---
    const navButtons = document.querySelectorAll('.nav-btn, .nav-trigger');
    const sections = document.querySelectorAll('.view-section');

    function switchView(targetId) {
        if (isExamActive && targetId !== 'view-exam') {
            alert('Please exit the current exam before navigating elsewhere.');
            return;
        }

        sections.forEach(sec => sec.classList.remove('active'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');

        document.querySelectorAll('.sidebar-nav .nav-btn').forEach(btn => {
            if (btn.dataset.target === targetId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const target = this.dataset.target;
            if (target) switchView(target);
        });
    });

    // --- Debug Panel Helpers ---
    function ensureDebugElements() {
        return {
            status: document.getElementById('debug-status'),
            phase: document.getElementById('debug-phase'),
            uid: document.getElementById('debug-uid'),
            rawUid: document.getElementById('debug-raw-uid'),
            alias: document.getElementById('debug-alias'),
            mappedPoint: document.getElementById('debug-point'),
            expected: document.getElementById('debug-expected'),
            note: document.getElementById('debug-note')
        };
    }

    function updateDebugStatus(partial = {}) {
        Object.assign(debugState, partial);

        const els = ensureDebugElements();
        if (!els.status) return; // Safe if debug panel is not present in HTML

        els.status.textContent = `${debugState.backend} | RFID ${debugState.rfidAvailable ? 'available' : 'unavailable'}`;
        els.phase.textContent = debugState.phase;
        els.uid.textContent = debugState.uid;
        els.rawUid.textContent = debugState.rawUid;
        els.alias.textContent = debugState.matchedAlias;
        els.mappedPoint.textContent = String(debugState.mappedPoint);
        els.expected.textContent = String(debugState.expectedPoint);
        els.note.textContent = debugState.note;
    }

    async function checkBackendHealth() {
        try {
            const res = await fetch('/health', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            updateDebugStatus({
                backend: 'online',
                rfidAvailable: !!data.rfid_available,
                note: data.message || 'backend healthy'
            });

            return !!data.rfid_available;
        } catch (err) {
            updateDebugStatus({
                backend: 'offline',
                rfidAvailable: false,
                note: `health check failed: ${err.message}`
            });
            return false;
        }
    }

    // --- 2. Instructor Setup (10 Questions) ---
    const setupGrid = document.getElementById('setup-rows');
    const configTbody = document.getElementById('config-tbody');

    function initSetup() {
        if (!setupGrid) return;

        setupGrid.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            let optionsHTML = `<option value="">Select Point...</option>`;
            ALL_POINTS.forEach(p => {
                optionsHTML += `<option value="${p.id}">${p.name}</option>`;
            });

            const row = document.createElement('div');
            row.className = 'setup-row';
            row.innerHTML = `
                <span class="q-num">${i}</span>
                <select class="form-select point-select" id="point-sel-${i}">${optionsHTML}</select>
                <select class="form-select status-select" id="status-sel-${i}">
                    <option value="normal">Normal</option>
                    <option value="abnormal">Abnormal</option>
                </select>
            `;
            setupGrid.appendChild(row);
        }
    }

    const saveConfigBtn = document.getElementById('save-config-btn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            examConfig = [];
            let valid = true;

            for (let i = 1; i <= 10; i++) {
                const pointEl = document.getElementById(`point-sel-${i}`);
                const statusEl = document.getElementById(`status-sel-${i}`);
                const pid = pointEl ? pointEl.value : '';
                const sts = statusEl ? statusEl.value : 'normal';

                if (!pid) {
                    valid = false;
                    break;
                }

                examConfig.push({
                    qNum: i,
                    pointId: Number(pid),
                    status: sts
                });
            }

            if (!valid) {
                alert('Please select an auscultation point for all 10 questions.');
                return;
            }

            updateConfigTable();
            alert('Blueprint Saved! You can now Launch Exam.');
        });
    }

    const randomizeBtn = document.getElementById('randomize-config-btn');
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            // Fisher-Yates shuffle to get 10 unique points from 15
            const allIds = ALL_POINTS.map(p => p.id);
            for (let i = allIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
            }
            const selected = allIds.slice(0, 10);

            for (let i = 1; i <= 10; i++) {
                const pointEl = document.getElementById(`point-sel-${i}`);
                const statusEl = document.getElementById(`status-sel-${i}`);
                if (pointEl) pointEl.value = selected[i - 1];
                if (statusEl) statusEl.value = Math.random() > 0.5 ? 'normal' : 'abnormal';
            }
        });
    }

    function updateConfigTable() {
        if (!configTbody) return;

        configTbody.innerHTML = '';
        examConfig.forEach(cfg => {
            const pt = ALL_POINTS.find(p => p.id === cfg.pointId);
            const badgeCls = cfg.status === 'normal' ? 'normal' : 'abnormal';

            configTbody.innerHTML += `
                <tr>
                    <td>${cfg.qNum}</td>
                    <td>${pt ? pt.name : 'Unknown'}</td>
                    <td><span class="badge ${badgeCls}">${cfg.status}</span></td>
                </tr>
            `;
        });
    }

    // --- 3. Live Hardware-Only Exam ---
    const sidebar = document.getElementById('app-sidebar');
    const mainContent = document.querySelector('.main-content');

    const quickStartBtn = document.getElementById('quick-start-exam-btn');
    if (quickStartBtn) {
        quickStartBtn.addEventListener('click', async () => {
            if (examConfig.length !== 10) {
                alert('Please save a 10-question blueprint in Instructor Setup first.');
                switchView('view-instructor');
                return;
            }

            isMockExam = false;
            const hardwareReady = await checkBackendHealth();
            if (!hardwareReady) {
                alert('RFID hardware is not available. Please check the RC522 connection and backend.');
                return;
            }

            startLockedExam();
        });
    }

    const exitExamBtn = document.getElementById('exit-exam-btn');
    if (exitExamBtn) {
        exitExamBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to abort the current exam? Results will be lost.')) {
                endLockedExam(false);
            }
        });
    }

    function startLockedExam() {
        isExamActive = true;

        if (sidebar) sidebar.classList.add('locked-out');
        if (mainContent) mainContent.classList.add('locked-in');

        switchView('view-exam');

        currentQuestionIndex = 0;
        examResults = [];
        numCorrect = 0;
        numIncorrect = 0;
        totalLocationPoints = 0;
        currentQuestionAttempts = 0;
        currentPhase = 'locating';
        scanResolved = false;
        lastProcessedScan = null;
        lastProcessedAt = 0;
        window.lastUnknownTag = null;

        loadQuestion(currentQuestionIndex);

        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(pollLatestScan, 600);
    }

    function endLockedExam(completed = true) {
        isExamActive = false;
        currentPhase = 'idle';

        if (sidebar) sidebar.classList.remove('locked-out');
        if (mainContent) mainContent.classList.remove('locked-in');

        if (completed) {
            generateFinalResults();
            switchView('view-results');
            const resBtn = document.getElementById('nav-btn-results');
            if (resBtn) resBtn.classList.add('active');
        } else {
            switchView('view-dashboard');
        }

        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }

        stopAudioEq();

        updateDebugStatus({
            phase: 'idle',
            expectedPoint: '-',
            note: completed ? 'exam completed' : 'exam aborted'
        });
    }

    function normalizeUidString(uid) {
        if (!uid) return '';

        let cleaned = String(uid).trim().toUpperCase().replace(/\s+/g, ' ');

        // Accept comma/colon/dash separated input too
        cleaned = cleaned.replace(/[:,\-]/g, ' ').replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    function resolvePointFromUid(uidStr) {
        const normalized = normalizeUidString(uidStr);
        if (!normalized) {
            return {
                pointId: -1,
                matchedAlias: null
            };
        }

        // Exact match first
        if (Object.prototype.hasOwnProperty.call(RFID_MAP, normalized)) {
            return {
                pointId: Number(RFID_MAP[normalized]),
                matchedAlias: normalized
            };
        }

        // If current RC522 short form like "88 04 6D 8E 6F",
        // try the middle 3-byte alias "04 6D 8E"
        const parts = normalized.split(' ');
        if (parts.length >= 4) {
            for (let i = 0; i <= parts.length - 3; i++) {
                const alias3 = parts.slice(i, i + 3).join(' ');
                if (Object.prototype.hasOwnProperty.call(RFID_MAP, alias3)) {
                    return {
                        pointId: Number(RFID_MAP[alias3]),
                        matchedAlias: alias3
                    };
                }
            }
        }

        return {
            pointId: -1,
            matchedAlias: null
        };
    }

    async function pollLatestScan() {
        if (!isExamActive || currentPhase !== 'locating') return;

        try {
            const res = await fetch('/latest-scan', { cache: 'no-store' });
            if (!res.ok) return;

            const data = await res.json();

            if (data.uid) {
                const uidStr = normalizeUidString(data.uid);
                const rawUid = data.raw_uid ? String(data.raw_uid) : uidStr;

                const resolved = resolvePointFromUid(uidStr);

                updateDebugStatus({
                    phase: currentPhase,
                    uid: uidStr || '-',
                    rawUid: rawUid || '-',
                    matchedAlias: resolved.matchedAlias || '-',
                    mappedPoint: resolved.pointId,
                    expectedPoint: examConfig[currentQuestionIndex]?.pointId ?? '-',
                    note: resolved.pointId === -1 ? 'unknown tag received' : `mapped to point ${resolved.pointId}`
                });

                if (resolved.pointId === -1) {
                    window.lastUnknownTag = uidStr;
                } else {
                    window.lastUnknownTag = null;
                }

                processScan(resolved.pointId);
            }
        } catch (e) {
            updateDebugStatus({
                backend: 'offline',
                note: `scan poll failed: ${e.message}`
            });
        }
    }

    function loadQuestion(idx) {
        if (idx >= 10) {
            endLockedExam(true);
            return;
        }

        const q = examConfig[idx];
        const pt = ALL_POINTS.find(p => Number(p.id) === Number(q.pointId));

        attemptsLeft = 2;
        currentQuestionAttempts = 0;
        currentPhase = 'locating';
        scanResolved = false;
        lastProcessedScan = null;
        lastProcessedAt = 0;
        updateAttemptsUI();

        const qNum = document.getElementById('exam-q-number');
        const progress = document.getElementById('exam-progress-fill');
        const targetName = document.getElementById('exam-target-name');
        const feedback = document.getElementById('scanner-feedback');
        const locating = document.getElementById('phase-locating');
        const listening = document.getElementById('phase-listening');
        const scannerVisual = document.getElementById('scanner-visual');

        if (qNum) qNum.textContent = `${idx + 1} / 10`;
        if (progress) progress.style.width = `${(idx / 10) * 100}%`;
        if (targetName) targetName.textContent = pt ? pt.name : 'Unknown Point';
        if (feedback) {
            feedback.textContent = 'Awaiting RFID Scan...';
            feedback.className = 'scanner-text text-accent';
        }

        if (locating) locating.classList.add('active');
        if (listening) listening.classList.remove('active');
        if (scannerVisual) scannerVisual.classList.add('scanner-pulse');

        updateDebugStatus({
            phase: 'locating',
            expectedPoint: Number(q.pointId),
            uid: '-',
            rawUid: '-',
            matchedAlias: '-',
            mappedPoint: '-',
            note: `waiting for point ${Number(q.pointId)}`
        });

        stopAudioEq();
    }

    function updateAttemptsUI() {
        const dotsBox = document.getElementById('attempts-dots');
        if (!dotsBox) return;

        dotsBox.innerHTML = '';
        for (let i = 0; i < 2; i++) {
            dotsBox.innerHTML += `<div class="dot ${i < attemptsLeft ? 'active' : ''}"></div>`;
        }
    }

    function advanceToListening() {
        currentPhase = 'listening';

        const locating = document.getElementById('phase-locating');
        const listening = document.getElementById('phase-listening');
        const scannerVisual = document.getElementById('scanner-visual');

        if (locating) locating.classList.remove('active');
        if (listening) listening.classList.add('active');
        if (scannerVisual) scannerVisual.classList.remove('scanner-pulse');

        updateDebugStatus({
            phase: 'listening',
            note: 'location phase complete'
        });
    }

    function processScan(scannedId) {
        if (!isExamActive || currentPhase !== 'locating' || scanResolved) return;

        const question = examConfig[currentQuestionIndex];
        const feedback = document.getElementById('scanner-feedback');

        const actualScanned = Number(scannedId);
        const expectedPoint = Number(question.pointId);

        const now = Date.now();
        const scanKey = String(scannedId);

        // Ignore repeated identical scans for 1 second
        if (lastProcessedScan === scanKey && (now - lastProcessedAt) < 1000) {
            return;
        }

        lastProcessedScan = scanKey;
        lastProcessedAt = now;
        currentQuestionAttempts += 1;

        console.log('QUESTION CHECK', {
            scannedId,
            actualScanned,
            expectedPoint,
            currentQuestionIndex
        });

        if (actualScanned === expectedPoint) {
            scanResolved = true;
            totalLocationPoints += 0.5;

            if (feedback) {
                feedback.textContent = 'Location Verified!';
                feedback.className = 'scanner-text text-success';
            }

            updateDebugStatus({
                phase: currentPhase,
                mappedPoint: actualScanned,
                expectedPoint,
                note: `matched point ${expectedPoint}`
            });

            setTimeout(() => {
                advanceToListening();
            }, 500);
            return;
        }

        attemptsLeft -= 1;
        updateAttemptsUI();

        if (attemptsLeft > 0) {
            const message = (actualScanned === -1 && window.lastUnknownTag)
                ? `Unknown Tag! (UID: ${window.lastUnknownTag})`
                : `Incorrect Location. Try again.`;

            if (feedback) {
                feedback.textContent = message;
                feedback.className = 'scanner-text text-danger';
            }

            updateDebugStatus({
                phase: currentPhase,
                mappedPoint: actualScanned,
                expectedPoint,
                note: message
            });
            return;
        }

        scanResolved = true;

        if (feedback) {
            feedback.textContent = '0 Attempts Left. Skipping to audio.';
            feedback.className = 'scanner-text text-danger';
        }

        updateDebugStatus({
            phase: currentPhase,
            mappedPoint: actualScanned,
            expectedPoint,
            note: 'location attempts exhausted'
        });

        setTimeout(() => {
            advanceToListening();
        }, 900);
    }

    // --- Audio Playback ---
    const examPlayBtn = document.getElementById('exam-play-btn');
    if (examPlayBtn) {
        examPlayBtn.addEventListener('click', function () {
            const eq = document.getElementById('exam-eq');
            if (eq && eq.classList.contains('playing')) {
                stopAudioEq();
                this.textContent = '▶';
            } else {
                startAudioEq();
                this.textContent = '⏸';
            }
        });
    }

    function startAudioEq() {
        const eq = document.getElementById('exam-eq');
        if (eq) eq.classList.add('playing');

        const q = examConfig[currentQuestionIndex];
        const pt = ALL_POINTS.find(p => Number(p.id) === Number(q.pointId));
        if (pt) playSound(pt.id, pt.name, q.status);
    }

    function stopAudioEq() {
        const eq = document.getElementById('exam-eq');
        if (eq) eq.classList.remove('playing');

        const btn = document.getElementById('exam-play-btn');
        if (btn) btn.textContent = '▶';

        stopSound();
    }

    // --- Answering ---
    const ansNormalBtn = document.getElementById('ans-normal');
    const ansAbnormalBtn = document.getElementById('ans-abnormal');

    if (ansNormalBtn) ansNormalBtn.addEventListener('click', () => submitAnswer('normal'));
    if (ansAbnormalBtn) ansAbnormalBtn.addEventListener('click', () => submitAnswer('abnormal'));

    function submitAnswer(ans) {
        if (currentPhase !== 'listening') return;

        const q = examConfig[currentQuestionIndex];
        const pt = ALL_POINTS.find(p => Number(p.id) === Number(q.pointId));
        const isCorrect = ans === q.status;
        const isLocCorrect = scanResolved && attemptsLeft > 0;

        let score = 0;
        if (isLocCorrect) score += 0.5;
        if (isCorrect) score += 0.5;

        examResults.push({
            qNum: q.qNum,
            pointName: pt ? pt.name : 'Unknown',
            attempts: currentQuestionAttempts,
            actual: q.status,
            studentAns: ans,
            correct: isCorrect,
            locCorrect: isLocCorrect,
            score: score
        });

        numCorrect += score;
        numIncorrect += (1 - score);

        currentQuestionIndex += 1;
        loadQuestion(currentQuestionIndex);
    }

    // --- 4. Results ---
    function generateFinalResults() {
        const noRes = document.getElementById('no-results-msg');
        const content = document.getElementById('results-content');
        if (noRes) noRes.classList.add('hidden');
        if (content) content.classList.remove('hidden');

        const pct = Math.round((numCorrect / 10) * 100);

        const finalScoreVal = document.getElementById('final-score-val');
        const scoreCirclePath = document.getElementById('score-circle-path');
        const resCorrect = document.getElementById('res-correct');
        const resIncorrect = document.getElementById('res-incorrect');
        const resAccuracy = document.getElementById('res-accuracy');

        if (finalScoreVal) finalScoreVal.textContent = `${pct}%`;
        if (scoreCirclePath) {
            scoreCirclePath.style.strokeDasharray = `${pct}, 100`;
            if (pct >= 80) scoreCirclePath.style.stroke = 'var(--c-success)';
            else if (pct >= 50) scoreCirclePath.style.stroke = 'var(--c-accent)';
            else scoreCirclePath.style.stroke = 'var(--c-danger)';
        }

        if (resCorrect) resCorrect.textContent = numCorrect.toFixed(1);
        if (resIncorrect) resIncorrect.textContent = numIncorrect.toFixed(1);

        const locAccuracyPct = Math.round((totalLocationPoints / 5) * 100); // 10 questions * 0.5 max
        if (resAccuracy) resAccuracy.textContent = `${locAccuracyPct}%`;

        const tbody = document.getElementById('results-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        examResults.forEach(r => {
            const locBadge = r.locCorrect
                ? '<span class="badge normal">Correct</span>'
                : '<span class="badge abnormal">Incorrect</span>';

            const diagBadge = r.correct
                ? '<span class="badge normal">Correct</span>'
                : '<span class="badge abnormal">Incorrect</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${r.qNum}</td>
                    <td>${r.pointName}</td>
                    <td>${r.attempts} attempt(s): ${locBadge}</td>
                    <td>${diagBadge} <span class="text-xs text-muted ml-2">(${r.studentAns})</span> <br><small>Earned: ${r.score} pt(s)</small></td>
                </tr>
            `;
        });
    }

    // --- Email Report ---
    const sendEmailBtn = document.getElementById('send-email-btn');
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', async () => {
            const studentNameEl = document.querySelector('input[placeholder="e.g. Jane Doe (ID: 123456)"]');
            const instructorEmailEl = document.querySelector('input[placeholder="instructor@university.edu"]');
            const customNotesEl = document.getElementById('email-custom-text');

            const studentName = studentNameEl ? studentNameEl.value.trim() : '';
            const instructorEmail = instructorEmailEl ? instructorEmailEl.value.trim() : '';
            const customNotes = customNotesEl ? customNotesEl.value.trim() : '';

            if (!instructorEmail) {
                alert('Please enter an instructor email address.');
                return;
            }

            const pct = Math.round((numCorrect / 10) * 100);
            let bodyText = `Student: ${studentName || 'Unknown Student'}\n`;
            bodyText += `Final Score: ${numCorrect.toFixed(1)} / 10 (${pct}%)\n`;
            bodyText += `Points Earned: ${numCorrect.toFixed(1)}\n`;
            bodyText += `Points Missed: ${numIncorrect.toFixed(1)}\n\n`;
            
            if (customNotes) {
                bodyText += `--- Custom Message & Notes ---\n${customNotes}\n\n`;
            }

            // AI System Analysis & Recommendations
            let aiFeedback = "--- AI System Analysis & Recommendations ---\n";
            let locationErrors = 0;
            let diagnosisErrors = 0;
            let heartErrors = 0;
            let lungErrors = 0;

            examResults.forEach(r => {
                if (!r.locCorrect) locationErrors++;
                if (!r.correct) diagnosisErrors++;
                
                let p = ALL_POINTS.find(ap => ap.name === r.pointName);
                if (p) {
                    if ((!r.locCorrect || !r.correct) && p.type === 'heart') heartErrors++;
                    if ((!r.locCorrect || !r.correct) && p.type === 'lung') lungErrors++;
                }
            });

            if (locationErrors === 0 && diagnosisErrors === 0) {
                aiFeedback += "[Excellent] No specific weaknesses detected. Keep up the flawless work.\n\n";
            } else {
                if (locationErrors > diagnosisErrors) {
                    aiFeedback += "[Primary Weakness] Anatomical Landmarking & Placement.\n";
                    aiFeedback += "[Recommendation] Focus on surface anatomy. Ensure you are palpating correctly for intercostal spaces. Reference: 'Bates Guide to Physical Examination - Anatomy & Topography'.\n\n";
                } else if (diagnosisErrors > locationErrors) {
                    aiFeedback += "[Primary Weakness] Audio Diagnosis (Normal vs Abnormal).\n";
                    aiFeedback += "[Recommendation] Your stethoscope placement is good, but you need intensive ear training. Spend at least 30 minutes in the 'Training' soundboard listening to pathological sounds.\n\n";
                } else {
                    aiFeedback += "[Primary Weakness] Mixed Location and Diagnosis errors.\n";
                    aiFeedback += "[Recommendation] A comprehensive review of auscultation techniques is strongly advised.\n\n";
                }

                if (heartErrors > lungErrors) {
                    aiFeedback += "[Focus Area] Cardiovascular Auscultation.\n";
                    aiFeedback += "[Reference] 'Macleod's Clinical Examination - Cardiovascular System'. Pay close attention to valve auscultation zones (Aortic, Pulmonic, Tricuspid, Mitral).\n\n";
                } else if (lungErrors > heartErrors) {
                    aiFeedback += "[Focus Area] Respiratory / Pulmonary Auscultation.\n";
                    aiFeedback += "[Reference] 'Bates Guide to Physical Examination - Thorax and Lungs'. Review differences between vesicular, bronchovesicular, and abnormal lung sounds (crackles/wheezes).\n\n";
                }
            }
            
            bodyText += aiFeedback;
            bodyText += `--- Question Breakdown ---\n`;

            examResults.forEach(r => {
                const locStatus = r.locCorrect ? '[Correct]' : '[Incorrect]';
                const diagStatus = r.correct ? '[Correct]' : '[Incorrect]';
                
                bodyText += `Question ${r.qNum}: ${r.pointName}\n`;
                bodyText += `  Location Scan: ${locStatus} (${r.attempts} attempts)\n`;
                bodyText += `  Diagnosis: ${diagStatus} (Student chose: ${r.studentAns})\n`;
                bodyText += `  Score: ${r.score} / 1.0\n\n`;
            });

            try {
                const res = await fetch('/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: instructorEmail,
                        subject: `Exam Results for ${studentName || 'Student'}`,
                        text: bodyText
                    })
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();
                if (data.success) {
                    alert('Report sent successfully.');
                } else {
                    throw new Error(data.error || 'Unknown email error');
                }
            } catch (err) {
                console.error('Backend email failed, falling back to mailto:', err);

                const subject = encodeURIComponent(`Exam Results for ${studentName || 'Student'}`);
                const body = encodeURIComponent(bodyText);
                window.location.href = `mailto:${instructorEmail}?subject=${subject}&body=${body}`;
            }
        });
    }

    // --- 5. Sandbox / Training ---
    function initSandbox() {
        const list = document.getElementById('sandbox-list');
        if (!list) return;

        list.innerHTML = '';

        ALL_POINTS.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = `list-item ${idx === 0 ? 'selected' : ''}`;
            item.innerHTML = `<h4>${p.name}</h4>`;
            item.addEventListener('click', () => {
                document.querySelectorAll('.list-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                updateSandboxDetail(p);
            });
            list.appendChild(item);
        });

        updateSandboxDetail(ALL_POINTS[0]);

        document.querySelectorAll('.sb-play').forEach(btn => {
            btn.addEventListener('click', function () {
                const wasPlaying = this.textContent.includes('⏸');

                document.querySelectorAll('.sb-play').forEach(b => {
                    const t = b.dataset.type;
                    b.innerHTML = `▶ ${t.charAt(0).toUpperCase() + t.slice(1)} S/S`;
                });

                stopSound();

                if (!wasPlaying) {
                    this.innerHTML = '⏸ Playing...';
                    const status = this.dataset.type;
                    const p = ALL_POINTS.find(ap => ap.name === document.getElementById('sb-title')?.textContent);
                    if (p) {
                        playSound(p.id, p.name, status);
                    }
                }
            });
        });
    }

    function updateSandboxDetail(p) {
        const title = document.getElementById('sb-title');
        const location = document.getElementById('sb-location');
        const desc = document.getElementById('sb-desc');
        const controls = document.getElementById('sb-controls');
        const icon = document.querySelector('.illus-icon');

        if (title) title.textContent = p.name;
        if (location) location.textContent = p.location;
        if (desc) desc.textContent = p.desc;
        if (controls) controls.classList.remove('hidden');

        if (icon) {
            if (p.type === 'heart') icon.textContent = '🫀';
            else if (p.type === 'lung') icon.textContent = '🫁';
            else icon.textContent = '👤';
        }

        document.querySelectorAll('.sb-play').forEach(b => {
            const t = b.dataset.type;
            b.innerHTML = `▶ ${t.charAt(0).toUpperCase() + t.slice(1)} S/S`;
        });

        stopSound();
    }

    // INIT
    initSetup();
    initSandbox();
    checkBackendHealth();
});