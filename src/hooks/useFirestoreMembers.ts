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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_MEMBER_CLASS, isMemberClass, type MemberClass } from '../utils/memberClass';

interface MemberRanking {
  id?: string;
  rank: number;
  name: string;
  walletAddress: string;
  playerClass: MemberClass;
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
            walletAddress: typeof rawData.walletAddress === 'string' ? rawData.walletAddress : '',
            playerClass: isMemberClass(rawData.playerClass) ? rawData.playerClass : DEFAULT_MEMBER_CLASS,
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
      const memberPayload: Omit<MemberRanking, 'id' | 'rank'> = {
        name: member.name,
        walletAddress: member.walletAddress ?? '',
        playerClass: isMemberClass(member.playerClass) ? member.playerClass : DEFAULT_MEMBER_CLASS,
        level: member.level,
        combatPower: member.combatPower,
        status: member.status,
        memberType: member.memberType,
      };

      await addDoc(collection(db, 'guildMembers'), memberPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
      throw err;
    }
  };

  const updateMember = async (id: string, updates: Partial<MemberRanking>) => {
    try {
      const memberRef = doc(db, 'guildMembers', id);
      const { rank, walletAddress, playerClass, ...updatesWithoutRank } = updates;
      void rank;

      const updatePayload: Partial<Omit<MemberRanking, 'id' | 'rank'>> = {
        ...updatesWithoutRank,
      };

      if (walletAddress !== undefined) {
        updatePayload.walletAddress = walletAddress;
      }

      if (playerClass !== undefined) {
        updatePayload.playerClass = playerClass;
      }

      await updateDoc(memberRef, updatePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
      throw err;
    }
  };

  const deleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'guildMembers', id));
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
