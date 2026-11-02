<?php
// Opens the PDO connection to PostgreSQL using DATABASE_URL from .env.
function env_value(string $key): ?string {
    $path = __DIR__ . '/.env';
    if (!is_readable($path)) return getenv($key) ?: null;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with($line, $key . '=')) {
            return trim(substr($line, strlen($key) + 1), "\"' ");
        }
    }
    return getenv($key) ?: null;
}

function db(): PDO {
    $url = env_value('DATABASE_URL');
    if (!$url) throw new RuntimeException('DATABASE_URL is not set');
    $p = parse_url($url);
    // The Neon endpoint id lets libpq route correctly on older SNI setups.
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;sslmode=require',
        $p['host'], $p['port'] ?? 5432, ltrim($p['path'], '/'));
    return new PDO($dsn, urldecode($p['user']), urldecode($p['pass']), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function json_out($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
