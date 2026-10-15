CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL,
  email varchar(254) NOT NULL UNIQUE, password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','therapist','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id), title text NOT NULL DEFAULT 'روان‌شناس',
  specialty text NOT NULL DEFAULT 'اضطراب و استرس', city varchar(80) NOT NULL DEFAULT '',
  address varchar(500) NOT NULL DEFAULT '', bio varchar(2000) NOT NULL DEFAULT '',
  license_number varchar(80) NOT NULL DEFAULT '', experience integer NOT NULL DEFAULT 0 CHECK(experience BETWEEN 0 AND 70),
  fee integer NOT NULL DEFAULT 0 CHECK(fee BETWEEN 0 AND 100000000), phone_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','changes_requested','approved','rejected')),
  feedback varchar(2000) NOT NULL DEFAULT '', is_demo boolean NOT NULL DEFAULT false,
  identity_checked boolean NOT NULL DEFAULT false, license_checked boolean NOT NULL DEFAULT false,
  official_reference varchar(500) NOT NULL DEFAULT '', interview_completed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz, reviewed_by uuid REFERENCES users(id)
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK(kind IN ('identity','license','degree')),
  filename text NOT NULL, mime text NOT NULL, storage_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,kind)
);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES users(id), subject_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (key text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL);
