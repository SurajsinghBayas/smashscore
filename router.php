<?php
// Development router: serves only the app's public files, so .env and config are never exposed.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$allowed = ['/index.html', '/style.css', '/app.js', '/save_match.php', '/data.php'];
if ($path === '/') $path = '/index.html';
if (!in_array($path, $allowed, true)) {
    http_response_code(404);
    echo 'Not found';
    return true;
}
if (str_ends_with($path, '.php')) {
    require __DIR__ . $path;
    return true;
}
$types = ['html' => 'text/html', 'css' => 'text/css', 'js' => 'text/javascript'];
header('Content-Type: ' . $types[pathinfo($path, PATHINFO_EXTENSION)] . '; charset=utf-8');
readfile(__DIR__ . $path);
return true;
