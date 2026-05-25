import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_MEMBER_CLASS, isMemberClass, type MemberClass } from '../utils/memberClass';

const normalizeMemberName = (name: string) => name.trim().toLocaleLowerCase();
const BATCH_LIMIT = 400;

export interface MemberRanking {
  id?: string;
  rank: number;
  name: string;
  walletAddress: string;
  playerClass: MemberClass;
  level: number;
  combatPower: number;
  guildName: string;
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

  const commitBatchWrites = async (writes: Array<(batch: ReturnType<typeof writeBatch>) => void>) => {
    if (writes.length === 0) return;

    for (let start = 0; start < writes.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db);
      writes.slice(start, start + BATCH_LIMIT).forEach((applyWrite) => applyWrite(batch));
      await batch.commit();
    }
  };

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
            guildName: typeof rawData.guildName === 'string' ? rawData.guildName : '',
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
      const trimmedName = member.name.trim();
      const trimmedGuildName = member.guildName.trim();

      if (!trimmedName) {
        throw new Error('Member name is required.');
      }

      if (!trimmedGuildName) {
        throw new Error('Please select a guild.');
      }

      const normalizedName = normalizeMemberName(trimmedName);
      const duplicateMember = members.some((existingMember) => normalizeMemberName(existingMember.name) === normalizedName);
      if (duplicateMember) {
        throw new Error('A member with that name is already registered.');
      }

      const memberPayload: Omit<MemberRanking, 'id' | 'rank'> = {
        name: trimmedName,
        walletAddress: member.walletAddress ?? '',
        playerClass: isMemberClass(member.playerClass) ? member.playerClass : DEFAULT_MEMBER_CLASS,
        level: member.level,
        combatPower: member.combatPower,
        guildName: trimmedGuildName,
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
      const existingMember = members.find((member) => member.id === id);
      if (!existingMember) {
        throw new Error('Member not found.');
      }

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

      if (typeof updatePayload.name === 'string') {
        const trimmedName = updatePayload.name.trim();
        if (!trimmedName) {
          throw new Error('Member name is required.');
        }

        const duplicateMember = members.some((member) => member.id !== id && normalizeMemberName(member.name) === normalizeMemberName(trimmedName));
        if (duplicateMember) {
          throw new Error('A member with that name is already registered.');
        }

        updatePayload.name = trimmedName;
      }

      if (typeof updatePayload.guildName === 'string') {
        const trimmedGuildName = updatePayload.guildName.trim();
        if (!trimmedGuildName) {
          throw new Error('Please select a guild.');
        }

        updatePayload.guildName = trimmedGuildName;
      }

      const previousName = existingMember.name;
      const nextName = typeof updatePayload.name === 'string' ? updatePayload.name : previousName;
      const didRenameMember = nextName !== previousName;

      await updateDoc(memberRef, updatePayload);

      if (!didRenameMember) {
        return;
      }

      const [attendanceSnapshot, summarySnapshot] = await Promise.all([
        getDocs(query(collection(db, 'guildAttendance'), where('memberId', '==', id))),
        getDocs(collection(db, 'guildAttendanceSummary')),
      ]);

      const normalizedPreviousName = normalizeMemberName(previousName);
      const cascadingWrites: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

      attendanceSnapshot.docs.forEach((attendanceDoc) => {
        cascadingWrites.push((batch) => {
          batch.update(attendanceDoc.ref, { name: nextName });
        });
      });

      summarySnapshot.docs
        .filter((summaryDoc) => {
          const summaryData = summaryDoc.data() as Partial<MemberRanking> & { name?: string };
          return normalizeMemberName(summaryData.name || '') === normalizedPreviousName;
        })
        .forEach((summaryDoc) => {
          cascadingWrites.push((batch) => {
            batch.set(summaryDoc.ref, { name: nextName }, { merge: true });
          });
        });

      await commitBatchWrites(cascadingWrites);
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
