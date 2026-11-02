# SmashScore

Badminton scoring and match history. HTML, CSS and JavaScript frontend, PHP backend, Neon PostgreSQL database.

## Run

1. Put `DATABASE_URL` in `.env` (never commit this file).
2. Create the table once: `psql "$DATABASE_URL" -f schema.sql`
3. Start the app: `php -S localhost:8080 router.php`
4. Open http://localhost:8080
