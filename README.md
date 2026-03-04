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

3. Validate before deploy:

```bash
npm run lint
npm run build
```

4. Apply strict Firestore rules from [firestore.rules](firestore.rules) and deploy them with Firebase CLI.
5. Ensure admin users have Firebase custom claim `role: "admin"` (set via Firebase Admin SDK), or write operations will be denied.
6. After hardening, non-admin users are denied Firestore reads and writes by server rules.

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
- Admin panel for guild management

## License

Copyright © 2026 Secreta Guild
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
