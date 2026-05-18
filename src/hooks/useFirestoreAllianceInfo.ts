import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const getFactionLeaderFromDocument = (rawData: Record<string, unknown>) => {
  const directLeaderKeys = ['factionLeader', 'allianceLeader', 'leaderName', 'leader'] as const;

  for (const key of directLeaderKeys) {
    const candidate = rawData[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const nestedLeaderKeys = ['leader', 'factionLeader', 'allianceLeader'] as const;

  for (const key of nestedLeaderKeys) {
    const candidate = rawData[key];
    if (!isRecord(candidate)) continue;

    const nestedName = typeof candidate.name === 'string'
      ? candidate.name
      : typeof candidate.leaderName === 'string'
        ? candidate.leaderName
        : '';

    if (nestedName.trim()) {
      return nestedName.trim();
    }
  }

  return '';
};

const shouldCollectNameForKey = (key: string, parentKeys: string[]) => {
  const normalizedKey = key.toLowerCase();
  const joinedParents = parentKeys.join('.').toLowerCase();

  if (normalizedKey === 'guildname') return true;
  if (normalizedKey === 'guildnames') return true;
  if (normalizedKey === 'guild') return true;
  if (normalizedKey === 'guilds') return true;
  if (normalizedKey === 'name' && joinedParents.includes('guild')) return true;

  return false;
};

const collectGuildNames = (value: unknown, guildNames: Set<string>, parentKeys: string[] = [], currentKey = ''): void => {
  if (typeof value === 'string') {
    if (value.trim() && shouldCollectNameForKey(currentKey, parentKeys)) {
      guildNames.add(value.trim());
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectGuildNames(item, guildNames, [...parentKeys, currentKey].filter(Boolean), currentKey);
    });
    return;
  }

  if (!isRecord(value)) return;

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (Array.isArray(nestedValue) && (key === 'guildNames' || key === 'guilds')) {
      nestedValue.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          guildNames.add(item.trim());
          return;
        }

        collectGuildNames(item, guildNames, [...parentKeys, key], key);
      });
      return;
    }

    collectGuildNames(nestedValue, guildNames, [...parentKeys, key], key);
  });
};

const getGuildNamesFromDocument = (rawData: Record<string, unknown>) => {
  const guildNames = new Set<string>();

  if (typeof rawData.guildName === 'string' && rawData.guildName.trim()) {
    guildNames.add(rawData.guildName.trim());
  }

  if (typeof rawData.name === 'string' && rawData.name.trim()) {
    guildNames.add(rawData.name.trim());
  }

  if (Array.isArray(rawData.guildNames)) {
    rawData.guildNames.forEach((value) => {
      if (typeof value === 'string' && value.trim()) {
        guildNames.add(value.trim());
      }
    });
  }

  if (Array.isArray(rawData.guilds)) {
    rawData.guilds.forEach((guild) => {
      if (typeof guild === 'string' && guild.trim()) {
        guildNames.add(guild.trim());
        return;
      }

      if (guild && typeof guild === 'object') {
        const guildRecord = guild as Record<string, unknown>;
        const name = typeof guildRecord.guildName === 'string'
          ? guildRecord.guildName
          : typeof guildRecord.name === 'string'
            ? guildRecord.name
            : '';

        if (name.trim()) {
          guildNames.add(name.trim());
        }
      }
    });
  }

  collectGuildNames(rawData, guildNames);

  return [...guildNames];
};

interface UseFirestoreAllianceInfoReturn {
  guildNames: string[];
  factionLeader: string;
  loading: boolean;
  error: string | null;
}

export const useFirestoreAllianceInfo = (): UseFirestoreAllianceInfoReturn => {
  const [guildNames, setGuildNames] = useState<string[]>([]);
  const [factionLeader, setFactionLeader] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'allianceInfo'),
      (snapshot) => {
        const nextGuildNames = new Set<string>();
        let nextFactionLeader = '';

        snapshot.forEach((allianceDoc) => {
          const data = allianceDoc.data() as Record<string, unknown>;

          if (!nextFactionLeader) {
            nextFactionLeader = getFactionLeaderFromDocument(data);
          }

          getGuildNamesFromDocument(data).forEach((guildName) => {
            nextGuildNames.add(guildName);
          });
        });

        setGuildNames([...nextGuildNames].sort((first, second) => first.localeCompare(second)));
        setFactionLeader(nextFactionLeader);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError(err.message || 'Failed to load alliance guild names');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    guildNames,
    factionLeader,
    loading,
    error,
  };
};