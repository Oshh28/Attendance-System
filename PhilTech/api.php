<?php
// =====================================================
//   api.php — Student CRUD API
//   PhilTech - GMA Attendance System
//
//   GET    api.php?action=get&section=BSCS 1M1   → get students
//   POST   api.php?action=add                     → add student
//   POST   api.php?action=update&id=5             → update student
//   POST   api.php?action=delete&id=5             → delete student
// =====================================================

// Allow requests from the same origin (XAMPP local)
ob_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) {
    ob_end_clean();
    echo json_encode(['success' => false, 'error' => 'db.php not found. Place all PHP files in the same folder.']);
    exit;
}
require_once $dbPath;
ob_end_clean();

// Read what action to do
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// =====================================================
//   GET STUDENTS — returns all students for a section
// =====================================================
if ($action === 'get') {
    $section = $_GET['section'] ?? '';

    // Sanitize input to prevent SQL injection
    $section = $conn->real_escape_string(trim($section));

    $sql    = "SELECT * FROM students WHERE section = '$section' ORDER BY dateAdded ASC";
    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode(['success' => false, 'error' => $conn->error]);
        exit;
    }

    $students = [];
    while ($row = $result->fetch_assoc()) {
        $students[] = $row;
    }

    echo json_encode(['success' => true, 'students' => $students]);
    exit;
}

