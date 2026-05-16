# Firebase Firestore Security Setup

## Goal
Block unauthorized users at the server layer.

## Required Rules
Use the repository rule file [firestore.rules](firestore.rules), which enforces:
- Enabled admin document required for all regular reads and writes
- Only the signed-in user can read their own `admins/{uid}` document from the client
- Super admins can read `adminAuditLogs`
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
- Authenticated users without an enabled `admins/{uid}` document should fail rule checks.
- Authenticated users with an enabled `admins/{uid}` document should pass rule checks for normal data.
- Super-admin-only operations must still flow through Firebase Cloud Functions.
- Never use `allow read, write: if true` in any environment.
