<?php
// =====================================================
//   gatepass_api.php — Gate Pass API
//   PhilTech - GMA
//
//   POST gatepass_api.php?action=add    → record gate pass
//   GET  gatepass_api.php?action=today  → today's logs
// =====================================================

ob_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) {
    ob_end_clean();
    echo json_encode(['success' => false, 'error' => 'db.php not found.']);
    exit;
}
require_once $dbPath;

// Auto-create table if not exists
$conn->query("CREATE TABLE IF NOT EXISTS gatepass_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    studentNo    VARCHAR(30)   NOT NULL,
    studentName  VARCHAR(200)  DEFAULT '',
    section      VARCHAR(50)   NOT NULL,
    timeIn       VARCHAR(20)   NOT NULL,
    date         DATE          NOT NULL,
    processedBy  VARCHAR(100)  DEFAULT 'Guard',
    createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

ob_end_clean();

$action = $_GET['action'] ?? '';

// =====================================================
//   ADD GATE PASS ENTRY
// =====================================================
if ($action === 'add') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { echo json_encode(['success' => false, 'error' => 'No data received']); exit; }

    $studentNo  = $conn->real_escape_string(trim($body['studentNo'] ?? ''));
    $section    = $conn->real_escape_string(trim($body['section']   ?? ''));
    $timeIn     = $conn->real_escape_string(trim($body['timeIn']    ?? ''));
    $today      = date('Y-m-d');

    if (!$studentNo || !$section || !$timeIn) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    // Look up student name from students table
    $safeNo      = $conn->real_escape_string($studentNo);
    $studentRes  = $conn->query("SELECT firstName, middleName, lastName FROM students WHERE studentNo='$safeNo' LIMIT 1");
    $studentName = '';
    if ($studentRes && $studentRes->num_rows > 0) {
        $s           = $studentRes->fetch_assoc();
        $mid         = $s['middleName'] ? ' ' . $s['middleName'][0] . '.' : '';
        $studentName = $conn->real_escape_string("{$s['firstName']}{$mid} {$s['lastName']}");
    }

    // ── Compare timeIn with schedule to get Present / Late / Absent ──
    $attStatus = 'Present'; // default

    // Get student's sem
    $semRes = $conn->query("SELECT sem FROM students WHERE studentNo='$safeNo' LIMIT 1");
    $sem    = 1; // default to sem 1
    if ($semRes && $semRow = $semRes->fetch_assoc()) {
        $sem = intval($semRow['sem']);
    }

    // Get today's day name
    $days     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    $todayDay = $days[intval(date('w'))];

    // Fetch schedule for this section + sem
    $schedSql = $conn->real_escape_string($section);
    $schedRes = $conn->query("SELECT slot_id FROM schedules 
                              WHERE section='$schedSql' AND sem=$sem AND day='$todayDay' 
                              ORDER BY slot_id ASC LIMIT 1");

    if ($schedRes && $schedRes->num_rows > 0) {
        $firstSlot  = $schedRes->fetch_assoc();
        $slotParts  = explode('-', $firstSlot['slot_id']); // "11:15-1:00"
        $startStr   = $slotParts[0]; // "11:15"

        // Convert schedule start to minutes
        $schedMins  = timeToMinutes($startStr);

        // Convert student timeIn to minutes (e.g. "09:30 AM")
        $studentMins = timeToMinutes($timeIn);

        $GRACE = 15; // 15 minute grace period

        if ($studentMins <= $schedMins + $GRACE) {
            $attStatus = 'Present';
        } else {
            $attStatus = 'Late';
        }
    } else {
        // No class today → Absent
        $attStatus = 'Absent';
    }

    // Update student attendance
    $conn->query("UPDATE students SET attendance='$attStatus', timeIn='$timeIn' WHERE studentNo='$safeNo'");

    // Insert gate pass log
    $sql = "INSERT INTO gatepass_logs (studentNo, studentName, section, timeIn, date, processedBy)
            VALUES ('$studentNo', '$studentName', '$section', '$timeIn', '$today', 'Guard')";

    if ($conn->query($sql)) {
        echo json_encode([
            'success'     => true,
            'id'          => $conn->insert_id,
            'studentName' => $studentName,
            'message'     => "Gate pass recorded: $attStatus",
            'attendance'  => $attStatus
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

// =====================================================
//   GET TODAY'S LOGS
// =====================================================
if ($action === 'today') {
    $today  = date('Y-m-d');
    $result = $conn->query("SELECT * FROM gatepass_logs WHERE date='$today' ORDER BY createdAt DESC");

    $logs = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $logs[] = $row;
        }
    }
    echo json_encode(['success' => true, 'logs' => $logs]);
    exit;
}

echo json_encode(['success' => false, 'error' => "Unknown action: '$action'"]);
$conn->close();

// ── Helper: convert "9:00", "9:00 AM", "01:30 PM" → minutes ──
function timeToMinutes($str) {
    $str   = trim(strtoupper($str));
    $isPM  = strpos($str, 'PM') !== false;
    $isAM  = strpos($str, 'AM') !== false;
    $str   = trim(str_replace(['AM','PM'], '', $str));
    $parts = explode(':', $str);
    $h     = intval($parts[0]);
    $m     = intval($parts[1] ?? 0);
    if ($isPM && $h !== 12) $h += 12;
    if ($isAM && $h === 12) $h  = 0;
    // No AM/PM and hour < 7 → assume PM
    if (!$isPM && !$isAM && $h > 0 && $h < 7) $h += 12;
    return ($h * 60) + $m;
}
?>