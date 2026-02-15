import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  onSnapshot,
  query,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

interface MemberRanking {
  id?: string;
  rank: number;
  name: string;
  level: number;
  combatPower: number;
  status: 'active' | 'inactive';
  memberType: 'guild master' | 'elite' | 'normal';
}

interface UseFirestoreMembersReturn {
  members: MemberRanking[];
  loading: boolean;
  error: string | null;
  addMember: (member: Omit<MemberRanking, 'id' | 'rank'>) => Promise<void>;
  updateMember: (id: string, updates: Partial<MemberRanking>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  saveMember: (member: MemberRanking) => Promise<void>;
}

export const useFirestoreMembers = (): UseFirestoreMembersReturn => {
  const [members, setMembers] = useState<MemberRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const removeLegacyRankField = async (memberDocIds: string[]) => {
    if (memberDocIds.length === 0) return;

    const batch = writeBatch(db);
    memberDocIds.forEach((memberId) => {
      batch.update(doc(db, 'guildMembers', memberId), {
        rank: deleteField(),
      });
    });

    await batch.commit();
  };

  // Set up real-time listener on mount
  useEffect(() => {
    const q = query(collection(db, 'guildMembers'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const memberData = [] as Array<Omit<MemberRanking, 'rank'>>;
        snapshot.forEach((doc) => {
          const rawData = doc.data() as Partial<MemberRanking>;
          memberData.push({
            id: doc.id,
            name: rawData.name || '',
            level: Number(rawData.level || 1),
            combatPower: Number(rawData.combatPower || 0),
            status: rawData.status === 'inactive' ? 'inactive' : 'active',
            memberType:
              rawData.memberType === 'guild master'
              || rawData.memberType === 'elite'
              || rawData.memberType === 'normal'
                ? rawData.memberType
                : 'normal',
          });
        });

        const rankedMembers: MemberRanking[] = [...memberData]
          .sort((first, second) => second.combatPower - first.combatPower)
          .map((member, index) => ({
            ...member,
            rank: index + 1,
          }));

        const membersWithLegacyRankField = snapshot.docs
          .filter((memberDoc) => Object.prototype.hasOwnProperty.call(memberDoc.data(), 'rank'))
          .map((memberDoc) => memberDoc.id);

        if (membersWithLegacyRankField.length > 0) {
          void removeLegacyRankField(membersWithLegacyRankField);
        }

        setMembers(rankedMembers);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError(err.message || 'Failed to load members');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addMember = async (member: Omit<MemberRanking, 'id' | 'rank'>) => {
    try {
      await addDoc(collection(db, 'guildMembers'), member);
      // Add guild activity log
      await addDoc(collection(db, 'guildActivities'), {
        playerName: member.name,
        action: 'joined the guild',
        timestamp: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
      throw err;
    }
  };

  const updateMember = async (id: string, updates: Partial<MemberRanking>) => {
    try {
      const memberRef = doc(db, 'guildMembers', id);
      const { rank, ...updatesWithoutRank } = updates;
      void rank;
      await updateDoc(memberRef, updatesWithoutRank);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
      throw err;
    }
  };

  const deleteMember = async (id: string) => {
    try {
      // Get member data first to get the player name
      const memberDoc = await getDoc(doc(db, 'guildMembers', id));
      const memberData = memberDoc.data() as MemberRanking | undefined;
      
      // Delete the member
      await deleteDoc(doc(db, 'guildMembers', id));
      
      // Add guild activity log
      if (memberData?.name) {
        await addDoc(collection(db, 'guildActivities'), {
          playerName: memberData.name,
          action: 'has been kicked from the guild',
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member');
      throw err;
    }
  };

  const saveMember = async (member: MemberRanking) => {
    try {
      if (member.id) {
        const { id, ...updates } = member;
        await updateMember(id, updates);
      } else {
        await addMember(member);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member');
      throw err;
    }
  };

  return {
    members,
    loading,
    error,
    addMember,
    updateMember,
    deleteMember,
    saveMember,
  };
};
