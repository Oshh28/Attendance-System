<?php
// =====================================================
//   schedule_api.php — Schedule CRUD API
//   PhilTech - GMA
//
//   GET  schedule_api.php?action=get&section=BSCS 1M1
//   POST schedule_api.php?action=save  { section, sem, day, slots }
// =====================================================

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

$action = $_GET['action'] ?? '';

// =====================================================
//   GET SCHEDULE — returns full schedule for a section
// =====================================================
if ($action === 'get') {
    $section = $conn->real_escape_string(trim($_GET['section'] ?? ''));

    $sql    = "SELECT sem, day, slot_id, subject_code, subject_title,
                      units, room, teacher, color
               FROM schedules
               WHERE section = '$section'
               ORDER BY sem, day, slot_id";
    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode(['success' => false, 'error' => $conn->error]);
        exit;
    }

    // Build nested structure: schedule[sem][day][slot_id] = { ... }
    $schedule = [];
    while ($row = $result->fetch_assoc()) {
        $sem    = intval($row['sem']);
        $day    = $row['day'];
        $slotId = $row['slot_id'];

        $schedule[$sem][$day][$slotId] = [
            'subjectCode'  => $row['subject_code'],
            'subjectTitle' => $row['subject_title'],
            'units'        => $row['units'],
            'room'         => $row['room'],
            'teacher'      => $row['teacher'],
            'color'        => $row['color']
        ];
    }

    echo json_encode(['success' => true, 'schedule' => $schedule]);
    exit;
}

// =====================================================
//   SAVE SCHEDULE — upsert slots for one day
// =====================================================
if ($action === 'save') {
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$body) {
        echo json_encode(['success' => false, 'error' => 'No data received']);
        exit;
    }

    $section = $conn->real_escape_string(trim($body['section'] ?? ''));
    $sem     = intval($body['sem'] ?? 1);
    $day     = $conn->real_escape_string(trim($body['day']     ?? ''));
    $slots   = $body['slots'] ?? [];

    if (!$section || !$day) {
        echo json_encode(['success' => false, 'error' => 'Missing section or day']);
        exit;
    }

    // Delete existing slots for this section+sem+day
    $conn->query("DELETE FROM schedules WHERE section='$section' AND sem=$sem AND day='$day'");

    // Insert new slots
    foreach ($slots as $slotId => $slot) {
        $slotId      = $conn->real_escape_string($slotId);
        $subjectCode = $conn->real_escape_string($slot['subjectCode']  ?? '');
        $subjectTitle= $conn->real_escape_string($slot['subjectTitle'] ?? '');
        $units       = $conn->real_escape_string($slot['units']        ?? '');
        $room        = $conn->real_escape_string($slot['room']         ?? '');
        $teacher     = $conn->real_escape_string($slot['teacher']      ?? '');
        $color       = $conn->real_escape_string($slot['color']        ?? '#2196F3');

        if (!$subjectCode) continue; // skip empty

        $conn->query("INSERT INTO schedules
                      (section, sem, day, slot_id, subject_code, subject_title, units, room, teacher, color)
                      VALUES
                      ('$section', $sem, '$day', '$slotId', '$subjectCode', '$subjectTitle', '$units', '$room', '$teacher', '$color')");
    }

    echo json_encode(['success' => true, 'message' => 'Schedule saved']);
    exit;
}

echo json_encode(['success' => false, 'error' => "Unknown action: '$action'"]);
$conn->close();
?>