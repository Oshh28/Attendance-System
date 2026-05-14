<?php
// =====================================================
//   db.php — MySQL Database Connection
//   PhilTech - GMA Attendance System
// =====================================================

// ⚙️ CHANGE THESE to match your XAMPP/server settings
define('DB_HOST',     'localhost');
define('DB_USER',     'root');        // default XAMPP user
define('DB_PASSWORD', '');            // default XAMPP password (blank)
define('DB_NAME',     'philtech_db');

// Connect to MySQL
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database connection failed: ' . $conn->connect_error
    ]);
    exit;
}

// Set charset to UTF-8 (handles Filipino names properly)
$conn->set_charset('utf8mb4');
?>