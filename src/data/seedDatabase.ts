import { collection, writeBatch, query, getDocs, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sampleMembersData } from './sampleMembers.ts';
import { sampleBossInfo } from './sampleBossInfo.ts';

/**
 * Seed Firestore with initial guild member data
 * Checks if collection is empty before adding data (prevents duplicates)
 * Usage: See instructions in database setup guide
 */
export async function seedFirestoreDatabase(): Promise<void> {
  try {
    console.log('🔄 Checking if database needs seeding...');

    // Check if collection already has data
    const guildMembersRef = collection(db, 'guildMembers');
    const existingQuery = query(guildMembersRef);
    const snapshot = await getDocs(existingQuery);

    if (snapshot.empty) {
      console.log('📝 Database is empty. Starting seed with 54 guild members...');

      // Use batch to add all documents at once (more efficient)
      const batch = writeBatch(db);
      let addedCount = 0;

      for (const memberData of sampleMembersData) {
        // Create document with specific ID for rank
        const docRef = doc(db, 'guildMembers', `member_${memberData.rank}`);
        batch.set(docRef, memberData);
        addedCount++;
      }

      // Commit all writes
      await batch.commit();

      console.log('✅ Successfully seeded database with', addedCount, 'members!');
      console.log('🎉 Guild member data is now available in Firestore.');
    } else {
      console.log('✅ Database already contains', snapshot.size, 'members. Skipping seed.');
    }

    // Seed bossInfo if empty
    const bossInfoRef = collection(db, 'bossInfo');
    const bossSnapshot = await getDocs(query(bossInfoRef));
    if (bossSnapshot.empty) {
      const bossDocRef = doc(bossInfoRef);
      const bossBatch = writeBatch(db);
      bossBatch.set(bossDocRef, sampleBossInfo);
      await bossBatch.commit();
      console.log('✅ Successfully seeded database with 1 boss info record.');
    } else {
      console.log('✅ Boss info already exists. Skipping boss info seed.');
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

/**
 * Clear all guild members from Firestore (use with caution!)
 * Only use this for development/testing purposes
 */
export async function clearGuildMembers(): Promise<void> {
  try {
    console.log('⚠️  WARNING: This will delete ALL guild members from Firestore.');
    console.log('Proceeding with deletion...');

    const guildMembersRef = collection(db, 'guildMembers');
    const snapshot = await getDocs(guildMembersRef);

    const batch = writeBatch(db);
    let deletedCount = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();

    console.log('✅ Deleted', deletedCount, 'members from Firestore.');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}
