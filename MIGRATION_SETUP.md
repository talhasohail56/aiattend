# Migration Setup for Supabase

## Important Note

For Supabase, **migrations work differently** than direct PostgreSQL connections:

### Option 1: Use `prisma db push` (Recommended for now)
```bash
npx prisma db push
```
This works with connection pooling and is simpler for development.

### Option 2: Use Migrations (Requires Direct Connection)

For `prisma migrate dev` to work, you need:

1. **Direct Connection String** (not pooling):
   - Go to Supabase Dashboard → Settings → Database
   - Copy the **Direct connection** string (port 5432)
   - Format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`

2. **Temporarily update .env**:
   ```bash
   # For migrations, use direct connection
   DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres?sslmode=require"
   ```

3. **Run migration**:
   ```bash
   npx prisma migrate dev
   ```

4. **Switch back to pooling** for app runtime:
   ```bash
   # For app, use connection pooling
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
   ```

## Current Setup

Your database schema is already created via `prisma db push`. The app is configured to use **connection pooling** (port 6543) which is better for production.

For future schema changes:
- Use `npx prisma db push` for quick development changes
- Or switch to direct connection temporarily for migrations


