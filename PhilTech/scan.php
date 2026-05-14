<?php
// =====================================================
//   scan.php — QR Code Scanner Endpoint for ESP32
//   PhilTech - GMA Attendance System
//
//   TOGGLE LOGIC:
//   1st scan today → TIME IN  (Present / Late / Absent)
//   2nd scan today → TIME OUT
//   3rd scan today → TIME IN  again
//   ... alternates
//
//   ESP32 sends: scan.php?qr={"id":5,"name":"...","section":"..."}
//
//   Responses:
//   {"result":"TIME_IN",  "attendance":"Present", "time_in":"09:00 AM", ...}
//   {"result":"TIME_OUT", "time_out":"05:00 PM", ...}
//   {"result":"REJECTED", "reason":"Student is DROPPED"}
//   {"result":"NOT_FOUND","reason":"..."}
// =====================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) {
    echo json_encode(['result' => 'ERROR', 'reason' => 'db.php not found']);
    exit;
}
require_once $dbPath;

// ── Read QR data from ESP32 ───────────────────────────
$qrRaw  = $_GET['qr'] ?? '';
$qrData = json_decode($qrRaw, true);
$studentId = intval($qrData['id'] ?? 0);

if (!$studentId) {
    echo json_encode(['result' => 'NOT_FOUND', 'reason' => 'Invalid QR Code']);
    exit;
}

// ── Fetch student ─────────────────────────────────────
$res = $conn->query(
    "SELECT id, firstName, lastName, section, sem, status, timeIn, timeOut
     FROM students WHERE id = $studentId LIMIT 1"
);

if (!$res || $res->num_rows === 0) {
    echo json_encode(['result' => 'NOT_FOUND', 'reason' => 'Student not in database']);
    exit;
}

$student  = $res->fetch_assoc();
$fullName = $student['firstName'] . ' ' . $student['lastName'];
$status   = strtoupper($student['status']);
$section  = $student['section'];
$sem      = intval($student['sem'] ?? 1);

// ── Check if DROPPED ─────────────────────────────────
if ($status === 'DROPPED') {
    echo json_encode([
        'result'  => 'REJECTED',
        'reason'  => 'Student is DROPPED',
        'name'    => $fullName,
        'section' => $section
    ]);
    exit;
}

if ($status !== 'ENROLLED' && $status !== 'IRREGULAR') {
    echo json_encode([
        'result'  => 'REJECTED',
        'reason'  => 'Status not allowed: ' . $student['status'],
        'name'    => $fullName,
        'section' => $section
    ]);
    exit;
}

// ── Get current time ──────────────────────────────────
$now       = new DateTime();
$timeNow   = $now->format('h:i A');   // "09:32 AM"
$timeNow24 = $now->format('H:i');     // "09:32"
$today     = $now->format('Y-m-d');
$scanTime  = $now->format('Y-m-d H:i:s');

// ── Check today's log for this student ───────────────
$logRes = $conn->query(
    "SELECT id, time_in, time_out, scan_count, attendance
     FROM attendance_logs
     WHERE student_id = $studentId AND DATE(scan_time) = '$today'
     ORDER BY id DESC LIMIT 1"
);

// =====================================================
//   TOGGLE: If no log today → TIME IN
//           If last scan was TIME IN (time_out empty) → TIME OUT
//           If last scan was TIME OUT (time_out filled) → TIME IN again
// =====================================================

