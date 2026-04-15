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

## Notes

- Sessions use the default memory store right now, which is fine for local development but should be replaced with Redis or a database-backed store for real production scaling.
- The database lives at `data/whatsapp-center.sqlite`.
