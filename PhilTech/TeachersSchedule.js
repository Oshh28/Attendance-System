// =====================================================
//   PhilTech - GMA | TeacherSchedule.js
//   Teacher weekly schedule — same grid as section schedule
//   Edit modal: Sub Code, Room, Section, Sidebar Colour only
// =====================================================

const API_SCHED = 'schedule_api.php'; // reuse same API, but teacher_id scoped

// =====================================================
//   TIME SLOTS (same as Schedule.js)
// =====================================================
const TIME_SLOTS = [
    { id: '7:00-8:00',    label: '7:00 AM\n8:00 AM',      period: 'morning'   },
    { id: '8:00-8:45',    label: '8:00 AM\n8:45 AM',      period: 'morning'   },
    { id: '8:45-9:00',    label: '',  period: 'break', breakLabel: 'BREAK TIME',  breakTime: '8:45 – 9:00 AM'  },
    { id: '9:00-10:00',   label: '9:00 AM\n10:00 AM',     period: 'morning'   },
    { id: '10:00-10:45',  label: '10:00 AM\n10:45 AM',    period: 'morning'   },
    { id: '10:45-11:15',  label: '',  period: 'break', breakLabel: 'LUNCH BREAK', breakTime: '10:45 AM – 11:15 AM' },
    { id: '11:15-1:00',   label: '11:15 AM\n1:00 PM',     period: 'afternoon' },
    { id: '1:00-2:45',    label: '1:00 PM\n2:45 PM',      period: 'afternoon' },
    { id: '2:45-3:00',    label: '',  period: 'break', breakLabel: 'BREAK TIME',  breakTime: '2:45 – 3:00 PM'  },
    { id: '3:00-4:00',    label: '3:00 PM\n4:00 PM',      period: 'afternoon' },
    { id: '4:00-4:45',    label: '4:00 PM\n4:45 PM',      period: 'afternoon' },
    { id: '4:45-5:15',    label: '',  period: 'break', breakLabel: 'BREAK TIME',  breakTime: '4:45 – 5:15 PM'  },
    { id: '5:15-6:00',    label: '5:15 PM\n6:00 PM',      period: 'afternoon' },
    { id: '6:00-7:00',    label: '6:00 PM\n7:00 PM',      period: 'afternoon' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ROOMS = [
    '401 Main', '402 Main', '403 Main', '404 Main', '405 Main',
    '406 Main', '407 Main', '408 Main', '409 Main', '410 Main',
    '101 Annex', '102 Annex', '103 Annex', '104 Annex',
    '201 Annex', '202 Annex', '203 Annex', '204 Annex', '205 Annex',
    'ComLab1', 'ComLab2', 'Library', 'FBS', 'TBA', 'Online'
];

const SECTIONS = [
    'BSCS 1M1','BSCS 2M1','BSCS 3M1','BSCS 4M1',
    'BSOA 1M1','BSOA 2M1','BSOA 3M1','BSOA 4M1',
    'BTVTEd 1M1','BTVTEd 2M1','BTVTEd 3M1','BTVTEd 4M1'
];

// =====================================================
//   STATE
// =====================================================
const urlParams   = new URLSearchParams(window.location.search);
const teacherId   = urlParams.get('id')   || '';
const teacherName = decodeURIComponent(urlParams.get('name') || 'Teacher');

let currentSem    = 1;
let currentDay    = '';
let scheduleData  = {};

// =====================================================
//   INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Set teacher name as page title
    const titleEl = document.getElementById('teacherNameTitle');
    if (titleEl) titleEl.textContent = teacherName;

    // Hamburger
    const hamburger  = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileMenu?.classList.toggle('open');
    });

    // Navbar shadow on scroll
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) nav.style.boxShadow = window.scrollY > 10
            ? '0 4px 20px rgba(0,0,0,0.15)'
            : '0 2px 10px rgba(0,0,0,0.10)';
    });

    // Close edit modal on overlay click
    document.getElementById('editModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('editModal')) closeEditModal();
    });

    loadSchedule();
});

// =====================================================
//   LOAD SCHEDULE FROM SERVER (teacher-scoped)
// =====================================================
async function loadSchedule() {
    try {
        // Use teacher_id as the "section" key so data is separate per teacher
        const key  = `teacher_${teacherId}`;
        const res  = await fetch(`${API_SCHED}?action=get&section=${encodeURIComponent(key)}`);
        const data = await res.json();
        if (data.success) scheduleData = data.schedule || {};
    } catch (e) {
        console.warn('⚠️ Could not load teacher schedule:', e.message);
        scheduleData = {};
    }
    renderGrid();
}

