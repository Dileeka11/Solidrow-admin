# Solidrow: Local Registration + Live Sync — Install Guide

**මේකෙන් වෙන්නේ:** Candidate registration කරන්නේ office එකේ **local server** එකේ. Register කරන / update කරන
හැම candidate කෙනෙක්ම (personal details, training, documents, visa, employee, departure, remarks, files)
තත්පර කීපයකින් **live server** (https://registration.solidrow.lk) එකට auto යනවා.

- Live DB එක **replace වෙන්නේ නෑ** — එක candidate කෙනාගේ rows විතරයි update වෙන්නේ (`registration_no` එකෙන් match කරලා).
- Internet නැති වෙලාවට local එකේ වැඩ කරගෙන යන්න පුළුවන්. Internet ආව ගමන් pending ඒවා auto යනවා (දින 7ක් දක්වා retry).

කොටස් දෙකයි: **A — Live server (cPanel)** සහ **B — Local office PC**. පිළිවෙළට කරන්න.

---

## 0. Secret token එකක් හදාගන්න (එක පාරයි)

ඕනෑම PC එකක (PHP තියෙන):

```
php -r "echo bin2hex(random_bytes(32));"
```

ලැබෙන අකුරු 64 string එක **TOKEN** විදිහට save කරගන්න. Live එකටයි local එකටයි **එකම** token එක දාන්න ඕනේ.
මේක කාටවත් share කරන්න / git එකට දාන්න එපා.

---

## A. Live server (cPanel) — registration.solidrow.lk

### A1. අලුත් code files upload කරන්න

cPanel **File Manager** → `/home/festelsd/registration_app/` ඇතුළට, repo එකේ `backend/` එකෙන් මේ files upload කරන්න
(තියෙන ඒවා overwrite වෙන්න දෙන්න):

| Repo path (`backend/…`)                              | Server path (`registration_app/…`)        |
| ---------------------------------------------------- | ----------------------------------------- |
| `app/Http/Controllers/SyncController.php`            | `app/Http/Controllers/`                   |
| `app/Http/Middleware/VerifySyncToken.php`            | `app/Http/Middleware/` (folder එක හදන්න) |
| `app/Sync/` (මුළු folder එකම)                        | `app/Sync/`                               |
| `app/Jobs/` (මුළු folder එකම)                        | `app/Jobs/`                               |
| `app/Console/Commands/SyncPushCandidates.php`        | `app/Console/Commands/`                   |
| `app/Providers/AppServiceProvider.php`               | `app/Providers/`                          |
| `config/sync.php`                                    | `config/`                                 |
| `routes/api.php`                                     | `routes/`                                 |

> Live එකේ **migration එකක් run කරන්න ඕනේ නෑ.** DB structure එක වෙනස් වෙන්නේ නෑ.

### A2. Live `.env` එකට lines 2ක් එකතු කරන්න

`registration_app/.env` open කරලා අන්තිමට:

```
SYNC_PUSH_ENABLED=false
SYNC_RECEIVE_TOKEN=<TOKEN>
```

### A3. Config cache clear කරන්න

File Manager එකේ `registration_app/bootstrap/cache/` ඇතුළේ **`config.php`** සහ **`routes-v7.php`** (හෝ `routes-*.php`)
තියෙනවා නම් delete කරන්න. (නැත්නම් කමක් නෑ — ඒ කියන්නේ cache වෙලා නෑ.)

### A4. Live එක check කරන්න

ඕනෑම PC එකක command prompt එකේ (`<TOKEN>` replace කරලා):

```
curl -X POST https://registration.solidrow.lk/api/sync/files/check -H "Authorization: Bearer <TOKEN>" -H "Accept: application/json" -d "paths[]=candidates/test.jpg"
```

- ✅ `{"missing":["candidates/test.jpg"]}` → හරි.
- ❌ `401` → token එක වැරදියි. ❌ `404` → A2 / A3 ආයෙ check කරන්න.

---

## B. Local office PC

### B1. Install කරන්න ඕනේ software

- **XAMPP** (PHP 8.2 හෝ ඊට වැඩි + MySQL/MariaDB) — https://www.apachefriends.org
- **Composer** — https://getcomposer.org
- **Node.js 20 LTS** හෝ ඊට වැඩි — https://nodejs.org
- **Git** (project එක clone කරන්න) — https://git-scm.com

XAMPP Control Panel එකෙන් **MySQL** start කරන්න. (Apache ඕනේ නෑ.)

### B2. Project එක ගන්න

```
cd C:\
git clone <repo-url> Solidrow-admin
cd C:\Solidrow-admin\backend
composer install
```

### B3. Live DB එකේ copy එකක් local එකට දාන්න (එක පාරයි)

Local DB එක live එකේ copy එකක් වෙන්න ඕනේ — job categories, demands, staff, users වල IDs ගැලපෙන්න.

1. cPanel → **phpMyAdmin** → `festelsd_registration` → **Export** → Quick / SQL → Go. (`.sql` file එක download වෙනවා)
2. Local: http://localhost/phpmyadmin → **New** → database name `solidrow_admin` (Collation `utf8mb4_unicode_ci`) → Create.
3. `solidrow_admin` select කරලා **Import** → download කරපු `.sql` file එක → Go.
   (File එක ලොකු නම්: `C:\xampp\mysql\bin\mysql -u root solidrow_admin < C:\path\file.sql`)

### B4. Local `.env` එක හදන්න

```
cd C:\Solidrow-admin\backend
copy .env.example .env
php artisan key:generate
```

`.env` open කරලා මේ values set කරන්න (`192.168.1.50` වෙනුවට **මේ PC එකේ LAN IP** එක — `ipconfig` එකෙන් බලන්න):

```
APP_ENV=local
APP_DEBUG=false
APP_URL=http://192.168.1.50:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=solidrow_admin
DB_USERNAME=root
DB_PASSWORD=

QUEUE_CONNECTION=database
CACHE_STORE=database

SYNC_PUSH_ENABLED=true
SYNC_TARGET_URL=https://registration.solidrow.lk/api/sync
SYNC_TOKEN=<TOKEN>
```

SMS settings (`SMS_…`) live `.env` එකේ තියෙන විදිහටම copy කරන්න ඕනේ නම්. **Police report reminder SMS
scheduler එක live එකේ විතරක් run කරන්න** — local එකේ scheduler / Task Scheduler එකක් දාන්න එපා (නැත්නම් SMS දෙපාරක් යනවා).

### B5. Queue / cache tables තියෙනවද බලන්න

```
php artisan migrate --path=database/migrations/0001_01_01_000001_create_cache_table.php --force
php artisan migrate --path=database/migrations/0001_01_01_000002_create_jobs_table.php --force
```

"Nothing to migrate" හෝ "table already exists" ආවොත් ඒ කියන්නේ tables දැනටමත් තියෙනවා — ප්‍රශ්නයක් නෑ.

> ⚠️ `php artisan migrate` (path නැතුව) run කරන්න **එපා** — DB එක SQL dump එකකින් හදපු නිසා පරණ migrations error දෙනවා.

### B6. Uploaded files (photos/documents) copy කරන්න — optional

Local එකේ පරණ candidates ලගේ photos පේන්න ඕනේ නම්: cPanel File Manager → `registration_app/storage/app/public`
→ Compress (zip) → download → `C:\Solidrow-admin\backend\storage\app\public\` ඇතුළට extract කරන්න.

### B7. Frontend එක local server එකට build කරන්න

```
cd C:\Solidrow-admin\frontend
npm install
npm run build:office
```

ඊට පස්සේ `frontend\dist\` ඇතුළේ තියෙන **සියල්ලම** `backend\public\` එකට copy කරන්න (overwrite):

```
xcopy /E /Y C:\Solidrow-admin\frontend\dist\* C:\Solidrow-admin\backend\public\
```

> `build:office` එකෙන් app එක **local server එකටම** connect වෙනවා. සාමාන්‍ය `npm run build` එක දැම්මොත්
> local app එක live එකට connect වෙනවා — ඒක කරන්න එපා.

### B8. Server + Sync worker start කරන්න

`C:\Solidrow-admin\deploy\local-office\` ඇතුළේ:

1. **`start-server.bat`** — double-click. App එක: `http://<LAN-IP>:8000`
2. **`start-sync-worker.bat`** — double-click. **මේ window එක close කරන්න එපා** — මේකෙන් තමයි live එකට data යවන්නේ.

**PC එක on කරද්දී auto start වෙන්න:** `Win + R` → `shell:startup` → open වෙන folder එකට bat files දෙකේම
**shortcut** එකක් දාන්න.

**අනිත් office PC වලින් access කරන්න:** Windows Firewall → *Allow an app* / Inbound rule → **TCP port 8000** allow කරන්න.

### B9. Test කරන්න ✅

1. Local app එකේ login වෙලා **test candidate** කෙනෙක් register කරන්න (passport photo එකකුත් එක්ක).
2. තත්පර 10–15කින් https://registration.solidrow.lk එකේ ඒ candidate පේනවද බලන්න (photo එකත් එක්ක).
3. Local එකේ name එක edit කරන්න → live එකේ update වෙනවද බලන්න.
4. Local එකෙන් test candidate delete කරන්න → live එකෙනුත් අයින් වෙනවද බලන්න.

### B10. කලින් local එකේ register කරපු candidates යවන්න (ඕනේ නම් විතරක්)

Local DB එක live copy එකක් නම් මේක ඕනේ නෑ. Sync දාන්න කලින් local එකේ register කරපු අය ඉන්නවා නම්:

```
cd C:\Solidrow-admin\backend
php artisan sync:push-candidates --since=2026-11-01
```

(`--since` නැතුව දැම්මොත් සියලුම candidates යවනවා. Live එකේ තියෙන අය duplicate වෙන්නේ නෑ — update වෙනවා විතරයි.)

---

## C. දිනපතා පාවිච්චිය සහ ප්‍රශ්න විසඳීම

| ප්‍රශ්නය | කරන්න ඕනේ දේ |
| --- | --- |
| Live එකට data යන්නේ නෑ | `start-sync-worker.bat` window එක open ද බලන්න. Internet තියෙනවද බලන්න. |
| යන්න තියෙන (pending) ගණන | phpMyAdmin → `solidrow_admin` → `jobs` table එකේ rows ගණන. |
| Fail වුණු ඒවා | `php artisan queue:failed` (backend folder එකේ) |
| Fail වුණු ඒවා ආයෙ යවන්න | data එක හදලා `php artisan queue:retry all` |
| Error විස්තර | `backend\storage\logs\laravel.log` (`sync:` කියලා search කරන්න) |

**Fail වෙන්න පුළුවන් සාමාන්‍ය හේතුව:** Live එකේ **වෙන** candidate කෙනෙක්ට එකම NIC / passport number එක තියෙනවා.
Local හෝ live එකේ වැරදි record එක හදලා `queue:retry all` කරන්න.

### වැදගත් නීති

1. **Candidate register කරන්නේ local එකේ විතරයි.** Live එකේත් register කළොත් Registration No clash වෙන්න පුළුවන්.
2. **Master data** (Job categories, Demands, Staff, Users, Agents) sync වෙන්නේ **නෑ**. අලුත් එකක් එකතු කරනවා නම්
   live එකෙයි local එකෙයි **දෙකේම** එකතු කරලා ID එක සමානද බලන්න. Live එකේ නැති job category / demand ID එකක් ආවොත්
   live එකේ ඒ field එක හිස්ව (NULL) save වෙලා log එකේ warning එකක් වැටෙනවා.
3. Sync worker එක නවත්තලා තිබ්බොත් data නැති වෙන්නේ නෑ — worker එක ආයෙ start කළාම pending ඒවා යනවා.
4. TOKEN එක වෙනස් කරනවා නම් live සහ local `.env` දෙකේම එකවර වෙනස් කරන්න.
