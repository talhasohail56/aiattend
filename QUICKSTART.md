# Quick Start Guide

## Local Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/attendance_db?schema=public"
NEXTAUTH_URL="http://localhost:4000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
DEFAULT_TIMEZONE="Asia/Karachi"
CHECK_IN_TIME="21:00"
CHECK_OUT_TIME="05:00"
LATE_THRESHOLD_MINUTES=15
```

**Important**: Replace `DATABASE_URL` with your actual PostgreSQL connection string.

### 3. Set Up Database
```bash
# Create database tables
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### 4. Create Admin User
```bash
npm run db:seed
```

This creates an admin account:
- **Email**: talhasohail56@gmail.com
- **Password**: talha123

### 5. Start Development Server
```bash
npm run dev
```

### 6. Access the Application
- Open [http://localhost:4000](http://localhost:4000)
- Click "Login"
- Use the admin credentials above

## Setting Individual Employee Times

1. Login as admin
2. Go to the "Employees" section
3. Click "Edit Times" next to any employee
4. Set custom check-in and check-out times (format: HH:mm)
5. Leave empty to use default times (21:00 - 05:00)

## Default Admin Account

- **Email**: talhasohail56@gmail.com
- **Password**: talha123

You can change this password after logging in, or modify `prisma/seed.ts` to use different credentials.