if (!$logRes || $logRes->num_rows === 0) {

    // ── FIRST SCAN TODAY = TIME IN ────────────────────
    $attendance = computeAttendance($conn, $section, $sem, $timeNow24);

    $nameEsc = $conn->real_escape_string($fullName);
    $secEsc  = $conn->real_escape_string($section);
    $attEsc  = $conn->real_escape_string($attendance);
    $tinEsc  = $conn->real_escape_string($timeNow);

    $conn->query(
        "INSERT INTO attendance_logs
         (student_id, student_name, section, scan_time, time_in, time_out, scan_count, attendance)
         VALUES ($studentId, '$nameEsc', '$secEsc', '$scanTime', '$tinEsc', '', 1, '$attEsc')"
    );

    $conn->query(
        "UPDATE students SET attendance='$attEsc', timeIn='$tinEsc', timeOut='—'
         WHERE id=$studentId"
    );

    echo json_encode([
        'result'     => 'TIME_IN',
        'attendance' => $attendance,
        'name'       => $fullName,
        'section'    => $section,
        'status'     => $student['status'],
        'time_in'    => $timeNow,
        'message'    => "$attendance — Time In: $timeNow"
    ]);

} else {

    $log       = $logRes->fetch_assoc();
    $logId     = intval($log['id']);
    $scanCount = intval($log['scan_count']) + 1;
    $hasTimeOut = !empty($log['time_out']);

    if ($hasTimeOut) {

        // ── ODD SCAN AFTER TIME OUT = NEW TIME IN ────────
        $attendance = computeAttendance($conn, $section, $sem, $timeNow24);

        $nameEsc = $conn->real_escape_string($fullName);
        $secEsc  = $conn->real_escape_string($section);
        $attEsc  = $conn->real_escape_string($attendance);
        $tinEsc  = $conn->real_escape_string($timeNow);

        // Insert a new log row for the new Time In
        $conn->query(
            "INSERT INTO attendance_logs
             (student_id, student_name, section, scan_time, time_in, time_out, scan_count, attendance)
             VALUES ($studentId, '$nameEsc', '$secEsc', '$scanTime', '$tinEsc', '', $scanCount, '$attEsc')"
        );

        $conn->query(
            "UPDATE students SET attendance='$attEsc', timeIn='$tinEsc', timeOut='—'
             WHERE id=$studentId"
        );

        echo json_encode([
            'result'     => 'TIME_IN',
            'attendance' => $attendance,
            'name'       => $fullName,
            'section'    => $section,
            'status'     => $student['status'],
            'time_in'    => $timeNow,
            'message'    => "$attendance — Time In: $timeNow"
        ]);

    } else {

        // ── EVEN SCAN = TIME OUT ──────────────────────────
        $toutEsc = $conn->real_escape_string($timeNow);

        // Update the existing log row with time_out
        $conn->query(
            "UPDATE attendance_logs SET time_out='$toutEsc', scan_count=$scanCount
             WHERE id=$logId"
        );

        $conn->query(
            "UPDATE students SET timeOut='$toutEsc' WHERE id=$studentId"
        );

        echo json_encode([
            'result'   => 'TIME_OUT',
            'name'     => $fullName,
            'section'  => $section,
            'status'   => $student['status'],
            'time_out' => $timeNow,
            'message'  => "Time Out: $timeNow"
        ]);
    }
}

$conn->close();

// ── Compute attendance: Present / Late / Absent ───────
function computeAttendance($conn, $section, $sem, $timeNow24) {
    $GRACE = 15;
    $days  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    $today = $days[intval(date('w'))];

    $secEsc  = $conn->real_escape_string($section);
    $schedRes = $conn->query(
        "SELECT slot_id FROM schedules
         WHERE section='$secEsc' AND sem=$sem AND day='$today'
         ORDER BY slot_id ASC LIMIT 1"
    );

    if (!$schedRes || $schedRes->num_rows === 0) {
        return 'Absent'; // No class today
    }

    $slot      = $schedRes->fetch_assoc();
    $startStr  = explode('-', $slot['slot_id'])[0]; // "11:15"
    $schedMins = timeToMins($startStr);
    $nowMins   = timeToMins($timeNow24);

    if ($nowMins <= $schedMins + $GRACE) return 'Present';
    return 'Late';
}

// ── Convert time string to minutes ───────────────────
function timeToMins($str) {
    $str   = trim(strtoupper($str));
    $isPM  = strpos($str, 'PM') !== false;
    $isAM  = strpos($str, 'AM') !== false;
    $str   = trim(str_replace(['AM','PM'], '', $str));
    $parts = explode(':', $str);
    $h     = intval($parts[0]);
    $m     = intval($parts[1] ?? 0);
    if ($isPM && $h !== 12) $h += 12;
    if ($isAM && $h === 12) $h  = 0;
    if (!$isPM && !$isAM && $h > 0 && $h < 7) $h += 12;
    return ($h * 60) + $m;
}
?>