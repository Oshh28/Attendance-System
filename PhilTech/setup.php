<?php
// =====================================================
//   setup.php — Run this ONCE to create the database & table
//   Open in browser: http://localhost/PhilTech/setup.php
// =====================================================

// Connect WITHOUT selecting a database first
$conn = new mysqli('localhost', 'root', '');

if ($conn->connect_error) {
    die('<h2 style="color:red">❌ Cannot connect to MySQL: ' . $conn->connect_error . '</h2>
         <p>Make sure XAMPP is running and MySQL is started.</p>');
}

$results = [];

// 1. Create database
$sql = "CREATE DATABASE IF NOT EXISTS philtech_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
if ($conn->query($sql)) {
    $results[] = '✅ Database <strong>philtech_db</strong> created (or already exists)';
} else {
    $results[] = '❌ Failed to create database: ' . $conn->error;
}

// 2. Select database
$conn->select_db('philtech_db');

// 3. Create students table
$sql = "CREATE TABLE IF NOT EXISTS students (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    studentId   VARCHAR(50)   DEFAULT '',
    firstName   VARCHAR(100)  NOT NULL,
    lastName    VARCHAR(100)  NOT NULL,
    middleName  VARCHAR(100)  DEFAULT '',
    studentNo   VARCHAR(30)   DEFAULT '',
    email       VARCHAR(200)  NOT NULL,
    gender      VARCHAR(10)   DEFAULT 'Male',
    section     VARCHAR(50)   NOT NULL,
    sem         TINYINT       DEFAULT 1,
    schoolYear  VARCHAR(20)   DEFAULT '',
    status      VARCHAR(20)   DEFAULT 'ENROLLED',
    attendance  VARCHAR(20)   DEFAULT 'Present',
    timeIn      VARCHAR(20)   DEFAULT '07:00 AM',
    timeOut     VARCHAR(20)   DEFAULT '12:00 PM',
    photoBase64 MEDIUMTEXT    DEFAULT '',
    dateAdded   BIGINT        DEFAULT 0,
    createdAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

// Add sem column if it doesn't exist yet (for existing databases)
// Safely add studentNo column
$checkSN = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME='studentNo'");
if ($checkSN && $checkSN->num_rows === 0) {
    if ($conn->query("ALTER TABLE students ADD COLUMN studentNo VARCHAR(30) DEFAULT '' AFTER id")) {
        $results[] = '✅ Column <strong>studentNo</strong> added to students table';
    } else {
        $results[] = '❌ studentNo add failed: ' . $conn->error;
    }
} else {
    $results[] = '✅ Column <strong>studentNo</strong> already exists in students table';
}

// Safely add sem column for existing databases (compatible with older MySQL)
$checkCol = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_SCHEMA='philtech_db' AND TABLE_NAME='students' AND COLUMN_NAME='sem'");
if ($checkCol && $checkCol->num_rows === 0) {
    $conn->query("ALTER TABLE students ADD COLUMN sem TINYINT DEFAULT 1 AFTER section");
}

// Add studentId column for existing databases
// Remove old studentId if exists
$chkOld = $conn->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME='studentId'");
if ($chkOld && $chkOld->num_rows > 0) {
    $conn->query("ALTER TABLE students DROP COLUMN studentId");
    $results[] = '✅ Old <strong>studentId</strong> replaced by studentNo';
}

if ($conn->query($sql)) {
    $results[] = '✅ Table <strong>students</strong> created (or already exists)';
} else {
    $results[] = '❌ Failed to create table: ' . $conn->error;
}

// 4. Create attendance_logs table
$sql = "CREATE TABLE IF NOT EXISTS attendance_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id   INT          NOT NULL,
    student_name VARCHAR(200) NOT NULL,
    section      VARCHAR(50)  NOT NULL,
    scan_time    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    time_in      VARCHAR(20)  DEFAULT '',
    attendance   VARCHAR(20)  DEFAULT 'Present',
    INDEX idx_student_id (student_id),
    INDEX idx_scan_time  (scan_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

if ($conn->query($sql)) {
    $results[] = '✅ Table <strong>attendance_logs</strong> created (or already exists)';
} else {
    $results[] = '❌ Failed to create attendance_logs table: ' . $conn->error;
}

// 5. Create teachers table
$sql = "CREATE TABLE IF NOT EXISTS teachers (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName  VARCHAR(100) NOT NULL,
    gender    VARCHAR(10)  DEFAULT 'Male',
    major     VARCHAR(200) DEFAULT '',
    email     VARCHAR(200) DEFAULT '',
    createdAt TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

if ($conn->query($sql)) {
    $results[] = '✅ Table <strong>teachers</strong> created (or already exists)';
} else {
    $results[] = '❌ Failed to create teachers table: ' . $conn->error;
}

// 6. Create gatepass_logs table
$sql = "CREATE TABLE IF NOT EXISTS gatepass_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    studentNo    VARCHAR(30)   NOT NULL,
    studentName  VARCHAR(200)  DEFAULT '',
    section      VARCHAR(50)   NOT NULL,
    timeIn       VARCHAR(20)   NOT NULL,
    date         DATE          NOT NULL,
    processedBy  VARCHAR(100)  DEFAULT 'Guard',
    createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
if ($conn->query($sql)) {
    $results[] = '✅ Table <strong>gatepass_logs</strong> created (or already exists)';
} else {
    $results[] = '❌ Failed to create gatepass_logs: ' . $conn->error;
}

// 7. Create schedules table
$sql = "CREATE TABLE IF NOT EXISTS schedules (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    section       VARCHAR(50)   NOT NULL,
    sem           TINYINT       NOT NULL DEFAULT 1,
    day           VARCHAR(20)   NOT NULL,
    slot_id       VARCHAR(30)   NOT NULL,
    subject_code  VARCHAR(50)   DEFAULT '',
    subject_title VARCHAR(200)  DEFAULT '',
    units         VARCHAR(10)   DEFAULT '',
    room          VARCHAR(100)  DEFAULT '',
    teacher       VARCHAR(200)  DEFAULT '',
    color         VARCHAR(20)   DEFAULT '#2196F3',
    UNIQUE KEY unique_slot (section, sem, day, slot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

if ($conn->query($sql)) {
    $results[] = '✅ Table <strong>schedules</strong> created (or already exists)';
} else {
    $results[] = '❌ Failed to create schedules table: ' . $conn->error;
}

$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PhilTech Setup</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: Poppins, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .box { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px; width: 100%; text-align: center; }
        h1 { color: #D32F2F; font-size: 24px; margin-bottom: 8px; }
        p { color: #666; font-size: 13px; margin-bottom: 24px; }
        .result { text-align: left; padding: 12px 16px; border-radius: 8px; background: #f9f9f9; margin-bottom: 10px; font-size: 13px; line-height: 1.6; }
        .btn { display: inline-block; margin-top: 20px; padding: 12px 28px; background: #D32F2F; color: white; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 14px; }
        .btn:hover { background: #B71C1C; }
    </style>
</head>
<body>
    <div class="box">
        <h1>PhilTech - GMA Setup</h1>
        <p>Setting up your MySQL database...</p>
        <?php foreach ($results as $r): ?>
            <div class="result"><?= $r ?></div>
        <?php endforeach; ?>
        <a class="btn" href="SectionData.html">→ Go to App</a>
        <p style="margin-top:16px; font-size:12px; color:#aaa;">You only need to run this once.<br>Delete setup.php after setup is done (optional).</p>
    </div>
</body>
</html>