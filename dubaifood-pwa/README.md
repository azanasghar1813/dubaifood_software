# Dubai Food — Live Sales PWA (Vercel Deployment)

Yeh standalone PWA (Progressive Web App) hai jo Dubai Food Restaurant ki daily sales aur orders live mobile par show karta hai.

---

## 🚀 Step 1: Supabase Mein Table Banayein

1. Apne [Supabase Dashboard](https://supabase.com/dashboard) mein jayein.
2. Left menu se **SQL Editor** open karein.
3. `supabase_setup.sql` ka code copy karein aur **Run** dabayein:

```sql
CREATE TABLE IF NOT EXISTS daily_sales (
  business_date DATE PRIMARY KEY,
  total_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales (business_date DESC);
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on daily_sales" ON daily_sales FOR SELECT USING (true);
CREATE POLICY "Allow service role upsert on daily_sales" ON daily_sales FOR ALL USING (true);
```

---

## ⚡ Step 2: Vercel Par Deploy Karein

Aap is folder ko direct terminal se ya GitHub ke zariye deploy kar sakte hain:

### Option A: Terminal (Vercel CLI)
```bash
cd dubaifood-pwa
vercel
```
(Pehle sawal par `Y` karein, project link karein aur deploy kar dein).

### Option B: GitHub Repo
Yeh folder GitHub par push karke vercel.com par import kar lein.

---

## 🔑 Step 3: Vercel Environment Variables
Vercel dashboard mein **Project Settings -> Environment Variables** mein yeh 4 values add karein:

* `SUPABASE_URL` = `https://rogswfiwwmzgezdueoht.supabase.co`
* `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
* `SYNC_SECRET` = `Azan@181314Sync2026`
* `APP_PIN` = `1813`

---

## 📱 Step 4: Mobile Par App Kaise Banayein (PWA)

1. Vercel se jo URL mile (maslan: `https://dubaifood-sales.vercel.app`) usko apne phone ke **Chrome** (Android) ya **Safari** (iPhone) mein open karein.
2. PIN enter karein: `1813`.
3. Browser menu mein **"Add to Home screen"** ya **"Install App"** par click karein.
4. Mobile par Dubai Food ka logo icon ban jayega. Jab bhi click karenge, bina address bar ke direct live sales khul jayengi!

---

## 🔄 Step 5: Local POS Se Connect Karna
Local POS software ke `.env` ya settings mein apna Vercel URL set kar dein:
```env
CLOUD_SALES_SYNC_URL=https://your-app-name.vercel.app/api/sync
CLOUD_SYNC_SECRET=Azan@181314Sync2026
```
POS har order ke baad aur har 2 minute mein automatically aaj ki sale cloud par bhejta rahega.
