# Firebase Firestore Security Setup

## Goal
Block unauthorized users at the server layer.

## Required Rules
Use the repository rule file [firestore.rules](firestore.rules), which enforces:
- Admin role claim required for all reads and writes
- Anonymous and non-admin users denied

## Deploy Rules
1. Install Firebase CLI if not installed.
2. Authenticate and select your project.
3. Run:

```bash
firebase deploy --only firestore:rules
```

## Verification
- Unauthenticated requests should fail with permission errors.
- Authenticated users without `role: "admin"` should fail rule checks.
- Authenticated users with `role: "admin"` should pass rule checks.
- Never use `allow read, write: if true` in any environment.
