import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { MarketplacePricingSettings } from '../types/marketplace';

interface UseFirestoreMarketplacePricingReturn {
  pricingSettings: MarketplacePricingSettings;
  loading: boolean;
  error: string | null;
}

export const MARKETPLACE_PRICING_DOC = doc(db, 'appSettings', 'marketplacePricing');

const DEFAULT_MARKETPLACE_PRICING_SETTINGS: MarketplacePricingSettings = {
  phpPerUsd: null,
  source: '',
  sourceDate: '',
  fetchedAt: '',
  updatedAt: '',
};

const normalizeMarketplacePricingSettings = (
  raw: Partial<MarketplacePricingSettings> | undefined,
): MarketplacePricingSettings => {
  const phpPerUsd = Number(raw?.phpPerUsd);

  return {
    phpPerUsd: Number.isFinite(phpPerUsd) && phpPerUsd > 0 ? phpPerUsd : null,
    source: typeof raw?.source === 'string' ? raw.source : '',
    sourceDate: typeof raw?.sourceDate === 'string' ? raw.sourceDate : '',
    fetchedAt: typeof raw?.fetchedAt === 'string' ? raw.fetchedAt : '',
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
  };
};

export const useFirestoreMarketplacePricing = (): UseFirestoreMarketplacePricingReturn => {
  const [pricingSettings, setPricingSettings] = useState<MarketplacePricingSettings>(DEFAULT_MARKETPLACE_PRICING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      MARKETPLACE_PRICING_DOC,
      (snapshot) => {
        const raw = snapshot.exists() ? (snapshot.data() as Partial<MarketplacePricingSettings>) : undefined;
        setPricingSettings(normalizeMarketplacePricingSettings(raw));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore marketplace pricing error:', err);
        setError(err.message || 'Failed to load marketplace pricing settings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    pricingSettings,
    loading,
    error,
  };
};