// =====================================================
//   SWITCH SEMESTER
// =====================================================
function switchSem(sem, btn) {
    currentSem = sem;
    document.querySelectorAll('.sem-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderGrid();
}

// =====================================================
//   RENDER GRID
// =====================================================
function renderGrid() {
    const grid    = document.getElementById('schedGrid');
    const semData = scheduleData[currentSem] || {};
    let   html    = '';

    // Header row
    html += `<div class="grid-header-cell"></div>`;
    DAYS.forEach(day => {
        html += `
        <div class="grid-header-cell">
            <span>${day}</span>
            <button class="edit-day-btn" onclick="openEditModal('${day}')" title="Edit ${day}">
                <i class="fa-solid fa-pen"></i>
            </button>
        </div>`;
    });

    // Slot rows
    TIME_SLOTS.forEach(slot => {
        if (slot.period === 'break') {
            html += `
            <div class="grid-break-row">
                ${slot.breakLabel}
                ${slot.breakTime ? `<span class="break-time-range">(${slot.breakTime})</span>` : ''}
            </div>`;
            return;
        }

        html += `<div class="grid-time-cell"><span class="grid-time-label">${slot.label}</span></div>`;

        DAYS.forEach(day => {
            const subj  = (semData[day] || {})[slot.id];
            if (subj && subj.subjectCode) {
                const color = subj.color || '#D32F2F';
                html += `
                <div class="grid-slot-cell">
                    <div class="subject-card" style="border-left-color:${color};">
                        <div class="subj-code">${subj.subjectCode}</div>
                        ${subj.section ? `<div class="subj-teacher">${subj.section}</div>` : ''}
                        ${subj.room    ? `<div class="subj-room">${subj.room}</div>` : ''}
                    </div>
                </div>`;
            } else {
                html += `<div class="grid-slot-cell"><div class="slot-empty"></div></div>`;
            }
        });
    });

    grid.innerHTML = html;
    renderLegend(semData);
}

// =====================================================
//   RENDER LEGEND TABLE
// =====================================================
function renderLegend(semData) {
    const legendEl = document.getElementById('subjectLegend');
    const subjects = {};

    Object.values(semData).forEach(daySlots => {
        Object.values(daySlots).forEach(slot => {
            if (slot?.subjectCode && !subjects[slot.subjectCode]) {
                subjects[slot.subjectCode] = {
                    code:    slot.subjectCode,
                    section: slot.section || '',
                    room:    slot.room    || ''
                };
            }
        });
    });

    const rows = Object.values(subjects);
    if (rows.length === 0) { legendEl.innerHTML = ''; return; }

    legendEl.innerHTML = `
    <table class="legend-table">
        <thead>
            <tr>
                <th>Subject Code</th>
                <th>Section</th>
                <th>Room</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(r => `
            <tr>
                <td class="legend-code">${r.code}</td>
                <td>${r.section || '—'}</td>
                <td>${r.room    || '—'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// =====================================================
//   OPEN EDIT MODAL
// =====================================================
function openEditModal(day) {
    currentDay = day;
    document.getElementById('editModalTitle').textContent = `${day} Schedule`;

    const daySlots = (scheduleData[currentSem] || {})[day] || {};
    renderEditSlots(daySlots);

    document.getElementById('editModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
    document.body.style.overflow = '';
}

// =====================================================
//   RENDER EDIT SLOTS — Teacher version
//   Only 4 fields: Subject Code, Room, Section, Sidebar Colour
// =====================================================
function renderEditSlots(daySlots) {
    const container    = document.getElementById('editSlotsContainer');
    const editableSlots = TIME_SLOTS.filter(s => s.period !== 'break');
    let   html          = '';
    let   lastPeriod    = '';

    editableSlots.forEach(slot => {
        const periodLabel = slot.period === 'morning' ? 'Morning Time' : 'Afternoon Time';
        if (slot.period !== lastPeriod) {
            html += `<div class="time-period-label">${periodLabel}</div>`;
            lastPeriod = slot.period;
        }

        const existing = daySlots[slot.id] || null;
        const hasSub   = existing && existing.subjectCode;
        const color     = existing?.color        || '#2196F3';
        const subjCode  = existing?.subjectCode  || '';
        const room      = existing?.room         || '';
        const section   = existing?.section      || '';
        const timeDisplay = slot.id.replace('-', ' - ');
        const safeId    = slot.id.replace(/[^a-z0-9]/gi, '_');

        html += `
        <div class="slot-row" id="slotRow_${safeId}">
            <div class="slot-time-row">
                <div class="slot-time-label">
                    <span style="font-size:12px;font-weight:600;color:#555;">${timeDisplay}</span>
                </div>
                <input class="slot-time-input" type="text" value="${timeDisplay} TIME" readonly>
                ${hasSub
                    ? `<button class="slot-toggle-btn remove-btn" onclick="toggleSlot('${slot.id}', false)">
                           <i class="fa-solid fa-minus"></i>
                       </button>`
                    : `<button class="slot-toggle-btn add-btn" onclick="toggleSlot('${slot.id}', true)">
                           <i class="fa-solid fa-plus"></i>
                       </button>`
                }
            </div>

            <div class="slot-subject-fields ${hasSub ? 'visible' : ''}" id="fields_${safeId}">
                <!-- Row 1: Subject Code + Room -->
                <div class="slot-fields-row">
                    <div class="slot-field-group">
                        <label>Subject Code</label>
                        <input type="text" placeholder="Enter Subject Code"
                               id="subj_${safeId}" value="${subjCode}">
                    </div>
                    <div class="slot-field-group">
                        <label>Room</label>
                        <select id="room_${safeId}">
                            <option value="">Select Room</option>
                            ${ROOMS.map(r => `<option value="${r}" ${r === room ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <!-- Row 2: Section + Sidebar Colour -->
                <div class="slot-fields-row" style="grid-template-columns: 1fr auto; align-items: end;">
                    <div class="slot-field-group">
                        <label>Section</label>
                        <select id="section_${safeId}">
                            <option value="">Select Section</option>
                            ${SECTIONS.map(s => `<option value="${s}" ${s === section ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="slot-field-group" style="align-items:center;">
                        <label style="text-align:center;font-size:10px;">Sidebar<br>Colour</label>
                        <input type="color" id="color_${safeId}" value="${color}"
                               style="width:40px;height:36px;border:1px solid #ddd;border-radius:7px;padding:2px;cursor:pointer;">
                    </div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// =====================================================
//   TOGGLE SLOT (add / remove)
// =====================================================
function toggleSlot(slotId, show) {
    const safeId   = slotId.replace(/[^a-z0-9]/gi, '_');
    const fieldsEl = document.getElementById(`fields_${safeId}`);
    const rowEl    = document.getElementById(`slotRow_${safeId}`);
    if (!fieldsEl || !rowEl) return;

    if (show) {
        fieldsEl.classList.add('visible');
        const btn = rowEl.querySelector('.slot-toggle-btn');
        if (btn) {
            btn.className = 'slot-toggle-btn remove-btn';
            btn.innerHTML = '<i class="fa-solid fa-minus"></i>';
            btn.setAttribute('onclick', `toggleSlot('${slotId}', false)`);
        }
    } else {
        fieldsEl.classList.remove('visible');
        [`subj_`, `room_`, `section_`].forEach(prefix => {
            const el = document.getElementById(`${prefix}${safeId}`);
            if (el) el.value = '';
        });
        const colorEl = document.getElementById(`color_${safeId}`);
        if (colorEl) colorEl.value = '#2196F3';

        const btn = rowEl.querySelector('.slot-toggle-btn');
        if (btn) {
            btn.className = 'slot-toggle-btn add-btn';
            btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            btn.setAttribute('onclick', `toggleSlot('${slotId}', true)`);
        }
    }
}

// =====================================================
//   SAVE SCHEDULE
// =====================================================
async function saveSchedule() {
    const btn     = document.getElementById('saveSchedBtn');
    const btnText = document.getElementById('saveBtnText');
    btn.disabled  = true;
    btnText.textContent = 'Saving...';

    const editableSlots = TIME_SLOTS.filter(s => s.period !== 'break');
    const dayData       = {};

    editableSlots.forEach(slot => {
        const safeId   = slot.id.replace(/[^a-z0-9]/gi, '_');
        const fieldsEl = document.getElementById(`fields_${safeId}`);
        if (!fieldsEl?.classList.contains('visible')) return;

        const subjectCode = document.getElementById(`subj_${safeId}`)?.value.trim()    || '';
        const room        = document.getElementById(`room_${safeId}`)?.value           || '';
        const section     = document.getElementById(`section_${safeId}`)?.value        || '';
        const color       = document.getElementById(`color_${safeId}`)?.value          || '#2196F3';

        if (subjectCode) {
            dayData[slot.id] = { subjectCode, room, section, color };
        }
    });

    // Update local state
    if (!scheduleData[currentSem])             scheduleData[currentSem]              = {};
    scheduleData[currentSem][currentDay] = dayData;

    // Save to server using teacher_id as the key
    try {
        const key = `teacher_${teacherId}`;
        const res = await fetch(`${API_SCHED}?action=save`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                section: key,
                sem:     currentSem,
                day:     currentDay,
                slots:   dayData
            })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        console.log('✅ Teacher schedule saved');
    } catch (e) {
        console.warn('⚠️ Save failed (saved locally):', e.message);
    }

    renderGrid();
    btn.disabled        = false;
    btnText.textContent = 'Save';
    closeEditModal();
}