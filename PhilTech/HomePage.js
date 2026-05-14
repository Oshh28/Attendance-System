// =====================================================
//   PhilTech - GMA | HomePage.js
// =====================================================

const hamburger    = document.getElementById('hamburger');
const mobileMenu   = document.getElementById('mobileMenu');
const tabBtns      = document.querySelectorAll('.tab-btn');
const sectionCards = document.querySelectorAll('.section-card');
const navbar       = document.getElementById('navbar');

// ===== HAMBURGER =====
hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(function (link) {
    link.addEventListener('click', function () {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
    });
});

// ===== COURSE TAB FILTER =====
tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var selectedCourse = btn.getAttribute('data-course');

        sectionCards.forEach(function (card) {
            var cardCourse = card.getAttribute('data-course');
            card.classList.remove('highlighted', 'dimmed');
            if (cardCourse === selectedCourse) {
                card.classList.add('highlighted');
            } else {
                card.classList.add('dimmed');
            }
        });
    });
});

// ===== SECTION CARD CLICK → Go to SectionData.html =====
sectionCards.forEach(function (card) {
    card.addEventListener('click', function () {
        var code = card.querySelector('.section-code').textContent.trim();
        // Navigate to SectionData.html with the section as URL param
        window.location.href = 'SectionData.html?section=' + encodeURIComponent(code);
    });
});

// ===== NAVBAR SCROLL SHADOW =====
window.addEventListener('scroll', function () {
    if (window.scrollY > 10) {
        navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.10)';
    }
});