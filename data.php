<?php
// Returns history, players, leaderboard and summary totals as JSON.
require __DIR__ . '/config.php';

const SIDES = "SELECT side_a AS name, match_type, winner, games_a AS gw, games_b AS gl FROM matches
               UNION ALL SELECT side_b, match_type, winner, games_b, games_a FROM matches";
try {
    $db = db();
    switch ($_GET['view'] ?? '') {
        case 'history':
            $rows = $db->query('SELECT * FROM matches ORDER BY created_at DESC LIMIT 200')->fetchAll();
            foreach ($rows as &$r) $r['game_scores'] = json_decode($r['game_scores']);
            json_out($rows);
        case 'players':
            json_out($db->query('SELECT name, match_type, COUNT(*)::int AS played FROM (' . SIDES . ') s
                GROUP BY name, match_type ORDER BY name')->fetchAll());
        case 'leaderboard':
            json_out($db->query('SELECT name, match_type, COUNT(*)::int AS played,
                    SUM((winner = name)::int)::int AS wins, SUM((winner <> name)::int)::int AS losses,
                    SUM(gw)::int AS games_won, SUM(gl)::int AS games_lost
                FROM (' . SIDES . ') s GROUP BY name, match_type
                ORDER BY wins DESC, (SUM(gw) - SUM(gl)) DESC, name')->fetchAll());
        case 'summary':
            json_out($db->query("SELECT COUNT(*)::int AS matches,
                (SELECT COUNT(DISTINCT name)::int FROM (" . SIDES . ") s) AS players FROM matches")->fetch());
        default:
            json_out(['error' => 'Unknown view'], 400);
    }
} catch (Throwable $e) {
    error_log($e->getMessage());
    json_out(['error' => 'Could not load data'], 500);
}
