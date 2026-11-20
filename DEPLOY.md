# Deploying to cPanel — registration.solidrow.lk

Single-origin setup: **Laravel serves both the API (`/api/*`) and the built React SPA**
from one domain. No CORS, no second subdomain needed.

Server facts (from your hosting):

| Thing              | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| Domain             | https://registration.solidrow.lk                       |
| Document root      | `/home/festelsd/sites/registration.solidrow.lk`        |
| DB name            | `festelsd_registration`                                |
| DB user            | `festelsd_registration`                                |
| DB password        | `fuN;U~s.5I?6+$Bv`                                      |
| App folder (below) | `/home/festelsd/registration_app`                      |

The Laravel app lives **above** the web root in `registration_app/`; only the
contents of Laravel's `public/` go into the document root.

---

## 0. cPanel prerequisites (once)

1. **MultiPHP Manager** → set `registration.solidrow.lk` to **PHP 8.2 or 8.3**.
2. **MultiPHP INI Editor** → make sure these extensions are on (usually are):
   `pdo_mysql, mbstring, openssl, tokenizer, xml, ctype, bcmath, fileinfo, curl, gd`.
3. **MySQL Databases** → the DB + user already exist. Confirm the user is added to
   the DB with **ALL PRIVILEGES**.

## 1. Already done locally (in this repo)

- React built for production (`VITE_API_BASE_URL=https://registration.solidrow.lk/api`)
  and copied into `backend/public/` (`index.html`, `assets/`, svg icons).
- SPA fallback route added in `backend/routes/web.php`.
- `backend/.env.production` created with your DB credentials + a fresh `APP_KEY`.

## 2. Upload

1. On your PC, zip the **`backend`** folder → `backend.zip` (keep `vendor/` inside — that
   way you don't need Composer on the server).
2. cPanel **File Manager** → go to `/home/festelsd/` → **Upload** `backend.zip` → **Extract**.
3. Rename the extracted `backend` folder to **`registration_app`**.
4. Inside `registration_app`, rename **`.env.production` → `.env`**
   (enable "show hidden files / dotfiles" in File Manager settings first).

## 3. Put the public files into the document root

1. Open `registration_app/public/`, **Select All**, **Move** everything into
   `/home/festelsd/sites/registration.solidrow.lk/`.
   - If a placeholder `index.html` / `index.php` already exists in the doc root, delete it first.
2. In the doc root, **edit `index.php`** and replace its whole content with:

   ```php
   <?php

   use Illuminate\Foundation\Application;
   use Illuminate\Http\Request;

   define('LARAVEL_START', microtime(true));

   $app_path = __DIR__.'/../../registration_app';

   if (file_exists($maintenance = $app_path.'/storage/framework/maintenance.php')) {
       require $maintenance;
   }

   require $app_path.'/vendor/autoload.php';

   /** @var Application $app */
   $app = require_once $app_path.'/bootstrap/app.php';

   // The web-accessible files live here (doc root), not in registration_app/public.
   $app->usePublicPath(__DIR__);

   $app->handleRequest(Request::capture());
   ```

   (The two require paths point up to `registration_app`, and `usePublicPath`
   tells Laravel the doc root is where `index.html` / assets / `storage` live.)

3. Make sure the doc root also has the `.htaccess` that came from `public/` (it enables
   the front-controller rewrite). If missing, create it with this content:

   ```apache
   <IfModule mod_rewrite.c>
       <IfModule mod_negotiation.c>
           Options -MultiViews -Indexes
       </IfModule>
       RewriteEngine On
       RewriteCond %{HTTP:Authorization} .
       RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteRule ^ index.php [L]
   </IfModule>
   ```

## 4. Database + finalize (cPanel → Terminal)

```bash
cd ~/registration_app

# writable dirs
chmod -R 775 storage bootstrap/cache

# build the schema + seed roles/permissions/admin
php artisan migrate --force --seed

# link uploaded files (candidate passport images) into the web root
rm -f ~/sites/registration.solidrow.lk/storage
ln -s ~/registration_app/storage/app/public ~/sites/registration.solidrow.lk/storage

# cache config for speed (do NOT run `route:cache` — the SPA route is a closure)
php artisan config:clear
php artisan config:cache
```

> No Terminal access? Run `migrate --seed` by temporarily adding a protected route,
> or ask the host to run it. The symlink can also be created in File Manager.

## 5. Done — log in

Open **https://registration.solidrow.lk**

Admin login (seeded): username `admin`. Set the password **before** seeding by adding
`ADMIN_DEFAULT_PASSWORD=your-strong-password` to `.env`. If you skip it, the seeder
prints a random password once to the Terminal — copy it immediately.

**Change this password** after first login (Staff / your account).

---

## Redeploying after code changes

- **Frontend change:** `cd frontend && npm run build`, then copy `dist/index.html`,
  `dist/assets/`, and svg files into `backend/public/`, re-upload those into the doc root.
- **Backend change:** upload the changed files into `registration_app/`, then
  `php artisan config:cache` (and `migrate --force` if there are new migrations).

## Troubleshooting

- **500 error / blank page:** check `registration_app/storage/logs/laravel.log`.
  Usually a wrong path in `index.php`, wrong PHP version, or `storage` not writable.
- **DB connection refused:** if `localhost` fails, try `DB_HOST=127.0.0.1` in `.env`,
  then `php artisan config:cache`.
- **API 404s but site loads:** the `/api` rewrite isn't reaching Laravel — confirm
  `.htaccess` and `index.php` are in the doc root.
- **Images (passport photos) don't show:** the `storage` symlink is missing or the host
  blocks symlinks — recreate the link, or contact the host.

---

## Candidate registration sync (Local → Live)

Full step-by-step install guide (Sinhala): [deploy/local-office/INSTALL.md](deploy/local-office/INSTALL.md)

Candidates are registered on a **local** install. Every create / update / delete of a
candidate — or any of its sections (training, documents, visa, employee, departure,
remarks, section status) — is queued and pushed to live **for that one candidate only**
(matched by `registration_no`). Uploaded files go with it (only files live doesn't have
yet). The live DB is never replaced; no migration is needed on live.

**Live** (`registration_app/.env`), then clear config cache:

```
SYNC_PUSH_ENABLED=false
SYNC_RECEIVE_TOKEN=<long random secret>
```

**Local** (`backend/.env`):

```
SYNC_PUSH_ENABLED=true
SYNC_TARGET_URL=https://registration.solidrow.lk/api/sync
SYNC_TOKEN=<same secret>
```

Keep a worker running on the local machine: `npm run sync-worker`
(= `php artisan queue:work --queue=sync,default`). If internet drops, pushes wait in the
`jobs` table and retry automatically (up to 7 days, `SYNC_RETRY_HOURS`).

- First hand-over / re-send: `php artisan sync:push-candidates [--since=YYYY-MM-DD] [--id=N]`
- Permanent rejects (e.g. NIC already used by a *different* live candidate) land in
  `failed_jobs`; fix the data, then `php artisan queue:retry all`.
- Master data (job categories, demands, staff, users) is **not** synced. Start the local
  DB from a copy of live so IDs match; a job category / demand id missing on live is
  saved as NULL and logged as a warning.
- Register candidates only on the local side, so `registration_no` values never clash.
- Run the `sms:police-report-reminders` scheduler on one side only, or SMS go out twice.
