# FuelBunk Pro — Backend Server

REST API + SQLite backend for FuelBunk Pro fuel station management.

## Quick Start (Local)

```bash
npm install
node server.js
# → http://localhost:3000
# → Default login: admin / admin123  (tenant: demo_station)
```

## Deploy to Render.com (Free)

1. Push this folder to a GitHub repo
2. Go to https://render.com → New Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Deploy**
5. Done! Your app is live at `https://fuelbunk-pro.onrender.com`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `JWT_SECRET` | Secret for JWT signing — **change in production!** | dev_secret |
| `DB_PATH` | Path to SQLite file | `./data/fuelbunk.db` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login → JWT token |
| GET | /api/data | Load all station data |
| POST | /api/sync | Bulk sync from browser |
| GET/POST | /api/sales | Sales |
| GET/PUT | /api/tanks/:id | Tank management |
| GET/POST/PUT | /api/employees | Employees |
| GET/POST | /api/expenses | Expenses |
| GET/POST | /api/fuel_purchases | Fuel purchases |
| GET/PUT | /api/prices | Fuel prices |
| GET/PUT | /api/settings/:key | Settings |
| GET | /api/audit | Audit log |

## Database

SQLite file at `DB_PATH`. WAL mode enabled.
Schema in `schema.sql` — auto-applied on startup.
