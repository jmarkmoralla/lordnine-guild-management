import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import type { DocumentData, UpdateData } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface GuildInfo {
  id?: string;
  guildName: string;
  guildLevel: number;
  info: string;
  logo: string;
  totalFund: number;
  attendancePercentage: number;
  managementPercentage: number;
}

interface UseFirestoreGuildInfoReturn {
  guildInfo: GuildInfo | null;
  loading: boolean;
  error: string | null;
  updateGuildInfoFields: (docId: string, fields: GuildInfoEditableFields) => Promise<void>;
}

export interface GuildInfoEditableFields {
  totalFund?: number;
  attendancePercentage?: number;
  managementPercentage?: number;
}

export const useFirestoreGuildInfo = (): UseFirestoreGuildInfoReturn => {
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set up real-time listener on mount
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'guildInfo'),
      (snapshot) => {
        if (!snapshot.empty) {
          // Get the first document (there should only be one)
          const doc = snapshot.docs[0];
          const data = doc.data();
          setGuildInfo({
            id: doc.id,
            guildName: data.guildName,
            guildLevel: data.guildLevel,
            info: data.info,
            logo: data.logo,
            totalFund: Number(data.totalFund || 0),
            attendancePercentage: Number(data.attendancePercentage || 0),
            managementPercentage: Number(data.managementPercentage || 0),
          });
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError(err.message || 'Failed to load guild info');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateGuildInfoFields = async (docId: string, fields: GuildInfoEditableFields) => {
    const guildInfoRef = doc(db, 'guildInfo', docId);
    await updateDoc(guildInfoRef, fields as UpdateData<DocumentData>);
  };

  return {
    guildInfo,
    loading,
    error,
    updateGuildInfoFields,
  };
};
