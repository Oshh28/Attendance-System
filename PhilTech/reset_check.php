<?php
// =====================================================
//   reset_check.php — Auto Daily Reset Trigger
//   PhilTech - GMA
//
//   Include this at the TOP of any PHP page or
//   call it silently via JS fetch() on page load.
//
//   It checks: "Did we already reset today?"
//   If NO  → triggers daily_reset.php
//   If YES → does nothing (very fast)
//
//   HOW TO USE IN YOUR PHP FILES:
//   Add this line at the top of api.php:
//   require_once 'reset_check.php';
// =====================================================

$dbPath = __DIR__ . '/db.php';
if (!file_exists($dbPath)) exit;
require_once $dbPath;

$today = date('Y-m-d');

// Check if reset already happened today
$check = $conn->query(
    "SELECT id FROM attendance_logs
     WHERE section = 'DAILY_RESET'
     AND DATE(scan_time) = '$today'
     LIMIT 1"
);

if (!$check || $check->num_rows === 0) {
    // Not reset yet today — trigger it
    // Run in background (non-blocking)
    $resetUrl = 'http://localhost/' . basename(dirname($_SERVER['SCRIPT_NAME'])) . '/daily_reset.php';

    // Use file_get_contents with timeout so it doesn't slow down the page
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 2,
            'method'  => 'GET'
        ]
    ]);
    @file_get_contents($resetUrl, false, $ctx);
}
// If already reset → do nothing, returns immediately
?>