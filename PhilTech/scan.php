<?php
// =====================================================
//   scan.php — QR Scanner Endpoint + Attendance Logic
//   Called by ESP32 Camera when a QR code is scanned
//
//   GET: scan.php?qr={"id":5,...}
//
//   ATTENDANCE RULES:
//   1. Get student's scheduled time for today from schedules table
//   2. No class today → ABSENT
//   3. No schedule set → record timeIn only (no grade)
//   4. timeIn <= scheduleStart + 15min grace → PRESENT
//   5. timeIn > scheduleStart + 15min grace → LATE
//   6. Student never scanned by end of day → ABSENT (set by cron/manual)
//
//   RESPONSES (for ESP32 to read):
//   {"result":"ACCEPTED","attendance":"Present","name":"...","time_in":"..."}
//   {"result":"ACCEPTED","attendance":"Late","name":"...","time_in":"..."}
//   {"result":"REJECTED","reason":"Student is DROPPED"}
//   {"result":"NOT_FOUND","reason":"QR Code not recognized"}
//   {"result":"ALREADY_IN","name":"...","attendance":"Present","time_in":"..."}
// =====================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'db.php';

// ── Read QR data ──────────────────────────────────────
$qrRaw = $_GET['qr'] ?? '';

if (empty($qrRaw)) {
    echo json_encode(['result' => 'ERROR', 'reason' => 'No QR data received']);
    exit;
}

$qrData = json_decode($qrRaw, true);

if (!$qrData || !isset($qrData['id'])) {
    echo json_encode(['result' => 'NOT_FOUND', 'reason' => 'Invalid QR Code format']);
    exit;
}

$studentId = intval($qrData['id']);

// ── Look up student ───────────────────────────────────
$result = $conn->query(
    "SELECT id, firstName, lastName, section, sem, status, attendance, timeIn
     FROM students WHERE id = $studentId LIMIT 1"
);

if (!$result || $result->num_rows === 0) {
    echo json_encode(['result' => 'NOT_FOUND', 'reason' => 'Student not found']);
    exit;
}

$student  = $result->fetch_assoc();
$fullName = $student['firstName'] . ' ' . $student['lastName'];
$status   = strtoupper($student['status']);
$sem      = intval($student['sem'] ?? 1);

// ── Check if DROPPED ──────────────────────────────────
if ($status === 'DROPPED') {
    echo json_encode([
        'result'  => 'REJECTED',
        'reason'  => 'Student is DROPPED',
        'name'    => $fullName,
        'section' => $student['section'],
        'status'  => $student['status']
    ]);
    exit;
}

// ── Only allow ENROLLED and IRREGULAR ─────────────────
if ($status !== 'ENROLLED' && $status !== 'IRREGULAR') {
    echo json_encode([
        'result'  => 'REJECTED',
        'reason'  => 'Status not allowed: ' . $student['status'],
        'name'    => $fullName
    ]);
    exit;
}

// ── Check if already scanned today ────────────────────
$today = date('Y-m-d');
$logCheck = $conn->query(
    "SELECT id, time_in, attendance FROM attendance_logs
     WHERE student_id = $studentId AND DATE(scan_time) = '$today' LIMIT 1"
);

if ($logCheck && $logCheck->num_rows > 0) {
    $log = $logCheck->fetch_assoc();
    echo json_encode([
        'result'     => 'ALREADY_IN',
        'reason'     => 'Already checked in today',
        'name'       => $fullName,
        'section'    => $student['section'],
        'attendance' => $log['attendance'],
        'time_in'    => $log['time_in']
    ]);
    exit;
}

// ── Determine PRESENT, LATE, or ABSENT ────────────────
$now       = new DateTime();
$timeIn    = $now->format('h:i A');     // e.g. "09:32 AM"
$timeIn24  = $now->format('H:i');       // e.g. "09:32" for comparison
$scanTime  = $now->format('Y-m-d H:i:s');

// Get today's day name (Monday, Tuesday, etc.)
$todayDay = $now->format('l');

// Fetch schedule for student's section + sem + today
$section    = $conn->real_escape_string($student['section']);
$schedResult = $conn->query(
    "SELECT slot_id FROM schedules
     WHERE section = '$section' AND sem = $sem AND day = '$todayDay'
     ORDER BY slot_id ASC LIMIT 1"
);

$attendanceStatus = 'Present'; // default
$GRACE_MINUTES    = 15;        // grace period in minutes

if ($schedResult && $schedResult->num_rows > 0) {
    // Student has class today — check if on time or late
    $schedRow     = $schedResult->fetch_assoc();
    $slotId       = $schedRow['slot_id'];              // e.g. "9:00-10:00"
    $schedStart   = explode('-', $slotId)[0];          // e.g. "9:00"

    // Parse scheduled start time to minutes since midnight
    $schedParts   = explode(':', $schedStart);
    $schedH       = intval($schedParts[0]);
    $schedM       = intval($schedParts[1] ?? 0);
    $schedMins    = $schedH * 60 + $schedM;

    // Parse student's current time to minutes
    $nowParts     = explode(':', $timeIn24);
    $nowMins      = intval($nowParts[0]) * 60 + intval($nowParts[1]);

    // Determine attendance
    if ($nowMins <= $schedMins + $GRACE_MINUTES) {
        $attendanceStatus = 'Present';
    } else {
        $attendanceStatus = 'Late';
    }
} else {
    // No schedule today — still record scan but mark as Present
    // (no class = free, but they came in anyway)
    $attendanceStatus = 'Present';
}

// ── Log attendance ────────────────────────────────────
$attEsc = $conn->real_escape_string($attendanceStatus);
$nameEsc = $conn->real_escape_string($fullName);
$secEsc  = $conn->real_escape_string($student['section']);

// 1. Insert into attendance_logs
$conn->query(
    "INSERT INTO attendance_logs (student_id, student_name, section, scan_time, time_in, attendance)
     VALUES ($studentId, '$nameEsc', '$secEsc', '$scanTime', '$timeIn', '$attEsc')"
);

// 2. Update student record
$timeInEsc = $conn->real_escape_string($timeIn);
$conn->query(
    "UPDATE students SET attendance = '$attEsc', timeIn = '$timeInEsc'
     WHERE id = $studentId"
);

// ── Return result to ESP32 ────────────────────────────
echo json_encode([
    'result'     => 'ACCEPTED',
    'attendance' => $attendanceStatus,
    'name'       => $fullName,
    'section'    => $student['section'],
    'status'     => $student['status'],
    'time_in'    => $timeIn,
    'message'    => $attendanceStatus === 'Late'
                        ? "LATE - Came in at $timeIn"
                        : "PRESENT - Came in at $timeIn"
]);

$conn->close();
?>