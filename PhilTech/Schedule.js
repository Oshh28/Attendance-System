// =====================================================
//   PhilTech - GMA | Schedule.js
//   Schedule page — view, edit per day, save to MySQL
// =====================================================

// =====================================================
//   CONFIG
// =====================================================
const API_SCHED = 'schedule_api.php';   // PHP API for schedule

// =====================================================
//   STATE
// =====================================================
const urlParams      = new URLSearchParams(window.location.search);
const currentSection = decodeURIComponent(urlParams.get('section') || 'BSCS 1M1');
let   currentSem     = 1;
let   currentDay     = '';
let   scheduleData   = {};   // { sem: { day: { slot: { subjectCode, room, teacher, color } } } }

// =====================================================
//   TIME SLOT DEFINITIONS
//   Each slot has: id, label (display), period (morning/afternoon), breakRow
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
    // Main Building
    '401 Main', '402 Main', '403 Main', '404 Main', '405 Main',
    '406 Main', '407 Main', '408 Main', '409 Main', '410 Main',
    // Annex Building
    '101 Annex', '102 Annex', '103 Annex', '104 Annex',
    '201 Annex', '202 Annex', '203 Annex', '204 Annex', '205 Annex',
    // Labs & Special Rooms
    'ComLab1', 'ComLab2', 'Library', 'FBS',
    // Others
    'TBA', 'Online'
];

// =====================================================
//   INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Set section label
    document.getElementById('schedSectionLabel').textContent = currentSection;

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

    // Load schedule data
    loadSchedule();
});

