# Backend API (designed, not built)

The app today runs fully on the phone. This is the design for Phase 6. Stack from the spec: FastAPI, PostgreSQL, object storage. Schema: [schema.sql](schema.sql).

- **Transport:** HTTPS only. **Auth:** short-lived access token (JWT) plus refresh token; passwords hashed with argon2id server-side; tokens kept in the phone's secure store.
- **Roles:** `bowler`, `coach`, `admin`. A coach reads a bowler's data only through an active `consent` row.
- **Video** is private by default and uploaded only after a per-session consent, to object storage with pre-signed URLs that expire.
- Every result stores `model_version`, calibration, device, frame rate and provenance.

| Method and path | Purpose |
|---|---|
| POST `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Accounts |
| GET, PATCH `/me`; DELETE `/me` | Profile, deletion of the account and all data |
| GET `/me/export` | Everything about the user as JSON |
| GET, POST `/bowlers`; GET, PATCH, DELETE `/bowlers/{id}` | Bowler profiles |
| POST `/bowlers/{id}/consents`; DELETE `/consents/{id}` | Grant or withdraw a coach's access |
| GET, POST `/sessions`; GET, DELETE `/sessions/{id}` | Sessions (metadata, capture info) |
| POST `/sessions/{id}/video` | Returns a pre-signed upload URL. Requires `consent.video_upload`. |
| GET, POST `/sessions/{id}/deliveries` | Deliveries and their events |
| PUT `/sessions/{id}/pose` | Pose track (keypoints) |
| GET, POST `/sessions/{id}/metrics` | Metric measurements: kind, value, unit, confidence, reason |
| GET, POST `/sessions/{id}/feedback`; POST `/feedback/{id}/comments` | Coaching feedback and coach comments |
| POST `/comparisons` | Compare two sessions |
| POST `/sessions/{id}/process` | Optional cloud processing. Off unless the user enabled it. |

A metric on the wire always has `kind` in `measured | estimated | manual | unavailable`, and `reason` when unavailable.
