# Adansi — The Collective Finance Protocol

> *"Every contribution builds your future."*

A **PWA + USSD-first** fintech platform for Ghanaian group contributions (Susu).  
Built for the **MTN MoMo Fintech Lab 2026** — Accra, Kumasi, Tamale.

---

## Monorepo Structure

```
adansi/
├── backend/     # FastAPI async backend (Python 3.11+)
└── frontend/    # Vite + React 18 PWA (TailwindCSS)
```

---

## Architecture

| Layer | Technology |
|---|---|
| **Frontend** | Vite + React 18 + Tailwind CSS + PWA |
| **Backend** | FastAPI + SQLAlchemy 2.0 (async) |
| **Database** | Supabase PostgreSQL |
| **Auth** | Supabase Auth (Phone OTP) |
| **Cache** | Upstash Redis |
| **Payments** | Hubtel MoMo API |
| **Notifications** | Twilio WhatsApp API |
| **Hosting** | Vercel (frontend) + Render (backend) |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (free tier works)

### 1 — Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in .env with your credentials (see backend/README.md)

uvicorn app.main:app --reload --port 8000
```

API available at: <http://localhost:8000>  
Swagger docs: <http://localhost:8000/docs>

### 2 — Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

npm run dev
```

App available at: <http://localhost:5173>

---

## Local Dev with Docker Compose

```bash
# From the adansi/ root:
docker compose up
```

This starts both services together (backend on :8000, frontend on :5173).  
Ensure your `.env` files are populated before running.

---

## Deployment

| Service | Platform | Config file |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | `frontend/vercel.json` |
| Backend | [Render](https://render.com) | `frontend/render.yaml` |

---

## Features

- **USSD-First** — Dial `*422*1#` on any phone (no smartphone required)
- **Group Contributions** — Funeral, wedding, health, savings, investment groups
- **Transparent Ledger** — Every member sees every transaction in real-time
- **Social Credit Scoring** — Contributions build your creditworthiness (0–1000 scale)
- **Agent Guardian Network** — Biometric verification at MTN MoMo agents for large withdrawals
- **Diaspora Bridge** — Send money home from abroad (USD, GBP, EUR, CAD)
- **Group Marketplace** — Bulk-purchase deals for coffins, catering, textbooks, insurance
- **Embedded Micro-Insurance** — Funeral, wedding, health policies (Phase 2)

---

## Sub-package READMEs

- [backend/README.md](./backend/README.md) — API endpoints, services, DB schema, auth flow
- [frontend/README.md](./frontend/README.md) — Screens, components, env vars, routing

---

## Team

Built for the **MTN MoMo Fintech Lab 2026** — Accra, Kumasi, Tamale.