// =====================================================
//   ADD STUDENT
// =====================================================
if ($action === 'add') {
    // Read JSON body from JS fetch()
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$body) {
        echo json_encode(['success' => false, 'error' => 'No data received']);
        exit;
    }

    // Sanitize each field
    $studentNo   = $conn->real_escape_string(trim($body['studentNo']   ?? ''));
    $firstName   = $conn->real_escape_string(trim($body['firstName']   ?? ''));
    $lastName    = $conn->real_escape_string(trim($body['lastName']    ?? ''));
    $middleName  = $conn->real_escape_string(trim($body['middleName']  ?? ''));
    $email       = $conn->real_escape_string(trim($body['email']       ?? ''));
    $gender      = $conn->real_escape_string(trim($body['gender']      ?? 'Male'));
    $section     = $conn->real_escape_string(trim($body['section']     ?? ''));
    $sem         = intval($body['sem'] ?? 1);
    $schoolYear  = $conn->real_escape_string(trim($body['schoolYear']  ?? ''));
    $status      = $conn->real_escape_string(trim($body['status']      ?? 'ENROLLED'));

    $photoBase64 = $conn->real_escape_string($body['photoBase64']      ?? '');
    $attendance  = 'Absent';
    $timeIn      = '—';
    $timeOut     = '—';
    $dateAdded   = time() * 1000; // milliseconds like JS Date.now()

    // Basic validation
    if (!$firstName || !$lastName || !$email || !$section || !$status) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    $sql = "INSERT INTO students 
            (studentNo, firstName, lastName, middleName, email, gender, section, sem, schoolYear, 
             status, attendance, timeIn, timeOut, photoBase64, dateAdded)
            VALUES 
            ('$studentNo', '$firstName', '$lastName', '$middleName', '$email', '$gender', '$section', $sem,
             '$schoolYear', '$status', '$attendance', '$timeIn', '$timeOut', '$photoBase64', $dateAdded)";

    if ($conn->query($sql)) {
        $newId = $conn->insert_id;
        echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Student added']);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

// =====================================================
//   UPDATE STUDENT
// =====================================================
if ($action === 'update') {
    $id   = intval($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id || !$body) {
        echo json_encode(['success' => false, 'error' => 'Missing ID or data']);
        exit;
    }

    $studentNo   = $conn->real_escape_string(trim($body['studentNo']   ?? ''));
    $firstName   = $conn->real_escape_string(trim($body['firstName']   ?? ''));
    $lastName    = $conn->real_escape_string(trim($body['lastName']    ?? ''));
    $middleName  = $conn->real_escape_string(trim($body['middleName']  ?? ''));
    $email       = $conn->real_escape_string(trim($body['email']       ?? ''));
    $gender      = $conn->real_escape_string(trim($body['gender']      ?? 'Male'));
    $section     = $conn->real_escape_string(trim($body['section']     ?? ''));
    $sem         = intval($body['sem'] ?? 1);
    $schoolYear  = $conn->real_escape_string(trim($body['schoolYear']  ?? ''));
    $status      = $conn->real_escape_string(trim($body['status']      ?? ''));
    $photoBase64 = $conn->real_escape_string($body['photoBase64']      ?? '');

    $sql = "UPDATE students SET
                studentNo   = '$studentNo',
                firstName   = '$firstName',
                lastName    = '$lastName',
                middleName  = '$middleName',
                email       = '$email',
                gender      = '$gender',
                section     = '$section',
                sem         = $sem,
                schoolYear  = '$schoolYear',
                status      = '$status',
                photoBase64 = '$photoBase64'
            WHERE id = $id";

    if ($conn->query($sql)) {
        echo json_encode(['success' => true, 'message' => 'Student updated']);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

// =====================================================
//   DELETE STUDENT
// =====================================================
if ($action === 'delete') {
    $id = intval($_GET['id'] ?? 0);

    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Missing ID']);
        exit;
    }

    $sql = "DELETE FROM students WHERE id = $id";

    if ($conn->query($sql)) {
        echo json_encode(['success' => true, 'message' => 'Student deleted']);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

// =====================================================
//   UNKNOWN ACTION
// =====================================================
// ── LOOKUP STUDENT BY STUDENT NO ─────────────────────
if ($action === 'lookup') {
    $studentNo = $conn->real_escape_string(trim($_GET['studentNo'] ?? ''));
    if (!$studentNo) {
        echo json_encode(['success' => false, 'error' => 'No student number provided']);
        exit;
    }
    $res = $conn->query("SELECT id, studentNo, firstName, middleName, lastName, section, status FROM students WHERE studentNo='$studentNo' LIMIT 1");
    if ($res && $res->num_rows > 0) {
        echo json_encode(['success' => true, 'student' => $res->fetch_assoc()]);
    } else {
        echo json_encode(['success' => false, 'student' => null]);
    }
    exit;
}

// ── MARK TIME IN ─────────────────────────────────────
if ($action === 'timein') {
    $id   = intval($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id || !$body) {
        echo json_encode(['success' => false, 'error' => 'Missing data']);
        exit;
    }

    $timeIn     = $conn->real_escape_string(trim($body['timeIn']     ?? ''));
    $attendance = $conn->real_escape_string(trim($body['attendance'] ?? 'Present'));

    // Validate attendance value
    if (!in_array($attendance, ['Present', 'Late', 'Absent'])) {
        $attendance = 'Present';
    }

    $sql = "UPDATE students SET timeIn='$timeIn', attendance='$attendance' WHERE id=$id";

    if ($conn->query($sql)) {
        // Also log to attendance_logs
        $today    = date('Y-m-d');
        $datetime = date('Y-m-d H:i:s');

        // Get student info for log
        $sRes = $conn->query("SELECT firstName, lastName, section FROM students WHERE id=$id LIMIT 1");
        if ($sRes && $sRow = $sRes->fetch_assoc()) {
            $name    = $conn->real_escape_string($sRow['firstName'] . ' ' . $sRow['lastName']);
            $section = $conn->real_escape_string($sRow['section']);
            $conn->query("INSERT INTO attendance_logs 
                          (student_id, student_name, section, scan_time, time_in)
                          VALUES ($id, '$name', '$section', '$datetime', '$timeIn')
                          ON DUPLICATE KEY UPDATE time_in='$timeIn', scan_time='$datetime'");
        }

        echo json_encode([
            'success'    => true,
            'timeIn'     => $timeIn,
            'attendance' => $attendance,
            'message'    => "Time In recorded: $attendance"
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => "Unknown action: '$action'"]);
$conn->close();
?>