// =====================================================
//   LOAD SCHEDULE FROM PHP/MySQL
// =====================================================
async function loadSchedule() {
    try {
        const url  = `${API_SCHED}?action=get&section=${encodeURIComponent(currentSection)}`;
        console.log('📅 Loading schedule from:', url);
        const res  = await fetch(url);
        const text = await res.text(); // Read as text first

        try {
            const data = JSON.parse(text);
            console.log('📅 Schedule data loaded:', data);
            if (data.success) {
                scheduleData = data.schedule || {};
            } else {
                console.warn('⚠️ Schedule API error:', data.error);
            }
        } catch (parseErr) {
            console.error('❌ Schedule API returned non-JSON:', text.substring(0, 200));
        }

    } catch (e) {
        console.warn('⚠️ Could not reach schedule_api.php:', e.message);
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
//   RENDER SCHEDULE GRID
// =====================================================
function renderGrid() {
    const grid = document.getElementById('schedGrid');

    // Safety check — if grid not found, stop
    if (!grid) {
        console.error('❌ schedGrid element not found!');
        return;
    }

    const semData = scheduleData[currentSem] || {};
    let   html    = '';

    // ── Header row ──────────────────────────────────
    // Empty top-left corner
    html += `<div class="grid-header-cell" style="border-bottom:2px solid #f0f0f0;"></div>`;

    DAYS.forEach(day => {
        html += `
        <div class="grid-header-cell">
            <span>${day}</span>
            <button class="edit-day-btn" onclick="openEditModal('${day}')" title="Edit ${day}">
                <i class="fa-solid fa-pen"></i>
            </button>
        </div>`;
    });

    // ── Slot rows ────────────────────────────────────
    TIME_SLOTS.forEach(slot => {

        if (slot.period === 'break') {
            // Full-width break row with time range
            html += `<div class="grid-break-row">
                ${slot.breakLabel}
                ${slot.breakTime ? `<span class="break-time-range">(${slot.breakTime})</span>` : ''}
            </div>`;
            return;
        }

        // Time label
        html += `
        <div class="grid-time-cell">
            <span class="grid-time-label">${slot.label}</span>
        </div>`;

        // Day columns
        DAYS.forEach(day => {
            const daySlots  = semData[day] || {};
            const subj      = daySlots[slot.id];

            if (subj && subj.subjectCode) {
                const color = subj.color || '#D32F2F';
                html += `
                <div class="grid-slot-cell">
                    <div class="subject-card" style="border-left-color:${color};">
                        <div class="subj-code">${subj.subjectCode}</div>
                        ${subj.teacher ? `<div class="subj-teacher">${subj.teacher}</div>` : ''}
                        ${subj.room    ? `<div class="subj-room">${subj.room}</div>`       : ''}
                    </div>
                </div>`;
            } else {
                html += `<div class="grid-slot-cell"><div class="slot-empty"></div></div>`;
            }
        });
    });

    grid.innerHTML = html;

    // Render legend
    renderLegend(semData);
}

// =====================================================
//   RENDER SUBJECT LEGEND TABLE
// =====================================================
function renderLegend(semData) {
    const legendEl = document.getElementById('subjectLegend');

    // Collect unique subjects
    const subjects = {};
    Object.values(semData).forEach(daySlots => {
        Object.values(daySlots).forEach(slot => {
            if (slot && slot.subjectCode && !subjects[slot.subjectCode]) {
                subjects[slot.subjectCode] = {
                    code:    slot.subjectCode,
                    title:   slot.subjectTitle || '',
                    units:   slot.units        || '',
                    teacher: slot.teacher      || ''
                };
            }
        });
    });

    const rows = Object.values(subjects);

    if (rows.length === 0) {
        legendEl.innerHTML = '';
        return;
    }

    let html = `
    <table class="legend-table">
        <thead>
            <tr>
                <th>Subject Code</th>
                <th>Subject Title</th>
                <th>Units</th>
                <th>Teacher</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(r => `
            <tr>
                <td class="legend-code">${r.code}</td>
                <td>${r.title   || '—'}</td>
                <td>${r.units   || '—'}</td>
                <td>${r.teacher || '—'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;

    legendEl.innerHTML = html;
}

// =====================================================
//   OPEN EDIT MODAL FOR A DAY
// =====================================================
function openEditModal(day) {
    currentDay = day;

    document.getElementById('editModalTitle').textContent = `${day} Schedule`;

    // Build slot rows
    const semData  = scheduleData[currentSem] || {};
    const daySlots = semData[day] || {};

    renderEditSlots(daySlots);

    document.getElementById('editModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
    document.body.style.overflow = '';
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('editModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('editModal')) closeEditModal();
    });
});

// =====================================================
//   RENDER EDIT SLOTS INSIDE MODAL
// =====================================================
function renderEditSlots(daySlots) {
    const container = document.getElementById('editSlotsContainer');
    let   html      = '';
    let   lastPeriod = '';

    // Filter out break rows for modal
    const editableSlots = TIME_SLOTS.filter(s => s.period !== 'break');

    editableSlots.forEach(slot => {
        // Period header
        const periodLabel = slot.period === 'morning' ? 'Morning Time' : 'Afternoon Time';
        if (slot.period !== lastPeriod) {
            html += `<div class="time-period-label">${periodLabel}</div>`;
            lastPeriod = slot.period;
        }

        const existing    = daySlots[slot.id] || null;
        const hasSub      = existing && existing.subjectCode;
        const color       = existing?.color   || '#2196F3';
        const subjCode    = existing?.subjectCode || '';
        const room        = existing?.room    || '';
        const teacher     = existing?.teacher || '';
        const subjTitle   = existing?.subjectTitle || '';
        const units       = existing?.units   || '';

        // Convert time label "7:00\n8:00" → "7:00 - 8:00 AM"
        const timeDisplay = slot.id.replace('-', ' - ');

        html += `
        <div class="slot-row" id="slotRow_${slot.id.replace(/[^a-z0-9]/gi,'_')}">
            <div class="slot-time-row">
                <div class="slot-time-label">
                    <span style="font-size:12px;font-weight:600;color:#555;">${timeDisplay}</span>
                </div>
                <input class="slot-time-input" type="text" value="${timeDisplay} TIME" readonly>
                ${hasSub
                    ? `<button class="slot-toggle-btn remove-btn" onclick="toggleSlot('${slot.id}', false)" title="Remove subject">
                           <i class="fa-solid fa-minus"></i>
                       </button>`
                    : `<button class="slot-toggle-btn add-btn" onclick="toggleSlot('${slot.id}', true)" title="Add subject">
                           <i class="fa-solid fa-plus"></i>
                       </button>`
                }
            </div>

            <!-- Subject fields (visible when slot has subject) -->
            <div class="slot-subject-fields ${hasSub ? 'visible' : ''}" id="fields_${slot.id.replace(/[^a-z0-9]/gi,'_')}">
                <div class="slot-fields-row">
                    <div class="slot-field-group">
                        <label>Subject Code</label>
                        <input type="text" placeholder="Enter Subject Code"
                               id="subj_${slot.id.replace(/[^a-z0-9]/gi,'_')}"
                               value="${subjCode}">
                    </div>
                    <div class="slot-field-group">
                        <label>Room</label>
                        <select id="room_${slot.id.replace(/[^a-z0-9]/gi,'_')}">
                            <option value="">Select Room</option>
                            ${ROOMS.map(r => `<option value="${r}" ${r === room ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="slot-fields-row" style="grid-template-columns:1fr auto;">
                    <div class="slot-field-group">
                        <label>Teacher</label>
                        <input type="text" placeholder="Enter the name of Teacher"
                               id="teacher_${slot.id.replace(/[^a-z0-9]/gi,'_')}"
                               value="${teacher}">
                    </div>
                    <div class="slot-field-group" style="align-items:center;justify-content:center;">
                        <label style="text-align:center;font-size:10px;">Sidebar<br>Colour</label>
                        <input type="color"
                               id="color_${slot.id.replace(/[^a-z0-9]/gi,'_')}"
                               value="${color}">
                    </div>
                </div>
                <div class="slot-fields-row">
                    <div class="slot-field-group">
                        <label>Subject Title</label>
                        <input type="text" placeholder="e.g. Object-Oriented Programming"
                               id="title_${slot.id.replace(/[^a-z0-9]/gi,'_')}"
                               value="${subjTitle}">
                    </div>
                    <div class="slot-field-group">
                        <label>Units</label>
                        <input type="number" placeholder="3" min="1" max="6"
                               id="units_${slot.id.replace(/[^a-z0-9]/gi,'_')}"
                               value="${units}">
                    </div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// =====================================================
//   TOGGLE SLOT (add / remove subject fields)
// =====================================================
function toggleSlot(slotId, show) {
    const safeId     = slotId.replace(/[^a-z0-9]/gi,'_');
    const fieldsEl   = document.getElementById(`fields_${safeId}`);
    const rowEl      = document.getElementById(`slotRow_${safeId}`);

    if (!fieldsEl || !rowEl) return;

    if (show) {
        // Show fields, replace + with -
        fieldsEl.classList.add('visible');
        const btn = rowEl.querySelector('.slot-toggle-btn');
        if (btn) {
            btn.className = 'slot-toggle-btn remove-btn';
            btn.title     = 'Remove subject';
            btn.innerHTML = '<i class="fa-solid fa-minus"></i>';
            btn.setAttribute('onclick', `toggleSlot('${slotId}', false)`);
        }
    } else {
        // Hide fields, replace - with +, clear inputs
        fieldsEl.classList.remove('visible');
        [`subj_`, `room_`, `teacher_`, `title_`, `units_`].forEach(prefix => {
            const el = document.getElementById(`${prefix}${safeId}`);
            if (el) el.value = '';
        });
        const colorEl = document.getElementById(`color_${safeId}`);
        if (colorEl) colorEl.value = '#2196F3';

        const btn = rowEl.querySelector('.slot-toggle-btn');
        if (btn) {
            btn.className = 'slot-toggle-btn add-btn';
            btn.title     = 'Add subject';
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

    // Collect slot data from modal
    const editableSlots = TIME_SLOTS.filter(s => s.period !== 'break');
    const dayData       = {};

    editableSlots.forEach(slot => {
        const safeId   = slot.id.replace(/[^a-z0-9]/gi,'_');
        const fieldsEl = document.getElementById(`fields_${safeId}`);
        const isVisible = fieldsEl?.classList.contains('visible');

        if (isVisible) {
            const subjectCode = document.getElementById(`subj_${safeId}`)?.value.trim()    || '';
            const room        = document.getElementById(`room_${safeId}`)?.value           || '';
            const teacher     = document.getElementById(`teacher_${safeId}`)?.value.trim() || '';
            const color       = document.getElementById(`color_${safeId}`)?.value          || '#2196F3';
            const subjectTitle = document.getElementById(`title_${safeId}`)?.value.trim() || '';
            const units       = document.getElementById(`units_${safeId}`)?.value          || '';

            if (subjectCode) {
                dayData[slot.id] = { subjectCode, room, teacher, color, subjectTitle, units };
            }
        }
    });

    // Update local state
    if (!scheduleData[currentSem])          scheduleData[currentSem]            = {};
    if (!scheduleData[currentSem][currentDay]) scheduleData[currentSem][currentDay] = {};
    scheduleData[currentSem][currentDay] = dayData;

    // Save to server
    try {
        const res = await fetch(`${API_SCHED}?action=save`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                section: currentSection,
                sem:     currentSem,
                day:     currentDay,
                slots:   dayData
            })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Save failed');
        console.log('✅ Schedule saved');
    } catch (e) {
        console.warn('⚠️ Server save failed (saved locally):', e.message);
    }

    // Re-render grid
    renderGrid();

    btn.disabled        = false;
    btnText.textContent = 'Save';
    closeEditModal();
}

// =====================================================
//   GO TO ATTENDANCE
// =====================================================
function goToAttendance() {
    window.location.href = `SectionData.html?section=${encodeURIComponent(currentSection)}`;
}