# SI Investing App

A personal dividend portfolio dashboard: view holdings in PostgreSQL and import from CSV. Built with the **same tech stack as [cloud-db-inventory](https://github.com/your-org/cloud-db-inventory)** for consistency.

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

---

## Running on your machine (first-time setup)

### 1. Clone and install

```bash
git clone <repo-url>
cd SI-Investing-App
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

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
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

- **"Environment variable not found: DATABASE_URL"** — Create `.env` from `.env.example` when running the backend locally.
- **"relation does not exist"** — Backend runs `init_db()` on startup; ensure the backend has started after Postgres.
- **Frontend can’t reach API** — In Docker, nginx proxies `/api` to `backend:8000`. For local dev, ensure the backend is on port 8000 and Vite proxy targets it (default).
- **Port 5432, 8000, or 3000 in use** — Stop the conflicting process or change ports in `docker-compose.yml`.
- **"postgres failed to start" / "container si-investing-postgres is unhealthy"** — Often caused by port 5432 already in use. Stop the other Postgres container, or run `docker compose up -d --remove-orphans` to remove orphaned containers. If you need another Postgres on the host, change the SI app Postgres port in `docker-compose.yml` (e.g. `"5433:5432"`).
