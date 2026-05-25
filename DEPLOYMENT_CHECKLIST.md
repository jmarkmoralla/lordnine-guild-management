# Deployment Checklist

This checklist covers the super-admin rollout for a Vercel frontend with Firebase Auth, Firestore, and Firebase Cloud Functions.

## Before Deploy

1. Confirm Firebase email/password sign-in is enabled in Firebase Authentication.
2. Confirm your Firebase project is on a plan that supports the Cloud Functions setup you intend to deploy.
3. Install root dependencies:

```bash
npm install
```

4. Install functions dependencies:

```bash
cd functions
npm install
cd ..
```

5. Copy `.env.example` to `.env.local` for local validation.
6. Set the Firebase client values in `.env.local`.
7. If the frontend is deployed on Vercel, set `VITE_ADMIN_FUNCTIONS_BASE_URL` to `https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net` in Vercel project environment variables.
8. If the frontend is deployed on Firebase Hosting, `VITE_ADMIN_FUNCTIONS_BASE_URL` can stay empty and the `/api/*` rewrites will be used.
9. Configure the OCR secret:

```bash
firebase functions:secrets:set OCR_SPACE_API_KEY
```

## Local Validation

1. Build the frontend:

```bash
npm run build
```

2. Check Cloud Functions syntax:

```bash
node --check functions/index.js
```

3. Optionally run the Firebase emulator for functions before production deploy.

## Deploy

1. Deploy functions and Firestore rules:

```bash
firebase deploy --only functions,firestore:rules
```

2. If you use Firebase Hosting for the frontend, deploy hosting too:

```bash
firebase deploy --only hosting
```

3. If you use Vercel for the frontend, redeploy the Vercel project after updating environment variables.

## After Deploy

1. Sign in with a super-admin account.
2. Open the Manage Admins page and verify you can:
   - list admins
   - create an admin
   - change an admin role
   - disable and re-enable an admin
   - delete a non-critical admin
3. Confirm a regular admin can still access the normal admin pages but cannot access Manage Admins.
4. Confirm a non-admin still fails Firestore reads and writes.
5. Confirm OCR still works for enabled admins.

If the production deploy itself needs to be rolled back, use your normal hosting and functions release process. This repository does not currently include automated release pinning or one-command deployment rollback.