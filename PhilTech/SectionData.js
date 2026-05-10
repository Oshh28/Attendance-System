// =====================================================
//   SectionData.js — MySQL Version (via PHP API)
//   PhilTech - GMA Attendance System
//   No Firebase. Uses fetch() to call api.php
// =====================================================

// =====================================================
//   EmailJS CONFIG (keep your keys)
// =====================================================
const EMAILJS_PUBLIC_KEY  = "ltyeVvxQDmJSvp32J";
const EMAILJS_SERVICE_ID  = "service_zcv7nd9";
const EMAILJS_TEMPLATE_ID = "template_zcm4qqi";

// =====================================================
//   API URL — points to your api.php file
//   If your folder is named differently, update this
// =====================================================
const API_URL = 'api.php';

// =====================================================
//   APP STATE
// =====================================================
let allStudents    = [];
let editingId      = null;  // null = Add mode, number = Edit mode
let deleteId       = null;
let activeDropdown = null;

// =====================================================
//   GET SECTION FROM URL
//   e.g. SectionData.html?section=BSOA%202M1
// =====================================================
const urlParams      = new URLSearchParams(window.location.search);
const currentSection = decodeURIComponent(urlParams.get('section') || 'BSCS 1M1');

// =====================================================
//   INIT — runs when page loads
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Page ready. Section:', currentSection);

    // Initialize EmailJS
    try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch(e) {}

    // Set section title in header
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = currentSection;

    // Pre-select section in form
    const secEl = document.getElementById('studentSection');
    if (secEl) secEl.value = currentSection;

    // Load students from MySQL
    loadStudents();

    // Search & filter listeners
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('genderFilter')?.addEventListener('change', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (window._modalJustOpened) return;
        if (!e.target.closest('.action-btn') && !e.target.closest('.dropdown-menu')) {
            closeAllDropdowns();
        }
    });

    // Close modals on overlay click
    document.addEventListener('click', (e) => {
        if (window._modalJustOpened) return;
        ['studentModal', 'successModal', 'deleteModal'].forEach(id => {
            const el = document.getElementById(id);
            if (e.target === el) closeModal(id);
        });
    });

    // Hamburger menu
    const hamburger  = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileMenu?.classList.toggle('open');
    });

    // Navbar scroll shadow
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) nav.style.boxShadow = window.scrollY > 10
            ? '0 4px 20px rgba(0,0,0,0.15)'
            : '0 2px 10px rgba(0,0,0,0.10)';
    });
});

// =====================================================
//   LOAD STUDENTS — fetch from MySQL via api.php
// =====================================================
async function loadStudents() {
    showLoading(true);
    try {
        // Call: api.php?action=get&section=BSCS 1M1
        const res  = await fetch(`${API_URL}?action=get&section=${encodeURIComponent(currentSection)}`);
        const data = await res.json();

        if (!data.success) {
            console.error('❌ Load error:', data.error);
            showLoading(false);
            return;
        }

        allStudents = data.students || [];
        console.log('📋 Loaded', allStudents.length, 'students from MySQL');
        showLoading(false);
        renderTable(allStudents);

    } catch (err) {
        console.error('❌ Fetch error:', err.message);
        showLoading(false);
        showErrorBanner('Cannot connect to server. Make sure XAMPP is running and api.php is in the same folder.');
    }
}

