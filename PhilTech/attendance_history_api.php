<?php
// =====================================================
//   attendance_history_api.php
//   PhilTech - GMA
//
//   GET attendance_history_api.php?action=get
//       &section=BSCS 2M1
//       &week=2025-W20
// =====================================================

ob_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) {
    ob_end_clean();
    echo json_encode(['success' => false, 'error' => 'db.php not found']);
    exit;
}
require_once $dbPath;

// Auto-create table if missing
$conn->query("CREATE TABLE IF NOT EXISTS attendance_history (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id   INT           NOT NULL,
    studentNo    VARCHAR(30)   DEFAULT '',
    student_name VARCHAR(200)  NOT NULL,
    section      VARCHAR(50)   NOT NULL,
    subject_code  VARCHAR(50)  DEFAULT '',
    subject_title VARCHAR(200) DEFAULT '',
    date         DATE          NOT NULL,
    day_name     VARCHAR(20)   DEFAULT '',
    time_in      VARCHAR(20)   DEFAULT '—',
    time_out     VARCHAR(20)   DEFAULT '—',
    attendance   VARCHAR(20)   DEFAULT 'Absent',
    school_year  VARCHAR(20)   DEFAULT '',
    sem          TINYINT       DEFAULT 1,
    INDEX idx_student (student_id),
    INDEX idx_date    (date),
    INDEX idx_section (section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

ob_end_clean();

$action = $_GET['action'] ?? 'get';

// =====================================================
//   GET HISTORY RECORDS
// =====================================================
if ($action === 'get') {
    $section   = trim($_GET['section'] ?? '');
    $weekStr   = trim($_GET['week']    ?? ''); // "2025-W20"

    // Build WHERE conditions
    $conditions = [];

    // Section filter
    if ($section !== '') {
        $secEsc       = $conn->real_escape_string($section);
        $conditions[] = "section = '$secEsc'";
    }

    // Week filter → convert "2025-W20" to date range
    if ($weekStr !== '') {
        $dates = weekToDates($weekStr);
        if ($dates) {
            $conditions[] = "date BETWEEN '{$dates['start']}' AND '{$dates['end']}'";
        }
    }

    $where = count($conditions) > 0
           ? 'WHERE ' . implode(' AND ', $conditions)
           : '';

    $sql = "SELECT id, student_id, studentNo, student_name, section,
                   subject_code, subject_title, date, day_name,
                   time_in, time_out, attendance, school_year, sem
            FROM attendance_history
            $where
            ORDER BY date DESC, student_name ASC, subject_code ASC";

    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode(['success' => false, 'error' => $conn->error]);
        exit;
    }

    $records = [];
    while ($row = $result->fetch_assoc()) {
        $records[] = $row;
    }

    echo json_encode([
        'success' => true,
        'records' => $records,
        'total'   => count($records)
    ]);
    exit;
}

// =====================================================
//   SAVE TODAY'S ATTENDANCE MANUALLY
//   (same as daily_reset.php but via API)
// =====================================================
if ($action === 'save_today') {
    $today   = date('Y-m-d');
    $dayName = date('l');
    $saved   = 0;

    $students = $conn->query(
        "SELECT id, studentNo, firstName, middleName, lastName,
                section, sem, schoolYear, attendance, timeIn, timeOut
         FROM students
         WHERE status IN ('ENROLLED','IRREGULAR')"
    );

    if (!$students) {
        echo json_encode(['success' => false, 'error' => $conn->error]);
        exit;
    }

    while ($s = $students->fetch_assoc()) {
        $studentId  = intval($s['id']);
        $studentNo  = $conn->real_escape_string($s['studentNo']  ?? '');
        $mid        = $s['middleName'] ? $s['middleName'][0] . '.' : '';
        $fullName   = $conn->real_escape_string("{$s['firstName']} {$mid} {$s['lastName']}");
        $section    = $conn->real_escape_string($s['section']);
        $sem        = intval($s['sem'] ?? 1);
        $schoolYear = $conn->real_escape_string($s['schoolYear'] ?? '');
        $timeIn     = $conn->real_escape_string($s['timeIn']  ?? '—');
        $timeOut    = $conn->real_escape_string($s['timeOut'] ?? '—');
        $attendance = $conn->real_escape_string($s['attendance'] ?? 'Absent');

        // Skip if already saved today
        $exists = $conn->query(
            "SELECT id FROM attendance_history
             WHERE student_id = $studentId AND date = '$today' LIMIT 1"
        );
        if ($exists && $exists->num_rows > 0) continue;

        // Get subjects for today
        $subjects = getSubjectsForDay($conn, $s['section'], $sem, $dayName);

        if (empty($subjects)) {
            $conn->query(
                "INSERT INTO attendance_history
                 (student_id, studentNo, student_name, section, subject_code,
                  subject_title, date, day_name, time_in, time_out,
                  attendance, school_year, sem)
                 VALUES ($studentId,'$studentNo','$fullName','$section',
                         '','No Class','$today','$dayName',
                         '—','—','No Class','$schoolYear',$sem)"
            );
            $saved++;
        } else {
            foreach ($subjects as $subj) {
                $code  = $conn->real_escape_string($subj['code']  ?? '');
                $title = $conn->real_escape_string($subj['title'] ?? '');
                $conn->query(
                    "INSERT INTO attendance_history
                     (student_id, studentNo, student_name, section, subject_code,
                      subject_title, date, day_name, time_in, time_out,
                      attendance, school_year, sem)
                     VALUES ($studentId,'$studentNo','$fullName','$section',
                             '$code','$title','$today','$dayName',
                             '$timeIn','$timeOut','$attendance','$schoolYear',$sem)"
                );
                $saved++;
            }
        }
    }

    // Reset daily fields
    $conn->query(
        "UPDATE students SET attendance='Absent', timeIn='—', timeOut='—'
         WHERE status IN ('ENROLLED','IRREGULAR')"
    );

    echo json_encode([
        'success' => true,
        'saved'   => $saved,
        'date'    => $today,
        'message' => "Saved $saved records and reset attendance"
    ]);
    exit;
}

// =====================================================
//   DELETE HISTORY RECORD
// =====================================================
if ($action === 'delete') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'error' => 'Missing ID']); exit; }

    if ($conn->query("DELETE FROM attendance_history WHERE id = $id")) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => "Unknown action: '$action'"]);
$conn->close();

// =====================================================
//   HELPERS
// =====================================================

// Convert "2025-W20" → ['start' => '2025-05-12', 'end' => '2025-05-18']
function weekToDates($weekStr) {
    if (!preg_match('/^(\d{4})-W(\d{2})$/', $weekStr, $m)) return null;
    $year = intval($m[1]);
    $week = intval($m[2]);

    // ISO week: week 1 is the week containing the first Thursday
    $dto   = new DateTime();
    $dto->setISODate($year, $week, 1); // Monday
    $start = $dto->format('Y-m-d');
    $dto->setISODate($year, $week, 7); // Sunday
    $end   = $dto->format('Y-m-d');

    return ['start' => $start, 'end' => $end];
}

// Get all subjects for a section/sem/day from schedules table
function getSubjectsForDay($conn, $section, $sem, $dayName) {
    $secEsc = $conn->real_escape_string($section);
    $result = $conn->query(
        "SELECT subject_code, subject_title
         FROM schedules
         WHERE section = '$secEsc' AND sem = $sem AND day = '$dayName'"
    );

    $subjects = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $subjects[] = [
                'code'  => $row['subject_code']  ?? '',
                'title' => $row['subject_title'] ?? ''
            ];
        }
    }
    return $subjects;
}
?>