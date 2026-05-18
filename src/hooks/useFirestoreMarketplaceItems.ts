import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  DEFAULT_MARKETPLACE_IMAGE_URL,
  getMarketplaceImageUrl,
  normalizeMarketplaceRarity,
  normalizeMarketplaceSelection,
  type MarketplaceItem,
} from '../types/marketplace';

interface UseFirestoreMarketplaceItemsReturn {
  items: MarketplaceItem[];
  loading: boolean;
  error: string | null;
  addItem: (item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<MarketplaceItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

const normalizeMarketplaceItem = (id: string, rawData: Partial<MarketplaceItem>): MarketplaceItem => {
  const selection = normalizeMarketplaceSelection(rawData.category, rawData.subcategory, rawData.part, rawData.rarity);

  return {
    id,
    name: typeof rawData.name === 'string' ? rawData.name : '',
    description: typeof rawData.description === 'string' ? rawData.description : '',
    imageUrl: typeof rawData.imageUrl === 'string' && rawData.imageUrl.trim()
      ? rawData.imageUrl.trim()
      : DEFAULT_MARKETPLACE_IMAGE_URL,
    category: selection.category,
    subcategory: selection.subcategory,
    part: selection.part,
    qty: Number.isFinite(Number(rawData.qty)) ? Number(rawData.qty) : 0,
    priceUsd: Number.isFinite(Number(rawData.priceUsd)) ? Number(rawData.priceUsd) : 0,
    pricePhp: Number.isFinite(Number(rawData.pricePhp)) ? Number(rawData.pricePhp) : 0,
    rarity: normalizeMarketplaceRarity(rawData.rarity),
    isVisible: rawData.isVisible !== false,
    createdAt: typeof rawData.createdAt === 'string'
      ? rawData.createdAt
      : typeof rawData.updatedAt === 'string'
        ? rawData.updatedAt
        : '',
    updatedAt: typeof rawData.updatedAt === 'string' ? rawData.updatedAt : '',
  };
};

const sortMarketplaceItems = (items: MarketplaceItem[]) => (
  [...items].sort((first, second) => {
    const createdAtDifference = second.createdAt.localeCompare(first.createdAt);
    if (createdAtDifference !== 0) return createdAtDifference;

    const updatedAtDifference = second.updatedAt.localeCompare(first.updatedAt);
    if (updatedAtDifference !== 0) return updatedAtDifference;

    return first.name.localeCompare(second.name);
  })
);

const createItemPayload = (item: Partial<MarketplaceItem>) => {
  const selection = normalizeMarketplaceSelection(item.category, item.subcategory, item.part, item.rarity);
  const rarity = normalizeMarketplaceRarity(item.rarity);
  const normalizedName = typeof item.name === 'string' ? item.name.trim() : '';
  const normalizedDescription = typeof item.description === 'string' ? item.description.trim() : '';

  return {
    name: normalizedName,
    description: normalizedDescription || normalizedName,
    imageUrl: getMarketplaceImageUrl(selection.category, selection.subcategory, selection.part, rarity),
    category: selection.category,
    subcategory: selection.subcategory,
    part: selection.part,
    qty: Number(item.qty ?? 0),
    priceUsd: Number(item.priceUsd ?? 0),
    pricePhp: Number(item.pricePhp ?? 0),
    rarity,
    isVisible: item.isVisible !== false,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const useFirestoreMarketplaceItems = (): UseFirestoreMarketplaceItemsReturn => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'marketplaceItems'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemData = snapshot.docs.map((itemDoc) => normalizeMarketplaceItem(itemDoc.id, itemDoc.data() as Partial<MarketplaceItem>));
        setItems(sortMarketplaceItems(itemData));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore marketplace error:', err);
        setError(err.message || 'Failed to load marketplace items');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addItem = async (item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'marketplaceItems'), createItemPayload(item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add marketplace item');
      throw err;
    }
  };

  const updateItem = async (id: string, updates: Partial<MarketplaceItem>) => {
    try {
      await updateDoc(doc(db, 'marketplaceItems', id), createItemPayload(updates));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update marketplace item');
      throw err;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'marketplaceItems', id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete marketplace item');
      throw err;
    }
  };

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
  };
};