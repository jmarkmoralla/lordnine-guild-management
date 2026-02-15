# Guild Member Database Setup

## Automatic Initialization

The application now automatically seeds the Firestore database with 54 guild members when you first log in.

**How it works:**
1. When you log in (as either guest or admin), the app checks if the database is empty
2. If the `guildMembers` collection has no data, it automatically populates with sample member data
3. If data already exists, it skips the seeding process (prevents duplicates)

This happens silently in the background - you'll see the members appear in the Rankings page once the seed completes (usually within 1-2 seconds).

## Manual Database Management

### Files Overview

**`src/data/sampleMembers.ts`**
- Contains the 54 sample guild member profiles
- Data includes: rank, name, level, experience, combatPower, joinDate, status, memberType
- Edit this file if you want to customize the initial data

**`src/data/seedDatabase.ts`**
- Contains `seedFirestoreDatabase()` - seeds the database if empty
- Contains `clearGuildMembers()` - clears ALL members from database (use with caution!)

### Using the Seed Functions

#### From Browser Console

Open your browser's developer tools (F12) and run:

```javascript
// Import the seed function (if available in window scope)
// The function is called automatically, but you can manually trigger re-seed:
import { seedFirestoreDatabase, clearGuildMembers } from './data/seedDatabase.ts'
seedFirestoreDatabase()  // Re-seed the database
clearGuildMembers()      // Clear all members
```

#### Programmatically

```typescript
import { seedFirestoreDatabase, clearGuildMembers } from './data/seedDatabase'

// Seed the database
try {
  await seedFirestoreDatabase()
  console.log('✅ Database seeded successfully')
} catch (error) {
  console.error('❌ Seeding failed:', error)
}

// Clear all members (use carefully!)
try {
  await clearGuildMembers()
  console.log('✅ Database cleared')
} catch (error) {
  console.error('❌ Clear failed:', error)
}
```

## Firestore Collection Structure

**Collection:** `guildMembers`

**Document Structure:**
```json
{
  "rank": 1,
  "name": "Guild Master",
  "level": 99,
  "experience": 999999,
  "combatPower": 9850,
  "joinDate": "2024-01-15",
  "status": "active|inactive",
  "memberType": "guild master|elite|normal member"
}
```

## Real-Time Synchronization

All changes are now synchronized with Firestore:
- **Edit member** → saved to Firestore → visible immediately in all open browser windows
- **Delete member** → removed from Firestore → all users see removal in real-time
- **Add new member** → saved to Firestore → appears for all connected users
- **Page refresh** → loads latest data from Firestore database

## Testing the Database

1. **Test Data Loading:**
   - Log in as guest or admin
   - Wait 1-2 seconds for automatic seeding
   - Go to Rankings page
   - You should see 54 guild members

2. **Test Real-Time Sync:**
   - Open the app in two browser windows side-by-side
   - Edit a member's name in Window 1
   - Check Window 2 - the change appears instantly
   - This proves real-time synchronization is working

3. **Test Persistence:**
   - Edit a member's data
   - Refresh the page (F5)
   - The changes persist (loaded from Firestore)

## Troubleshooting

**Database not seeding?**
- Check browser console for errors
- Ensure Firebase credentials are correct in `src/config/firebase.ts`
- Verify Firestore is enabled in Firebase Console
- Check Firestore security rules allow read/write

**Can't see 54 members?**
- Wait a few seconds after login
- Check Firestore Console to see if documents exist
- Try manually triggering `clearGuildMembers()` then `seedFirestoreDatabase()`

**Real-time sync not working?**
- Ensure both browser windows are logged in
- Check network connectivity
- Verify Firestore security rules are not blocking operations

## Next Steps

1. ✅ Database seeding (COMPLETE)
2. ❓ Create new member form (TODO - currently only edit/delete available)
3. ❓ Member search and filtering (TODO)
4. ❓ Firestore backup and export (TODO)
5. ❓ Attendance page integration with Firestore (TODO)

## Firebase Firestore Rules

The current security rules require Firebase Authentication. See `src/config/firebase.ts` for details.

For production deployment, review and update the rules in Firebase Console:
- Read/Write should require proper authentication
- Consider role-based access control (admin vs guest)
- Implement audit logging for admin changes
