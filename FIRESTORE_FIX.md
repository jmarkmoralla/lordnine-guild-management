# Firebase Firestore Permissions Fix

## The Problem
Your Firestore security rules are blocking access. The error "Missing or insufficient permissions" means the rules are rejecting read/write requests.

## Immediate Fix (Testing)

### Step 1: Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click your **lordnine-dashboard** project
3. Left sidebar → **Firestore Database**
4. Click the **Rules** tab
5. **DELETE everything** and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6. Click **Publish** (blue button top right)
7. Wait for "Rules updated successfully" message
8. **Close the Firebase tab**

### Step 2: Hard Refresh Your App

In your browser where the app is running:
- Press **Ctrl + Shift + R** (or Cmd + Shift + R on Mac)
- Wait for the page to fully reload
- Members should now appear! ✅

---

## If Still Not Working

### Debug Step 1: Check Browser Console
1. Open your app in browser
2. Press **F12** (Developer Tools)
3. Click **Console** tab
4. Look for red error messages
5. **Share the EXACT error message** (screenshot or copy it)

### Debug Step 2: Verify Seeding
1. In Firebase Console → **Firestore Database** → **Data** tab
2. Click **guildMembers** collection
3. Do you see documents with rank 1-54? 
   - **Yes** → Rules issue (see above fix)
   - **No** → Database is empty, need to seed

### Debug Step 3: Check if Documents Exist
If the `guildMembers` collection is empty:
1. Go back to your app
2. Open browser console (F12)
3. Paste this and press Enter:
```javascript
import { seedFirestoreDatabase } from './data/seedDatabase.ts'
seedFirestoreDatabase()
```
4. Watch console for "Successfully seeded" message
5. Check Firebase Console → Firestore → guildMembers (should now have 54 docs)

---

## Permanent Setup (After Testing)

Once testing works, update rules to be secure:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /guildMembers/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

This requires users to be authenticated (your app now does anonymous auth).

---

## Troubleshooting Checklist

- [ ] Updated Firestore Rules (see Step 1 above)
- [ ] Clicked **Publish** button
- [ ] Waited for "Rules updated successfully" message
- [ ] Did **Ctrl + Shift + R** hard refresh
- [ ] Checked browser **Console** for error messages
- [ ] Verified `guildMembers` collection exists in Firebase
- [ ] Verified 54 documents exist in the collection

---

## Common Issues

**"Missing or insufficient permissions" persists**
→ Rules not published yet, wait 30 seconds and refresh

**Page loads but shows "Loading..." forever**
→ Rules are wrong, Firestore can't connect

**Members appear but edit/delete doesn't work**
→ Write rules may be blocked, use the permanent rules above

**No documents in guildMembers collection**
→ Seeding failed, try manually in console (Debug Step 3)
