export type GuildLogStatus = 'Available' | 'Reserved'
export type GuildLogCurrency = '-' | 'Dias' | 'USDT' | 'PHP'

export interface GuildLogItem {
  id?: string
  name: string
  loot?: string
  quantity?: number
  price: number
  currency: GuildLogCurrency
  imageUrl?: string
  guild?: string
  guildLeader?: string
  status: GuildLogStatus
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}
