-- SmashScore schema (PostgreSQL). One row per finished match.
CREATE TABLE IF NOT EXISTS matches (
    id           SERIAL PRIMARY KEY,
    event_name   VARCHAR(100),
    match_type   VARCHAR(10) NOT NULL CHECK (match_type IN ('singles', 'doubles')),
    side_a       VARCHAR(120) NOT NULL,
    side_b       VARCHAR(120) NOT NULL,
    best_of      SMALLINT NOT NULL CHECK (best_of IN (1, 3)),
    points_per_game SMALLINT NOT NULL CHECK (points_per_game IN (11, 15, 21)),
    game_scores  JSONB NOT NULL,
    games_a      SMALLINT NOT NULL,
    games_b      SMALLINT NOT NULL,
    winner       VARCHAR(120) NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
