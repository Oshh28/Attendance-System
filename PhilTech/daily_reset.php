<?php
// =====================================================
//   daily_reset.php — Daily Attendance Reset
//   PhilTech - GMA
//
//   WHAT IT DOES:
//   1. Saves today's attendance for ALL students into
//      attendance_history (permanent record)
//   2. Resets timeIn, timeOut, attendance back to default
//      for a fresh start tomorrow
//
//   HOW TO RUN:
//   Option A — Manual: open in browser once a day
//              http://localhost/PhilTech/daily_reset.php
//
//   Option B — Auto: called by reset_check.php which
//              runs silently on every page load
//
//   SAFE TO RUN MULTIPLE TIMES — checks if already
//   saved for today before inserting duplicates
// =====================================================

ob_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) {
    ob_end_clean();
    echo json_encode(['success' => false, 'error' => 'db.php not found']);
    exit;
}
require_once $dbPath;
ob_end_clean();

$today    = date('Y-m-d');
$dayName  = date('l'); // "Monday", "Tuesday", etc.
$saved    = 0;
$skipped  = 0;
$errors   = 0;

// ── Get all students ──────────────────────────────────
$students = $conn->query(
    "SELECT id, studentNo, firstName, middleName, lastName,
            section, sem, schoolYear, attendance, timeIn, timeOut
     FROM students
     WHERE status IN ('ENROLLED', 'IRREGULAR')"
);

if (!$students || $students->num_rows === 0) {
    echo json_encode([
        'success' => true,
        'message' => 'No students to process',
        'saved'   => 0
    ]);
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
    $timeIn     = $conn->real_escape_string($s['timeIn']     ?? '—');
    $timeOut    = $conn->real_escape_string($s['timeOut']    ?? '—');
    $attendance = $conn->real_escape_string($s['attendance'] ?? 'Absent');

    // ── Check if already saved today for this student ──
    $exists = $conn->query(
        "SELECT id FROM attendance_history
         WHERE student_id = $studentId AND date = '$today'
         LIMIT 1"
    );

    if ($exists && $exists->num_rows > 0) {
        $skipped++;
        continue; // Already saved today — skip
    }

    // ── Get subjects from schedule for today ──────────
    $subjects = getSubjectsToday($conn, $section, $sem, $dayName);

    if (empty($subjects)) {
        // No class today — save one Absent record
        $ok = $conn->query(
            "INSERT INTO attendance_history
             (student_id, studentNo, student_name, section, subject_code,
              subject_title, date, day_name, time_in, time_out,
              attendance, school_year, sem)
             VALUES ($studentId, '$studentNo', '$fullName', '$section',
                     '', 'No Class', '$today', '$dayName',
                     '—', '—', 'No Class', '$schoolYear', $sem)"
        );
        if ($ok) $saved++; else $errors++;

    } else {
        // Save one record per subject
        foreach ($subjects as $subj) {
            $subjCode  = $conn->real_escape_string($subj['code']  ?? '');
            $subjTitle = $conn->real_escape_string($subj['title'] ?? '');

            $ok = $conn->query(
                "INSERT INTO attendance_history
                 (student_id, studentNo, student_name, section, subject_code,
                  subject_title, date, day_name, time_in, time_out,
                  attendance, school_year, sem)
                 VALUES ($studentId, '$studentNo', '$fullName', '$section',
                         '$subjCode', '$subjTitle', '$today', '$dayName',
                         '$timeIn', '$timeOut', '$attendance',
                         '$schoolYear', $sem)"
            );
            if ($ok) $saved++; else $errors++;
        }
    }
}

// ── RESET daily fields for fresh start tomorrow ───────
$conn->query(
    "UPDATE students
     SET attendance = 'Absent', timeIn = '—', timeOut = '—'
     WHERE status IN ('ENROLLED', 'IRREGULAR')"
);

// ── Log the reset ─────────────────────────────────────
$conn->query(
    "INSERT INTO attendance_logs
     (student_id, student_name, section, scan_time, time_in, attendance)
     VALUES (0, 'SYSTEM', 'DAILY_RESET', NOW(), '$today', 'Reset')"
);

$conn->close();

echo json_encode([
    'success' => true,
    'date'    => $today,
    'day'     => $dayName,
    'saved'   => $saved,
    'skipped' => $skipped,
    'errors'  => $errors,
    'message' => "Daily reset done. Saved: $saved records. Reset all attendance."
]);

// ── Helper: get all subjects scheduled today ──────────
function getSubjectsToday($conn, $section, $sem, $dayName) {
    $secEsc = $conn->real_escape_string($section);
    $result = $conn->query(
        "SELECT slot_id, subject_code, subject_title
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