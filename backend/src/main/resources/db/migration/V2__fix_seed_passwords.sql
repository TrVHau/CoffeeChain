-- ============================================================
-- V2__fix_seed_passwords.sql
-- Re-hash demo user passwords using pgcrypto (BCrypt rounds=10)
-- Compatible with Spring BCryptPasswordEncoder
-- All 5 users → password = "pw123"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE users
SET password = crypt('pw123', gen_salt('bf', 10))
WHERE user_id IN (
    'farmer_alice',
    'processor_bob',
    'roaster_charlie',
    'packager_dave',
    'retailer_eve'
);
