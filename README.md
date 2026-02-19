# Stock-Research-App

A personal dividend portfolio dashboard: view holdings in PostgreSQL and import from CSV. Built with the **same tech stack as [cloud-db-inventory](https://github.com/your-org/cloud-db-inventory)** for consistency.

**Primary way to run:** Docker Compose (`docker compose up`). All services (Postgres, backend, frontend) run in containers; data persists in a Docker volume.

---

## Tech stack (aligned with cloud-db-inventory)

| Layer    | Technology |
|---------|------------|
| **Frontend** | Vite, React 18, TypeScript, MUI (Material UI), Axios |
| **Frontend serve** | nginx (Alpine) — static build + proxy `/api` to backend |
| **Backend** | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2, psycopg2-binary |
| **Database** | PostgreSQL 17 (Alpine) in Docker |
| **Orchestration** | Docker Compose (postgres, backend, frontend) |

---

## Prerequisites

- **Node.js** 20+ (for frontend dev/build)
- **Python** 3.12+ (for backend dev)
- **Docker Desktop** (for running the full stack)

---

## Quick start (Docker — recommended)

From the project root:

```bash
docker compose up -d --build
```

- **App (UI):** http://localhost:3000  
- **Backend API:** http://localhost:8000  
- **Postgres:** `localhost:5432` (user `si_user`, password `si_password`, database `si_investing`)

Data is stored in the `pgdata` volume and persists between restarts. Tables are created automatically on first backend startup (`init_db()`).

**After code or dependency changes:** rebuild and restart so the containers pick up changes:

```bash
docker compose up -d --build
```

To rebuild only one service (e.g. backend): `docker compose build backend && docker compose up -d backend`.

---

## Docker vs Python virtual environment (.venv)

| How you run | What it is | When to use it |
|-------------|------------|----------------|
| **Docker** (`docker compose up`) | Backend, frontend, and Postgres run inside containers with their own Python, Node, and dependencies. Nothing is installed on your machine except Docker. | **Running the full app** (UI + API + DB) with one command; same setup on every machine; no local Python/Node version conflicts. |
| **.venv** (virtual environment) | A folder (e.g. `backend/.venv`) that holds a **copy of Python** and **project-specific packages** (FastAPI, SQLAlchemy, etc.). You “activate” it so `python` and `pip` point into that folder instead of system Python. | **Local development** (edit backend code and see changes without rebuilding the image), **running scripts** (e.g. `scripts/excel_stock_analysis.py`), or **debugging** on your host. |

**Why use .venv when you already have Docker?**

- **Docker** = “run the app as built.” Dependencies and Python live inside the image. You don’t install FastAPI or pandas on your Mac; the container has them. Great for “just run it.”
- **.venv** = “run Python on my machine, but isolated.” You install dependencies into `.venv` so:
  - You don’t pollute **system Python** (or other projects).
  - You get a **reproducible** set of packages per project (same `requirements.txt` as the backend image).
  - You can **run the backend locally** with `uvicorn --reload` (instant code changes) or run **standalone scripts** (e.g. the Excel analyzer) that aren’t in Docker.

So: **Docker** = run the full stack with no local Python/Node setup. **.venv** = when you want to run or develop Python on your machine in an isolated, project-specific way.

---

## Activate a .venv and run the backend locally

From the project root. Use **Python 3.12** (or 3.13) so `psycopg2-binary` has pre-built wheels; Python 3.14 may force a source build and require `pg_config`.

```bash
cd backend
python3.12 -m venv .venv   # or python3.13; avoid 3.14 for now (no psycopg2-binary wheel)
source .venv/bin/activate   # macOS/Linux
# On Windows:  .venv\Scripts\activate
pip install -r requirements.txt
```

Your prompt will usually show `(.venv)` so you know the env is active. Then run the backend:

```bash
# Postgres must be running (e.g. docker compose up -d postgres)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

To run the **Excel/stock analysis script** (different deps), use a venv at the **repo root** and the root `requirements.txt`:

```bash
cd /path/to/Stock-Research-App
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/excel_stock_analysis.py raw_data/some.csv
```

To **leave** the virtual environment:

```bash
deactivate
```

---

## Running on your machine (first-time setup)

### 1. Clone and install

```bash
git clone <repo-url>
cd Stock-Research-App
```

### 2. Environment variables (for local backend)

Create a `.env` in the project root (optional for Docker; required for running the backend locally):

```bash
cp .env.example .env
```

Default in `.env.example`:

```env
DATABASE_URL="postgres://si_user:si_password@localhost:5432/si_investing"
```

**.env is gitignored** — do not commit credentials.

### 3. Start the database

```bash
docker compose up -d postgres
```

Wait until Postgres is healthy (~10s).

### 4. Run the backend locally

Use a **Python virtual environment** so dependencies stay isolated (see [Activate a .venv and run the backend locally](#activate-a-venv-and-run-the-backend-locally) above). Then:

```bash
cd backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Tables are created on first request (lifespan `init_db()`).

### 5. Run the frontend locally

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/health` to `http://localhost:8000` by default.

### 6. Import data

- **From the UI:** Open the app → “Import CSV” → choose a dividend portfolio CSV (columns: Ticker, Company, Sector, Price, P/E, Ann. Div, Cur. Yield, 5-Yr Avg Yield, Valuation, Payout %, 5-Yr Gr, SI Verdict, Why it fits).
- **Sample files:** Put CSVs in the **`raw_data/`** folder (gitignored) and use them for import.

---

## Project structure

| Path | Purpose |
|------|--------|
| `frontend/` | Vite + React + MUI app; build served by nginx in Docker |
| `backend/` | FastAPI app (SQLAlchemy models, API, CSV import) |
| `scripts/` | Python Excel/stock analysis helper (separate from the web app) |
| `raw_data/` | Local CSV/Excel files (gitignored) |
| `.env` | Local env vars (gitignored; copy from `.env.example`) |

---

## Design decisions (aligned with cloud-db-inventory)

- **Same stack as cloud-db-inventory** — Vite + React + MUI frontend, FastAPI + SQLAlchemy backend, Postgres in Docker, nginx to serve frontend and proxy API. Easy for anyone who already runs cloud-db-inventory.
- **No Prisma** — Backend is Python; schema and tables are created with SQLAlchemy `Base.metadata.create_all()` on startup (no migration files).
- **Postgres 17-alpine** — Matches cloud-db-inventory; healthcheck so backend starts after DB is ready.
- **Frontend build in Docker** — Node 20 Alpine builds the Vite app; nginx Alpine serves static files and proxies `/api` to the backend. No Node at runtime in production.
- **`ticker` unique** — Upsert-by-ticker on CSV import so re-imports update existing rows.
- **`raw_data/` gitignored** — Sample or personal CSVs stay local.

---

## Scripts reference

| Command | Where | Description |
|--------|--------|-------------|
| `npm run dev` | frontend/ | Vite dev server (proxies API to backend) |
| `npm run build` | frontend/ | Production build |
| `uvicorn app.main:app --reload` | backend/ | Run FastAPI with auto-reload |
| `python scripts/excel_stock_analysis.py <path>` | root | Analyze Excel/CSV for stock tickers (standalone script) |

---

## Troubleshooting

- **"Failed to build psycopg2-binary" / "pg_config executable not found"** — You're likely on Python 3.14 (or another version without a pre-built wheel). Create the venv with Python 3.12: `python3.12 -m venv .venv` (install via [python.org](https://www.python.org/downloads/) or `brew install python@3.12`). Alternatively, install PostgreSQL client tools so `pg_config` is on `PATH` (e.g. `brew install postgresql`) and retry; building from source on 3.14 can still fail for other packages.
- **"Environment variable not found: DATABASE_URL"** — Create `.env` from `.env.example` when running the backend locally.
- **"relation does not exist"** — Backend runs `init_db()` on startup; ensure the backend has started after Postgres.
- **Frontend can’t reach API** — In Docker, nginx proxies `/api` to `backend:8000`. For local dev, ensure the backend is on port 8000 and Vite proxy targets it (default).
- **Port 5432, 8000, or 3000 in use** — Stop the conflicting process or change ports in `docker-compose.yml`.
- **"postgres failed to start" / "container stock-research-postgres is unhealthy"** — Often caused by port 5432 already in use. Stop the other Postgres container, or run `docker compose up -d --remove-orphans` to remove orphaned containers. If you need another Postgres on the host, change the SI app Postgres port in `docker-compose.yml` (e.g. `"5433:5432"`).
