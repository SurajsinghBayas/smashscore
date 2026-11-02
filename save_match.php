<?php
// Validates a finished match against the badminton rules and stores one row.
require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$m = json_decode(file_get_contents('php://input'), true);
if (!is_array($m)) json_out(['error' => 'Invalid JSON'], 400);

function valid_game(int $a, int $b, int $target): bool {
    $hi = max($a, $b);
    $lo = min($a, $b);
    if ($lo < 0 || $hi < $target) return false;
    $cap = $target + 9;              // 21 -> 30, 15 -> 24, 11 -> 20
    if ($hi === $cap) return $lo === $cap - 1 || $lo === $cap - 2;
    if ($hi > $cap) return false;
    if ($hi === $target) return $lo <= $target - 2;
    return $hi - $lo === 2;          // past the target, only a two-point lead ends it
}

$sideA = trim((string)($m['side_a'] ?? ''));
$sideB = trim((string)($m['side_b'] ?? ''));
$type = $m['match_type'] ?? '';
$bestOf = (int)($m['best_of'] ?? 0);
$points = (int)($m['points_per_game'] ?? 0);
$games = $m['game_scores'] ?? null;
$event = trim((string)($m['event_name'] ?? ''));
$duration = max(0, (int)($m['duration_seconds'] ?? 0));

if ($sideA === '' || $sideB === '' || mb_strlen($sideA) > 120 || mb_strlen($sideB) > 120) json_out(['error' => 'Both side names are required'], 422);
if (mb_strtolower($sideA) === mb_strtolower($sideB)) json_out(['error' => 'Sides must be different'], 422);
if (!in_array($type, ['singles', 'doubles'], true)) json_out(['error' => 'Invalid match type'], 422);
if (!in_array($bestOf, [1, 3], true)) json_out(['error' => 'Invalid number of games'], 422);
if (!in_array($points, [11, 15, 21], true)) json_out(['error' => 'Invalid points per game'], 422);
if (mb_strlen($event) > 100) json_out(['error' => 'Event name is too long'], 422);
if (!is_array($games) || !$games) json_out(['error' => 'Game scores are required'], 422);

$need = (int)ceil($bestOf / 2);
$winsA = $winsB = 0;
$clean = [];
foreach ($games as $g) {
    if (!is_array($g) || !is_int($g[0] ?? null) || !is_int($g[1] ?? null)) json_out(['error' => 'Invalid game score'], 422);
    if ($winsA === $need || $winsB === $need) json_out(['error' => 'Games played after the match ended'], 422);
    if (!valid_game($g[0], $g[1], $points)) json_out(['error' => "Invalid game score {$g[0]}-{$g[1]}"], 422);
    $g[0] > $g[1] ? $winsA++ : $winsB++;
    $clean[] = [$g[0], $g[1]];
}
if ($winsA !== $need && $winsB !== $need) json_out(['error' => 'Match is not finished'], 422);

$winner = $winsA > $winsB ? $sideA : $sideB;
try {
    $st = db()->prepare('INSERT INTO matches (event_name, match_type, side_a, side_b, best_of, points_per_game, game_scores, games_a, games_b, winner, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id');
    $st->execute([$event ?: null, $type, $sideA, $sideB, $bestOf, $points, json_encode($clean), $winsA, $winsB, $winner, $duration]);
    json_out(['id' => $st->fetchColumn(), 'winner' => $winner], 201);
} catch (Throwable $e) {
    error_log($e->getMessage());
    json_out(['error' => 'Could not save the match'], 500);
}
