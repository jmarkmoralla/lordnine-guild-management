import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn('Firebase environment variables are missing. Configure VITE_FIREBASE_* values before deployment.');
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = getAuth(app);

const attendanceFirebaseConfig = {
  apiKey: import.meta.env.VITE_ATTENDANCE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_ATTENDANCE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_ATTENDANCE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_ATTENDANCE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_ATTENDANCE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_ATTENDANCE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_ATTENDANCE_FIREBASE_MEASUREMENT_ID || '',
};

let attendanceApp: ReturnType<typeof initializeApp> | null = null;
let attendanceDb: ReturnType<typeof getFirestore> | null = null;
let attendanceAuth: ReturnType<typeof getAuth> | null = null;

if (attendanceFirebaseConfig.apiKey && attendanceFirebaseConfig.projectId && attendanceFirebaseConfig.appId) {
  attendanceApp = initializeApp(attendanceFirebaseConfig, 'attendance');
  attendanceDb = getFirestore(attendanceApp);
  attendanceAuth = getAuth(attendanceApp);
}

export { attendanceApp, attendanceDb, attendanceAuth };

export default app;
