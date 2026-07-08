# Overseas Careers — Admin Panel

Foreign Employment Agency admin panel, implemented from the Claude Design handoff
(`Admin Panel.dc.html`).

- **Frontend:** React + TypeScript (Vite), React Router, Axios
- **Backend:** Laravel 12 REST API with Sanctum token auth
- **Database:** MySQL / MariaDB (XAMPP)

Three sections behind a staff login: **Dashboard** (KPIs, monthly-placements trend,
staff-by-department donut, placements-by-country bars), **Staff Management**
(table + add / edit / delete modal), and **User Permissions** (role × permission matrix).

```
Solidrow-admin/
├── backend/     Laravel API (app, routes/api.php, database/migrations + seeders)
└── frontend/    React + TS SPA (src/pages, src/components, src/auth, src/api)
```

## Prerequisites

- PHP 8.2+ and Composer
- Node 18+ and npm
- MySQL / MariaDB running (e.g. XAMPP)

## Backend setup

```bash
cd backend
composer install                 # if vendor/ is missing
cp .env.example .env             # then set the DB_* values below
php artisan key:generate
```

`.env` database settings (defaults assume XAMPP MySQL on localhost):

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=solidrow_admin
DB_USERNAME=root
DB_PASSWORD=
```

Create the database, then run migrations + seeders:

```bash
# create the schema (or make it in phpMyAdmin)
mysql -u root -e "CREATE DATABASE solidrow_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

php artisan migrate --seed
php artisan serve            # http://127.0.0.1:8000
```

The seeder creates the admin account and the initial staff + permission matrix.

## Frontend setup

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

The API base URL lives in `frontend/.env` (`VITE_API_BASE_URL`, default
`http://127.0.0.1:8000/api`). CORS in `backend/config/cors.php` allows the Vite dev
origins (5173 / 5174).

Open the frontend, and log in.

## Demo credentials

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

## API

All routes are prefixed with `/api`. Every route except `login` requires an
`Authorization: Bearer <token>` header (issued by `login`).

| Method | Endpoint                  | Purpose                                  |
|--------|---------------------------|------------------------------------------|
| POST   | `/login`                  | Authenticate (username + password) → token |
| GET    | `/me`                     | Current authenticated user               |
| POST   | `/logout`                 | Revoke the current token                 |
| GET    | `/dashboard`              | KPIs, trend, department + country data   |
| GET    | `/staff`                  | List staff                               |
| POST   | `/staff`                  | Create staff                             |
| PUT    | `/staff/{id}`             | Update staff                             |
| DELETE | `/staff/{id}`             | Delete staff                             |
| GET    | `/permissions`            | Role × permission matrix                 |
| PATCH  | `/permissions/{id}`       | Toggle one cell (`role`, `allowed`)      |

## Notes on the design mapping

- **Auth.** The design's hardcoded `admin / admin123` demo login is now backed by a
  real `users` table with a bcrypt-hashed password and a seeded admin account.
- **Live data.** The dashboard's *Total Staff* KPI, the donut total, and the
  department breakdown are computed live from the `staff` table. The remaining
  business figures (placements, revenue, pending applications, monthly trend,
  country placements) are representative values returned by the API, as they live
  outside this schema.
- **Permissions** are stored one row per permission with a JSON map of role → boolean,
  matching the matrix shape in the design; toggles persist immediately.
- **Styling** is ported 1:1 from the prototype, including the original `oklch()` color
  tokens (see `frontend/src/index.css`).
