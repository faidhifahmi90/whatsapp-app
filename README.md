# WhatsApp Center

A realtime conversational web app for shared-team WhatsApp operations using Twilio Messaging Services, Twilio Content API templates, and Programmable Messaging.

## Included features

- Two-way realtime conversation inbox with contact details, segments, and labels per conversation
- Individual contact creation with custom fields
- CSV bulk contact import with segment add, replace, or remove behavior
- One-click open or create conversation from contacts
- Template messaging with placeholders, media, CTA preview, and Twilio Content sync
- Simplified bulk or batch campaigns by segments or direct contact selection
- Workflow automation for keyword replies, new contacts, and segment joins
- Multiple shared logins pointing to the same dashboard and settings
- Multiple WhatsApp numbers/channels with easy channel switching
- Twilio inbound and status webhook endpoints

## Stack

- React + Vite frontend
- Express + Socket.IO backend
- SQLite via `better-sqlite3`
- Session auth with shared dashboard access
- Twilio Node SDK + Content API calls

## Local run

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Start development:

```bash
npm run dev
```

4. Open:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

## Seeded login

- Email: `admin@example.com`
- Password: `admin123`

Also seeded:

- `agent@example.com` / `admin123`

## Twilio setup

Set these in `.env`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_DEFAULT_MESSAGING_SERVICE_SID` optional but recommended
- `TWILIO_CONTENT_API_BASE` optional, defaults to `https://content.twilio.com/v1/Content`

Configure Twilio webhook URLs:

- Incoming messages:
  `POST /api/webhooks/twilio/incoming`
- Status callbacks:
  `POST /api/webhooks/twilio/status`

If Twilio credentials are missing, outbound sends are simulated so the UI and realtime flows still work locally.

## CSV import format

Expected columns:

- `firstName`
- `lastName`
- `phone`
- `email`
- `company`
- `labels`

Any extra CSV column is stored as a custom field. For `labels`, use `|` as a separator.

## Production build

```bash
npm run build
npm run start
```

## Docker deploy

Build and run:

```bash
docker build -t whatsapp-center .
docker run -p 3001:3001 --env-file .env whatsapp-center
```

Or with Compose:

```bash
docker compose up --build -d
```

## Public deployment

This repo now includes:

- `Dockerfile` for container deployment
- `docker-compose.yml` for single-host deployment
- `render.yaml` for Render blueprint deployment

Recommended production env:

- `PUBLIC_BASE_URL=https://your-domain`
- `TRUST_PROXY=true` when behind a load balancer or managed host
- `SESSION_COOKIE_SECURE=true`
- `TWILIO_WEBHOOK_VALIDATE=true`

Twilio console webhook URLs should point to:

- `https://your-domain/api/webhooks/twilio/incoming`
- `https://your-domain/api/webhooks/twilio/status`

## Notes

- Sessions are persisted in SQLite now, so restarts do not immediately log every user out on a single-node deployment.
- For multi-instance production scaling, move sessions and app data to a shared external store.
- The database lives at `data/whatsapp-center.sqlite`.
