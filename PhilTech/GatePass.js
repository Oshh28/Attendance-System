// =====================================================
//   PhilTech - GMA | GatePass.js
//   Guard use: manually record student entry
// =====================================================

const API_URL      = 'api.php';
const GATEPASS_API = 'gatepass_api.php';

// =====================================================
//   TIME PICKER STATE
// =====================================================
let timeHours   = 10;
let timeMinutes = 30;
let timeAMPM    = 'AM';

// =====================================================
//   INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Set current time as default
    const now = new Date();
    timeHours   = now.getHours() % 12 || 12;
    timeMinutes = now.getMinutes();
    timeAMPM    = now.getHours() >= 12 ? 'PM' : 'AM';
    updateTimeDisplay();

    // Hamburger
    const hamburger  = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileMenu?.classList.toggle('open');
    });

    // Navbar scroll
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) nav.style.boxShadow = window.scrollY > 10
            ? '0 4px 20px rgba(0,0,0,0.15)'
            : '0 2px 10px rgba(0,0,0,0.10)';
    });

    // Student No lookup on input (debounced)
    let lookupTimer = null;
    document.getElementById('gpStudentNo').addEventListener('input', () => {
        clearTimeout(lookupTimer);
        lookupTimer = setTimeout(lookupStudent, 500);
    });

    // Close success modal on overlay click
    document.getElementById('gpSuccessModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('gpSuccessModal')) closeSuccessModal();
    });

    // Load today's logs
    loadTodayLogs();
});

// =====================================================
//   STUDENT LOOKUP — auto-fill name & section
// =====================================================
async function lookupStudent() {
    const studentNo = document.getElementById('gpStudentNo').value.trim();
    const preview   = document.getElementById('studentPreview');
    const notFound  = document.getElementById('studentNotFound');

    preview.style.display  = 'none';
    notFound.style.display = 'none';

    if (!studentNo || studentNo.length < 3) return;

    try {
        const res  = await fetch(`${API_URL}?action=lookup&studentNo=${encodeURIComponent(studentNo)}`);
        const data = await res.json();

        if (data.success && data.student) {
            const s        = data.student;
            const fullName = `${s.firstName} ${s.middleName ? s.middleName[0] + '.' : ''} ${s.lastName}`.trim();

            document.getElementById('previewName').textContent    = fullName;
            document.getElementById('previewSection').textContent = s.section || '';
            document.getElementById('previewStatus').textContent  = s.status  || 'ENROLLED';

            // Auto-fill section dropdown
            const secEl = document.getElementById('gpSection');
            if (secEl && s.section) secEl.value = s.section;

            preview.style.display = 'flex';
        } else {
            notFound.style.display = 'flex';
        }
    } catch (e) {
        console.warn('Lookup error:', e.message);
    }
}

// =====================================================
//   TIME PICKER
// =====================================================
function changeTime(unit, delta) {
    if (unit === 'hours') {
        timeHours = ((timeHours - 1 + delta + 12) % 12) + 1;
    } else {
        timeMinutes = (timeMinutes + delta + 60) % 60;
    }
    updateTimeDisplay();
}

function setAMPM(value) {
    timeAMPM = value;
    document.getElementById('btnAM').classList.toggle('active', value === 'AM');
    document.getElementById('btnPM').classList.toggle('active', value === 'PM');
}

function updateTimeDisplay() {
    document.getElementById('timeHours').textContent   = String(timeHours).padStart(2, '0');
    document.getElementById('timeMinutes').textContent = String(timeMinutes).padStart(2, '0');
    document.getElementById('btnAM').classList.toggle('active', timeAMPM === 'AM');
    document.getElementById('btnPM').classList.toggle('active', timeAMPM === 'PM');
}

function getTimeString() {
    const h = String(timeHours).padStart(2, '0');
    const m = String(timeMinutes).padStart(2, '0');
    return `${h}:${m} ${timeAMPM}`;
}

// =====================================================
//   SUBMIT GATE PASS
// =====================================================
async function submitGatePass() {
    const studentNo = document.getElementById('gpStudentNo').value.trim();
    const section   = document.getElementById('gpSection').value;
    const timeIn    = getTimeString();
    const errEl     = document.getElementById('gpError');

    // Validation
    if (!studentNo) { errEl.textContent = 'Please enter a Student No.';      return; }
    if (!section)   { errEl.textContent = 'Please select a student section.'; return; }
    errEl.textContent = '';

    const btn  = document.getElementById('gpSubmitBtn');
    const text = document.getElementById('gpSubmitText');
    btn.disabled     = true;
    text.textContent = 'SUBMITTING...';

    try {
        const res  = await fetch(`${GATEPASS_API}?action=add`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ studentNo, section, timeIn })
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'Submit failed');

        // Show success modal with attendance result
        const studentName  = document.getElementById('previewName').textContent || '—';
        const attendance   = data.attendance || 'Present';
        showSuccess(studentNo, studentName, section, timeIn, attendance);

        // Reset form
        document.getElementById('gpStudentNo').value  = '';
        document.getElementById('gpSection').value    = '';
        document.getElementById('studentPreview').style.display  = 'none';
        document.getElementById('studentNotFound').style.display = 'none';

        // Reload logs
        loadTodayLogs();

    } catch (e) {
        errEl.textContent = 'Error: ' + e.message;
    }

    btn.disabled     = false;
    text.textContent = 'SUBMIT';
}

// =====================================================
//   SHOW SUCCESS MODAL
// =====================================================
function showSuccess(studentNo, studentName, section, timeIn, attendance = 'Present') {
    // Attendance badge color
    const attColor = attendance === 'Present' ? '#16a34a'
                   : attendance === 'Late'    ? '#d97706'
                   : '#dc2626';

    document.getElementById('gpSuccessMsg').textContent = 'The student entry has been successfully recorded.';
    document.getElementById('gpSuccessDetails').innerHTML = `
        <strong>Student No:</strong> ${studentNo}<br>
        <strong>Name:</strong> ${studentName}<br>
        <strong>Section:</strong> ${section}<br>
        <strong>Time In:</strong> ${timeIn}<br>
        <strong>Attendance:</strong> <span style="font-weight:800;color:${attColor};">${attendance}</span><br>
        <strong>Date:</strong> ${new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })}
    `;
    document.getElementById('gpSuccessModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSuccessModal() {
    document.getElementById('gpSuccessModal').classList.remove('open');
    document.body.style.overflow = '';
}

// =====================================================
//   LOAD TODAY'S GATE PASS LOGS
// =====================================================
async function loadTodayLogs() {
    try {
        const res  = await fetch(`${GATEPASS_API}?action=today`);
        const data = await res.json();

        const tbody = document.getElementById('gpLogsBody');
        if (!data.success || !data.logs || data.logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="gp-logs-empty">
                        <i class="fa-solid fa-clipboard-list"></i>
                        No gate pass entries today.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = data.logs.map((log, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="log-studno">${log.studentNo}</td>
                <td>${log.studentName || '—'}</td>
                <td>${log.section}</td>
                <td class="log-timein">${log.timeIn}</td>
                <td>${log.processedBy || 'Guard'}</td>
            </tr>`).join('');

    } catch (e) {
        console.warn('Could not load gate pass logs:', e.message);
    }
}