// =====================================================
//   COMPUTE ATTENDANCE FROM SCHEDULE
//
//   Rules:
//   1. Get the student's sem from their record
//   2. Fetch schedule for that section + sem + today's day
//   3. Find the EARLIEST class start time today
//   4. Compare student's timeIn with that start time:
//      - No timeIn yet              → Absent
//      - No class today             → Absent
//      - timeIn <= start + 15 mins  → Present
//      - timeIn >  start + 15 mins  → Late
//
//   Used by:
//   - saveStudent() when timeIn is recorded
//   - Gate Pass API when guard manually records entry
//   - scan.php when ESP32 scans QR
// =====================================================
async function computeAttendanceFromSchedule(section, sem, timeIn) {
    // Must have all three params
    if (!section || !sem || !timeIn || timeIn === '—') return 'Absent';

    const GRACE_MINS = 15;
    const days       = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const todayDay   = days[new Date().getDay()];

    try {
        const res  = await fetch(`schedule_api.php?action=get&section=${encodeURIComponent(section)}`);
        const text = await res.text();
        const data = JSON.parse(text);

        if (!data.success) {
            console.warn('Schedule fetch failed:', data.error);
            return 'Present'; // fallback: don't punish if schedule unavailable
        }

        // Get slots for this sem + today
        const semKey   = String(sem); // "1" or "2"
        const semData  = data.schedule?.[semKey] || data.schedule?.[parseInt(semKey)] || {};
        const daySlots = semData[todayDay] || {};
        const slotIds  = Object.keys(daySlots);

        console.log(`📅 Schedule check: ${section} Sem${sem} ${todayDay} → ${slotIds.length} slots`);

        if (slotIds.length === 0) {
            console.log('📅 No class today → Absent');
            return 'Absent';
        }

        // Sort slot IDs to get earliest (e.g. "7:00-8:00" < "9:00-10:00")
        slotIds.sort((a, b) => {
            const aStart = timeStrToMins(a.split('-')[0]);
            const bStart = timeStrToMins(b.split('-')[0]);
            return aStart - bStart;
        });

        const earliestStart = slotIds[0].split('-')[0]; // e.g. "11:15"
        const schedMins     = timeStrToMins(earliestStart);
        const studentMins   = timeStrToMins(timeIn);

        console.log(`📅 First class: ${earliestStart} (${schedMins} mins) | Student: ${timeIn} (${studentMins} mins) | Diff: ${studentMins - schedMins} mins`);

        if (studentMins <= schedMins + GRACE_MINS) {
            return 'Present';
        } else {
            return 'Late';
        }

    } catch (e) {
        console.warn('⚠️ computeAttendanceFromSchedule error:', e.message);
        return 'Present'; // fallback
    }
}

// =====================================================
//   TIME STRING → MINUTES
//   Handles: "7:00", "7:00 AM", "01:30 PM", "13:30"
// =====================================================
function timeStrToMins(timeStr) {
    if (!timeStr || timeStr === '—') return 9999;
    let str  = timeStr.trim().toUpperCase();
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    str = str.replace('AM','').replace('PM','').trim();
    const parts = str.split(':');
    let h = parseInt(parts[0]) || 0;
    let m = parseInt(parts[1]) || 0;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h  = 0;
    // If no AM/PM and hour < 7 → assume PM (afternoon class)
    if (!isPM && !isAM && h > 0 && h < 7) h += 12;
    return h * 60 + m;
}

