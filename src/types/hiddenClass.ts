export type HiddenClassCategory = 'enhance' | 'combat' | 'vitality' | 'trick'

export type HiddenClassBoardCategory = HiddenClassCategory | 'recon' | 'defense' | 'support' | 'spell'

export interface HiddenClassMilestone {
  level: number
  effect: string
}

export interface HiddenClassStat {
  label: string
  value: string
}

export interface HiddenClassNode {
  id: string
  name: string
  category: HiddenClassCategory
  imagePath?: string
  currentRank: number
  maxRank: number
  shortEffect: string
  unlockHint: string
  milestones: HiddenClassMilestone[]
}

export interface HiddenClassAbilityPopupMetaField {
  label: string
  value: string
}

export type HiddenClassPopupTextTone = 'default' | 'highlight' | 'accent' | 'violet' | 'red' | 'yellow'

export type HiddenClassPopupPanelTone = 'subtle' | 'green' | 'red'

export interface HiddenClassAbilityPopupTextSegment {
  text: string
  tone?: HiddenClassPopupTextTone
  underline?: boolean
  breakLine?: boolean
}

export interface HiddenClassAbilityPopupCardRow {
  label: string
  value?: string
  tone?: HiddenClassPopupTextTone
  valueSegments?: HiddenClassAbilityPopupTextSegment[]
}

export interface HiddenClassAbilityPopupPanel {
  title: string
  tone?: HiddenClassPopupPanelTone | HiddenClassPopupPanelTone[]
  items?: string[]
  itemSegments?: HiddenClassAbilityPopupTextSegment[][]
}

export interface HiddenClassAbilityPopupCard {
  title: string
  subtitle?: string
  status?: string
  rows?: HiddenClassAbilityPopupCardRow[]
  description?: string
  descriptionSegments?: HiddenClassAbilityPopupTextSegment[]
  panels?: HiddenClassAbilityPopupPanel[]
}

export interface HiddenClassAbilityPopupInfo {
  title: string
  category: HiddenClassBoardCategory
  iconPath?: string
  meta: HiddenClassAbilityPopupMetaField[]
  cards: HiddenClassAbilityPopupCard[]
}

export interface HiddenClassBoardEntry {
  category: HiddenClassBoardCategory
  abilityName: string
  imagePath?: string
  rankText?: string
  popup?: HiddenClassAbilityPopupInfo
}

export interface HiddenClassBoardRow {
  left: HiddenClassBoardEntry
  right: HiddenClassBoardEntry
}

export interface HiddenClassProgressionStatLine {
  label: string
  value?: string
  segments?: HiddenClassProgressionTextSegment[]
}

export interface HiddenClassProgressionPopupInfo {
  title: string
  subtitle?: string
  typeLabel?: string
  iconPath?: string
  metaLabel?: string
  metaValue?: string
  badges?: HiddenClassProgressionPopupBadge[]
  detailLabel?: string
  detailText: string
  sections?: HiddenClassProgressionPopupSection[]
}

export interface HiddenClassProgressionPopupBadge {
  label: string
  tone?: 'gold' | 'neutral' | 'violet' | 'red' | 'green'
}

export type HiddenClassProgressionPanelTone = HiddenClassPopupPanelTone

export interface HiddenClassProgressionPopupSection {
  title: string
  displayStyle?: 'default' | 'panel'
  panelTone?: HiddenClassProgressionPanelTone | HiddenClassProgressionPanelTone[]
  items?: string[]
  itemSegments?: HiddenClassProgressionPopupTextSegment[][]
  segments?: HiddenClassProgressionPopupTextSegment[]
}

export interface HiddenClassProgressionPopupTextSegment {
  text: string
  tone?: HiddenClassPopupTextTone
}

export interface HiddenClassProgressionTextSegment {
  text: string
  tone?: HiddenClassPopupTextTone
  underline?: boolean
  popup?: HiddenClassProgressionPopupInfo
}

export interface HiddenClassProgressionEntry {
  level: number
  label: string
  value?: string
  lines?: HiddenClassProgressionStatLine[]
  popup?: HiddenClassProgressionPopupInfo
}

export interface HiddenClassDefinition {
  id: string
  name: string
  title: string
  weaponClass: string
  tagLevel: number
  accentColor: string
  imagePath: string
  summary: string
  traits: string[]
  stats: HiddenClassStat[]
  nodes: HiddenClassNode[]
  progressionEntries?: HiddenClassProgressionEntry[]
  boardRows?: HiddenClassBoardRow[]
}