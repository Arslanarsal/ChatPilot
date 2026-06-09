# ChatPilot — API & AI Engine

ChatPilot is an AI-powered assistant that answers customer messages on a business's
WhatsApp number automatically, 24/7. This repository is the **backend** — the brain of
the system. It runs the AI agent, manages companies and their contacts, stores
conversations, and talks to the WhatsApp connector service.

It works together with two other services:

- **ChatPilot API** (this repo) — NestJS backend, AI agent, business logic, database
- **WB** — a separate service that holds the live WhatsApp connection (Baileys)
- **Frontend** — a Next.js dashboard where business owners configure everything

---

## What it does

A customer sends a WhatsApp message → the WB service forwards it here through a webhook →
ChatPilot loads that company's AI configuration and conversation history → **Google
Gemini** generates a reply → ChatPilot sends the reply back through WB → the customer
receives it on their normal WhatsApp chat.

Each company gets its own AI personality, its own contacts, and its own conversation
history. One backend serves many companies at the same time (multi-tenant).

---

## Key features

- **AI agent powered by Google Gemini 2.5 Flash** — replies in English, Urdu, and mixed
  language, in the business's own tone.
- **Tool-using agent** — the AI can call functions instead of only replying with text:
  - `save_name` — remembers the customer's name
  - `book_appointment` — books a slot via cal.com
  - `notify_company` — flags a lead or payment for a human to follow up
  - `set_needs_review` — pauses the bot and asks a human to take over
- **Multi-tenant** — many companies, each isolated with their own data and AI prompt.
- **Per-contact bot toggle** — the bot can be switched off for one specific customer.
- **Voice, image & PDF handling** — incoming media is processed and understood.
- **Encrypted message storage** — every conversation is stored AES-256-GCM encrypted in
  the database, keyed off `JWT_SECRET`.
- **Background jobs** — replies and follow-ups run through a BullMQ + Redis queue so the
  API stays fast and reliable.
- **Auth** — JWT-based login, signup, refresh, and OTP-based password reset.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| AI | Google Gemini via the Vercel AI SDK (`@ai-sdk/google`) |
| Database | PostgreSQL + Prisma ORM (pg adapter) |
| Queues | BullMQ + Redis |
| Auth | JWT (`@nestjs/jwt`, Passport) + bcrypt |
| File storage | Supabase Storage (media uploads) |
| Monitoring | Sentry + Winston logging |
| API docs | Swagger |

---

## Project structure

```
src/
├── auth/              # login, signup, JWT, OTP password reset
├── company/           # company settings, dashboard stats, AI prompt generation
├── contact/           # contacts, messages, conversation history
├── webhook/           # receives incoming WhatsApp messages from WB
├── vercel-ai/         # the AI agent, tools, and message processing
├── background-tasks/  # BullMQ processors (reply, follow-up)
├── common/            # crypto (message encryption), logging, filters
├── config/            # typed config service (env vars)
├── prisma/            # Prisma service
└── utils/             # shared helpers and the WB client
```

---

## Getting started

### Requirements

- Node.js 20+
- PostgreSQL database
- Redis
- The WB service running (for live WhatsApp)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file (see below) and set your values

# 3. Apply database migrations
npm run migrations:run

# 4. Start in development
npm run start:dev
```

The API runs on `http://localhost:3000` with the prefix `/api/v1`.
Swagger docs are available at `http://localhost:3000/api`.

### Environment variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/chatpilot?schema=public

GEMINI_API_KEY=your_google_gemini_api_key
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_jwt_secret            # also used to encrypt stored messages
JWT_REFRESH_SECRET=your_refresh_secret

FRONTEND_URL=http://localhost:3001
WB_BASE_URL=http://localhost:3002     # the WhatsApp connector service

SUPABASE_STORAGE_URL=...              # for media uploads
SUPABASE_SERVICE_KEY=...

BULL_BOARD_USER=admin                 # queue dashboard auth
BULL_BOARD_PASSWORD=password
```

---

## Useful scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Start with hot reload |
| `npm run start` | Run migrations then start |
| `npm run build` | Build for production |
| `npm run migrations:run` | Apply Prisma migrations |
| `npm run test` | Run tests |
| `npm run lint:fix` | Lint and auto-fix |

---

## Running with Docker

A `Dockerfile` and `docker-compose.yml` are included. In production the full system runs
as containers behind Nginx:

```
postgres · redis · chatpilot (this) · whatsapp-bot · frontend
```

```bash
docker compose up -d
```

---

## How a message flows

```
Customer (WhatsApp)
        │
        ▼
   WB service  ──webhook──►  ChatPilot API
                                  │
                       loads company + history
                                  │
                          Gemini AI agent
                          (text + tools)
                                  │
                    encrypted save to PostgreSQL
                                  │
        ◄────── reply sent back through WB ──────
        ▼
Customer (WhatsApp)
```
