# Supabase Setup Guide

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: attendance-system (or any name you prefer)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait for the project to be created (takes 1-2 minutes)

## Step 2: Get Your Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string** section
3. Under **Connection pooling**, select **Transaction** mode
4. Copy the connection string (it looks like):
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
5. Replace `[password]` with your database password you set earlier

## Step 3: Update Your .env File

Update the `DATABASE_URL` in your `.env` file with the Supabase connection string.

## Step 4: Run Migrations

```bash
npx prisma migrate dev
```

## Step 5: Create Admin User

```bash
npm run db:seed
```

## Alternative: Direct Connection (if pooling doesn't work)

If connection pooling gives issues, use the **Direct connection** string from Supabase:
- Go to Settings → Database
- Under **Connection string**, select **Direct connection**
- Use port 5432 instead of 6543
- Remove `?pgbouncer=true` from the connection string


