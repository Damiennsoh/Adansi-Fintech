# ADANSI Backend — Part 2 (Complete)

The Collective Finance Protocol — Full Backend API for MTN MoMo Fintech Lab 2026.

## What Is New in Part 2

Part 2 completes the backend with full CRUD, business logic, and external integrations:

| Feature | Status |
|---------|--------|
| **Supabase Auth** | Full phone OTP, JWT verification, PIN management |
| **Redis Sessions** | USSD state machine with Redis (or in-memory fallback) |
| **Credit Scoring Engine** | Rule-based algorithm (6 factors, 0-1000 scale) |
| **Twilio WhatsApp** | Outbound notifications for contributions, withdrawals, loans |
| **Hubtel MoMo** | Collections + disbursements with callback handling |
| **Full CRUD Routers** | All endpoints now query database, not mocked |
| **Auth Middleware** | JWT Bearer token verification via Supabase secret |
| **Rate Limiting** | PIN attempt lockout (5 attempts = 15min block) |
| **Background Tasks** | Async notification sending, credit score updates |

## Tech Stack

- **FastAPI** (Python 3.11+, async)
- **SQLAlchemy 2.0** (async ORM)
- **Supabase** (PostgreSQL + Auth + Storage)
- **Redis / Upstash** (USSD sessions, rate limiting, credit cache)
- **Hubtel** (MoMo collections + disbursements)
- **Twilio** (WhatsApp Business API + SMS)

## Quick Start

### 1. Setup environment

```bash
cd adansi-part2-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials:
# - Supabase URL, anon key, service role key, JWT secret
# - PostgreSQL connection string
# - Redis/Upstash URL
# - Hubtel client ID, secret, merchant ID
# - Twilio SID, auth token, WhatsApp number
```

### 3. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000`
Docs: `http://localhost:8000/docs`

## Project Structure

```
adansi-backend/
├── app/
│   ├── main.py              # FastAPI app + router registration
│   ├── config.py            # Pydantic settings from .env
│   ├── database.py          # SQLAlchemy async engine + session
│   ├── middleware/
│   │   └── auth.py          # JWT verification dependency
│   ├── models/              # 11 SQLAlchemy ORM models
│   ├── schemas/             # Pydantic v2 request/response schemas
│   ├── routers/             # 10 API modules, ~60 endpoints
│   └── services/
│       ├── auth_service.py       # PIN hashing, JWT creation
│       ├── supabase_client.py    # Supabase Auth + Storage
│       ├── group_service.py      # Group creation, code generation
│       ├── momo_service.py       # Hubtel MoMo integration
│       ├── redis_service.py      # USSD sessions, rate limiting
│       ├── notification_service.py # Twilio WhatsApp/SMS
│       └── credit_service.py     # Rule-based scoring engine
├── alembic/                 # Optional local dev migrations (see Database Migrations below)
├── tests/
├── requirements.txt
├── .env.example
└── README.md
```

## API Endpoints (All Modules)

| Module | Prefix | Endpoints | Description |
|--------|--------|-----------|-------------|
| Auth | `/api/v1/auth` | 7 | Register, OTP, login, refresh, PIN reset, Ghana Card |
| Users | `/api/v1/users` | 4 | Profile, credit profile, notifications |
| Groups | `/api/v1/groups` | 12 | Create, join, invite, balance, members, roles |
| Contributions | `/api/v1/contributions` | 4 | Initiate, verify, status, Hubtel webhook |
| Withdrawals | `/api/v1/withdrawals` | 5 | Request, approve, agent verify, disburse |
| Credit | `/api/v1/credit` | 8 | Score, history, loan apply/repay, group vouch |
| Agents | `/api/v1/agents` | 4 | Login, pending verifications, submit verify |
| USSD | `/api/v1/ussd` | 3 | Hubtel webhook, menu debug, session reset |
| WhatsApp | `/api/v1/whatsapp` | 3 | Twilio webhook, send, broadcast |
| MoMo | `/api/v1/momo` | 4 | Request payment, disburse, callback, query |

