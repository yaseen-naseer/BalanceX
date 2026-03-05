# BalanceX Installation Guide (Debian 12)

## Prerequisites

- Debian 12 server (fresh install)
- A domain pointed to the server via Cloudflare Tunnel
- Root or sudo access

---

## 1. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
```

Verify:
```bash
node --version
npm --version
```

Update npm to latest:
```bash
sudo npm install -g npm@latest
```

---

## 2. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql --now
```

Create database and user:
```bash
sudo -u postgres psql -c "CREATE DATABASE balancex;"
sudo -u postgres psql -c "CREATE USER balancex_user WITH PASSWORD 'your-strong-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE balancex TO balancex_user;"
sudo -u postgres psql -d balancex -c "GRANT ALL ON SCHEMA public TO balancex_user;"
sudo -u postgres psql -d balancex -c "ALTER SCHEMA public OWNER TO balancex_user;"
```

> Replace `your-strong-password` with a strong password. Note any special characters for URL encoding in the next step.

---

## 3. Clone the Repository

```bash
git clone https://github.com/yaseen-naseer/BalanceX.git
cd BalanceX
```

---

## 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in the values:

```env
DATABASE_URL="postgresql://balancex_user:YOUR_PASSWORD@localhost:5432/balancex?schema=public"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="run-openssl-rand-hex-32"
```

> **Password URL encoding**: `@` → `%40`, `%` → `%25`

Generate a secret:
```bash
openssl rand -hex 32
```

---

## 5. Install Dependencies

```bash
npm install
```

---

## 6. Set Up Database Schema

```bash
npx prisma db push
npx prisma generate
```

---

## 7. Build the App

```bash
npm run build
```

---

## 8. Run with PM2

Install PM2:
```bash
sudo npm install -g pm2
```

Start the app:
```bash
pm2 start npm --name balancex -- start
pm2 save
pm2 startup
```

> Copy and run the command printed by `pm2 startup` to enable auto-start on reboot.

Verify it's running:
```bash
pm2 list
```

---

## 9. Verify the App

```bash
curl http://localhost:3000
```

Should return a redirect to `/login` or `/setup`.

---

## 10. Cloudflare Tunnel

In your Cloudflare Zero Trust dashboard:

1. Go to **Networks → Tunnels → your tunnel**
2. Add a public hostname:
   - **Subdomain**: `your-subdomain`
   - **Domain**: `your-domain.com`
   - **Service Type**: `HTTP`
   - **URL**: `server-ip:3000`
3. Save — DNS record will be created automatically

---

## Updating the App

```bash
cd ~/BalanceX
git pull
npm install
npx prisma db push
npx prisma generate
npm run build
pm2 restart balancex
```

---

## Useful Commands

| Command | Description |
|---|---|
| `pm2 list` | Check app status |
| `pm2 logs balancex` | View app logs |
| `pm2 restart balancex` | Restart the app |
| `pm2 stop balancex` | Stop the app |
| `npx prisma db push` | Sync DB schema changes |
| `npx prisma generate` | Regenerate Prisma client |

---

## Resetting the Database

> ⚠️ This deletes all data permanently.

```bash
npx prisma db push --force-reset
```

After reset, visit the app — you will be redirected to the setup wizard to create the owner account and opening balances.
