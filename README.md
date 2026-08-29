# Demo POS — Backend

Express + MongoDB (Mongoose) REST API for a Point of Sale system.
All routes are mounted under the `/pos` prefix.

## Setup

```bash
npm install
cp .env.example .env    # phir .env me apni values daalein
npm start
```

Server: `http://localhost:5000` — API base: `http://localhost:5000/pos`

Health check: `GET /health` → `{ "status": "ok", "db": "pos", "dbState": 1 }`

## Environment variables

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string (required) |
| `JWT_SECRET` | JWT signing secret |
| `SESSION_SECRET` | Express session secret |
| `PORT` | HTTP port (default `5000`) |
| `CLIENT_URL` | Frontend origin(s) for CORS, comma separated |
| `STORE_NAME` | Business name printed on PDF invoices/ledgers |
| `STORE_TAGLINE` | Tagline on purchase invoice PDFs |
| `STORE_PHONE` | Phone line on salesman ledger PDF |

`*.vercel.app` origins are allowed automatically.

## Seed scripts

Server chalne ke baad:

```bash
npm run seed:admin        # admin / admin (role: admin)
npm run seed:products     # 5 demo products + inventory
npm run seed:suppliers    # 3 demo suppliers
```

`npm run seed:admin <username> <password>` se custom credentials bhi de sakte hain.

## Auth

JWT bearer token. `POST /pos/users/login` → `{ token }`, phir
`Authorization: Bearer <token>` header bhejein.

## Deployment (Vercel)

`api/index.js` Express app export karti hai aur `vercel.json` saari requests
usi pe rewrite karta hai. Vercel project settings me environment variables
(`MONGO_URI`, `JWT_SECRET`, `SESSION_SECRET`, `CLIENT_URL`) set karna zaroori hai.

## Structure

```
app.js              Express app (middleware, DB, error handling)
bin/www             Local HTTP server entry
api/index.js        Vercel serverless entry
config.js           Env-backed config
mainRoutes/index.js Sab routers /pos ke neeche mount
middlewares/        Passport JWT + local strategies
src/<feature>/      Har feature ka model + router
```
