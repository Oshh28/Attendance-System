// =====================================================
//   PhilTech - GMA | Teachers.js
// =====================================================

const API_TEACHER = 'teachers_api.php';

let allTeachers = [];
let editingId   = null;
let deletingId  = null;

// =====================================================
//   INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    loadTeachers();

    const hamburger  = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileMenu?.classList.toggle('open');
    });

    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) nav.style.boxShadow = window.scrollY > 10
            ? '0 4px 20px rgba(0,0,0,0.15)'
            : '0 2px 10px rgba(0,0,0,0.10)';
    });

    // Close modals on overlay click
    document.addEventListener('click', (e) => {
        ['addTeacherModal', 'deleteTeacherModal'].forEach(id => {
            const el = document.getElementById(id);
            if (e.target === el) closeModal(id);
        });
        // Close all card dropdowns when clicking outside
        if (!e.target.closest('.teacher-card-action')) {
            closeAllCardMenus();
        }
    });
});

// =====================================================
//   LOAD TEACHERS
// =====================================================
async function loadTeachers() {
    try {
        const res  = await fetch(`${API_TEACHER}?action=get`);
        const data = await res.json();
        if (data.success) allTeachers = data.teachers || [];
    } catch (e) {
        console.warn('Could not load teachers:', e.message);
        allTeachers = [];
    }
    renderTeachers();
}

// =====================================================
//   RENDER TEACHERS
// =====================================================
function renderTeachers() {
    const males   = allTeachers.filter(t => t.gender === 'Male');
    const females = allTeachers.filter(t => t.gender === 'Female');

    renderGrid('maleTeachersGrid',   males);
    renderGrid('femaleTeachersGrid', females);

    document.getElementById('maleGroup').style.display   = males.length   === 0 ? 'none' : 'block';
    document.getElementById('femaleGroup').style.display = females.length === 0 ? 'none' : 'block';
}

