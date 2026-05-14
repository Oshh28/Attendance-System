<?php
// =====================================================
//   teachers_api.php — Teacher CRUD API
//   PhilTech - GMA
//
//   GET  teachers_api.php?action=get          → all teachers
//   POST teachers_api.php?action=add          → add teacher
//   POST teachers_api.php?action=update&id=N  → update teacher
//   POST teachers_api.php?action=delete&id=N  → delete teacher
// =====================================================

// Catch ALL PHP errors and return them as JSON (never return HTML)
set_exception_handler(function($e) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'PHP Exception: ' . $e->getMessage()]);
    exit;
});

// Buffer output so stray errors don't break JSON
ob_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Check if db.php exists before requiring it
$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) {
    ob_end_clean();
    echo json_encode(['success' => false, 'error' => 'db.php not found. Make sure all files are in the same folder.']);
    exit;
}
require_once $dbPath;

// Check if teachers table exists, create it if not
$conn->query("CREATE TABLE IF NOT EXISTS teachers (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName  VARCHAR(100) NOT NULL,
    gender    VARCHAR(10)  DEFAULT 'Male',
    major     VARCHAR(200) DEFAULT '',
    email     VARCHAR(200) DEFAULT '',
    createdAt TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

ob_end_clean(); // Clear any stray output before JSON

$action = $_GET['action'] ?? '';

// ── GET ALL ──────────────────────────────────────────
if ($action === 'get') {
    $result = $conn->query("SELECT * FROM teachers ORDER BY lastName ASC");
    $teachers = [];
    while ($row = $result->fetch_assoc()) {
        $teachers[] = $row;
    }
    echo json_encode(['success' => true, 'teachers' => $teachers]);
    exit;
}

// ── ADD ──────────────────────────────────────────────
if ($action === 'add') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { echo json_encode(['success' => false, 'error' => 'No data']); exit; }

    $firstName = $conn->real_escape_string(trim($body['firstName'] ?? ''));
    $lastName  = $conn->real_escape_string(trim($body['lastName']  ?? ''));
    $gender    = $conn->real_escape_string(trim($body['gender']    ?? 'Male'));
    $major     = $conn->real_escape_string(trim($body['major']     ?? ''));
    $email     = $conn->real_escape_string(trim($body['email']     ?? ''));

    if (!$firstName || !$lastName) {
        echo json_encode(['success' => false, 'error' => 'Name is required']); exit;
    }

    $sql = "INSERT INTO teachers (firstName, lastName, gender, major, email)
            VALUES ('$firstName', '$lastName', '$gender', '$major', '$email')";

    if ($conn->query($sql)) {
        echo json_encode(['success' => true, 'id' => $conn->insert_id]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

// ── UPDATE ───────────────────────────────────────────
if ($action === 'update') {
    $id   = intval($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$id || !$body) { echo json_encode(['success' => false, 'error' => 'Missing data']); exit; }

    $firstName = $conn->real_escape_string(trim($body['firstName'] ?? ''));
    $lastName  = $conn->real_escape_string(trim($body['lastName']  ?? ''));
    $gender    = $conn->real_escape_string(trim($body['gender']    ?? 'Male'));
    $major     = $conn->real_escape_string(trim($body['major']     ?? ''));
    $email     = $conn->real_escape_string(trim($body['email']     ?? ''));

    $sql = "UPDATE teachers SET firstName='$firstName', lastName='$lastName',
            gender='$gender', major='$major', email='$email' WHERE id=$id";

    if ($conn->query($sql)) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

// ── DELETE ───────────────────────────────────────────
if ($action === 'delete') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'error' => 'Missing ID']); exit; }

    if ($conn->query("DELETE FROM teachers WHERE id=$id")) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => "Unknown action: '$action'"]);
$conn->close();
?>