## Key Services

### Credit Scoring Engine
- **6 weighted factors**: Consistency (35%), Volume (25%), Diversity (15%), Tenure (10%), Standing (10%), Behavior (5%)
- **Score tiers**: No Credit (0-299), Bronze (300-499), Silver (500-649), Gold (650-799), Platinum (800-1000)
- **Loan amounts**: GHS 0 / 100 / 300 / 600 / 1,000
- **Group vouch**: Reduces interest rate by 1.5%
- **Cached in Redis** for 1 hour, recalculated after every contribution

### USSD State Machine
- **Redis-backed** sessions with 5-minute TTL
- **Auto-cleanup** of expired sessions
- **Multi-step flows**: Join group -> Confirm -> Complete
- **In-memory fallback** if Redis unavailable

### Notification Service
- **WhatsApp** via Twilio Business API
- **SMS fallback** for non-WhatsApp users
- **Event types**: Contribution alerts, withdrawal requests, loan reminders, group invites
- **Sandbox ready** — no Meta business verification needed

### MoMo Integration (Hubtel)
- **Collections**: Request payment from user wallet
- **Disbursements**: Send money to user wallet
- **Callback verification**: Signature + idempotency checks
- **Auto-updates**: Group balance, member totals, credit score on payment completion

## Authentication Flow

1. **Register**: `POST /api/v1/auth/register` → phone, name, PIN
2. **Verify OTP**: `POST /api/v1/auth/verify-otp` → phone, OTP token
3. **Login**: `POST /api/v1/auth/login` → phone, PIN → returns JWT
4. **Use API**: Include `Authorization: Bearer <token>` header
5. **Rate limit**: 5 failed PIN attempts = 15-minute lockout

## Database Migrations

**Supabase is PostgreSQL.** The hosted database lives on Supabase; the FastAPI backend connects to it via `DATABASE_URL` (async SQLAlchemy).

**Source of truth:** [`supabase/migrations/`](../supabase/migrations/) — apply with Supabase CLI (`npx supabase db push`) or the Supabase SQL Editor.

**Why Alembic exists:** Alembic is SQLAlchemy’s migration runner, included for optional **local dev** when you run `init_db()` or experiment without Supabase. It is **not** a separate database — both tools target the same PostgreSQL instance. For production and team sync, use **Supabase migrations only** and treat Alembic as legacy/optional.

## Database

All 11 models with relationships, indexes, and foreign keys:
- `users`, `groups`, `group_members`
- `contributions`, `withdrawals`, `withdrawal_approvals`
- `transactions` (unified audit ledger)
- `credit_profiles`, `loans`
- `agent_verifications`, `insurance_policies`
- `notifications`, `ussd_sessions`

## External Integrations Setup

### Supabase
1. Create project at `https://supabase.com`
2. Get connection string: Settings → Database → Connection string
3. Enable Phone Auth: Authentication → Providers → Phone
4. Get JWT secret: Settings → API → JWT Settings

### Hubtel (MoMo Sandbox)
1. Register at `https://hubtel.com`
2. Create merchant account
3. Get client ID, secret, merchant ID
4. Sandbox available immediately

### Twilio (WhatsApp Sandbox)
1. Sign up at `https://twilio.com/try-whatsapp`
2. Get sandbox number (+1 415 523 8886)
3. Get Account SID and Auth Token
4. Join sandbox: Send "join {code}" to sandbox number

### Upstash (Redis)
1. Create database at `https://upstash.com`
2. Copy REST URL and token
3. Free tier: 10,000 requests/day

## Next Steps

1. **Frontend (Part 3)**: Vite + React PWA with Supabase Realtime
2. **Testing**: Add pytest test suite
3. **Production**: Alembic migrations, Render deployment
4. **Phase 2**: Insurance API integration, group marketplace, diaspora remittance

## Team

- Backend Developer
- Frontend Developer (Vite + React PWA)
- Product Strategist

---
Built for the MTN MoMo Fintech Lab 2026.