function renderGrid(gridId, teachers) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (teachers.length === 0) {
        grid.innerHTML = `<div class="teachers-empty"><i class="fa-solid fa-user-slash"></i><br>No teachers added yet.</div>`;
        return;
    }

    grid.innerHTML = teachers.map(t => {
        const prefix   = t.gender === 'Female' ? 'Ms.' : 'Mr.';
        const fullName = `${prefix} ${t.firstName} ${t.lastName}`;
        const safeName = fullName.replace(/'/g, "\\'");
        const major    = t.major || '—';

        return `
        <div class="teacher-card" id="tcard-${t.id}">
            <!-- Click name to go to schedule -->
            <div class="teacher-card-info" onclick="goToSchedule(${t.id}, '${safeName}')">
                <div class="teacher-name">${fullName}</div>
                <div class="teacher-major">Major in ${major}</div>
            </div>
            <!-- 3-dot button (visible only on card hover) -->
            <div class="teacher-card-action">
                <button class="card-dots-btn"
                        onclick="event.stopPropagation(); toggleCardMenu(${t.id})"
                        title="Options">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <!-- Dropdown -->
                <div class="card-dropdown" id="cardMenu-${t.id}">
                    <button class="card-menu-item"
                            onclick="event.stopPropagation(); closeAllCardMenus(); goToSchedule(${t.id}, '${safeName}')">
                        <i class="fa-regular fa-calendar-days"></i> View Schedule
                    </button>
                    <button class="card-menu-item"
                            onclick="event.stopPropagation(); closeAllCardMenus(); openEditModal(${t.id})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="card-menu-item danger"
                            onclick="event.stopPropagation(); closeAllCardMenus(); openDeleteModal(${t.id}, '${safeName}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// =====================================================
//   3-DOT MENU HELPERS
// =====================================================
function toggleCardMenu(teacherId) {
    const menu   = document.getElementById(`cardMenu-${teacherId}`);
    const isOpen = menu.classList.contains('open');
    closeAllCardMenus();
    if (!isOpen) menu.classList.add('open');
}

function closeAllCardMenus() {
    document.querySelectorAll('.card-dropdown').forEach(m => m.classList.remove('open'));
}

// =====================================================
//   GO TO TEACHER SCHEDULE
// =====================================================
function goToSchedule(teacherId, teacherName) {
    window.location.href = `TeachersSchedule.html?id=${teacherId}&name=${encodeURIComponent(teacherName)}`;
}

// =====================================================
//   ADD MODAL
// =====================================================
function openAddModal() {
    editingId = null;
    clearForm();
    document.getElementById('addModalTitle').textContent       = 'Add Teacher';
    document.getElementById('teacherSaveBtnText').textContent  = 'Save';
    openModal('addTeacherModal');
}

function closeAddModal() { closeModal('addTeacherModal'); }

// =====================================================
//   EDIT MODAL
// =====================================================
function openEditModal(teacherId) {
    const t = allTeachers.find(x => String(x.id) === String(teacherId));
    if (!t) return;

    editingId = t.id;
    document.getElementById('teacherFirstName').value = t.firstName || '';
    document.getElementById('teacherLastName').value  = t.lastName  || '';
    document.getElementById('teacherMajor').value     = t.major     || '';
    document.getElementById('teacherEmail').value     = t.email     || '';

    document.querySelectorAll('input[name="teacherGender"]').forEach(r => {
        r.checked = r.value === t.gender;
    });

    document.getElementById('addModalTitle').textContent      = 'Edit Teacher';
    document.getElementById('teacherSaveBtnText').textContent = 'Update';
    openModal('addTeacherModal');
}

// =====================================================
//   SAVE TEACHER
// =====================================================
async function saveTeacher() {
    const firstName = document.getElementById('teacherFirstName').value.trim();
    const lastName  = document.getElementById('teacherLastName').value.trim();
    const gender    = document.querySelector('input[name="teacherGender"]:checked')?.value || 'Male';
    const major     = document.getElementById('teacherMajor').value.trim();
    const email     = document.getElementById('teacherEmail').value.trim();

    const errEl = document.getElementById('teacherFormError');
    if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; return; }
    errEl.textContent = '';

    const btn  = document.getElementById('teacherSaveBtn');
    const text = document.getElementById('teacherSaveBtnText');
    btn.disabled     = true;
    text.textContent = editingId ? 'Updating...' : 'Saving...';

    const payload = { firstName, lastName, gender, major, email };

    try {
        const action = editingId ? `update&id=${editingId}` : 'add';
        const res    = await fetch(`${API_TEACHER}?action=${action}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Save failed');

        closeModal('addTeacherModal');
        await loadTeachers();

    } catch (e) {
        errEl.textContent = 'Error: ' + e.message;
    }

    btn.disabled     = false;
    text.textContent = editingId ? 'Update' : 'Save';
}

// =====================================================
//   DELETE TEACHER
// =====================================================
function openDeleteModal(teacherId, teacherName) {
    deletingId = teacherId;
    document.getElementById('deleteTeacherName').textContent = teacherName;
    document.getElementById('confirmDeleteTeacher').onclick  = confirmDelete;
    openModal('deleteTeacherModal');
}

async function confirmDelete() {
    const btn = document.getElementById('confirmDeleteTeacher');
    btn.textContent = 'Deleting...';
    btn.disabled    = true;

    try {
        const res  = await fetch(`${API_TEACHER}?action=delete&id=${deletingId}`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        closeModal('deleteTeacherModal');
        await loadTeachers();
    } catch (e) {
        console.error('Delete error:', e);
    }

    btn.textContent = 'Delete';
    btn.disabled    = false;
}

// =====================================================
//   MODAL HELPERS
// =====================================================
function openModal(id) {
    document.getElementById(id)?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
    document.body.style.overflow = '';
}

function clearForm() {
    ['teacherFirstName','teacherLastName','teacherMajor','teacherEmail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('teacherFormError').textContent = '';
    const male = document.querySelector('input[name="teacherGender"][value="Male"]');
    if (male) male.checked = true;
}