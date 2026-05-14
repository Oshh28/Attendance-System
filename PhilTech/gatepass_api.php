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
    time_out     VARCHAR(20)   DEFAULT '',
    date         DATE          NOT NULL,
    processedBy  VARCHAR(100)  DEFAULT 'Guard',
    createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
// Add time_out column if missing
$conn->query("ALTER TABLE gatepass_logs ADD COLUMN IF NOT EXISTS time_out VARCHAR(20) DEFAULT '' AFTER timeIn");

ob_end_clean();

$action = $_GET['action'] ?? '';

// =====================================================
//   ADD GATE PASS ENTRY
// =====================================================
if ($action === 'add') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { echo json_encode(['success' => false, 'error' => 'No data received']); exit; }

    $studentNo = $conn->real_escape_string(trim($body['studentNo'] ?? ''));
    $section   = $conn->real_escape_string(trim($body['section']   ?? ''));
    $timeInput = $conn->real_escape_string(trim($body['timeIn']    ?? ''));
    $today     = date('Y-m-d');

    if (!$studentNo || !$section || !$timeInput) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    // Lookup student
    $studentRes = $conn->query(
        "SELECT id, firstName, middleName, lastName, sem, timeIn, timeOut
         FROM students WHERE studentNo='$studentNo' LIMIT 1"
    );
    $studentId   = 0;
    $studentName = '';
    $sem         = 1;

    if ($studentRes && $studentRes->num_rows > 0) {
        $s           = $studentRes->fetch_assoc();
        $studentId   = intval($s['id']);
        $mid         = $s['middleName'] ? ' ' . $s['middleName'][0] . '.' : '';
        $studentName = $conn->real_escape_string("{$s['firstName']}{$mid} {$s['lastName']}");
        $sem         = intval($s['sem'] ?? 1);
    }

    // Check last gate pass log for this student today → toggle Time In / Time Out
    $lastLog = $conn->query(
        "SELECT id, timeIn, time_out FROM gatepass_logs
         WHERE studentNo='$studentNo' AND date='$today'
         ORDER BY id DESC LIMIT 1"
    );

    $isTimeOut   = false;
    $lastLogId   = 0;

    if ($lastLog && $lastLog->num_rows > 0) {
        $logRow    = $lastLog->fetch_assoc();
        $lastLogId = intval($logRow['id']);
        // If last log has no time_out yet → this scan is TIME OUT
        if (empty($logRow['time_out'])) {
            $isTimeOut = true;
        }
    }

    if ($isTimeOut) {

        // ── TIME OUT ────────────────────────────────────
        $conn->query(
            "UPDATE gatepass_logs SET time_out='$timeInput' WHERE id=$lastLogId"
        );
        if ($studentId > 0) {
            $conn->query(
                "UPDATE students SET timeOut='$timeInput' WHERE id=$studentId"
            );
        }
        echo json_encode([
            'success'     => true,
            'scan_type'   => 'TIME_OUT',
            'studentName' => $studentName,
            'time_out'    => $timeInput,
            'message'     => "Time Out recorded: $timeInput",
            'attendance'  => 'Time Out'
        ]);

    } else {

        // ── TIME IN ─────────────────────────────────────
        // Compute attendance vs schedule
        $attStatus = computeGPAttendance($conn, $section, $sem, $timeInput);

        $nameEsc  = $conn->real_escape_string($studentName);
        $secEsc   = $conn->real_escape_string($section);

        $conn->query(
            "INSERT INTO gatepass_logs (studentNo, studentName, section, timeIn, time_out, date, processedBy)
             VALUES ('$studentNo', '$nameEsc', '$secEsc', '$timeInput', '', '$today', 'Guard')"
        );

        if ($studentId > 0) {
            $att = $conn->real_escape_string($attStatus);
            $tin = $conn->real_escape_string($timeInput);
            $conn->query(
                "UPDATE students SET attendance='$att', timeIn='$tin', timeOut='—' WHERE id=$studentId"
            );
        }

        echo json_encode([
            'success'     => true,
            'scan_type'   => 'TIME_IN',
            'id'          => $conn->insert_id,
            'studentName' => $studentName,
            'time_in'     => $timeInput,
            'message'     => "Time In: $timeInput — $attStatus",
            'attendance'  => $attStatus
        ]);
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
function computeGPAttendance($conn, $section, $sem, $timeStr) {
    $GRACE    = 15;
    $days     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    $todayDay = $days[intval(date('w'))];
    $secEsc   = $conn->real_escape_string($section);

    $schedRes = $conn->query(
        "SELECT slot_id FROM schedules
         WHERE section='$secEsc' AND sem=$sem AND day='$todayDay'
         ORDER BY slot_id ASC LIMIT 1"
    );

    if (!$schedRes || $schedRes->num_rows === 0) return 'Absent';

    $slot      = $schedRes->fetch_assoc();
    $startStr  = explode('-', $slot['slot_id'])[0];
    $schedMins = timeToMinutes($startStr);
    $nowMins   = timeToMinutes($timeStr);

    if ($nowMins <= $schedMins + $GRACE) return 'Present';
    return 'Late';
}

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