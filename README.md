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
# From the Adansi repo root:
docker compose up --build
```

This starts both containers on the shared `adansi` network:

| Service | Container | URL |
|---|---|---|
| Backend (FastAPI) | `adansi-backend` | http://localhost:8000 (`/docs`, `/health`) |
| Frontend (Vite) | `adansi-frontend` | http://localhost:5173 |

The frontend proxies `/api` to `http://backend:8000` inside Docker, so the browser only needs the frontend origin. Optional `backend/.env` and `frontend/.env` are loaded when present; copy from each folder's `.env.example`.

---

## Deployment

| Service | Platform | Config file |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | `frontend/vercel.json` |
| Backend | [Render](https://render.com) | `frontend/render.yaml` |

---

## Features

### MVP / Current Product

- **USSD-first participation** — A feature-phone-friendly contribution path (`*422*1#`).
- **Group contributions** — Create and manage funeral, wedding, health, savings, and investment groups.
- **Transparent group ledger** — Members can review contribution and withdrawal history.
- **Multi-signatory withdrawals** — Require multiple group approvals before disbursement.
- **Beneficiary disbursement workflow** — Model approved payments directly to a beneficiary.
- **Social credit scoring** — Build a contribution-based score from recorded repayment and payment behavior.
- **Diaspora contribution flow** — Support international contribution intent and currency conversion workflows.
- **Sandbox payment mode** — Demonstrate contribution and withdrawal flows without moving real money while Hubtel onboarding is pending.

### Roadmap / Not Yet Live

- Dedicated group wallets or sub-merchant accounts.
- Agent-assisted identity and withdrawal verification.
- Group marketplace and negotiated bulk purchases.
- Embedded micro-insurance products.
- Automated recurring collections and production notifications.

Adansi is not a bank and does not currently provide deposit-taking, interest-bearing savings, insurance, or live payment services without the required regulated partners and credentials. See the full product definition and roadmap in [FEATURE_DOCUMENTATION.md](./FEATURE_DOCUMENTATION.md).

---

## Sub-package READMEs

- [backend/README.md](./backend/README.md) — API endpoints, services, DB schema, auth flow
- [frontend/README.md](./frontend/README.md) — Screens, components, env vars, routing

---

## Team

Built for the **MTN MoMo Fintech Lab 2026** — Accra, Kumasi, Tamale.
