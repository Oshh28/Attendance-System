// =====================================================
//   PhilTech - GMA | AttendanceHistory.js
//   Weekly attendance history per student per subject
// =====================================================

const HISTORY_API = 'attendance_history_api.php';

let allRows = []; // all loaded rows from server

// =====================================================
//   INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Default week = current week
    const now  = new Date();
    const week = getWeekString(now);
    document.getElementById('filterWeek').value = week;

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

    // Auto-load if section is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const section   = urlParams.get('section');
    if (section) {
        document.getElementById('filterSection').value = section;
        document.getElementById('historySection').textContent = section;
    }

    loadHistory();
});

// =====================================================
//   GET WEEK STRING FOR INPUT[TYPE=WEEK]
//   Returns "2025-W20" format
// =====================================================
function getWeekString(date) {
    const d    = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day  = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const year = d.getUTCFullYear();
    const week = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

// =====================================================
//   LOAD HISTORY FROM SERVER
// =====================================================
async function loadHistory() {
    const section    = document.getElementById('filterSection').value;
    const weekValue  = document.getElementById('filterWeek').value; // "2025-W20"

    // Update section label
    document.getElementById('historySection').textContent = section || 'All Sections';

    // Show loading
    document.getElementById('historyLoading').style.display = 'flex';
    document.getElementById('historyBody').innerHTML        = '';

    // Build query params
    const params = new URLSearchParams({ action: 'get' });
    if (section)   params.append('section', section);
    if (weekValue) params.append('week', weekValue);

    try {
        const res  = await fetch(`${HISTORY_API}?${params.toString()}`);
        const text = await res.text();
        const data = JSON.parse(text);

        if (!data.success) {
            console.error('History load error:', data.error);
            showEmpty('Could not load history. ' + (data.error || ''));
            return;
        }

        allRows = data.records || [];
        renderTable(allRows);
        updateSummary(allRows);

    } catch (e) {
        console.error('Fetch error:', e.message);
        showEmpty('Cannot connect to server. Make sure XAMPP is running.');
    } finally {
        document.getElementById('historyLoading').style.display = 'none';
    }
}

// =====================================================
//   RENDER TABLE
// =====================================================
function renderTable(rows) {
    const tbody = document.getElementById('historyBody');

    if (rows.length === 0) {
        showEmpty('No attendance records found for this period.');
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const attClass = getAttClass(r.attendance);
        const timeIn   = r.time_in  && r.time_in  !== '—' ? `<span class="time-cell">${r.time_in}</span>`  : '<span style="color:#ccc;">—</span>';
        const timeOut  = r.time_out && r.time_out !== '—' ? `<span class="time-cell">${r.time_out}</span>` : '<span style="color:#ccc;">—</span>';

        return `
        <tr>
            <td class="date-cell">${formatDate(r.date)}</td>
            <td class="day-cell">${r.day_name}</td>
            <td>${r.student_name}</td>
            <td>${r.section}</td>
            <td>
                <span style="font-weight:600;">${r.subject_code || '—'}</span>
                ${r.subject_title ? `<br><span style="font-size:11px;color:#9E9E9E;">${r.subject_title}</span>` : ''}
            </td>
            <td>${timeIn}</td>
            <td>${timeOut}</td>
            <td><span class="att-badge ${attClass}">${r.attendance}</span></td>
        </tr>`;
    }).join('');
}

// =====================================================
//   CLIENT-SIDE FILTER (student name + attendance)
// =====================================================
function filterTable() {
    const nameFilter = document.getElementById('filterStudent').value.toLowerCase().trim();
    const attFilter  = document.getElementById('filterAttendance').value;

    const filtered = allRows.filter(r => {
        const nameMatch = !nameFilter || r.student_name.toLowerCase().includes(nameFilter);
        const attMatch  = !attFilter  || r.attendance === attFilter;
        return nameMatch && attMatch;
    });

    renderTable(filtered);
    updateSummary(filtered);
}

// =====================================================
//   UPDATE SUMMARY CARDS
// =====================================================
function updateSummary(rows) {
    const counts = { Present: 0, Late: 0, Absent: 0, 'No Class': 0 };
    rows.forEach(r => {
        if (counts.hasOwnProperty(r.attendance)) counts[r.attendance]++;
    });

    document.getElementById('countPresent').textContent = counts['Present'];
    document.getElementById('countLate').textContent    = counts['Late'];
    document.getElementById('countAbsent').textContent  = counts['Absent'];
    document.getElementById('countNoClass').textContent = counts['No Class'];
}

// =====================================================
//   TRIGGER DAILY RESET MANUALLY
// =====================================================
async function triggerReset() {
    if (!confirm('Run daily reset now?\n\nThis will:\n✅ Save today\'s attendance to history\n🔄 Reset all Time In/Out/Attendance for tomorrow\n\nContinue?')) return;

    const btn = document.querySelector('.btn-reset');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';
    btn.disabled  = true;

    try {
        const res  = await fetch('daily_reset.php');
        const data = await res.json();

        if (data.success) {
            alert(`✅ Reset complete!\nSaved: ${data.saved} records\nDate: ${data.date}`);
            loadHistory(); // Refresh table
        } else {
            alert('❌ Reset failed: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('❌ Error: ' + e.message);
    }

    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Reset Today';
    btn.disabled  = false;
}

// =====================================================
//   HELPERS
// =====================================================
function getAttClass(att) {
    switch (att) {
        case 'Present':  return 'att-present';
        case 'Late':     return 'att-late';
        case 'Absent':   return 'att-absent';
        case 'No Class': return 'att-noclass';
        case 'Time Out': return 'att-timeout';
        default:         return 'att-absent';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showEmpty(msg) {
    document.getElementById('historyBody').innerHTML = `
        <tr>
            <td colspan="8" class="history-empty">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <p>${msg}</p>
            </td>
        </tr>`;
    updateSummary([]);
}