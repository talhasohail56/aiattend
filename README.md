# Night Shift Attendance System

A modern, production-ready attendance tracking system built with Next.js, TypeScript, PostgreSQL, and Tailwind CSS. Designed specifically for night shift teams with check-in at 9:00 PM and check-out at 5:00 AM.

## Features

### Employee Features
- **Check In/Check Out**: Simple one-click check-in and check-out with location tracking
- **Attendance History**: View personal attendance records for the last 14 days
- **Statistics**: See summary of total days, present days, late days, and absences
- **Location Tracking**: Automatic location capture using browser geolocation API
- **Custom Shift Times**: Each employee can have individual check-in/check-out times set by admin

### Admin Features
- **Employee Management**: Create and manage employee accounts
- **Individual Time Settings**: Set custom check-in/check-out times for each employee
- **Attendance Overview**: View all attendance records with advanced filtering
- **Per-Employee Statistics**: Detailed stats and charts for each employee
- **Manual Attendance Editing**: Fix missed check-outs or correct attendance records
- **CSV Export**: Export filtered attendance data for reporting
- **Real-time Dashboard**: Monitor team attendance in real-time

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Vercel account (for deployment)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd attendance-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Update the following variables:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/attendance_db?schema=public"
   NEXTAUTH_URL="http://localhost:4000"
   NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
   DEFAULT_TIMEZONE="Asia/Karachi"
   CHECK_IN_TIME="21:00"
   CHECK_OUT_TIME="05:00"
   LATE_THRESHOLD_MINUTES=15
   ```

4. **Set up the database**
   
   Run Prisma migrations to create the database schema:
   ```bash
   npx prisma migrate dev
   # or
   npm run db:migrate
   ```

   This will create the `User` and `Attendance` tables in your PostgreSQL database.

5. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

6. **Create an admin user**
   
   Run the seed script to create the default admin user:
   ```bash
   npm run db:seed
   # or
   npx tsx prisma/seed.ts
   ```
   
   This will create an admin user with:
   - Email: `talhasohail56@gmail.com`
   - Password: `talha123`
   
   **Alternative: Using Prisma Studio**
   ```bash
   npx prisma studio
   ```
   - Open the User table
   - Click "Add record"
   - Fill in: name, email, passwordHash (use bcrypt to hash), role: "ADMIN"

## Development

1. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Open your browser**
   
   Navigate to [http://localhost:4000](http://localhost:4000)

3. **Access Prisma Studio** (optional)
   ```bash
   npm run db:studio
   ```
   
   This opens a GUI to view and edit your database.

## Building for Production

1. **Build the application**
   ```bash
   npm run build
   # or
   yarn build
   ```

2. **Start the production server**
   ```bash
   npm start
   # or
   yarn start
   ```

## Deployment to Vercel

1. **Push your code to GitHub**

2. **Import your project to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure environment variables**
   - In Vercel project settings, add all environment variables from your `.env` file
   - Make sure to set `NEXTAUTH_URL` to your Vercel deployment URL

4. **Set up PostgreSQL database**
   - Use Vercel Postgres or any PostgreSQL provider (e.g., Supabase, Neon, Railway)
   - Add the `DATABASE_URL` to your Vercel environment variables

5. **Deploy**
   - Vercel will automatically build and deploy your application
   - After deployment, run migrations:
     ```bash
     npx prisma migrate deploy
     ```

## Database Schema

### User Model
- `id`: Unique identifier
- `name`: User's full name
- `email`: Unique email address
- `passwordHash`: Hashed password
- `role`: Either "ADMIN" or "EMPLOYEE"
- `checkInTime`: Custom check-in time (format: "HH:mm", e.g., "21:00") - null uses default
- `checkOutTime`: Custom check-out time (format: "HH:mm", e.g., "05:00") - null uses default
- `createdAt`: Account creation timestamp

### Attendance Model
- `id`: Unique identifier
- `userId`: Foreign key to User
- `shiftDate`: Date representing the shift start (9pm day)
- `checkInAt`: Check-in timestamp
- `checkOutAt`: Check-out timestamp
- `checkInLatitude` / `checkInLongitude`: Check-in location
- `checkOutLatitude` / `checkOutLongitude`: Check-out location
- `status`: "ON_TIME", "LATE", "ABSENT", or "NO_CHECKOUT"
- `createdAt` / `updatedAt`: Timestamps

## Attendance Rules

- **Default Shift Time**: 9:00 PM to 5:00 AM (next day)
- **Custom Times**: Admins can set individual check-in/check-out times for each employee
- **Late Threshold**: Check-in after the set time + 15 minutes is marked as late
- **Absent**: No check-in for a shift counts as absent
- **No Checkout**: If checked in but not checked out, status is "NO_CHECKOUT"
- **Timezone**: Default is Asia/Karachi (configurable via environment variable)

## Location Tracking

The system uses the browser's Geolocation API to capture location during check-in and check-out. If the user denies location access, the attendance record is still created but marked as "Location not shared".

Location data is displayed with:
- Approximate city/area name (using reverse geocoding)
- Link to Google Maps for precise location

## Security

- Passwords are hashed using bcrypt
- Authentication is handled by NextAuth.js
- Routes are protected by middleware
- Admin routes require ADMIN role
- All API routes verify authentication

## Project Structure

```
attendance-system/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth configuration
│   │   ├── attendance/   # Attendance endpoints
│   │   └── admin/        # Admin endpoints
│   ├── admin/            # Admin dashboard pages
│   ├── dashboard/        # Employee dashboard
│   ├── login/            # Login page
│   └── page.tsx          # Landing page
├── components/
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── auth.ts           # Authentication utilities
│   ├── attendance.ts     # Attendance logic
│   ├── db.ts             # Prisma client
│   ├── location.ts       # Location utilities
│   └── utils.ts          # General utilities
├── prisma/
│   └── schema.prisma     # Database schema
└── types/                # TypeScript type definitions
```

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check network/firewall settings

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your deployment URL
- Clear browser cookies and try again

### Location Not Working
- Ensure HTTPS in production (geolocation requires secure context)
- Check browser permissions
- The system will work without location, just marks as "Location not shared"

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue on the repository.

# aiattend
