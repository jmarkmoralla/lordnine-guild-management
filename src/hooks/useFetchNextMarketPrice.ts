import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NextMarketPriceMatch } from '../types/marketplace';
import { getNextMarketPresetIds } from '../types/marketplace';
import type { MarketplaceItem } from '../types/marketplace';

const FUNCTION_REGION = 'asia-southeast1';
const CACHE_PREFIX = 'nextMarketPrice:';

const getCached = (searchUrl: string): NextMarketPriceMatch | null | undefined => {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + searchUrl);
    if (raw === null) return undefined;
    return JSON.parse(raw) as NextMarketPriceMatch | null;
  } catch {
    return undefined;
  }
};

const setCached = (searchUrl: string, data: NextMarketPriceMatch | null) => {
  try {
    if (data === null) {
      sessionStorage.removeItem(CACHE_PREFIX + searchUrl);
    } else {
      sessionStorage.setItem(CACHE_PREFIX + searchUrl, JSON.stringify(data));
    }
  } catch { /* noop */ }
};

const getEndpoint = () => {
  const baseUrl = import.meta.env.VITE_ADMIN_FUNCTIONS_BASE_URL?.trim().replace(/\/$/, '');
  if (baseUrl) {
    return `${baseUrl}/fetchNextMarketPrices`;
  }
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (projectId) {
    return `https://${FUNCTION_REGION}-${projectId}.cloudfunctions.net/fetchNextMarketPrices`;
  }
  return '/api/fetchNextMarketPrices';
};

export const useFetchNextMarketPrice = (
  searchUrl: string,
  item?: MarketplaceItem,
  refreshCounter = 0,
) => {
  const [match, setMatch] = useState<NextMarketPriceMatch | null | undefined>(
    () => getCached(searchUrl) ?? undefined,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endpointRef = useRef('');
  const prevCounterRef = useRef(refreshCounter);

  const legacyParams = useMemo(() => {
    if (!item) return '';
    const presets = getNextMarketPresetIds(item);
    const params = new URLSearchParams();
    params.set('keyword', item.name);
    if (presets?.presetId != null) params.set('presetId', String(presets.presetId));
    if (presets?.subPresetId != null) params.set('subPresetId', String(presets.subPresetId));
    if (presets?.refPresetId != null) params.set('refPresetId', String(presets.refPresetId));
    return params.toString();
  }, [item]);

  const fetchPrice = useCallback(async (skipCache: boolean) => {
    if (!searchUrl.trim()) {
      setMatch(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    if (!skipCache) {
      const cached = getCached(searchUrl);
      if (cached !== undefined) {
        setMatch(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    setError(null);

    try {
      const endpoint = endpointRef.current || (endpointRef.current = getEndpoint());
      const url = `${endpoint}?searchUrl=${encodeURIComponent(searchUrl)}&${legacyParams}`;

      const response = await fetch(url, { signal: abort.signal });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data: NextMarketPriceMatch | null = await response.json();

      if (!abort.signal.aborted) {
        setCached(searchUrl, data);
        setMatch(data);
        setLoading(false);
      }
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
      setLoading(false);
    }
  }, [searchUrl, legacyParams]);

  useEffect(() => {
    const prev = prevCounterRef.current;
    prevCounterRef.current = refreshCounter;

    if (refreshCounter !== prev) {
      sessionStorage.removeItem(CACHE_PREFIX + searchUrl);
      fetchPrice(true);
    } else {
      fetchPrice(false);
    }
  }, [refreshCounter, searchUrl, fetchPrice]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { match, loading, error };
};