// =====================================================
//   RENDER TABLE
// =====================================================
function renderTable(students) {
    const tbody   = document.getElementById('studentTableBody');
    const emptyEl = document.getElementById('emptyState');
    const countEl = document.getElementById('studentCount');

    if (countEl) countEl.textContent = students.length;

    if (students.length === 0) {
        if (tbody)   tbody.innerHTML       = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    tbody.innerHTML = students.map((s, index) => {
        // Build full name
        const middle  = s.middleName ? s.middleName[0] + '.' : '';
        const fullName = [s.firstName, middle, s.lastName].filter(Boolean).join(' ');

        // Avatar
        const avatarHtml = s.photoBase64
            ? `<img src="${s.photoBase64}" alt="${fullName}">`
            : `<i class="fa-solid fa-user"></i>`;

        const statusClass = getStatusClass(s.status);
        // Escape single quotes in name for onclick attribute
        const safeName = fullName.replace(/'/g, "\\'");

        // Attendance badge class
        const attClass = getAttendanceClass(s.attendance);
        const semLabel = s.sem == '1' ? '1st Sem' : s.sem == '2' ? '2nd Sem' : '—';

        return `
        <tr id="row-${s.id}">
            <td><input type="checkbox" class="row-check" data-id="${s.id}"></td>
            <td>${index + 1}</td>
            <td class="student-id-cell">${s.studentNo || '—'}</td>
            <td>
                <div class="student-cell">
                    <div class="student-avatar">${avatarHtml}</div>
                    <span class="student-name">${fullName}</span>
                </div>
            </td>
            <td>${s.gender || '—'}</td>
            <td><span class="${attClass}">${s.attendance || 'Absent'}</span></td>
            <td>${s.timeIn  || '—'}</td>
            <td>${s.timeOut || '—'}</td>
            <td><span class="status-badge ${statusClass}">${s.status || '—'}</span></td>
            <td><span class="sem-badge">${semLabel}</span></td>
            <td style="position:relative;">
                <button class="action-btn" onclick="toggleDropdown(event, ${s.id})" type="button">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
                <div class="dropdown-menu" id="dropdown-${s.id}">
                    <button class="dropdown-item" onclick="openEditModal(${s.id})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="dropdown-item" onclick="viewQR(${s.id})">
                        <i class="fa-solid fa-qrcode"></i> View QR
                    </button>
                    <button class="dropdown-item" onclick="resendQR(${s.id})">
                        <i class="fa-solid fa-envelope"></i> Resend QR
                    </button>
                    <button class="dropdown-item danger" onclick="openDeleteModal(${s.id}, '${safeName}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
//   STATUS CSS CLASS HELPER
// =====================================================
function getStatusClass(status) {
    switch ((status || '').toUpperCase()) {
        case 'ENROLLED':  return 'status-enrolled';
        case 'IRREGULAR': return 'status-irregular';
        case 'DROPPED':   return 'status-dropped';
        default:          return 'status-enrolled';
    }
}

// =====================================================
//   ATTENDANCE CSS CLASS HELPER
// =====================================================
function getAttendanceClass(att) {
    switch ((att || '').toLowerCase()) {
        case 'present': return 'badge-present';
        case 'late':    return 'badge-late';
        case 'absent':  return 'badge-absent';
        default:        return 'badge-absent';
    }
}

// =====================================================
//   SHOW / HIDE LOADING
// =====================================================
function showLoading(show) {
    const el = document.getElementById('loadingState');
    if (el) el.style.display = show ? 'flex' : 'none';
}

// =====================================================
//   SEARCH & FILTER (client-side, already loaded data)
// =====================================================
function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const gender = document.getElementById('genderFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';

    const filtered = allStudents.filter(s => {
        const name  = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
        const okSearch = !search || name.includes(search) || (s.email || '').toLowerCase().includes(search);
        const okGender = !gender || s.gender === gender;
        const okStatus = !status || (s.status || '').toUpperCase() === status.toUpperCase();
        return okSearch && okGender && okStatus;
    });

    renderTable(filtered);
}

function clearFilters() {
    const s = document.getElementById('searchInput');
    const g = document.getElementById('genderFilter');
    const f = document.getElementById('statusFilter');
    if (s) s.value = '';
    if (g) g.value = '';
    if (f) f.value = '';
    renderTable(allStudents);
}

// =====================================================
//   SELECT ALL CHECKBOX
// =====================================================
function toggleSelectAll(cb) {
    document.querySelectorAll('.row-check').forEach(c => c.checked = cb.checked);
}

// =====================================================
//   DROPDOWN MENU
// =====================================================
function toggleDropdown(event, studentId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${studentId}`);
    if (!dropdown) return;

    if (activeDropdown && activeDropdown !== dropdown) {
        activeDropdown.classList.remove('open');
    }
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open');
    activeDropdown = !isOpen ? dropdown : null;

    if (!isOpen) {
        const rect = btn.getBoundingClientRect();
        dropdown.style.top  = (rect.bottom + 4) + 'px';
        dropdown.style.left = (rect.right - 160) + 'px';
        setTimeout(() => {
            const dr = dropdown.getBoundingClientRect();
            if (dr.right > window.innerWidth) dropdown.style.left = (window.innerWidth - dr.width - 8) + 'px';
            if (dr.bottom > window.innerHeight) dropdown.style.top = (rect.top - dr.height - 4) + 'px';
        }, 0);
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('open'));
    activeDropdown = null;
}

// =====================================================
//   MARK TIME IN — with schedule comparison
//   Called from dropdown "Mark Time In"
// =====================================================
async function markTimeIn(studentId) {
    closeAllDropdowns();
    const s = allStudents.find(x => String(x.id) === String(studentId));
    if (!s) return;

    // Get current time as time string e.g. "09:30 AM"
    const now  = new Date();
    const h    = now.getHours();
    const m    = now.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    const timeIn = `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;

    // Compute attendance: compare with schedule
    const attendance = await computeAttendanceFromSchedule(s.section, s.sem, timeIn);

    console.log(`⏱ Marking Time In: ${s.firstName} ${s.lastName} | ${timeIn} | Result: ${attendance}`);

    // Save to database
    try {
        const res  = await fetch(`${API_URL}?action=timein&id=${studentId}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ timeIn, attendance })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // Update local array immediately
        const idx = allStudents.findIndex(x => String(x.id) === String(studentId));
        if (idx !== -1) {
            allStudents[idx].timeIn     = timeIn;
            allStudents[idx].attendance = attendance;
        }
        renderTable(allStudents);

        // Show toast
        showToast(`${s.firstName} ${s.lastName} → ${attendance} (${timeIn})`);

    } catch (e) {
        console.error('Time In error:', e.message);
        alert('Error recording time in: ' + e.message);
    }
}

