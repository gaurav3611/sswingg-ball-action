-- PostgreSQL schema for the Phase 6 backend. Designed, not built or run.
CREATE TYPE role AS ENUM ('bowler', 'coach', 'admin');
CREATE TYPE metric_kind AS ENUM ('measured', 'estimated', 'manual', 'unavailable');

CREATE TABLE users (
  id uuid PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL,
  role role NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bowler_profiles (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, age int, height_cm numeric, mass_kg numeric,        -- optional on purpose
  bowling_arm text NOT NULL CHECK (bowling_arm IN ('left','right')),
  style text NOT NULL, experience text NOT NULL, preferred_view text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE consents (
  id uuid PRIMARY KEY, bowler_id uuid NOT NULL REFERENCES bowler_profiles(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_upload boolean NOT NULL DEFAULT false, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY, bowler_id uuid NOT NULL REFERENCES bowler_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL, session_type text NOT NULL, camera_view text NOT NULL,
  requested_fps int NOT NULL, delivered_fps numeric, dropped_estimate int, longest_gap_ms int,
  width_px int, height_px int, duration_ms int, format_max_fps int,
  device_model text, os_version text, app_version text,
  calibration jsonb,                         -- null until a calibration step exists
  retention_until timestamptz
);
CREATE TABLE videos (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  object_key text NOT NULL, uploaded_with_consent boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE deliveries (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  t_ms int NOT NULL, intended text, source text NOT NULL CHECK (source IN ('manual','detected'))
);
CREATE TABLE detected_events (
  id uuid PRIMARY KEY, delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  kind text NOT NULL, t_ms int NOT NULL, confidence numeric NOT NULL, corrected_by_user boolean NOT NULL DEFAULT false
);
CREATE TABLE pose_tracks (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  model_id text NOT NULL, model_version text NOT NULL, rotation int, width int, height int,
  frames jsonb NOT NULL                       -- same compact layout as the phone's pose.json
);
CREATE TABLE metric_measurements (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE CASCADE, metric text NOT NULL,
  value numeric, unit text NOT NULL, kind metric_kind NOT NULL, confidence numeric, reason text,
  model_version text NOT NULL, provenance jsonb NOT NULL,
  CHECK ((kind = 'unavailable') = (value IS NULL))      -- an unavailable metric has no value, and only then
);
CREATE TABLE feedback (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  observed text NOT NULL, metric text NOT NULL, measured_value numeric, comparison text,
  why_it_matters text NOT NULL, drill text NOT NULL, confidence numeric NOT NULL, refer_to_coach text,
  author_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE session_comparisons (
  id uuid PRIMARY KEY, session_a uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_b uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now()
);
