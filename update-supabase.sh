#!/bin/bash

# Script to update .env with Supabase connection string
# Usage: ./update-supabase.sh "your-connection-string-here"

if [ -z "$1" ]; then
  echo "Usage: ./update-supabase.sh \"your-supabase-connection-string\""
  echo ""
  echo "Example:"
  echo "./update-supabase.sh \"postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true\""
  exit 1
fi

CONNECTION_STRING="$1"

# Update DATABASE_URL in .env file
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$CONNECTION_STRING\"|" .env
else
  # Linux
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$CONNECTION_STRING\"|" .env
fi

echo "✅ Updated DATABASE_URL in .env file"
echo ""
echo "Next steps:"
echo "1. Run: npx prisma migrate dev"
echo "2. Run: npm run db:seed"
echo "3. Your app should now work with Supabase!"

