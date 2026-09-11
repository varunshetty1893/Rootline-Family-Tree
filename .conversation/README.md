# Rootline

A digital family tree management system. This repo has two parts:

- **`backend/`** — FastAPI + PostgreSQL. Handles register, login, logout,
  forgot/reset password, and Google OAuth. Issues JWTs.
- **`src/`** — Vite + React + Tailwind frontend: Home, Register, Login,
  Forgot/Reset Password, Google OAuth callback, and a protected Dashboard.

## 1. Database

Easiest path — spin up Postgres with Docker:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with user `postgres` / password
`postgres` / database `rootline` (matches `backend/.env.example`). No Docker?
Install Postgres locally and create a `rootline` database, then point
`DATABASE_URL` at it.

If startup ends with `password authentication failed for user "postgres"`,
the Python environment is working but the database credentials do not match.
Make sure the database is running and that `backend\.env` contains the
credentials for that database:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rootline
```

For the Docker database included with this project, run this from the
repository root in a second PowerShell window:

```powershell
docker compose up -d db
docker compose ps
```

Then restart Uvicorn from `backend`. If Docker reports an existing database
volume with a password different from `postgres`, either use the original
password in `backend\.env`, or reset the password on that database. Do not
run `docker compose down -v` unless the database is disposable: the `-v`
flag deletes the Postgres data volume.

## 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then edit .env (see below)
python -m uvicorn app.main:app --reload --port 8000
```

Tables are created automatically on first run (`Base.metadata.create_all`).
For a real production setup, swap that for Alembic migrations.

API docs: `http://localhost:8000/docs`

### Windows PowerShell

Run these commands from the repository root. The `cd backend` step matters:
`app.main` lives inside `backend`, and `requirements.txt` is
`backend\requirements.txt`.

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks activation, either run
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` once in that
terminal or skip activation and use the virtual-environment interpreter
directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

If you see `Router.__init__() got an unexpected keyword argument
'on_startup'`, FastAPI and Starlette are from incompatible installations.
Install the pinned dependencies inside the project virtual environment
instead of using the global Python installation:

```powershell
python -m pip install --force-reinstall -r requirements.txt
python -m pip check
```

The `401 Unauthorized` responses shown before a successful login are
expected; `/auth/me` and `/people` require the JWT returned by login.

### Configuring `.env`

- `DATABASE_URL` — already correct if you used `docker compose up -d`.
- `SECRET_KEY` — set to any long random string (`openssl rand -hex 32`).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
  Create an OAuth 2.0 Client ID (Web application) and add
  `http://localhost:8000/auth/google/callback` as an authorized redirect URI.
- `GOOGLE_REDIRECT_URI` — must exactly match what you added in Google Cloud
  Console.
- `FRONTEND_URL` — where the frontend runs (`http://localhost:5173` by
  default with Vite).

### Password reset emails (dev mode)

`forgot-password` doesn't require real email to work locally — the reset
link is printed to the backend's console (`app/email_utils.py`). Copy that
link into your browser to test the reset flow. Swap `send_reset_email()` for
a real provider (SMTP, SendGrid, SES, Postmark…) before going live.

## 3. Frontend

```bash
npm install
cp .env.example .env      # VITE_API_URL, defaults to http://localhost:8000
npm run dev
```

Open the printed local URL. Routes:

| Path               | Page                          |
|--------------------|--------------------------------|
| `/`                | Home                           |
| `/register`        | Create account                 |
| `/login`           | Sign in                        |
| `/forgot-password` | Request a reset link           |
| `/reset-password`  | Set a new password (from email link) |
| `/oauth-callback`  | Handles the Google OAuth redirect |
| `/dashboard`       | Protected — redirects to `/login` if not signed in |

Auth state (JWT + user) lives in `AuthContext.jsx`, persisted to
`localStorage`, and is checked against `/auth/me` on load so refreshing the
page doesn't log you out.

## How auth flows work

- **Register / Login** — form posts to `/auth/register` or `/auth/login`,
  backend returns a JWT + user object, frontend stores it and redirects to
  `/dashboard`.
- **Logout** — clears the token client-side and calls `/auth/logout` (JWTs
  are stateless; that endpoint is a hook point if you later add server-side
  token revocation, e.g. a Redis blocklist).
- **Forgot/reset password** — `/auth/forgot-password` always returns the
  same message whether or not the email exists (prevents account
  enumeration), creates a time-limited token row in `password_reset_tokens`,
  and "emails" the link. `/auth/reset-password` validates the token, updates
  the password, and marks the token used.
- **Google OAuth** — clicking "Continue with Google" hits
  `/auth/google/login`, which redirects to Google. Google redirects back to
  `/auth/google/callback`, the backend exchanges the code, finds-or-creates
  the user, issues a JWT, and redirects to the frontend's
  `/oauth-callback?token=...`, which stores the token and lands on
  `/dashboard`.

## Next steps

- Alembic migrations instead of `create_all` for production.
- Rate-limit `/auth/login` and `/auth/forgot-password`.
- Real transactional email provider.
- The person/relationship/tree-generation pieces (forms, PostgreSQL schema
  for people + relationships, tree rendering) — this repo currently covers
  auth end-to-end; the tree itself is the next milestone.
