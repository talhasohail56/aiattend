# Supabase Connection Troubleshooting

## Current Connection String
```
postgresql://postgres:Apex123%21@db.lhwtwqayyqcqvvherotb.supabase.co:5432/postgres?sslmode=require
```

## Common Issues & Solutions

### 1. Check Supabase Project Status
- Go to your Supabase dashboard
- Make sure your project status is "Active" (not "Paused" or "Inactive")
- If paused, click "Restore" to reactivate

### 2. Check Connection Pooling Settings
In Supabase Dashboard → Settings → Database:
- Try using the **Connection pooling** string instead of direct connection
- Use **Transaction** mode (port 6543)
- Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`

### 3. Check IP Restrictions
- Go to Settings → Database → Connection Pooling
- Make sure "Restrict connections to specific IP addresses" is OFF
- Or add your current IP to the allowed list

### 4. Verify Password
- Make sure the password is exactly: `Apex123!`
- In the connection string, `!` should be URL encoded as `%21`

### 5. Try Direct Connection String from Supabase
1. Go to Settings → Database
2. Under "Connection string", select "Direct connection"
3. Copy the exact string shown
4. Update your `.env` file

### 6. Test Connection with psql (if available)
```bash
psql "postgresql://postgres:Apex123!@db.lhwtwqayyqcqvvherotb.supabase.co:5432/postgres?sslmode=require"
```

## Alternative: Use Supabase Connection String Builder
1. Go to Supabase Dashboard → Settings → Database
2. Use the connection string builder
3. Select your preferred connection method
4. Copy the generated string exactly as shown