// Simple toast notification
function showToast(msg) {
    const existing = document.getElementById('attToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'attToast';
    toast.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        background:#1a1a1a; color:white; padding:12px 22px; border-radius:50px;
        font-size:13px; font-weight:600; z-index:9999; white-space:nowrap;
        box-shadow:0 4px 16px rgba(0,0,0,0.25); animation:fadeInUp 0.3s ease;
    `;
    toast.textContent = `✅ ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// =====================================================
//   OPEN ADD MODAL
// =====================================================
function openAddModal() {
    editingId = null;
    clearForm();
    setEl('modalTitle', 'Add Student', true);
    setEl('saveBtn',    'Save',        true);

    // ✅ Auto-fill section based on current page's section
    const secEl = document.getElementById('studentSection');
    if (secEl) secEl.value = currentSection;

    // ✅ Auto-select current school year
    const now = new Date();
    const month = now.getMonth(); // 0=Jan, 5=Jun, 6=Jul
    // School year starts June/July — if past June, use current-next, else prev-current
    const startYear = month >= 5 ? now.getFullYear() : now.getFullYear() - 1;
    const defaultSY = `${startYear}-${startYear + 1}`;
    const syEl = document.getElementById('schoolYear');
    if (syEl) syEl.value = defaultSY;

    openModal('studentModal');
}

// =====================================================
//   OPEN EDIT MODAL
// =====================================================
function openEditModal(studentId) {
    closeAllDropdowns();
    const s = allStudents.find(x => String(x.id) === String(studentId));
    if (!s) return;

    editingId = s.id;

    setEl('firstName',      s.firstName    || '');
    setEl('lastName',       s.lastName     || '');
    setEl('middleName',     s.middleName   || '');
    setEl('emailAddress',   s.email        || '');
    setEl('schoolYear',     s.schoolYear   || '');
    setEl('studentSection', s.section      || currentSection);
    setEl('studentStatus',  s.status       || '');
    setEl('studentSem',     s.sem          || '');

    document.querySelectorAll('input[name="gender"]').forEach(r => {
        r.checked = r.value === s.gender;
    });

    if (s.photoBase64) {
        const prev = document.getElementById('photoPreview');
        const ph   = document.getElementById('photoPlaceholder');
        if (prev) { prev.src = s.photoBase64; prev.style.display = 'block'; }
        if (ph)   { ph.style.display = 'none'; }
    }

    setEl('modalTitle', 'Edit Student', true);
    setEl('saveBtn',    'Update',       true);
    openModal('studentModal');
}

// =====================================================
//   SAVE STUDENT (Add or Update)
// =====================================================
async function saveStudent() {
    // Read form values
    const studentNo  = document.getElementById('studentNo')?.value.trim()  || '';
    const firstName  = document.getElementById('firstName')?.value.trim()  || '';
    const lastName   = document.getElementById('lastName')?.value.trim()   || '';
    const middleName = document.getElementById('middleName')?.value.trim() || '';
    const email      = document.getElementById('emailAddress')?.value.trim() || '';
    const gender     = document.querySelector('input[name="gender"]:checked')?.value || 'Male';
    const section    = document.getElementById('studentSection')?.value    || '';
    const schoolYear = document.getElementById('schoolYear')?.value        || '';
    const status     = document.getElementById('studentStatus')?.value     || '';
    const sem        = document.getElementById('studentSem')?.value        || '';
    const preview    = document.getElementById('photoPreview');
    const hasPhoto   = preview && preview.style.display !== 'none'
                       && preview.src && !preview.src.endsWith('.html');
    const photoBase64 = hasPhoto ? preview.src : '';

    // --- Validation ---
    if (!firstName || !lastName) { showFormError('First name and last name are required.'); return; }
    if (!email)                  { showFormError('Email address is required.');             return; }
    if (!section)                { showFormError('Please select a section.');               return; }
    if (!status)                 { showFormError('Please select a status.');                return; }
    if (!sem)                    { showFormError('Please select a semester.');              return; }

    showFormError('');

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = editingId ? 'Updating...' : 'Saving...'; }

    const payload = { studentNo, firstName, lastName, middleName, email, gender, section, schoolYear, status, sem, photoBase64 };

    try {
        let url, res, data;

        if (editingId) {
            // ── UPDATE ──
            url  = `${API_URL}?action=update&id=${editingId}`;
            res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            data = await res.json();

            if (!data.success) throw new Error(data.error || 'Update failed');

            // Update local array so table refreshes instantly without re-fetching
            const idx = allStudents.findIndex(x => String(x.id) === String(editingId));
            if (idx !== -1) allStudents[idx] = { ...allStudents[idx], ...payload };

            window._modalJustOpened = true;
            closeModal('studentModal');
            setTimeout(() => {
                showSuccess('Successfully Updated', 'The student information has been successfully updated.', false);
                setTimeout(() => { window._modalJustOpened = false; }, 300);
            }, 50);

            renderTable(allStudents); // refresh table immediately

        } else {
            // ── ADD NEW ──
            url  = `${API_URL}?action=add`;
            res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            data = await res.json();

            if (!data.success) throw new Error(data.error || 'Add failed');

            const newId = data.id;
            console.log('✅ Student saved to MySQL with ID:', newId);

            // Add to local array immediately
            allStudents.push({ id: newId, ...payload, attendance: 'Absent', timeIn: '—', timeOut: '—' });
            renderTable(allStudents);

            // Show success modal RIGHT AWAY
            window._modalJustOpened = true;
            closeModal('studentModal');
            setTimeout(() => {
                showSuccess(
                    'Successfully Added',
                    'The student information has been successfully added. A QR Code has been generated and sent to the registered email address.',
                    true
                );
                setTimeout(() => { window._modalJustOpened = false; }, 300);
            }, 50);

            // QR + Email in background
            generateQRCode(JSON.stringify({ id: newId, name: `${firstName} ${lastName}`, section, status }))
                .then(qrImage => sendQREmail(email, `${firstName} ${lastName}`, qrImage))
                .then(() => console.log('📧 QR email sent'))
                .catch(e  => console.warn('⚠️ QR/Email error:', e.message));
        }

    } catch (err) {
        console.error('❌ Save error:', err.message);
        showFormError('Error: ' + err.message);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editingId ? 'Update' : 'Save'; }
    }
}

