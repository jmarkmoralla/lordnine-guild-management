import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  orderBy,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { GuildLogItem } from '../types/guildLog'

interface UseFirestoreGuildLogsReturn {
  items: GuildLogItem[]
  loading: boolean
  error: string | null
  addItem: (item: Omit<GuildLogItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateItem: (id: string, updates: Partial<GuildLogItem>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

const COLLECTION_NAME = 'guildLogs'

const normalizeGuildLogItem = (id: string, rawData: Record<string, unknown>): GuildLogItem => ({
  id,
  name: typeof rawData.name === 'string' ? rawData.name : '',
  loot: typeof rawData.loot === 'string' ? rawData.loot : undefined,
  quantity: Number.isFinite(Number(rawData.quantity)) ? Number(rawData.quantity) : 1,
  price: Number.isFinite(Number(rawData.price)) ? Number(rawData.price) : 0,
  currency: ['-', 'Dias', 'USDT', 'PHP'].includes(rawData.currency as string)
    ? (rawData.currency as GuildLogItem['currency'])
    : '-',
  imageUrl: typeof rawData.imageUrl === 'string' ? rawData.imageUrl : '',
  guild: typeof rawData.guild === 'string' ? rawData.guild : '',
  guildLeader: typeof rawData.guildLeader === 'string' ? rawData.guildLeader : '',
  status: rawData.status === 'Reserved' ? 'Reserved' : 'Available',
  createdAt: typeof rawData.createdAt === 'string' ? rawData.createdAt : '',
  updatedAt: typeof rawData.updatedAt === 'string' ? rawData.updatedAt : '',
  createdBy: typeof rawData.createdBy === 'string' ? rawData.createdBy : '',
})

const createItemPayload = (item: Partial<GuildLogItem>) => ({
  name: (typeof item.name === 'string' ? item.name : '').trim(),
  loot: (typeof item.loot === 'string' ? item.loot : '').trim(),
  quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
  price: Number(item.price ?? 0),
  currency: ['-', 'Dias', 'USDT', 'PHP'].includes(item.currency as string)
    ? item.currency
    : '-',
  imageUrl: (typeof item.imageUrl === 'string' ? item.imageUrl : '').trim(),
  guild: (typeof item.guild === 'string' ? item.guild : '').trim(),
  guildLeader: (typeof item.guildLeader === 'string' ? item.guildLeader : '').trim(),
  status: item.status === 'Reserved' ? 'Reserved' : 'Available',
  createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: typeof item.createdBy === 'string' ? item.createdBy : '',
})

export const useFirestoreGuildLogs = (): UseFirestoreGuildLogsReturn => {
  const [items, setItems] = useState<GuildLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemData = snapshot.docs.map((doc) =>
          normalizeGuildLogItem(doc.id, doc.data() as Record<string, unknown>)
        )
        setItems(itemData)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('Firestore guild logs error:', err)
        setError(err.message || 'Failed to load guild logs')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const addItem = async (item: Omit<GuildLogItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addDoc(collection(db, COLLECTION_NAME), createItemPayload(item))
  }

  const updateItem = async (id: string, updates: Partial<GuildLogItem>) => {
    await updateDoc(doc(db, COLLECTION_NAME, id), createItemPayload(updates))
  }

  const deleteItem = async (id: string) => {
    await deleteDoc(doc(db, COLLECTION_NAME, id))
  }

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
  }
}
