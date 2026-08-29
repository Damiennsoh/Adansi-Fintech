# Adansi — The Collective Finance Protocol

A PWA + USSD-first fintech platform for Ghanaian group contributions (Susu), built for the MTN MoMo Fintech Lab 2026.

## Architecture

| Layer | Technology |
|---|---|
| **Frontend** | Vite + React 18 + Tailwind CSS + PWA |
| **Backend** | FastAPI + SQLAlchemy (async) |
| **Database** | Supabase PostgreSQL |
| **Auth** | Supabase Auth (Phone OTP) |
| **Cache** | Upstash Redis |
| **Payments** | Hubtel MoMo API |
| **Notifications** | Twilio WhatsApp API |
| **Hosting** | Vercel (frontend) + Render (backend) |

## Features

- **USSD-First** — Dial `*422*1#` on any phone, no smartphone required
- **Group Contributions** — Funeral, wedding, health, savings, investment groups
- **Transparent Ledger** — Every member sees every transaction in real-time
- **Social Credit Scoring** — Contributions build your creditworthiness
- **Agent Guardian Network** — Biometric verification at MTN MoMo agents for large withdrawals
- **Diaspora Bridge** — Send money home from abroad (USD, GBP, EUR, CAD)
- **Group Marketplace** — Bulk-purchase deals for coffins, catering, textbooks, insurance
- **Embedded Micro-Insurance** — Funeral, wedding, health policies (Phase 2)

## Quick Start

### Frontend

```bash
cd adansi-frontend
npm install
cp .env.example .env
# Edit .env with your Supabase & API credentials
npm run dev
```

### Backend

```bash
cd adansi-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp backend.env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload --port 8000
```

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Connect repo to [vercel.com](https://vercel.com)
3. Set environment variables from `.env.example`
4. Deploy — auto-builds on every push

### Backend → Render

1. Push to GitHub
2. Connect repo to [render.com](https://render.com)
3. Use `render.yaml` blueprint or manual setup:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set environment variables from `backend.env.example`

## Environment Variables

### Frontend (.env)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_URL` | Your FastAPI backend URL |

### Backend (.env)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `JWT_SECRET` | Random string for JWT signing |
| `HUBTEL_CLIENT_ID` | Hubtel MoMo API credentials |
| `HUBTEL_CLIENT_SECRET` | Hubtel MoMo API credentials |
| `TWILIO_SID` | Twilio account SID |
| `TWILIO_TOKEN` | Twilio auth token |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

## Project Structure

```
adansi-frontend/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App icons
├── src/
│   ├── components/            # Reusable UI components
│   ├── pages/                 # All 16 screens
│   ├── hooks/                 # React Query + custom hooks
│   ├── store/                 # Zustand state management
│   ├── lib/                   # Supabase, API client, utilities
│   ├── App.jsx                # Router configuration
│   ├── main.jsx               # Entry point
│   └── index.css              # Tailwind directives + animations
├── package.json
├── vite.config.js             # Vite + PWA plugin
├── tailwind.config.js
├── vercel.json                # Vercel deployment config
└── .env.example
```

## Screens

| Screen | Route | Description |
|---|---|---|
| Login | `/login` | Phone OTP + PIN login |
| Verify OTP | `/verify-otp` | 6-digit SMS verification |
| Setup PIN | `/setup-pin` | Create 4-digit PIN |
| Dashboard | `/dashboard` | Balance, credit score, groups, activity |
| Groups | `/groups` | List, filter, search all groups |
| Group Detail | `/groups/:id` | Balance, members, transactions, USSD |
| Create Group | `/groups/create` | Name, type, target, frequency |
| Join Group | `/groups/join` | Enter 6-char code |
| Contribute | `/groups/:id/contribute` | Amount input, MoMo payment flow |
| Withdraw | `/groups/:id/withdraw` | Request with approval workflow |
| Credit | `/credit` | Score ring, breakdown, loan application |
| Profile | `/profile` | Settings, Ghana Card, logout |
| Notifications | `/notifications` | Push-style alerts |
| Diaspora | `/diaspora` | International contributions, exchange rates |
| Marketplace | `/marketplace` | Bulk deals, group orders |
| Admin | `/admin` | Agent management, analytics, transactions |

## API Integration

The frontend expects a FastAPI backend at `VITE_API_URL` with these modules:

- `/auth` — OTP, PIN, JWT
- `/users` — Profile, credit score
- `/groups` — CRUD, join, invite
- `/contributions` — Initiate, verify, webhook
- `/withdrawals` — Request, approve, agent verify
- `/credit` — Score, loans, repayment
- `/ussd` — Hubtel USSD webhook
- `/whatsapp` — Twilio webhook
- `/momo` — Hubtel collections/disbursements
- `/diaspora` — International contributions
- `/marketplace` — Deals, orders
- `/admin` — Platform analytics

## Team

Built for the **MTN MoMo Fintech Lab 2026** — Accra, Kumasi, Tamale.

---

*Adansi: "Every contribution builds your future."*
