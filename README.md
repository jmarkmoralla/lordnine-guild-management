# Lordnine Dashboard

A modern React.js dashboard for the Lordnine Guild featuring an intuitive left sidebar with navigation menu, attendance tracking, and guild member rankings.

## Features

- **Dashboard**: Overview with guild statistics and recent activity
- **Attendance**: Track member attendance with filters and summary statistics
- **Guild Member Rankings**: Display member rankings with level, experience, and join date information
- **Responsive Design**: Mobile-friendly layout that adapts to different screen sizes
- **Modern UI**: Clean, professional interface with smooth animations and transitions

## Project Structure

```
src/
├── components/
│   ├── Sidebar.tsx              # Left sidebar with navigation menu
│   ├── DashboardPage.tsx        # Main dashboard page
│   ├── AttendancePage.tsx       # Attendance tracking page
│   └── RankingsPage.tsx         # Guild member rankings page
├── styles/
│   ├── Sidebar.css              # Sidebar styling
│   ├── Dashboard.css            # Dashboard page styling
│   ├── Attendance.css           # Attendance page styling
│   └── Rankings.css             # Rankings page styling
├── App.tsx                       # Main App component with navigation
├── App.css                       # Main app layout styles
├── main.tsx                      # Entry point
└── index.css                     # Global styles
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173/`

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the project for production
- `npm run preview` - Preview the production build

## Deployment Setup

1. Create a local env file from `.env.example`:

```bash
cp .env.example .env.local
```

2. Fill in Firebase values in `.env.local`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_OCR_PROXY_ENDPOINT` (optional; defaults to `/api/ocr-space` when Firebase Hosting rewrites are used)
- `VITE_ADMIN_FUNCTIONS_BASE_URL` (optional; base URL for admin functions such as `https://asia-southeast1-your-project-id.cloudfunctions.net`)

3. Configure the OCR secret for the Firebase function instead of the frontend bundle:

```bash
firebase functions:secrets:set OCR_SPACE_API_KEY
```

4. Deploy the function and hosting rewrite:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,hosting
```

The OCR proxy only accepts signed-in users whose `admins/{uid}` Firestore document exists and has `enabled: true`.

Super-admin management uses Firebase Cloud Functions for listing admins, creating admins, changing admin roles, enabling or disabling admins, and deleting admins. Legacy enabled admin documents without an explicit `role` field are treated as super admins until they are updated.

5. Validate before deploy:

```bash
npm run lint
npm run build
```

6. Apply strict Firestore rules from [firestore.rules](firestore.rules) and deploy them with Firebase CLI.
7. Ensure each admin user has a matching Firestore document in `admins/{uid}` with `enabled: true`, or login and OCR access will be denied.
8. After hardening, non-admin users are denied Firestore reads and writes by server rules.

## Super Admin Migration

If you already have admin documents in Firestore, assign explicit roles before relying on the new super-admin UI.

1. Install the functions dependencies if you have not done so yet:

```bash
cd functions
npm install
```

2. Run a dry run to see which admin documents will change:

```bash
npm run migrate-admin-roles -- --super-admin-uids=UID_1,UID_2
```

3. Apply the changes once the preview looks correct. The script writes a backup JSON file before updating Firestore roles:

```bash
npm run migrate-admin-roles -- --super-admin-uids=UID_1,UID_2 --apply
```

The script updates existing `admins/{uid}` documents so listed UIDs become `super_admin` and all other enabled admins become `admin`. Disabled admins also receive an explicit `role` field so the frontend and Cloud Functions no longer rely on the legacy fallback behavior.

If you need to revert the role migration, use the backup file created during the apply step:

```bash
npm run rollback-admin-roles -- --backup-file=admin-role-backups/admin-role-backup-YYYY-MM-DDTHH-MM-SS-sssZ.json
npm run rollback-admin-roles -- --backup-file=admin-role-backups/admin-role-backup-YYYY-MM-DDTHH-MM-SS-sssZ.json --apply
```

If your frontend stays on Vercel, set `VITE_ADMIN_FUNCTIONS_BASE_URL` to the deployed Cloud Functions base URL when you want the admin panel to bypass Firebase Hosting rewrites explicitly.

## Technologies Used

- **React 18** - JavaScript library for building user interfaces
- **React TypeScript** - Type-safe React with TypeScript
- **Vite** - Next generation frontend build tool
- **CSS3** - Modern CSS with flexbox and grid layouts

## Sidebar Navigation

The left sidebar features:
- **Guild Name**: "Secreta" prominently displayed
- **Navigation Menu**:
  - 📊 Dashboard - Overview and statistics
  - 📋 Attendance - Track guild member attendance
  - ⭐ Guild Member Rankings - View ranked members

## Pages

### Dashboard
- Displays key guild statistics (members, events, quests, level)
- Shows recent activity from guild members
- Interactive stat cards with hover effects

### Attendance
- Table view of member attendance records
- Filter by date and status (Present, Absent, Late)
- Summary statistics showing attendance counts
- Edit functionality for attendance records

### Guild Member Rankings
- Grid view of ranked members with medals for top 3
- Displays member level, experience, and join date
- Experience progress bars
- Rankings summary section

## Styling

The dashboard uses a professional color scheme:
- **Primary Blue**: `#1e3c72` to `#2a5298` (gradient)
- **Accent Blue**: `#4a90e2`
- **Light Background**: `#f5f7fa`
- **Text Color**: `#2c3e50`

## Responsive Design

The dashboard is fully responsive and works well on:
- Desktop (1200px+)
- Tablet (768px - 1200px)
- Mobile (below 768px)

## Future Enhancements

- Real-time data integration
- Member profile pages
- Guild events calendar
- In-game economy tracker
- Chat/messaging system

## License

Copyright © 2026 Secreta Guild