// =====================================================
//   GENERATE QR CODE
// =====================================================
function generateQRCode(data) {
    return new Promise((resolve) => {
        const container = document.getElementById('qrCodeOutput');
        if (!container) { resolve(''); return; }
        container.innerHTML = '';

        new QRCode(container, {
            text: data, width: 256, height: 256,
            colorDark: '#000000', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        setTimeout(() => {
            const img = container.querySelector('img');
            resolve(img ? img.src : '');
        }, 500);
    });
}

// =====================================================
//   SEND QR EMAIL via EmailJS
//   
//   ⚠️  EMAILJS TEMPLATE SETUP (important!):
//   In your EmailJS template, set it up like this:
//
//   Subject: Your PhilTech QR Code - {{student_name}}
//
//   Body (HTML must be ON in EmailJS template settings):
//   <p>Hello <b>{{student_name}}</b>!</p>
//   <p>Your QR Code for <b>{{section}}</b> at <b>{{school}}</b> is ready.</p>
//   <img src="{{qr_image}}" width="200" height="200" style="display:block;margin:16px 0;">
//   <p>Present this QR Code when checking your attendance.</p>
//   <p>Thank you!</p>
//
//   ✅ Make sure "Content type" is set to HTML (not Text) in your template!
// =====================================================
async function sendQREmail(toEmail, studentName, qrImage) {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:     toEmail,
        student_name: studentName,
        section:      currentSection,
        school:       'PhilTech - GMA',
        qr_image:     qrImage   // This is the base64 image — used as <img src="{{qr_image}}"> in template
    });
}

