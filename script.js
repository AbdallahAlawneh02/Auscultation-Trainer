/**
 * Heart & Lung Auscultation Trainer Pro - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Global Data & State ---
    
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

    let examConfig = []; 
    let examResults = []; 
    let currentQuestionIndex = 0;
    let attemptsLeft = 2;
    let totalAttemptsUsed = 0;
    let numCorrect = 0;
    let numIncorrect = 0;
    let isExamActive = false;
    let currentAudio = null;

    function playSound(pointId, pointName, status) {
        stopSound();
        const upperStatus = status.toUpperCase();
        // Path matches: sounds/{id}{name}/{STATUS}{id}.mp3
        const path = `sounds/${pointId}${pointName}/${upperStatus}${pointId}.mp3`;
        currentAudio = new Audio(path);
        currentAudio.onended = () => {
            stopAudioEq();
        };
        currentAudio.play().catch(e => console.error("Audio playback failed:", e));
    }

    function stopSound() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
    }

    // --- Navigation ---
    const navButtons = document.querySelectorAll('.nav-btn, .nav-trigger');
    const sections = document.querySelectorAll('.view-section');

    function switchView(targetId) {
        if (isExamActive && targetId !== 'view-exam') {
            alert("Please exit the current exam before navigating elsewhere.");
            return;
        }

        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        // Update sidebar active states
        document.querySelectorAll('.sidebar-nav .nav-btn').forEach(btn => {
            if(btn.dataset.target === targetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const target = this.dataset.target;
            if (target) switchView(target);
        });
    });

    // --- 2. Instructor Setup (10 Questions) ---
    const setupGrid = document.getElementById('setup-rows');
    const configTbody = document.getElementById('config-tbody');

    function initSetup() {
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

    document.getElementById('save-config-btn').addEventListener('click', () => {
        examConfig = [];
        let valid = true;

        for (let i = 1; i <= 10; i++) {
            const pid = document.getElementById(`point-sel-${i}`).value;
            const sts = document.getElementById(`status-sel-${i}`).value;
            if (!pid) { valid = false; break; }
            
            examConfig.push({ qNum: i, pointId: parseInt(pid), status: sts });
        }

        if (!valid) {
            alert('Please select an auscultation point for all 10 questions.');
            return;
        }

        updateConfigTable();
        alert("Blueprint Saved! You can now Launch Exam.");
    });

    document.getElementById('randomize-config-btn').addEventListener('click', () => {
        for (let i = 1; i <= 10; i++) {
            document.getElementById(`point-sel-${i}`).value = Math.floor(Math.random() * 15) + 1;
            document.getElementById(`status-sel-${i}`).value = Math.random() > 0.5 ? 'normal' : 'abnormal';
        }
    });

    function updateConfigTable() {
        configTbody.innerHTML = '';
        examConfig.forEach(cfg => {
            const pt = ALL_POINTS.find(p => p.id === cfg.pointId);
            const badgeCls = cfg.status === 'normal' ? 'normal' : 'abnormal';
            configTbody.innerHTML += `
                <tr>
                    <td>${cfg.qNum}</td>
                    <td>${pt.name}</td>
                    <td><span class="badge ${badgeCls}">${cfg.status}</span></td>
                </tr>
            `;
        });
    }

    // --- 3. Live Lock-in Exam ---
    const sidebar = document.getElementById('app-sidebar');
    const mainContent = document.querySelector('.main-content');
    
    document.getElementById('quick-start-exam-btn').addEventListener('click', () => {
        if (examConfig.length !== 10) {
            alert("Please save a 10-question blueprint in Instructor Setup first.");
            switchView('view-instructor');
            return;
        }
        startLockedExam();
    });

    document.getElementById('exit-exam-btn').addEventListener('click', () => {
        if(confirm("Are you sure you want to abort the current exam? Results will be lost.")) {
            endLockedExam(false);
        }
    });

    function startLockedExam() {
        isExamActive = true;
        // Lock UI
        sidebar.classList.add('locked-out');
        mainContent.classList.add('locked-in');
        
        switchView('view-exam');
        
        // Reset State
        currentQuestionIndex = 0;
        examResults = [];
        numCorrect = 0;
        numIncorrect = 0;
        totalAttemptsUsed = 0;
        
        // Prep Simulation Dropdown
        const simDrop = document.getElementById('sim-dropdown');
        simDrop.innerHTML = '<option value="">-- Choose RFID tag --</option>';
        ALL_POINTS.forEach(p => {
            simDrop.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });

        loadQuestion(currentQuestionIndex);
    }

    function endLockedExam(completed = true) {
        isExamActive = false;
        
        // Unlock UI
        sidebar.classList.remove('locked-out');
        mainContent.classList.remove('locked-in');
        
        if (completed) {
            generateFinalResults();
            switchView('view-results');
            document.getElementById('nav-btn-results').classList.add('active'); // force visual active
        } else {
            switchView('view-dashboard');
        }
        
        stopAudioEq();
    }

    function loadQuestion(idx) {
        if (idx >= 10) {
            endLockedExam(true);
            return;
        }
        
        const q = examConfig[idx];
        const pt = ALL_POINTS.find(p => p.id === q.pointId);

        attemptsLeft = 2;
        updateAttemptsUI();
        
        document.getElementById('exam-q-number').textContent = `${idx + 1} / 10`;
        document.getElementById('exam-progress-fill').style.width = `${((idx) / 10) * 100}%`;
        
        document.getElementById('exam-target-name').textContent = pt.name;
        document.getElementById('scanner-feedback').textContent = "Awaiting RFID Scan...";
        document.getElementById('scanner-feedback').className = "scanner-text text-accent";
        
        // Phase UI
        document.getElementById('phase-locating').classList.add('active');
        document.getElementById('phase-listening').classList.remove('active');
        document.getElementById('scanner-visual').classList.add('scanner-pulse');
        
        stopAudioEq();
    }

    function updateAttemptsUI() {
        const dotsBox = document.getElementById('attempts-dots');
        dotsBox.innerHTML = '';
        for (let i=0; i<2; i++) {
            dotsBox.innerHTML += `<div class="dot ${i < attemptsLeft ? 'active' : ''}"></div>`;
        }
    }

    // Scanning Simulation
    document.getElementById('sim-scan-btn').addEventListener('click', () => {
        const scannedId = parseInt(document.getElementById('sim-dropdown').value);
        if (!scannedId) return;
        processScan(scannedId);
    });

    document.getElementById('sim-fail-btn').addEventListener('click', () => {
        const tgt = examConfig[currentQuestionIndex].pointId;
        let wId = 1; while(wId === tgt) wId = Math.floor(Math.random() * 15) + 1;
        processScan(wId);
    });

    function processScan(scannedId) {
        if (!isExamActive) return;
        const qConfig = examConfig[currentQuestionIndex];
        const fb = document.getElementById('scanner-feedback');
        
        totalAttemptsUsed++;
        
        if (scannedId === qConfig.pointId) {
            // Correct Loc
            document.getElementById('scanner-visual').classList.remove('scanner-pulse');
            fb.textContent = "Location Verified!";
            fb.className = "scanner-text text-success";
            
            setTimeout(() => {
                document.getElementById('phase-locating').classList.remove('active');
                document.getElementById('phase-listening').classList.add('active');
            }, 800);
        } else {
            // Wrong
            attemptsLeft--;
            updateAttemptsUI();
            if (attemptsLeft > 0) {
                fb.textContent = "Incorrect Location. Try again.";
                fb.className = "scanner-text text-danger";
            } else {
                fb.textContent = "0 Attempts Left. Skipping to audio.";
                fb.className = "scanner-text text-danger";
                document.getElementById('scanner-visual').classList.remove('scanner-pulse');
                
                setTimeout(() => {
                    document.getElementById('phase-locating').classList.remove('active');
                    document.getElementById('phase-listening').classList.add('active');
                }, 1200);
            }
        }
    }

    // Audio Playback
    document.getElementById('exam-play-btn').addEventListener('click', function() {
        if (document.getElementById('exam-eq').classList.contains('playing')) {
            stopAudioEq();
            this.textContent = '▶';
        } else {
            startAudioEq();
            this.textContent = '⏸';
        }
    });

    function startAudioEq() { 
        document.getElementById('exam-eq').classList.add('playing');
        const q = examConfig[currentQuestionIndex];
        const pt = ALL_POINTS.find(p => p.id === q.pointId);
        playSound(pt.id, pt.name, q.status);
    }
    
    function stopAudioEq() { 
        const eq = document.getElementById('exam-eq');
        if(eq) eq.classList.remove('playing'); 
        const btn = document.getElementById('exam-play-btn');
        if(btn) btn.textContent = '▶';
        stopSound();
    }

    // Answering
    document.getElementById('ans-normal').addEventListener('click', () => submitAnswer('normal'));
    document.getElementById('ans-abnormal').addEventListener('click', () => submitAnswer('abnormal'));

    function submitAnswer(ans) {
        const q = examConfig[currentQuestionIndex];
        const pt = ALL_POINTS.find(p => p.id === q.pointId);
        const isCorrect = (ans === q.status);
        const isLocCorrect = (attemptsLeft > 0);
        
        let score = 0;
        if (isLocCorrect) score += 0.5;
        if (isCorrect) score += 0.5;

        examResults.push({
            qNum: q.qNum,
            pointName: pt.name,
            attempts: 2 - attemptsLeft + (attemptsLeft===2 && totalAttemptsUsed>0 ? 1 : 0), // rough tracking
            actual: q.status,
            studentAns: ans,
            correct: isCorrect,
            locCorrect: isLocCorrect,
            score: score
        });

        numCorrect += score;
        numIncorrect += (1 - score);

        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
    }

    // --- 4. Results Gen ---
    function generateFinalResults() {
        document.getElementById('no-results-msg').classList.add('hidden');
        document.getElementById('results-content').classList.remove('hidden');

        // Circle
        const pct = Math.round((numCorrect / 10) * 100);
        document.getElementById('final-score-val').textContent = `${pct}%`;
        document.getElementById('score-circle-path').style.strokeDasharray = `${pct}, 100`;
        
        // Colors
        const circle = document.getElementById('score-circle-path');
        if(pct >= 80) circle.style.stroke = "var(--c-success)";
        else if (pct >= 50) circle.style.stroke = "var(--c-accent)";
        else circle.style.stroke = "var(--c-danger)";

        document.getElementById('res-correct').textContent = numCorrect;
        document.getElementById('res-incorrect').textContent = numIncorrect;
        
        let perfectLocs = 10 - (totalAttemptsUsed - 10); 
        if(perfectLocs < 0) perfectLocs = 0;
        document.getElementById('res-accuracy').textContent = `${(perfectLocs/10)*100}%`;

        // Table
        const tbody = document.getElementById('results-tbody');
        tbody.innerHTML = '';
        examResults.forEach(r => {
            let actUsed = r.attempts;
            if(r.attempts === 0) actUsed = 1; // logical fix for min 1 used
            if(actUsed > 2) actUsed = 2;

            const locBadge = r.locCorrect ? '<span class="badge normal">Correct</span>' : '<span class="badge abnormal">Incorrect</span>';
            const diagBadge = r.correct ? '<span class="badge normal">Correct</span>' : '<span class="badge abnormal">Incorrect</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${r.qNum}</td>
                    <td>${r.pointName}</td>
                    <td>${actUsed} attempt(s): ${locBadge}</td>
                    <td>${diagBadge} <span class="text-xs text-muted ml-2">(${r.studentAns})</span> <br><small>Earned: ${r.score} pt(s)</small></td>
                </tr>
            `;
        });
    }

    document.getElementById('send-email-btn').addEventListener('click', () => {
        const studentName = document.querySelector('input[placeholder="e.g. Jane Doe (ID: 123456)"]').value;
        const instructorEmail = document.querySelector('input[placeholder="instructor@university.edu"]').value;
        
        if (!instructorEmail) {
            alert("Please enter an instructor email address.");
            return;
        }

        const pct = Math.round((numCorrect / 10) * 100);
        const subject = encodeURIComponent(`Exam Results for ${studentName || 'Student'}`);
        let bodyText = `Student: ${studentName || 'Unknown Student'}\n`;
        bodyText += `Final Score: ${numCorrect} / 10 (${pct}%)\n`;
        bodyText += `Correct Points: ${numCorrect}\n`;
        bodyText += `Incorrect Points: ${numIncorrect}\n\n`;
        bodyText += `Question Breakdown:\n`;
        
        examResults.forEach(r => {
            const locText = r.locCorrect ? "Correct" : "Incorrect"; 
            bodyText += `Q${r.qNum}: ${r.pointName}\n`;
            bodyText += `- Location Scan: ${locText}\n`;
            bodyText += `- Diagnosis: ${r.correct ? 'Correct' : 'Incorrect'} (Selected: ${r.studentAns})\n`;
            bodyText += `- Score: ${r.score} / 1\n\n`;
        });
        
        const body = encodeURIComponent(bodyText);
        window.location.href = `mailto:${instructorEmail}?subject=${subject}&body=${body}`;
    });


    // --- 5. Sandbox / Training ---
    function initSandbox() {
        const list = document.getElementById('sandbox-list');
        list.innerHTML = '';

        ALL_POINTS.forEach((p, idx) => {
            // Sandbox Item
            const item = document.createElement('div');
            item.className = `list-item ${idx===0?'selected':''}`;
            item.innerHTML = `<h4>${p.name}</h4>`;
            item.addEventListener('click', () => {
                document.querySelectorAll('.list-item').forEach(el=>el.classList.remove('selected'));
                item.classList.add('selected');
                updateSandboxDetail(p);
            });
            list.appendChild(item);
        });
        
        updateSandboxDetail(ALL_POINTS[0]);
        
        document.querySelectorAll('.sb-play').forEach(btn => {
            btn.addEventListener('click', function() {
                const wasPl = this.textContent.includes('⏸');
                
                // reset all
                document.querySelectorAll('.sb-play').forEach(b => {
                    const t = b.dataset.type;
                    b.innerHTML = `▶ ${t.charAt(0).toUpperCase() + t.slice(1)} S/S`;
                });
                stopSound();

                if(!wasPl) {
                    this.innerHTML = `⏸ Playing...`;
                    const status = this.dataset.type; // 'normal' or 'abnormal'
                    const p = ALL_POINTS.find(ap => ap.name === document.getElementById('sb-title').textContent);
                    if (p) {
                        playSound(p.id, p.name, status);
                        // Also reset button when audio ends
                        currentAudio.onended = () => {
                            this.innerHTML = `▶ ${status.charAt(0).toUpperCase() + status.slice(1)} S/S`;
                        };
                    }
                }
            });
        });
    }

    function updateSandboxDetail(p) {
        document.getElementById('sb-title').textContent = p.name;
        document.getElementById('sb-location').textContent = p.location;
        document.getElementById('sb-desc').textContent = p.desc;
        document.getElementById('sb-controls').classList.remove('hidden');
        
        const iCon = document.querySelector('.illus-icon');
        if(p.type === 'heart') iCon.textContent = '🫀';
        else if (p.type === 'lung') iCon.textContent = '🫁';
        else iCon.textContent = '👤';
        
        // reset buttons
        document.querySelectorAll('.sb-play').forEach(b => {
            const t = b.dataset.type;
            b.innerHTML = `▶ ${t.charAt(0).toUpperCase() + t.slice(1)} S/S`;
        });
        stopSound();
    }


    // INIT
    initSetup();
    initSandbox();
});