// =====================================================
//   VIEW QR
// =====================================================
async function viewQR(studentId) {
    closeAllDropdowns();
    const s = allStudents.find(x => String(x.id) === String(studentId));
    if (!s) return;

    const name    = `${s.firstName} ${s.lastName}`;
    const qrImage = await generateQRCode(JSON.stringify({ id: s.id, name, section: s.section, status: s.status }));

    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to view QR.'); return; }
    w.document.write(`
        <html><head><title>QR - ${name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;800&display=swap" rel="stylesheet">
        </head><body style="margin:0;display:flex;align-items:center;justify-content:center;
        min-height:100vh;background:#f5f5f5;font-family:Poppins,sans-serif;">
        <div style="background:white;padding:36px;border-radius:16px;
        box-shadow:0 4px 24px rgba(0,0,0,.1);text-align:center;max-width:320px;">
        <div style="background:#D32F2F;color:white;padding:12px 20px;border-radius:8px;
        margin-bottom:24px;font-weight:800;font-size:15px;letter-spacing:1px;">PhilTech - GMA</div>
        <img src="${qrImage}" style="width:220px;height:220px;display:block;margin:0 auto 18px;">
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;">${name}</h2>
        <p style="margin:0;color:#888;font-size:13px;">${s.section} · ${s.status}</p>
        </div></body></html>
    `);
}

// =====================================================
//   RESEND QR
// =====================================================
async function resendQR(studentId) {
    closeAllDropdowns();
    const s = allStudents.find(x => String(x.id) === String(studentId));
    if (!s) return;
    const name    = `${s.firstName} ${s.lastName}`;
    const qrImage = await generateQRCode(JSON.stringify({ id: s.id, name, section: s.section, status: s.status }));
    try {
        await sendQREmail(s.email, name, qrImage);
        alert(`✅ QR Code resent to ${s.email}`);
    } catch (e) {
        alert(`❌ Email failed: ${e.message}`);
    }
}

// =====================================================
//   DELETE STUDENT
// =====================================================
function openDeleteModal(studentId, studentName) {
    closeAllDropdowns();
    deleteId = studentId;
    const nameEl = document.getElementById('deleteStudentName');
    if (nameEl) nameEl.textContent = studentName;
    document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
    openModal('deleteModal');
}

async function confirmDelete() {
    if (!deleteId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    if (btn) { btn.textContent = 'Deleting...'; btn.disabled = true; }

    try {
        const res  = await fetch(`${API_URL}?action=delete&id=${deleteId}`, { method: 'POST' });
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        // Remove from local array instantly
        allStudents = allStudents.filter(s => String(s.id) !== String(deleteId));
        renderTable(allStudents);
        closeModal('deleteModal');
        deleteId = null;

    } catch (err) {
        console.error('❌ Delete error:', err.message);
        if (btn) { btn.textContent = 'Delete'; btn.disabled = false; }
    }
}

// =====================================================
//   SUCCESS MODAL
// =====================================================
function showSuccess(title, msg, showEmailNote) {
    setEl('successTitle', title, true);
    setEl('successMsg',   msg,   true);
    const noteEl = document.getElementById('successNote');
    if (noteEl) noteEl.style.display = showEmailNote ? 'block' : 'none';
    openModal('successModal');
    console.log('🎉 Success:', title);
}

// =====================================================
//   MODAL OPEN / CLOSE
// =====================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

// =====================================================
//   CLEAR FORM
// =====================================================
function clearForm() {
    ['studentNo','firstName','lastName','middleName','emailAddress'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    setEl('studentStatus',  '');
    setEl('studentSem',     '');
    setEl('studentSection', currentSection);
    setEl('schoolYear',     '');
    showFormError('');
    const maleRadio = document.querySelector('input[name="gender"][value="Male"]');
    if (maleRadio) maleRadio.checked = true;
    const prev  = document.getElementById('photoPreview');
    const ph    = document.getElementById('photoPlaceholder');
    const input = document.getElementById('photoInput');
    if (prev)  { prev.src = ''; prev.style.display = 'none'; }
    if (ph)    { ph.style.display = 'flex'; }
    if (input) { input.value = ''; }
}

// =====================================================
//   PHOTO PREVIEW
// =====================================================
function previewPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const prev = document.getElementById('photoPreview');
        const ph   = document.getElementById('photoPlaceholder');
        if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
        if (ph)   { ph.style.display = 'none'; }
    };
    reader.readAsDataURL(file);
}

// =====================================================
//   HELPERS
// =====================================================
function setEl(id, value, isText = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isText) el.textContent = value;
    else        el.value       = value;
}

function showFormError(msg) {
    const el = document.getElementById('formError');
    if (el) el.textContent = msg;
}

function showErrorBanner(msg) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#ffebee;border:1px solid #ef9a9a;color:#c62828;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;';
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
    document.querySelector('.students-container')?.prepend(banner);
}