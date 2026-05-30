import type {
  HiddenClassAbilityPopupCard,
  HiddenClassAbilityPopupInfo,
  HiddenClassAbilityPopupPanel,
  HiddenClassAbilityPopupTextSegment,
  HiddenClassBoardCategory,
  HiddenClassBoardRow,
  HiddenClassDefinition,
  HiddenClassNode,
  HiddenClassPopupPanelTone,
  HiddenClassPopupTextTone,
  HiddenClassProgressionPopupInfo,
  HiddenClassProgressionEntry,
} from '../types/hiddenClass'

const categoryImagePathMap = {
  enhance: '/assets/images/hidden-class/enhance/enhance.png',
  combat: '/assets/images/hidden-class/combat/combat.png',
  vitality: '/assets/images/hidden-class/vitality/vitality.png',
  trick: '/assets/images/hidden-class/trick/trick.png',
} as const

const boardCategoryImagePathMap: Record<HiddenClassBoardCategory, string> = {
  enhance: '/assets/images/hidden-class/enhance/enhance.png',
  combat: '/assets/images/hidden-class/combat/combat.png',
  vitality: '/assets/images/hidden-class/vitality/vitality.png',
  trick: '/assets/images/hidden-class/trick/trick.png',
  recon: '/assets/images/hidden-class/recon/recon.png',
  defense: '/assets/images/hidden-class/defense/defense.png',
  support: '/assets/images/hidden-class/support/support.png',
  spell: '/assets/images/hidden-class/spell/spell.png',
}

const nodeImagePathByName: Record<string, string> = {
  Deathblow: '/assets/images/hidden-class/enhance/deathblow.png',
  'Hellfire Weapon': '/assets/images/hidden-class/enhance/hellfireWeapon.png',
  'Polish Weapon': '/assets/images/hidden-class/combat/polishWeapon.png',
  'Secreta\'s Talent': '/assets/images/hidden-class/recon/secretasTalent.png',
  'Power of Darkness': '/assets/images/hidden-class/spell/powerOfDarkness.png',
  'Deliberate Attack': '/assets/images/hidden-class/support/deliberateAttack.png',
  'Time Haste': '/assets/images/hidden-class/trick/timeHaste.png',
}

const boardCategoryDescriptions: Record<HiddenClassBoardCategory, string> = {
  enhance: 'Enhance abilities reinforce burst windows and offensive scaling across the hidden class board.',
  combat: 'Combat abilities strengthen direct engagements and sustained front-line pressure.',
  vitality: 'Vitality abilities focus on survivability, recovery tempo, and long-fight stability.',
  trick: 'Trick abilities improve tempo, utility, and controlled repositioning.',
  recon: 'Recon abilities sharpen awareness, precision, and opportunistic damage windows.',
  defense: 'Defense abilities improve guard value, control, and front-line durability.',
  support: 'Support abilities add team utility, sustain, and battlefield control tools.',
  spell: 'Spell abilities increase magical pressure and utility-driven board progression.',
}

const formatBoardCategoryLabel = (category: HiddenClassBoardCategory) => `${category.charAt(0).toUpperCase()}${category.slice(1)}`

const parseBoardRankText = (rankText: string) => {
  const match = rankText.match(/^(\d+)\/(\d+)$/)

  if (!match) {
    return null
  }

  const currentRank = Number(match[1])
  const maxRank = Number(match[2])
  const completion = maxRank > 0 ? Math.round((currentRank / maxRank) * 100) : 0

  return { currentRank, maxRank, completion }
}

type BoardAbilityRankInfo = ReturnType<typeof parseBoardRankText>

interface BoardAbilityPopupContext {
  category: HiddenClassBoardCategory
  abilityName: string
  grade: string
  rankText: string
  parsedRank: BoardAbilityRankInfo
}

interface BoardAbilityCardPreset {
  rows?: HiddenClassAbilityPopupCard['rows']
  description?: string
  descriptionSegments?: HiddenClassAbilityPopupTextSegment[]
  panels?: HiddenClassAbilityPopupPanel[]
}

interface BoardAbilityPresetPanelConfig {
  title: string
  tone: HiddenClassPopupPanelTone | HiddenClassPopupPanelTone[]
  durationText?: string
  items?: string[]
  lines: HiddenClassAbilityPopupTextSegment[][]
}

const createAbilityPanelItems = (durationText?: string, items?: string[]) => {
  const panelItems = [...(items ?? [])]

  if (durationText?.trim()) {
    panelItems.unshift(`Duration: ${durationText}`)
  }

  return panelItems.length ? panelItems : undefined
}

interface BoardAbilityPreset {
  active: BoardAbilityCardPreset
  passive: BoardAbilityCardPreset
}

const createAbilitySegment = (
  text: string,
  tone?: HiddenClassPopupTextTone,
  underline?: boolean,
  breakLine?: boolean,
): HiddenClassAbilityPopupTextSegment => ({ text, tone, underline, breakLine })

const createAbilityPanel = (
  title: string,
  tone: HiddenClassPopupPanelTone | HiddenClassPopupPanelTone[],
  itemSegments: HiddenClassAbilityPopupTextSegment[][],
  items?: string[],
): HiddenClassAbilityPopupPanel => ({
  title,
  tone,
  itemSegments,
  items,
})

const createPresetPanels = (
  durationText: string | undefined,
  panels?: BoardAbilityPresetPanelConfig[],
): HiddenClassAbilityPopupPanel[] | undefined => {
  if (!panels?.length) {
    return undefined
  }

  return panels
    .filter((panel) => panel.title && panel.tone && panel.lines.length)
    .map((panel, panelIndex) => createAbilityPanel(
      panel.title,
      panel.tone,
      panel.lines,
      createAbilityPanelItems(panel.durationText ?? (panelIndex === 0 ? durationText : undefined), panel.items),
    ))
}

const createAbilityCard = (
  abilityName: string,
  grade: string,
  status: 'Active' | 'Passive',
  preset: BoardAbilityCardPreset,
): HiddenClassAbilityPopupCard => ({
  title: `${abilityName}: ${grade}`,
  status,
  rows: preset.rows,
  description: preset.description,
  descriptionSegments: preset.descriptionSegments,
  panels: preset.panels,
})

const getAbilityScaledValue = (parsedRank: BoardAbilityRankInfo, factor: number, base: number) => (
  parsedRank ? base + Math.round(parsedRank.currentRank * factor) : base
)

type BoardAbilityRowValue = string | HiddenClassAbilityPopupTextSegment[]

const createActiveRows = (
  range: string,
  cost: string,
  cooldown: string,
  damage: BoardAbilityRowValue,
): HiddenClassAbilityPopupCard['rows'] => {
  const rows: NonNullable<HiddenClassAbilityPopupCard['rows']> = []

  if (range.trim()) {
    rows.push({ label: 'Range', value: range })
  }

  if (cost.trim()) {
    rows.push({ label: 'Cost', value: cost })
  }

  if (cooldown.trim()) {
    rows.push({ label: 'Cooldown', value: cooldown })
  }

  if (Array.isArray(damage) ? damage.length : damage.trim()) {
    rows.push(Array.isArray(damage)
      ? { label: 'Damage', valueSegments: damage }
      : { label: 'Damage', value: damage })
  }

  return rows
}

const createBoardAbilityPreset = (preset: {
  active: {
    range: string
    cost?: string
    cooldown: string
    damage: BoardAbilityRowValue
    durationText?: string
    descriptionSegments: HiddenClassAbilityPopupTextSegment[]
    panels?: BoardAbilityPresetPanelConfig[]
    panelTitle?: string
    panelTone?: HiddenClassPopupPanelTone | HiddenClassPopupPanelTone[]
    panelItems?: string[]
    panelLines?: HiddenClassAbilityPopupTextSegment[][]
  }
  passive: {
    trigger?: string
    valueSegments?: ((context: BoardAbilityPopupContext) => HiddenClassAbilityPopupTextSegment[]) | string
    descriptionSegments: HiddenClassAbilityPopupTextSegment[]
    panelTitle?: string
    panelTone?: HiddenClassPopupPanelTone | HiddenClassPopupPanelTone[]
    panelItems?: string[]
    panelLines?: (context: BoardAbilityPopupContext) => HiddenClassAbilityPopupTextSegment[][]
  }
}) => (_context: BoardAbilityPopupContext): BoardAbilityPreset => ({
  active: {
    rows: createActiveRows(preset.active.range, preset.active.cost ?? '', preset.active.cooldown, preset.active.damage),
    descriptionSegments: preset.active.descriptionSegments,
    panels: createPresetPanels(
      preset.active.durationText,
      preset.active.panels ?? (preset.active.panelTitle && preset.active.panelTone && preset.active.panelLines?.length
        ? [{
            title: preset.active.panelTitle,
            tone: preset.active.panelTone,
            items: preset.active.panelItems,
            lines: preset.active.panelLines,
          }]
        : undefined),
    ),
  },
  passive: {
    descriptionSegments: preset.passive.descriptionSegments,
  },
})

const boardAbilityDefinitionPresets: Record<string, (context: BoardAbilityPopupContext) => BoardAbilityPreset> = {
  Deathblow: createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '75s',
      damage: '',
      durationText: '',
      descriptionSegments: [
        createAbilitySegment('Attacks have a '),
        createAbilitySegment('100%', 'highlight', false),
        createAbilitySegment(' chance to be a Critical Hit for 6 sec.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Critical Hit Damage '),
        createAbilitySegment('+16%', 'highlight', false),
      ],
    },
  }),
  'Time Haste': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '75s',
      damage: '',
      durationText: '10 sec',
      descriptionSegments: [
        createAbilitySegment('Reduces '),
        createAbilitySegment('Cooldown', 'highlight', true),
        createAbilitySegment(' of the next 2 skills used for a short duration.'),
      ],
      panelTitle: 'Time Haste: Expert',
      panelTone: 'green',
      panelLines: [
        [createAbilitySegment('Cooldown Decrease +25%')],
        [createAbilitySegment('Stack decreases when using skills.')]
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Cooldown Decrease '),
        createAbilitySegment('+5%', 'highlight', false),
      ],
    },
  }),
  "Secreta's Talent": createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '45s',
      damage: [
        createAbilitySegment('175%', 'default'),
        createAbilitySegment(' + '),
        createAbilitySegment('175%', 'accent'),
      ],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' to the target. The higher the '),
        createAbilitySegment('DEX', 'highlight', false),
        createAbilitySegment(', the more damage is dealt.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Defense Penetration '),
        createAbilitySegment('+27', 'highlight', false),
      ],
    },
  }),
  Parry: createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '55s',
      damage: '',
      durationText: '3 sec',
      descriptionSegments: [
        createAbilitySegment('Significantly reduces '),
        createAbilitySegment('Damage Received', 'highlight', true),
        createAbilitySegment(' for a short duration.'),
      ],
      panelTitle: 'Parry: Expert',
      panelTone: 'green',
      panelLines: [[createAbilitySegment('Damage Received Decrease +25%')]],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('All Damage '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  'Wild Dance': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '52s',
      damage: '',
      durationText: '5 sec',
      descriptionSegments: [
        createAbilitySegment('When attacking, increases '),
        createAbilitySegment('Attack Speed', 'highlight', true),
        createAbilitySegment(' and '),
        createAbilitySegment('All Damage', 'highlight', true),
        createAbilitySegment(' for '),
        createAbilitySegment('30', 'highlight', false),
        createAbilitySegment(' attacks.'),
      ],
      panelTitle: 'Wild Dance: Expert',
      panelTone: 'green',
      panelLines: [
        [createAbilitySegment('Attack Speed +10%')],
        [createAbilitySegment('All Damage +2%')],
        [createAbilitySegment('Stack decreases upon attack.')]
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Max HP '),
        createAbilitySegment('+800', 'highlight', false),
      ],
    },
  }),
  'Deliberate Attack': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '54s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Attacks are guaranteed to '),
        createAbilitySegment('hit', 'highlight', false),
        createAbilitySegment(' for 6 sec.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Accuracy '),
        createAbilitySegment('+90', 'highlight', false),
      ],
    },
  }),
  'Hellfire Weapon': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '55s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Basic Attacks become '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' (85% + '),
        createAbilitySegment('85%', 'accent', false),
        createAbilitySegment(') for 8 sec and reduce the target\'s '),
        createAbilitySegment('Endurance', 'red', true),
        createAbilitySegment(' and '),
        createAbilitySegment('Shield Defense', 'red', true),
        createAbilitySegment(' for 3 sec.', 'default', false, true),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false, false),
        createAbilitySegment(' skills cannot be used together.', 'default', false, true),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false, false),
        createAbilitySegment(' tag abilities share Cooldown.', 'default', false, false),
      ],
      panels: [
        {
          title: 'Hellfire Weapon: Expert',
          tone: 'red',
          durationText: '3 sec',
          lines: [
            [createAbilitySegment('Endurance -20')],
            [createAbilitySegment('Shield Defense -20')],
            [createAbilitySegment('(Max 3 Stacks)')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Evasion '),
        createAbilitySegment('+27', 'highlight', false),
      ],
    },
  }),
  'Honed Weaponry': createBoardAbilityPreset({
    active: {
      range: '2m',
      cooldown: '36s',
      damage: '120%',
      durationText: '5 sec',
      descriptionSegments: [
        createAbilitySegment('Deals Physical Damage to the target and inflicts '),
        createAbilitySegment('Bleed', 'red', true),
        createAbilitySegment(' for 5 sec. (Bleed Damage over Time: 16%)'),
      ],
      panelTitle: 'Bleed',
      panelTone: 'red',
      panelLines: [
        [createAbilitySegment('Receives Physical Damage over Time.')],
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Defense Penetration '),
        createAbilitySegment('+27', 'highlight', false),
      ],
    },
  }),
  Blink: createBoardAbilityPreset({
    active: {
      range: '5m',
      cooldown: '17s',
      damage: [
        createAbilitySegment('45%', 'default'),
        createAbilitySegment(' + '),
        createAbilitySegment('45%', 'accent'),
      ],
      descriptionSegments: [
        createAbilitySegment('Moves to a target within a 5m radius and deals '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment('.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Evasion '),
        createAbilitySegment('+27', 'highlight', false),
      ],
    },
  }),
  'Power of Darkness': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '20s',
      damage: [createAbilitySegment('130%', 'accent')],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Magic Damage', 'accent', false),
        createAbilitySegment(' to the target and recovers HP by '),
        createAbilitySegment('500', 'highlight', false),
        createAbilitySegment('.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Skill Damage '),
        createAbilitySegment('+7.5%', 'highlight', false),
      ],
    },
  }),
  'Polish Weapon': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '34s',
      damage: '',
      durationText: '10 sec',
      descriptionSegments: [
        createAbilitySegment('Increases '),
        createAbilitySegment('Attack Power', 'highlight', true),
        createAbilitySegment(' and '),
        createAbilitySegment('All Damage', 'highlight', true),
        createAbilitySegment(' for a short duration.'),
      ],
      panelTitle: 'Polish Weapon: Expert',
      panelTone: 'green',
      panelLines: [
        [createAbilitySegment('Attack Power +100')],
        [createAbilitySegment('All Damage +2%')]
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Attack Power '),
        createAbilitySegment('+28', 'highlight', false),
      ],
    },
  }),
  Gamble: createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '54s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Grants one of the following six effects to the caster for a short duration.', 'default', false, true),
        createAbilitySegment('#1: Recover HP '),
        createAbilitySegment('15%', 'highlight', false, true),
        createAbilitySegment('#2: Recover '),
        createAbilitySegment('250', 'highlight', false),
        createAbilitySegment(' MP', 'default', false, true),
        createAbilitySegment('#3: Attack Speed '),
        createAbilitySegment('+15%', 'highlight', false, true),
        createAbilitySegment('#4: Critical Hit '),
        createAbilitySegment('+160', 'highlight', false, true),
        createAbilitySegment('#5: Attack Power '),
        createAbilitySegment('+100', 'highlight', false, true),
        createAbilitySegment('#6: Attack Speed '),
        createAbilitySegment('+15%', 'highlight', false),
        createAbilitySegment(', Critical Hit ', 'default', false),
        createAbilitySegment('+160', 'highlight', false),
        createAbilitySegment(', Attack Power ', 'default', false),
        createAbilitySegment('+100', 'highlight', false, true),
        createAbilitySegment('[Recovery cannot exceed Max 7,500]', 'default', false),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Critical Hit '),
        createAbilitySegment('+60', 'highlight', false),
      ],
    },
  }),
  'Frost Weapon': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '55s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Basic Attacks become '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' (85% + '),
        createAbilitySegment('85%', 'accent', false),
        createAbilitySegment(') for 8 sec and reduce the target\'s '),
        createAbilitySegment('Movement Speed', 'red', true),
        createAbilitySegment(' for 3 sec.', 'default', false, true),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false, false),
        createAbilitySegment(' skills cannot be used together.', 'default', false, true),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false, false),
        createAbilitySegment(' tag abilities share Cooldown.', 'default', false, false),
      ],
      panels: [
        {
          title: 'Frost Weapon: Expert',
          tone: 'red',
          durationText: '3 sec',
          lines: [
            [createAbilitySegment('Movement Speed -6%')],
            [createAbilitySegment('(Max 3 Stacks)')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Potion Recovery '),
        createAbilitySegment('+12', 'highlight', false),
      ],
    },
  }),
  'Earth Shock': createBoardAbilityPreset({
    active: {
      range: '5m',
      cooldown: '45s',
      damage: '140%',
      durationText: '3 sec',
      descriptionSegments: [
        createAbilitySegment('Deals Physical Damage to targets within the fan-shaped range before the caster and significantly reduces their '),
        createAbilitySegment('Movement Speed', 'red', true),
        createAbilitySegment('. (Up to 5 targets)'),
      ],
      panelTitle: 'Earth Shock: Expert',
      panelTone: 'red',
      panelLines: [
        [createAbilitySegment('Movement Speed -45%')]
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Endurance Ignore '),
        createAbilitySegment('+28', 'highlight', false),
      ],
    },
  }),
  'Cutting Strike': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '60s',
      damage: '',
      durationText: '10 sec',
      descriptionSegments: [
        createAbilitySegment('Increases '),
        createAbilitySegment('Critical Hit', 'highlight', true),
        createAbilitySegment(' and '),
        createAbilitySegment('Critical Hit Damage', 'highlight', true),
        createAbilitySegment(' for a short duration.'),
      ],
      panelTitle: 'Cutting Strike: Expert',
      panelTone: 'green',
      panelLines: [
        [createAbilitySegment('Critical Hit +160')],
        [createAbilitySegment('Critical Hit Damage +7.5%')],
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Cripple Resistance '),
        createAbilitySegment('+65', 'highlight', false),
      ],
    },
  }),
  'Life Tap': createBoardAbilityPreset({
    active: {
      range: '',
      cost: 'HP 500',
      cooldown: '30s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Consumes '),
        createAbilitySegment('HP', 'red', false),
        createAbilitySegment(' to recover '),
        createAbilitySegment('10%', 'highlight', false),
        createAbilitySegment(' of MP.', 'default', false, true),
        createAbilitySegment('[Recovery cannot exceed Max 1,900.]'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Attack Power '),
        createAbilitySegment('+28', 'highlight', false),
      ],
    },
  }),
  Leech: createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '60s',
      damage: [createAbilitySegment('140%', 'accent')],
      durationText: '6 sec',
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Magic Damage', 'accent', false),
        createAbilitySegment(' to the target. Increases '),
        createAbilitySegment('Basic Attack Life Absorb', 'highlight', true),
        createAbilitySegment(' for a short duration.'),
      ],
      panelTitle: 'Leech: Expert',
      panelTone: 'green',
      panelLines: [
        [createAbilitySegment('Basic Attack Life Absorb +8%')]
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('HP Recovery in Battle '),
        createAbilitySegment('+50', 'highlight', false),
      ],
    },
  }),
  Anatomy: createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '55s',
      damage: '50%',
      descriptionSegments: [
        createAbilitySegment('Deals Physical Damage to the target and makes the target\'s '),
        createAbilitySegment('HP', 'red', false),
        createAbilitySegment(' visible for 10 sec. The '),
        createAbilitySegment('HP', 'red', false),
        createAbilitySegment(' view is shared with party members.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Accuracy '),
        createAbilitySegment('+90', 'highlight', false),
      ],
    },
  }),
  'Create Zone': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '60s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Creates a '),
        createAbilitySegment('Zone', 'highlight', false),
        createAbilitySegment(' around the caster for 5 sec to reduce '),
        createAbilitySegment('Damage Received', 'highlight', true),
        createAbilitySegment(' for party members within a 4m radius every sec. Reduces the caster\'s '),
        createAbilitySegment('Damage Received', 'highlight', true),
        createAbilitySegment(' for 10 sec.'),
      ],
      panels: [
        {
          title: 'Create Zone: Expert',
          tone: 'green',
          durationText: '10 sec',
          lines: [
            [createAbilitySegment('Damage Received Decrease +14%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Endurance '),
        createAbilitySegment('+28', 'highlight', false),
      ],
    },
  }),
  Overcome: createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '60s',
      damage: '',
      durationText: '5 sec',
      descriptionSegments: [
        createAbilitySegment('Increases '),
        createAbilitySegment('Max HP', 'highlight', true),
        createAbilitySegment(' for a short duration.'),
      ],
      panels: [
        {
          title: 'Overcome: Expert',
          tone: 'green',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Max HP +18%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Max HP '),
        createAbilitySegment('+800', 'highlight', false),
      ],
    },
  }),
  'Fire Spirit': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '52s',
      damage: [
        createAbilitySegment('90%', 'default'),
        createAbilitySegment(' + '),
        createAbilitySegment('90%', 'accent'),
      ],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' around the target and inflicts '),
        createAbilitySegment('Burn', 'red', true),
        createAbilitySegment(' for 8 sec. (Up to 5 targets, Burn Damage over Time: 8%)'),
      ],
      panels: [
        {
          title: 'Burn',
          tone: 'red',
          durationText: '8 sec',
          lines: [
            [createAbilitySegment('Magic Damage Received Increase +5%')],
            [createAbilitySegment('Receives Magic Damage over Time.')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Critical Hit Damage '),
        createAbilitySegment('+8%', 'highlight', false),
      ],
    },
  }),
  'Spell Infusion': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '48s',
      damage: [
        createAbilitySegment('45%', 'default'),
        createAbilitySegment(' + '),
        createAbilitySegment('45%', 'accent'),
      ],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' and inflicts '),
        createAbilitySegment('Spell Infusion', 'red', true),
        createAbilitySegment(' to targets on the straight line before the caster. Deals extra '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' 3 sec after and inflicts '),
        createAbilitySegment('Stun', 'red', true),
        createAbilitySegment(' for 1 sec. (Up to 5 targets)'),
      ],
      panels: [
        {
          title: 'Spell Infusion: Expert',
          tone: 'red',
          durationText: '3 sec',
          lines: [
            [
              createAbilitySegment('Receives (135% + '),
              createAbilitySegment('135%', 'accent', false),
              createAbilitySegment(') bonus '),
              createAbilitySegment('Combined Damage', 'violet', false),
              createAbilitySegment(', and becomes Stunned for 1 second when duration ends.'),
            ]
          ],
        },
        {
          title: 'Stun',
          tone: 'red',
          durationText: '1 sec',
          lines: [
            [createAbilitySegment('Becomes Incapacitated for the duration.')]
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Status Effects Hit '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  Wanderer: createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '41s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Increases '),
        createAbilitySegment('Movement Speed', 'highlight', true),
        createAbilitySegment(' of the caster and party members within a 4m radius for a short duration.'),
      ],
      panels: [
        {
          title: 'Wanderer: Expert',
          tone: 'green',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Movement Speed +16%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Movement Speed '),
        createAbilitySegment('+5%', 'highlight', false),
      ],
    },
  }),
  Chase: createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '27s',
      damage: '95%',
      descriptionSegments: [
        createAbilitySegment('Moves to a target within a 7m radius, deals Physical Damage, and reduces its '),
        createAbilitySegment('Movement Speed', 'red', true),
        createAbilitySegment(' for 3 sec.'),
      ],
      panels: [
        {
          title: 'Chase: Expert',
          tone: 'red',
          durationText: '3 sec',
          lines: [
            [createAbilitySegment('Movement Speed -30%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Grapple Resistance '),
        createAbilitySegment('+6%', 'highlight', false),
      ],
    },
  }),
  'Defensive Stance': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '60s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Increases '),
        createAbilitySegment('Defense Power', 'highlight', true),
        createAbilitySegment(' and reduces '),
        createAbilitySegment('Damage Received', 'highlight', true),
        createAbilitySegment(' for a short duration.'),
      ],
      panels: [
        {
          title: 'Defensive Stance: Expert',
          tone: 'green',
          durationText: '10 sec',
          lines: [
            [createAbilitySegment('Defense Power +115')],
            [createAbilitySegment('Damage Received Decrease +2%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Endurance '),
        createAbilitySegment('+28', 'highlight', false),
      ],
    },
  }),
  Supersense: createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '52s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Significantly increases the attack '),
        createAbilitySegment('Evasion', 'highlight', true),
        createAbilitySegment(' chance for 2 sec.'),
      ],
      panels: [
        {
          title: 'Supersense: Expert',
          tone: 'green',
          durationText: '2 sec',
          lines: [
            [createAbilitySegment('Evasion +1,300')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('All Damage '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  'Install Bomb': createBoardAbilityPreset({
    active: {
      range: '2m',
      cooldown: '44s',
      damage: '130%',
      descriptionSegments: [
        createAbilitySegment('Deals Physical Damage to the target and inflicts '),
        createAbilitySegment('Install Bomb', 'red', true),
        createAbilitySegment('. Attacking the target inflicted with the effect increases stacks. When reaching 5 stacks, inflicts '),
        createAbilitySegment('Stun', 'red', true),
        createAbilitySegment(' for 3 sec.'),
      ],
      panels: [
        {
          title: 'Install Bomb: Expert',
          tone: 'red',
          durationText: '5 sec',
          lines: [
            [
              createAbilitySegment('Stacks increase when hit, and becomes '),
              createAbilitySegment('Stunned', 'red', false),
              createAbilitySegment(' after 5 stacks. (Max 5 stacks)'),
            ],
          ],
        },
        {
          title: 'Stun',
          tone: 'red',
          durationText: '3 sec',
          lines: [
            [createAbilitySegment('Becomes Incapacitated for the duration.')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Status Effects Hit '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  'Magic Ignition': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '68s',
      damage: [createAbilitySegment('130%', 'accent')],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Magic Damage', 'accent', false),
        createAbilitySegment(' to the target and drains the target\'s MP by '),
        createAbilitySegment('11%', 'highlight', false),
        createAbilitySegment(' of Max MP.'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Damage to Normal Monsters Increase '),
        createAbilitySegment('+4%', 'highlight', false),
      ],
    },
  }),
  'Magic Circulation': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '40s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Grants one of the following effects to the caster for a short duration.', 'default', false, true),
        createAbilitySegment('#1: Grants a Barrier that absorbs Damage equal to ', 'default', false),
        createAbilitySegment('52.5%', 'highlight', false),
        createAbilitySegment(' of Max MP', 'default', false, true),
        createAbilitySegment('#2: Attack Power ', 'default', false),
        createAbilitySegment('+2', 'highlight', false),
        createAbilitySegment(' per '),
        createAbilitySegment('80', 'highlight', false),
        createAbilitySegment(' of Max MP', 'default', false, true),
        createAbilitySegment('[Barrier cannot exceed Max 7,900.]'),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Knockdown Resistance '),
        createAbilitySegment('+6%', 'highlight', false),
      ],
    },
  }),
  'Weapon of Destruction': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '55s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Basic Attacks become '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' (80% + '),
        createAbilitySegment('80%', 'accent', false),
        createAbilitySegment(') for 5 sec, cancel the target\'s ', 'default', false),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false),
        createAbilitySegment(' and '),
        createAbilitySegment('[Enhance Attack]', 'yellow', false),
        createAbilitySegment(' skills, and destroy all '),
        createAbilitySegment('Barriers', 'highlight', false),
        createAbilitySegment('.', 'default', false, true),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false),
        createAbilitySegment(' skills cannot be used together.', 'default', false, true),
        createAbilitySegment('[Basic Attack Change]', 'yellow', false),
        createAbilitySegment(' tag abilities share Cooldown.', 'default', false),
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Status Effects Hit '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  'Weak Spot Analysis': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '55s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Increases the caster\'s '),
        createAbilitySegment('Critical Hit', 'highlight', true),
        createAbilitySegment(' for 8 sec, and upon critical hits, increases '),
        createAbilitySegment('Damage Received', 'red', true),
        createAbilitySegment(' to the target with a 100% chance for 5 sec.'),
      ],
      panels: [
        {
          title: 'Weak Spot Analysis: Expert',
          tone: 'green',
          durationText: '8 sec',
          lines: [
            [createAbilitySegment('Critical Hit +130')],
          ],
        },
        {
          title: 'Weak Spot Analysis: Expert',
          tone: 'red',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Damage Received Increase +10%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Critical Hit '),
        createAbilitySegment('+60', 'highlight', false),
      ],
    },
  }),
  'Mirror Shield': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '40s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Increases the caster\'s '),
        createAbilitySegment('Defense Power', 'highlight', true),
        createAbilitySegment(' for 5 sec and returns '),
        createAbilitySegment('80%', 'highlight', false),
        createAbilitySegment(' of Damage Received to the target.', 'default', false, true),
        createAbilitySegment(' (Damage is not deflected to Elite or Boss Monsters.)'),
      ],
      panels: [
        {
          title: 'Mirror Shield: Expert',
          tone: 'green',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Defense Power +90', 'default', false, true)],
            [createAbilitySegment('Returns 80% of damage received to the target.', 'default')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Critical Hit Resistance '),
        createAbilitySegment('+60', 'highlight', false),
      ],
    },
  }),
  'War Cry': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '45s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Increases '),
        createAbilitySegment('All Damage', 'highlight', true),
        createAbilitySegment(' and '),
        createAbilitySegment('Movement Speed', 'highlight', true),
        createAbilitySegment(' of the caster and party members within a 4m radius for a short duration.'),
      ],
      panels: [
        {
          title: 'War Cry: Expert',
          tone: 'green',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('All Damage +10%')],
            [createAbilitySegment('Movement Speed +10%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Damage Received from Boss Monsters Decrease '),
        createAbilitySegment('+5.5%', 'highlight', false),
      ],
    },
  }),
  'Ice Spirit': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '52s',
      damage: [
        createAbilitySegment('90%', 'default'),
        createAbilitySegment(' + '),
        createAbilitySegment('90%', 'accent'),
      ],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' around the target, reduces '),
        createAbilitySegment('Movement Speed', 'red', true),
        createAbilitySegment(', and increases '),
        createAbilitySegment('Magic Damage Received', 'red', true),
        createAbilitySegment('. (Up to 5 targets)'),
      ],
      panels: [
        {
          title: 'Ice Spirit: Expert',
          tone: 'red',
          durationText: '3 sec',
          lines: [
            [createAbilitySegment('Movement Speed -22.5%')],
            [createAbilitySegment('Magic Damage Received Increase +13%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Damage over Time '),
        createAbilitySegment('+6%', 'highlight', false),
      ],
    },
  }),
  'Spread Venom': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '34s',
      damage: '90%',
      descriptionSegments: [
        createAbilitySegment('Deals Physical Damage around the target and inflicts '),
        createAbilitySegment('Venom', 'red', true),
        createAbilitySegment(' for 5 sec. (Up to 5 targets, Venom Damage over Time: 20%)', 'default', false, true),
        createAbilitySegment('Poison', 'red', false),
        createAbilitySegment(' and '),
        createAbilitySegment('Venom', 'red', false),
        createAbilitySegment(' can be inflicted at the same time.'),
      ],
      panels: [
        {
          title: 'Venom',
          tone: 'red',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Potion Recovery Rate -70%')],
            [createAbilitySegment('Receives Physical Damage over Time.')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Damage Received Decrease in PvP '),
        createAbilitySegment('+4.5%', 'highlight', false),
      ],
    },
  }),
  'Magnetic Field': createBoardAbilityPreset({
    active: {
      range: '3m',
      cooldown: '60s',
      damage: [createAbilitySegment('95%', 'accent')],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Magic Damage', 'accent', false),
        createAbilitySegment(' around the caster and inflicts '),
        createAbilitySegment('Stun', 'red', true),
        createAbilitySegment(' for 0.2 sec with a '),
        createAbilitySegment('+50%', 'highlight', false),
        createAbilitySegment(' chance for every 2, 4, 6, and 8 sec. (Up to 5 targets)'),
      ],
      panels: [
        {
          title: 'Stun',
          tone: 'red',
          durationText: '0.2 sec',
          lines: [
            [createAbilitySegment('Becomes Incapacitated for the duration.')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Status Effects Hit '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  'Lightning Spirit': createBoardAbilityPreset({
    active: {
      range: '7m',
      cooldown: '52s',
      damage: [
        createAbilitySegment('130% + ', 'default'),
        createAbilitySegment('130%', 'accent'),
      ],
      descriptionSegments: [
        createAbilitySegment('Deals '),
        createAbilitySegment('Combined Damage', 'violet', false),
        createAbilitySegment(' around the target and reduces its '),
        createAbilitySegment('Attack Speed', 'red', true),
        createAbilitySegment('. (Up to 5 targets)'),
      ],
      panels: [
        {
          title: 'Lightning Spirit: Expert',
          tone: 'red',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Attack Speed -23%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Damage Received Decrease '),
        createAbilitySegment('+3%', 'highlight', false),
      ],
    },
  }),
  'Continuous Curing': createBoardAbilityPreset({
    active: {
      range: '',
      cooldown: '54s',
      damage: '',
      descriptionSegments: [
        createAbilitySegment('Recovers HP of the caster and party members within a 4m radius by '),
        createAbilitySegment('300', 'highlight', false),
        createAbilitySegment(' + '),
        createAbilitySegment('1%', 'highlight', false),
        createAbilitySegment(' of HP per second for 5 sec. After the recovery ends, reduces '),
        createAbilitySegment('Healing Received', 'red', true),
        createAbilitySegment(' for 5 sec. (Up to 5 targets)', 'default', false, true),
        createAbilitySegment('[Recovery cannot exceed Max 800 per instance.]'),
      ],
      panels: [
        {
          title: 'Recovery Aftermath',
          tone: 'red',
          durationText: '5 sec',
          lines: [
            [createAbilitySegment('Healing Received -50%')],
          ],
        },
      ],
    },
    passive: {
      trigger: '',
      valueSegments: '',
      descriptionSegments: [
        createAbilitySegment('Max HP '),
        createAbilitySegment('+800', 'highlight', false),
      ],
    },
  }),
}

const createBoardAbilityPopup = (
  category: HiddenClassBoardCategory,
  abilityName: string,
  imagePath: string,
  rankText: string,
): HiddenClassAbilityPopupInfo => {
  const parsedRank = parseBoardRankText(rankText)
  const grade = parsedRank && parsedRank.currentRank >= parsedRank.maxRank ? 'Expert' : 'Progress'
  const level = parsedRank
    ? `${rankText} (${Math.max(0, 100 - parsedRank.completion)}%)`
    : rankText
  const presetContext: BoardAbilityPopupContext = {
    category,
    abilityName,
    grade,
    rankText,
    parsedRank,
  }
  const abilityPreset = boardAbilityDefinitionPresets[abilityName]?.(presetContext)

  const cards: HiddenClassAbilityPopupCard[] = abilityPreset
    ? [
        createAbilityCard(abilityName, grade, 'Active', abilityPreset.active),
        createAbilityCard(abilityName, grade, 'Passive', abilityPreset.passive),
      ]
    : [
        {
          title: `${abilityName}: ${grade}`,
          status: 'Active',
          rows: (parsedRank
            ? [
                { label: 'Range', value: 'Board Range', tone: 'accent' },
                { label: 'Cooldown', value: 'Instant' },
                {
                  label: 'Damage',
                  value: `${parsedRank.currentRank}% + ${parsedRank.maxRank}%`,
                  tone: 'highlight',
                },
              ]
            : [{ label: 'Level', value: rankText, tone: 'highlight' }]) as HiddenClassAbilityPopupCard['rows'],
          descriptionSegments: [
            createAbilitySegment(boardCategoryDescriptions[category]),
            createAbilitySegment(` ${abilityName} `, 'highlight', true),
            createAbilitySegment('directly affects the active flow of this hidden class board setup.'),
          ],
          panels: [
            createAbilityPanel('Ability Damage', 'subtle', [[createAbilitySegment('Detailed authored popup data can be added for this ability.')]]),
          ],
        },
        {
          title: `${abilityName}: ${grade}`,
          status: 'Passive',
          rows: [
            { label: 'Effect', value: `${formatBoardCategoryLabel(category)} Mastery`, tone: 'accent' },
            {
              label: 'Value',
              value: parsedRank ? `+${Math.max(1, Math.round(parsedRank.currentRank * 0.8))}` : '+80',
              tone: 'highlight',
            },
          ] as HiddenClassAbilityPopupCard['rows'],
          descriptionSegments: [
            createAbilitySegment(abilityName, 'highlight', true),
            createAbilitySegment(` passively reinforces board progression with a ${formatBoardCategoryLabel(category).toLowerCase()}-focused bonus.`),
          ],
        },
      ]

  return {
    title: abilityName,
    category,
    iconPath: imagePath,
    meta: [
      { label: 'Tag', value: formatBoardCategoryLabel(category) },
      { label: 'Grade', value: grade },
      { label: 'Level', value: level },
    ],
    cards,
  }
}

const withNodeImagePath = (node: HiddenClassNode): HiddenClassNode => ({
  ...node,
  imagePath: nodeImagePathByName[node.name] ?? categoryImagePathMap[node.category],
})

const createBoardEntry = (
  category: HiddenClassBoardCategory,
  abilityName: string,
  imagePath?: string,
  rankText = '80/80',
  popup?: HiddenClassAbilityPopupInfo,
) => {
  const resolvedImagePath = imagePath ?? nodeImagePathByName[abilityName] ?? boardCategoryImagePathMap[category]

  return {
    category,
    abilityName,
    imagePath: resolvedImagePath,
    rankText,
    popup: popup ?? createBoardAbilityPopup(category, abilityName, resolvedImagePath, rankText),
  }
}

const createBoardRows = (classId: string): HiddenClassBoardRow[] => {
  const rowPresets: Record<string, HiddenClassBoardRow[]> = {
    'sword-master': [
      {
        left: createBoardEntry('enhance', 'Deathblow', '/assets/images/hidden-class/enhance/deathblow.png'),
        right: createBoardEntry('trick', 'Time Haste', '/assets/images/hidden-class/trick/timeHaste.png'),
      },
      {
        left: createBoardEntry('recon', 'Secreta\'s Talent', '/assets/images/hidden-class/recon/secretasTalent.png'),
        right: createBoardEntry('defense', 'Parry', '/assets/images/hidden-class/defense/parry.png'),
      },
      {
        left: createBoardEntry('combat', 'Wild Dance', '/assets/images/hidden-class/combat/wildDance.png'),
        right: createBoardEntry('support', 'Deliberate Attack', '/assets/images/hidden-class/support/deliberateAttack.png'),
      },
    ],
    destroyer: [
      {
        left: createBoardEntry('enhance', 'Hellfire Weapon', '/assets/images/hidden-class/enhance/hellfireWeapon.png'),
        right: createBoardEntry('recon', 'Honed Weaponry', '/assets/images/hidden-class/recon/honedWeaponry.png'),
      },
      {
        left: createBoardEntry('trick', 'Blink', '/assets/images/hidden-class/trick/blink.png'),
        right: createBoardEntry('spell', 'Power of Darkness', '/assets/images/hidden-class/spell/powerOfDarkness.png'),
      },
      {
        left: createBoardEntry('combat', 'Polish Weapon', '/assets/images/hidden-class/combat/polishWeapon.png'),
        right: createBoardEntry('support', 'Gamble', '/assets/images/hidden-class/support/gamble.png'),
      },
    ],
    'frost-knight': [
      {
        left: createBoardEntry('spell', 'Frost Weapon', '/assets/images/hidden-class/spell/frostWeapon.png'),
        right: createBoardEntry('combat', 'Earth Shock', '/assets/images/hidden-class/combat/earthShock.png'),
      },
      {
        left: createBoardEntry('enhance', 'Cutting Strike', '/assets/images/hidden-class/enhance/cuttingStrike.png'),
        right: createBoardEntry('trick', 'Life Tap', '/assets/images/hidden-class/trick/lifeTap.png'),
      },
      {
        left: createBoardEntry('vitality', 'Leech', '/assets/images/hidden-class/vitality/leech.png'),
        right: createBoardEntry('support', 'Anatomy', '/assets/images/hidden-class/support/anatomy.png'),
      },
    ],
    'ancient-protector': [
      {
        left: createBoardEntry('defense', 'Create Zone', '/assets/images/hidden-class/defense/createZone.png'),
        right: createBoardEntry('support', 'Deliberate Attack', '/assets/images/hidden-class/support/deliberateAttack.png'),
      },
      {
        left: createBoardEntry('vitality', 'Overcome', '/assets/images/hidden-class/vitality/overcome.png'),
        right: createBoardEntry('enhance', 'Fire Spirit', '/assets/images/hidden-class/enhance/fireSpirit.png'),
      },
      {
        left: createBoardEntry('spell', 'Spell Infusion', '/assets/images/hidden-class/spell/spellInfusion.png'),
        right: createBoardEntry('trick', 'Wanderer', '/assets/images/hidden-class/trick/wanderer.png'),
      },
    ],
    'immortal-knight': [
      {
        left: createBoardEntry('combat', 'Chase', '/assets/images/hidden-class/combat/chase.png'),
        right: createBoardEntry('defense', 'Defensive Stance', '/assets/images/hidden-class/defense/defensiveStance.png'),
      },
      {
        left: createBoardEntry('enhance', 'Deathblow', '/assets/images/hidden-class/enhance/deathblow.png'),
        right: createBoardEntry('recon', 'Supersense', '/assets/images/hidden-class/recon/supersense.png'),
      },
      {
        left: createBoardEntry('trick', 'Install Bomb', '/assets/images/hidden-class/trick/installBomb.png'),
        right: createBoardEntry('recon', 'Secreta\'s Talent', '/assets/images/hidden-class/recon/secretasTalent.png'),
      },
    ],
    trinity: [
      {
        left: createBoardEntry('enhance', 'Cutting Strike', '/assets/images/hidden-class/enhance/cuttingStrike.png'),
        right: createBoardEntry('vitality', 'Magic Ignition', '/assets/images/hidden-class/vitality/magicIgnition.png'),
      },
      {
        left: createBoardEntry('vitality', 'Magic Circulation', '/assets/images/hidden-class/vitality/magicCirculation.png'),
        right: createBoardEntry('recon', 'Supersense', '/assets/images/hidden-class/recon/supersense.png'),
      },
      {
        left: createBoardEntry('trick', 'Weapon of Destruction', '/assets/images/hidden-class/trick/weaponOfDestruction.png'),
        right: createBoardEntry('support', 'Weak Spot Analysis', '/assets/images/hidden-class/support/weakSpotAnalysis.png'),
      },
    ],
    'harbinger-of-storms': [
      {
        left: createBoardEntry('defense', 'Mirror Shield', '/assets/images/hidden-class/defense/mirrorShield.png'),
        right: createBoardEntry('vitality', 'War Cry', '/assets/images/hidden-class/vitality/warCry.png'),
      },
      {
        left: createBoardEntry('enhance', 'Ice Spirit', '/assets/images/hidden-class/enhance/iceSpirit.png'),
        right: createBoardEntry('spell', 'Power of Darkness', '/assets/images/hidden-class/spell/powerOfDarkness.png'),
      },
      {
        left: createBoardEntry('recon', 'Spread Venom', '/assets/images/hidden-class/recon/spreadVenom.png'),
        right: createBoardEntry('spell', 'Magnetic Field', '/assets/images/hidden-class/spell/magneticField.png'),
      },
    ],
    'goddess-of-blessings': [
      {
        left: createBoardEntry('defense', 'Create Zone', '/assets/images/hidden-class/defense/createZone.png'),
        right: createBoardEntry('enhance', 'Lightning Spirit', '/assets/images/hidden-class/enhance/lightningSpirit.png'),
      },
      {
        left: createBoardEntry('vitality', 'Leech', '/assets/images/hidden-class/vitality/leech.png'),
        right: createBoardEntry('trick', 'Time Haste', '/assets/images/hidden-class/trick/timeHaste.png'),
      },
      {
        left: createBoardEntry('trick', 'Wanderer', '/assets/images/hidden-class/trick/wanderer.png'),
        right: createBoardEntry('support', 'Continuous Curing', '/assets/images/hidden-class/support/continuousCuring.png'),
      },
    ],
  }

  return rowPresets[classId] ?? rowPresets['sword-master']
}

const createProgressionEntries = (classId: string): HiddenClassProgressionEntry[] => {
  // Sword Master
  const createSwordMasterProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const exaltedWillPopup: HiddenClassProgressionPopupInfo = {
      title: 'Exalted Will',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Combined', tone: 'violet' },
        { label: 'Bonus Damage', tone: 'neutral' },
      ],
      detailText: 'When triggered, the attack deals an additional combined-damage hit based on the skill effect applied by this hidden class progression.',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '25%' },
            { text: ' + ' },
            { text: '25%', tone: 'accent' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Basic Attacks have a 25% chance of dealing Extra ' },
            { text: 'Combined Damage', tone: 'violet' },
            { text: '.' },
          ],
        },
      ],
    }

    // Level 600 popup
    const oneWithTheSwordPopup: HiddenClassProgressionPopupInfo = {
      title: 'One With the Sword',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Conditional Reduction', tone: 'red' },
        { label: 'Defense Increase', tone: 'green' },
      ],
      detailText: 'When hit, reduces the caster\'s Damage Received for the next 3 hits for 10 sec.',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 60s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'When hit, reduces the caster\'s ' },
            { text: 'Damage Received', tone: 'highlight' },
            { text: ' for the next 3 hits for 10 sec.' },
          ],
        },
        {
          title: 'One With the Sword',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 10 sec'],
          itemSegments: [
            [{ text: 'Damage Received Decrease +30%' }],
          ],
        },
      ],
    }

    // Level 800 popup
    const mindBladePopup: HiddenClassProgressionPopupInfo = {
      title: 'Mind Blade',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'Single', tone: 'neutral' },
        { label: 'Combined', tone: 'violet' },
        { label: 'MP Remove', tone: 'red' },
        { label: 'SP Remove', tone: 'red' },
      ],
      detailText: 'Deals combined damage to the target, then drains the target\'s MP and Stamina based on the hidden class progression effect.',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Range: 7m', 'Cost: MP 485', 'Cooldown: 112.8s'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '250%' },
            { text: ' + ' },
            { text: '250%', tone: 'accent' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Deals ' },
            { text: 'Combined Damage', tone: 'highlight' },
            { text: ' to the target, and drains the target\'s MP and Stamina equal to ' },
            { text: '80%', tone: 'highlight' },
            { text: ' of Max MP and Max Stamina.' },
          ],
        },
      ],
    }

    return [
    {
      level: 1,
      label: '',
      popup: exaltedWillPopup,
      lines: [
        {
          label: '',
          segments: [
            { text: 'Basic Attacks have a 25% chance of dealing Extra ' },
            {
              text: 'Combined Damage',
              tone: 'violet',
            },
            { text: '.' },
          ],
        },
      ],
    },
    { level: 100, label: 'Melee Defense Penetration', value: '+50' },
    { level: 200, label: 'Movement Speed', value: '+8%' },
    { level: 300, label: 'Attack Speed', value: '+8%' },
    { level: 400, label: 'Attack Power', value: '+70' },
    {
      level: 500,
      label: '',
      lines: [
        { label: 'Melee Attack', value: '+50' },
        { label: 'All Damage', value: '+3.5%' },
      ],
    },
    {
      level: 600,
      label: '',
      popup: oneWithTheSwordPopup,
      lines: [
        {
          label: '',
          segments: [
            { text: 'When hit, reduces the caster\'s '},
            {
              text: 'Damage Received',
              tone: 'highlight',
              underline: true,
            },
            { text: ' for the next 3 hits for 10 sec. ' },
          ],
        },
      ],
    },
    { level: 700, label: 'Defense Power', value: '+100' },
    {
      level: 800,
      label: '',
      popup: mindBladePopup,
      lines: [
        {
          label: '',
          segments: [
            { text: 'Deals '},
            {
              text: 'Combined Damage',
              tone: 'highlight',
            },
            { text: ' to the target, and drains the target\'s MP and Stamina equal to ' },
            { text: '80%', tone: 'highlight' },
            { text: ' of Max MP and Max Stamina.'},
          ],
        },
      ],
    },
    ]
  }

  // Destroyer
  const createDestroyerProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const landCrushPopup: HiddenClassProgressionPopupInfo = {
      title: 'Land Crush',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Combined', tone: 'violet' },
        { label: 'Knockdown', tone: 'red' },
        { label: 'Damage Immunity', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Range: 7m', 'Cooldown: 84.6s'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '100%' },
            { text: ' + ' },
            { text: '100%', tone: 'accent' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Jumps to a target within a 7m radius and deals ' },
            { text: 'Combined Damage', tone: 'violet' },
            { text: ' around the target and inflicts ' },
            { text: 'Knockdown', tone: 'red' },
            { text: ' for 2 sec with a ' },
            { text: '+80%', tone: 'highlight' },
            { text: ' chance. (Up to 10 targets) Gains ' },
            { text: 'Damage Immunity', tone: 'highlight' },
            { text: ' for 3.5 sec.' },
          ],
        },
        {
          title: 'Knockdown',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 2 sec'],
          itemSegments: [
            [{ text: 'Becomes Incapacitated for the duration.' }]
          ],
        },
        {
          title: 'Damage Immunity',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 3.5 sec'],
          itemSegments: [
            [{ text: 'Damage immune to All Damage.' }]
          ],
        },
      ],
    }

    // Level 600 popup
    const destructiveInstinctPopup: HiddenClassProgressionPopupInfo = {
      title: 'Destructive Instinct',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Defense Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 120s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Landing Attack increases the caster\'s ' },
            { text: 'Attack Power', tone: 'highlight' },
            { text: ' and ' },
            { text: 'Defense Power', tone: 'highlight' },
            { text: ' for 60 sec.' },
          ],
        },
        {
          title: 'Destructive Instinct',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 60 sec'],
          itemSegments: [
            [{ text: 'Attack Power +100' }],
            [{ text: 'Defense Power +100' }],
          ],
        },
      ],
    }

    // Level 800 popup
    const earthquakePopup: HiddenClassProgressionPopupInfo = {
      title: 'Earthquake',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Physical', tone: 'gold' },
        { label: 'Stun', tone: 'red' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cost: MP 485', 'Cooldown: 169.2s'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '250%' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Causes an ' },
            { text: 'Earthquake', tone: 'red' },
            { text: ' around the caster for 10 sec. Deals 50% extra Physical Damage to targets within range every 2 sec, and inflicts ' },
            { text: 'Stun', tone: 'red' },
            { text: ' for 1 sec with a ' },
            { text: '+80%', tone: 'highlight' },
            { text: ' chance. (Up to 20 targets)' },
          ],
        },
        {
          title: 'Stun',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 1 sec'],
          itemSegments: [
            [{ text: 'Becomes Incapacitated for the duration.' }],
          ],
        },
      ],
    }

    return [
      {
        level: 1,
        label: '',
        popup: landCrushPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Jumps to a target within a 7m radius and deals ' },
              { text: 'Combined Damage', tone: 'violet' },
              { text: ' around the target and inflicts ' },
              { text: 'Knockdown', tone: 'red', underline: true },
              { text: ' for 2 sec with a ' },
              { text: '+80%', tone: 'highlight' },
              { text: ' chance. (Up to 10 targets) ' },
            ],
          },
          {
            label: '',
            segments: [
              { text: 'Gains ' },
              { text: 'Damage Immunity', tone: 'highlight', underline: true },
              { text: ' for 3.5 sec.' },
            ],
          },
        ],
      },
      { level: 100, label: 'Defense Penetration', value: '+50' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      {
        level: 500,
        label: '',
        lines: [
          { label: 'Skill Damage', value: '+7%' },
          { label: 'Cooldown Decrease', value: '+10%' },
        ],
      },
      {
        level: 600,
        label: '',
        popup: destructiveInstinctPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Landing Attack increases the caster\'s ' },
              { text: 'Attack Power', tone: 'highlight', underline: true },
              { text: ' and ' },
              { text: 'Defense Power', tone: 'highlight', underline: true },
              { text: ' for 60 sec.' },
            ],
          },
        ],
      },
      {
        level: 700,
        label: '',
        lines: [
          { label: 'Attack Power', value: '+100' },
          { label: 'Defense Power', value: '+100' },
        ],
      },
      {
        level: 800,
        label: '',
        popup: earthquakePopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Causes an ' },
              { text: 'Earthquake', tone: 'red' },
              { text: ' around the caster for 10 sec. Deals 50% extra ' },
              { text: 'Physical Damage', tone: 'default' },
              { text: ' to targets within range every 2 sec, and inflicts ' },
              { text: 'Stun', tone: 'red', underline: true },
              { text: ' for 1 sec with a ' },
              { text: '+80%', tone: 'highlight' },
              { text: ' chance. (Up to 20 targets) ' },
            ],
          },
        ],
      },
    ]
  }

  // Frost Knight
  const createFrostKnightProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const frostCursePopup: HiddenClassProgressionPopupInfo = {
      title: 'Frost Curse',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'Single', tone: 'neutral' },
        { label: 'Combined', tone: 'violet' },
        { label: 'Frozen', tone: 'red' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Movement Speed Down', tone: 'red' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Range: 7m', 'Cooldown: 56.4s'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '250%' },
            { text: ' + ' },
            { text: '250%', tone: 'accent' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Deals ' },
            { text: 'Combined Damage', tone: 'violet' },
            { text: ' to the target and inflicts ' },
            { text: 'Frozen', tone: 'red' },
            { text: ' for 4 sec. When ' },
            { text: 'Frozen', tone: 'red' },
            { text: ' ends, reduces ' },
            { text: 'Movement Speed', tone: 'red' },
            { text: ' for 10 sec. Reduces ' },
            { text: 'Movement Speed', tone: 'red' },
            { text: ' around the target for 10 sec. (Up to 5 targets)' },
          ],
        },
        {
          title: 'Frozen',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 4 sec'],
          itemSegments: [
            [{ text: 'Magic Damage Received Increase +10%' }],
            [{ text: 'Becomes Incapacitated for the duration, and becomes immune to All Physical Damage.' }]
          ],
        },
        {
          title: 'Decelerate',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 10 sec'],
          itemSegments: [
            [{ text: 'Movement Speed -30%' }]
          ],
        },
      ],
    }

    // Level 600 popup
    const frozenHeartPopup: HiddenClassProgressionPopupInfo = {
      title: 'Frozen Heart',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Defense Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'When HP is at 50% or below, increases the caster\'s ' },
            { text: 'Endurance', tone: 'highlight' },
            { text: '.' },
          ],
        },
        {
          title: 'Frozen Heart',
          displayStyle: 'panel',
          panelTone: 'green',
          items: [''],
          itemSegments: [
            [{ text: 'Endurance +100' }],
          ],
        },
      ],
    }

    // Level 800 popup
    const blizzardPopup: HiddenClassProgressionPopupInfo = {
      title: 'Blizzard',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Magic', tone: 'neutral' },
        { label: 'Movement Speed Down', tone: 'red' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Range: 7m', 'Cost: MP 485', 'Cooldown: 169.2s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Causes an ' },
              { text: 'Ice Storm', tone: 'red'},
              { text: ' around the target for 10 sec. Deals 50% extra ' },
              { text: 'Magic Damage', tone: 'accent' },
              { text: ' to targets within range every second, and reduces ' },
              { text: 'Movement Speed', tone: 'red' },
              { text: ' for 3 sec. (Up to 20 targets)' },
          ],
        },
        {
          title: 'Blizzard',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 3 sec'],
          itemSegments: [
            [{ text: 'Movement Speed -25%' }],
          ],
        },
      ],
    }
    
    return [
      {
        level: 1,
        label: '',
        popup: frostCursePopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Deals ' },
              { text: 'Combined Damage', tone: 'violet' },
              { text: ' to the target and inflicts ' },
              { text: 'Frozen', tone: 'red', underline: true },
              { text: ' for 4 sec. When ' },
              { text: 'Frozen', tone: 'red' },
              { text: ' ends, reduces ' },
              { text: 'Movement Speed', tone: 'red', underline: true },
              { text: ' for 10 sec. Reduces ' },
              { text: 'Movement Speed', tone: 'red', underline: true },
              { text: ' around the target for 10 sec. (Up to 5 targets)' },
            ],
          },
        ],
      },
      { level: 100, label: 'Endurance Ignore', value: '+50' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      {
        level: 500,
        label: '',
        lines: [
          { label: 'Critical Hit', value: '+100' },
          { label: 'Critical Hit Damage', value: '+7%' },
        ],
      },
      {
        level: 600,
        label: '',
        popup: frozenHeartPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'When HP is at 50% or below, increases the caster\'s ' },
              { text: 'Endurance', tone: 'highlight', underline: true },
              { text: '.' },
            ],
          },
        ],
      },
      { level: 700, label: 'Attack Power', value: '+100' },
      {
        level: 800,
        label: '',
        popup: blizzardPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Causes an ' },
              { text: 'Ice Storm', tone: 'red' },
              { text: ' around the target for 10 sec. Deals 50% extra ' },
              { text: 'Magic Damage', tone: 'accent' },
              { text: ' to targets within range every second, and reduces ' },
              { text: 'Movement Speed', tone: 'red', underline: true },
              { text: ' for 3 sec. (Up to 20 targets)' },
            ],
          },
        ],
      },
    ]
  }

  // Ancient Protector
  const createAncientProtectorProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const ancientProtectorPopup: HiddenClassProgressionPopupInfo = {
      title: 'Ancient Protector',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Conditional Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Landing a Basic Attack has a 100% chance of increasing ' },
            { text: 'All Damage', tone: 'highlight' },
            { text: ' and ' },
            { text: 'Damage to Monster', tone: 'highlight' },
            { text: '. Stacks up to 20 times.' },
          ],
        },
        {
          title: 'Ancient Protector',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 10 sec'],
          itemSegments: [
            [{ text: 'All Damage +0.5%' }],
            [{ text: 'Damage to Monsters Increase +0.4% (Max 20 Stacks)' }]
          ],
        },
      ],
    }

    // Level 600 popup
    const protectorsLawPopup: HiddenClassProgressionPopupInfo = {
      title: 'Protector\'s Law',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Defense Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Increases the caster\'s ' },
            { text: 'Attack Power', tone: 'highlight' },
            { text: ' and ' },
            { text: 'Defense Power', tone: 'highlight' },
            { text: ' per 4% of HP lost. (Lost HP increases up to 80%.) ' },
          ],
        },
        {
          title: 'Protector\'s Law',
          displayStyle: 'panel',
          panelTone: 'green',
          items: [''],
          itemSegments: [
            [{ text: 'Attack Power +5' }],
            [{ text: 'Defense Power +5' }],
            [{ text: 'Increases Defense Power in proportion to HP lost.' }],
            [{ text: '(Max Attack Power and Defense Power +100)' }],
          ],
        },
      ],
    }

    // Level 800 popup
    const lightOfProtectionPopup: HiddenClassProgressionPopupInfo = {
      title: 'Light of Protection',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Defense Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cost: MP 485', 'Cooldown: 112.8s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Increases ' },
            { text: 'All Damage', tone: 'highlight' },
            { text: ' of the caster and allies within a 10m radius for 30 sec, and reduces ' },
            { text: 'Damage Received', tone: 'highlight' },
            { text: '. (Up to 10 targets)' },
          ],
        },
        {
          title: 'Light of Protection',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 30 sec'],
          itemSegments: [
            [{ text: 'All Damage +15%' }],
            [{ text: 'Damage Received Decrease +15%' }],
          ],
        },
      ],
    }


    return [
      {
        level: 1,
        label: '',
        popup: ancientProtectorPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Landing a Basic Attack has a 100% chance of increasing ' },
              { text: 'All Damage', tone: 'highlight', underline: true },
              { text: ' and ' },
              { text: 'Damage to Monster', tone: 'highlight', underline: true },
              { text: '. Stacks up to 20 times.' },
            ],
          },
        ],
      },
      { level: 100, label: 'Defense Power', value: '+50' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      {
        level: 500,
        label: '',
        lines: [
          { label: 'Defense Power', value: '+75' },
          { label: 'Attack Power', value: '+100' },
        ],
      },
      {
        level: 600,
        label: '',
        popup: protectorsLawPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Increases the caster\'s ' },
              { text: 'Attack Power', tone: 'highlight', underline: true },
              { text: ' and ' },
              { text: 'Defense Power', tone: 'highlight', underline: true },
              { text: ' per 4% of HP lost. (Lost HP increases up to 80%.) ' },
            ],
          },
        ],
      },
      {
        level: 700,
        label: '',
        lines: [
          { label: 'Defense Power', value: '+100' },
          { label: 'Endurance', value: '+30' },
        ],
      },
      {
        level: 800,
        label: '',
        popup: lightOfProtectionPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Increases ' },
              { text: 'All Damage', tone: 'highlight', underline: true },
              { text: ' of the caster and allies within a 10m radius for 30 sec, and reduces ' },
              { text: 'Damage Received', tone: 'highlight', underline: true },
              { text: '. (Up to 10 targets)' },
            ],
          },
        ],
      },
    ]
  }

  // Immortal Knight
  const createImmortalKnightProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const immortalityPopup: HiddenClassProgressionPopupInfo = {
      title: 'Immortality',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Immortal', tone: 'red' },
        { label: 'Damage Immunity', tone: 'green' },
        { label: 'Status Effects Immunity', tone: 'green' },
        { label: 'Debuff Immunity', tone: 'green' },
        { label: 'HP Recovery', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 120s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'When the caster\'s HP is at 10% or below, becomes ' },
            { text: 'Immortal', tone: 'highlight' },
            { text: ' and immune to all ' },
            { text: 'Damage', tone: 'highlight' },
            { text: ', ' },
            { text: 'Status Effects', tone: 'highlight' },
            { text: ', and ' },
            { text: 'Debuffs', tone: 'highlight' },
            { text: ' for 5 sec. When ' },
            { text: 'Immortal', tone: 'highlight' },
            { text: ' ends, recovers HP equal to ' },
            { text: '30%', tone: 'highlight' },
            { text: ' of Max HP. [Recovery cannot exceed Max 15,000.]' },
          ],
        },
        {
          title: 'Immortality',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 5 sec'],
          itemSegments: [
            [{ text: 'HP never falls below 1 and becomes immune to All Damage, Status Effects, and Debuffs.' }],
            [{ text: 'When the effect wears off, recovers 30% of Max HP.' }]
          ],
        },
      ],
    }

    // Level 600 popup
    const causalityTranscendencePopup: HiddenClassProgressionPopupInfo = {
      title: 'Causality Transcendence',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Accuracy Increase', tone: 'green' },
        { label: 'Critical Hit Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 60s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Landing Attack increases the caster\'s ' },
            { text: 'Accuracy', tone: 'highlight' },
            { text: ' and ' },
            { text: 'Critical Hit', tone: 'highlight' },
            { text: ' for 30 sec.' },
          ],
        },
        {
          title: 'Causality Transcendence',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 30 sec'],
          itemSegments: [
            [{ text: 'Accuracy +100' }],
            [{ text: 'Critical Hit +100' }]
          ],
        },
      ],
    }

    // Level 800 popup
    const petrificationCursePopup: HiddenClassProgressionPopupInfo = {
      title: 'Petrification Curse',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Petrify', tone: 'red' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cost: MP 485', 'Cooldown: 169.2s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Grants ' },
            { text: 'Petrify', tone: 'red' },
            { text: ' to the caster for 5 sec.' },
          ],
        },
        {
          title: 'Petrification Curse',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 5 sec'],
          itemSegments: [
            [{ text: 'Becomes immune to All Damage and Status Effects for the duration.' }],
          ],
        },
      ],
    }


    return [
      {
        level: 1,
        label: '',
        popup: immortalityPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'When the caster\'s HP is at 10% or below, becomes ' },
              { text: 'Immortal', tone: 'highlight' },
              { text: ' and immune to all ' },
              { text: 'Damage', tone: 'highlight' },
              { text: ', ' },
              { text: 'Status Effects', tone: 'highlight' },
              { text: ', and ' },
              { text: 'Debuffs', tone: 'highlight' },
              { text: ' for 5 sec. When ' },
              { text: 'Immortal', tone: 'highlight' },
              { text: ' ends, recovers HP equal to ' },
              { text: '30%', tone: 'highlight' },
              { text: ' of Max HP. [Recovery cannot exceed Max 15,000.]' },
            ],
          },
        ],
      },
      { level: 100, label: 'Defense Penetration', value: '+50' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      {
        level: 500,
        label: '',
        lines: [
          { label: 'Attack Power', value: '+75' },
          { label: 'Damage Received Decrease', value: '+3.5%' },
        ],
      },
      {
        level: 600,
        label: '',
        popup: causalityTranscendencePopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Landing Attack increases the caster\'s ' },
              { text: 'Accuracy', tone: 'highlight', underline: true },
              { text: ' and ' },
              { text: 'Critical Hit', tone: 'highlight', underline: true },
              { text: ' for 30 sec.' },
            ],
          },
        ],
      },
      { level: 700, label: 'Defense Power', value: '+100' },
      {
        level: 800,
        label: '',
        popup: petrificationCursePopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Grants ' },
              { text: 'Petrify', tone: 'red', underline: true },
              { text: ' to the caster for 5 sec.' },
            ],
          },
        ],
      },
    ]
  }

  // Trinity
  const createTrinityProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const everlastingFlowPopup: HiddenClassProgressionPopupInfo = {
      title: 'Everlasting Flow',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Attack Speed Up', tone: 'green' },
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Critical Hit Increase', tone: 'green' },
        { label: 'Conditional Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Basic Attacks have a 100% chance to grant an Effect to the caster for a short duration. Effects are applied in the order of ' },
              { text: 'Attack Speed', tone: 'highlight' },
              { text: ', ' },
              { text: 'Defense Penetration', tone: 'highlight' },
              { text: ', and ' },
              { text: 'Critical Hit', tone: 'highlight' },
              { text: ', circulating every 25 stacks.' },
          ],
        },
        {
          title: 'Everlasting Flow I',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 15 sec'],
          itemSegments: [
            [{ text: 'Attack Speed +1%' }],
            [{ text: '(Max 25 Stacks)' }]
          ],
        },
        {
          title: 'Everlasting Flow II',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 15 sec'],
          itemSegments: [
            [{ text: 'Defense Penetration +10' }],
            [{ text: '(Max 25 Stacks)' }]
          ],
        },
        {
          title: 'Everlasting Flow III',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 15 sec'],
          itemSegments: [
            [{ text: 'Critical Hit +10' }],
            [{ text: 'Critical Hit Damage +1%' }],
            [{ text: '(Max 25 Stacks)' }]
          ],
        },
      ],
    }

    // Level 600 popup
    const trinityForcePopup: HiddenClassProgressionPopupInfo = {
      title: 'Trinity Force',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Accuracy Increase', tone: 'green' },
        { label: 'Critical Hit Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 120s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Landing Attack Skill increases the caster\'s ' },
              { text: 'Attack Power', tone: 'highlight' },
              { text: ', ' },
              { text: 'Accuracy', tone: 'highlight' },
              { text: ', and ' },
              { text: 'Critical Hit', tone: 'highlight' },
              { text: ' for 60 sec.' },
          ],
        },
        {
          title: 'Trinity Force',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 60 sec'],
          itemSegments: [
            [{ text: 'Attack Power +100' }],
            [{ text: 'Accuracy +100' }],
            [{ text: 'Critical Hit +100' }]
          ],
        },
      ],
    }

    // Level 800 popup
    const worldLineCollisionPopup: HiddenClassProgressionPopupInfo = {
      title: 'World Line Collision',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Combined', tone: 'violet' },
        { label: 'Stun', tone: 'red' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Range: 4m', 'Cost: MP 485', 'Cooldown: 169.2s'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '100%' },
            { text: ' + ' },
            { text: '100%', tone: 'accent' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Deals ' },
            { text: 'Combined Damage', tone: 'violet' },
            { text: ' around the caster and inflicts ' },
            { text: 'Stun', tone: 'red' },
            { text: ' for 5 sec with a ' },
            { text: '+80%', tone: 'highlight' },
            { text: ' chance. (Up to 10 targets) ' },
          ],
        },
        {
          title: 'Stun',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 5 sec'],
          itemSegments: [
            [{ text: 'Becomes Incapacitated for the duration.' }],
          ],
        },
      ],
    }


    return [
      {
        level: 1,
        label: '',
        popup: everlastingFlowPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Basic Attacks have a 100% chance to grant an Effect to the caster for a short duration. Effects are applied in the order of ' },
              { text: 'Attack Speed', tone: 'highlight', underline: true },
              { text: ', ' },
              { text: 'Defense Penetration', tone: 'highlight', underline: true },
              { text: ', and ' },
              { text: 'Critical Hit', tone: 'highlight', underline: true },
              { text: ', circulating every 25 stacks.' },
            ],
          },
        ],
      },
      { level: 100, label: 'Defense Power', value: '+50' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      {
        level: 500,
        label: '',
        lines: [
          { label: 'Attack Power', value: '+75' },
          { label: 'All Damage', value: '+3.5%' },
        ],
      },
      {
        level: 600,
        label: '',
        popup: trinityForcePopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Landing Attack Skill increases the caster\'s ' },
              { text: 'Attack Power', tone: 'highlight', underline: true },
              { text: ', ' },
              { text: 'Accuracy', tone: 'highlight', underline: true },
              { text: ', and ' },
              { text: 'Critical Hit', tone: 'highlight', underline: true },
              { text: ' for 60 sec.' },
            ],
          },
        ],
      },
      {
        level: 700,
        label: '',
        lines: [
          { label: 'Attack Power', value: '+100' },
          { label: 'Attack Speed', value: '+5%' },
        ],
      },
      {
        level: 800,
        label: '',
        popup: worldLineCollisionPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Deals ' },
              { text: 'Combined Damage', tone: 'violet' },
              { text: ' around the caster and inflicts ' },
              { text: 'Stun', tone: 'red', underline: true},
              { text: ' for 5 sec with a ' },
              { text: '+80%', tone: 'highlight' },
              { text: ' chance. (Up to 10 targets) ' },
            ],
          },
        ],
      },
    ]
  }

  // Harbinger of Storms
  const createHarbingerOfStormsProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const ragingStormPopup: HiddenClassProgressionPopupInfo = {
      title: 'Raging Storm',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Fixed', tone: 'neutral' },
        { label: 'Combined', tone: 'violet' },
        { label: 'Status Effect Immunity', tone: 'green' },
        { label: 'Pull', tone: 'red' },
        { label: 'Movement Speed Down', tone: 'red' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Range: 7m', 'Cooldown: 169.2s'],
        },
        {
          title: 'Skill Damage Info',
          itemSegments: [[
            { text: 'Damage: ' },
            { text: '1600' },
            { text: ' + ' },
            { text: '200%' },
            { text: ' + ' },
            { text: '200%', tone: 'accent' },
          ]],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Summons a Storm Area to pull targets toward the caster and significantly reduces their ' },
            { text: 'Movement Speed', tone: 'red' },
            { text: '. Storm Area deals fixed damage 8 times and deals a powerful ' },
            { text: 'Combined Damage', tone: 'violet' },
            { text: ' 3 sec later. (Up to 10 targets) While Storm Area is summoned, the caster becomes immune to all ' },
            { text: 'Status Effects', tone: 'highlight' },
            { text: '.' },
          ],
        },
        {
          title: 'Status Effect Immunity',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 3 sec'],
          itemSegments: [
            [{ text: 'Becomes immune to All Status Effects.' }],
          ],
        },
        {
          title: 'Grapple',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 0.4 sec'],
          itemSegments: [
            [{ text: 'Incapacitated.' }],
          ],
        },
        {
          title: 'Raging Storm',
          displayStyle: 'panel',
          panelTone: 'red',
          items: ['Duration: 3 sec'],
          itemSegments: [
            [{ text: 'Movement Speed -70%' }],
          ],
        },
      ],
    }

    // Level 600 popup
    const windGodStepPopup: HiddenClassProgressionPopupInfo = {
      title: 'Wind God Step',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Movement Speed Up', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 60s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Landing Attack Skill increases the caster\'s ' },
            { text: 'Movement Speed', tone: 'highlight' },
            { text: ' for 30 sec. ' },
          ],
        },
        {
          title: 'Wind God Step',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 30 sec'],
          itemSegments: [
            [{ text: 'Movement Speed +15%' }],
          ],
        },
      ],
    }

    // Level 800 popup
    const descentOfWindGodPopup: HiddenClassProgressionPopupInfo = {
      title: 'Descent of Wind God',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'Max HP Increase', tone: 'green' },
        { label: 'HP Recovery', tone: 'green' },
        { label: 'Defense Increase', tone: 'green' },
        { label: 'Attack Speed Up', tone: 'green' },
        { label: 'Movement Speed Up', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cost: MP 485', 'Cooldown: 112.8s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Increases the caster\'s ' },
            { text: 'Max HP', tone: 'highlight' },
            { text: ', ' },
            { text: 'Defense Power', tone: 'highlight' },
            { text: ', ' },
            { text: 'Attack Speed', tone: 'highlight' },
            { text: ', and ' },
            { text: 'Movement Speed', tone: 'highlight' },
            { text: ' for 30 sec. ' },
          ],
        },
        {
          title: 'Descent of Wind God',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 30 sec'],
          itemSegments: [
            [{ text: 'Max HP +20%' }],
            [{ text: 'Defense Power +200' }],
            [{ text: 'Attack Speed +20%' }],
            [{ text: 'Movement Speed +20%' }],
          ],
        },
      ],
    }


    return [
      {
        level: 1,
        label: '',
        popup: ragingStormPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Summons a Storm Area to pull targets toward the caster and significantly reduces their ' },
              { text: 'Movement Speed', tone: 'red', underline: true },
              { text: '. Storm Area deals fixed damage 8 times and deals a powerful ' },
              { text: 'Combined Damage', tone: 'violet' },
              { text: ' 3 sec later. (Up to 10 targets) While Storm Area is summoned, the caster becomes immune to all ' },
              { text: 'Status Effects', tone: 'highlight', underline: true },
              { text: '.' },
            ],
          },
        ],
      },
      { level: 100, label: 'Skill Damage', value: '+7%' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      { level: 500, label: 'Skill Damage', value: '+15%' },
      {
        level: 600,
        label: '',
        popup: windGodStepPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Landing Attack Skill increases the caster\'s ' },
              { text: 'Movement Speed', tone: 'highlight', underline: true },
              { text: ' for 30 sec. ' },
            ],
          },
        ],
      },
      { level: 700, label: 'Attack Speed', value: '+5%' },
      {
        level: 800,
        label: '',
        popup: descentOfWindGodPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Increases the caster\'s ' },
              { text: 'Max HP', tone: 'highlight', underline: true },
              { text: ', ' },
              { text: 'Defense Power', tone: 'highlight', underline: true },
              { text: ', ' },
              { text: 'Attack Speed', tone: 'highlight', underline: true },
              { text: ', and ' },
              { text: 'Movement Speed', tone: 'highlight', underline: true },
              { text: ' for 30 sec. ' },
            ],
          },
        ],
      },
    ]
  }

  // Goddess of Blessings
  const createGoddessOfBlessingsProgressionEntries = (): HiddenClassProgressionEntry[] => {
    // Level 1 popup
    const handsOfTheGoddessPopup: HiddenClassProgressionPopupInfo = {
      title: 'Hands of the Goddess',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Movement Speed Up', tone: 'green' },
        { label: 'Status Effects Resistance Increase', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 56.4s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Increases ' },
            { text: 'Attack Power', tone: 'highlight' },
            { text: ', ' },
            { text: 'Movement Speed', tone: 'highlight' },
            { text: ', and ' },
            { text: 'Status Effect Resistance', tone: 'highlight' },
            { text: ' of the caster and allies within a 15m radius for 10 sec. (Up to 10 targets)' },
          ],
        },
        {
          title: 'Hands of the Goddess',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 10 sec'],
          itemSegments: [
            [{ text: 'Attack Power +120' }],
            [{ text: 'Movement Speed +20%' }],
            [{ text: 'Status Effect Resistance +10%' }]
          ],
        },
      ],
    }

    // Level 600 popup
    const descentOfGoddessPopup: HiddenClassProgressionPopupInfo = {
      title: 'Descent of Goddess',
      subtitle: 'Conditional Passive',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Attack Increase', tone: 'green' },
        { label: 'Defense Increase', tone: 'green' },
        { label: 'Attack Speed Up', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cooldown: 120s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Landing Attack Skill increases the caster\'s ' },
            { text: 'Attack Power', tone: 'highlight' },
            { text: ', ' },
            { text: 'Defense Power', tone: 'highlight' },
            { text: ', and ' },
            { text: 'Attack Speed', tone: 'highlight' },
            { text: ' for 60 sec.' },
          ],
        },
        {
          title: 'Descent of Goddess',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 60 sec'],
          itemSegments: [
            [{ text: 'Attack Power +100' }],
            [{ text: 'Defense Power +100' }],
            [{ text: 'Attack Speed +10%' }]
          ],
        },
      ],
    }

    // Level 800 popup
    const graceOfGoddessPopup: HiddenClassProgressionPopupInfo = {
      title: 'Grace of Goddess',
      subtitle: 'Active',
      metaLabel: '',
      metaValue: 'Class',
      typeLabel: '',
      badges: [
        { label: 'Auto', tone: 'gold' },
        { label: 'AoE', tone: 'neutral' },
        { label: 'HP Recovery', tone: 'green' },
      ],
      detailText: '',
      sections: [
        {
          title: 'Skill Info',
          items: ['Weapon: Common', 'Cost: MP 485', 'Cooldown: 169.2s'],
        },
        {
          title: 'Skill Effect',
          segments: [
            { text: 'Recovers HP of the caster and party members within a 10m radius equal to ' },
            { text: '10%', tone: 'highlight' },
            { text: ' of Max HP every 2 sec for 10 sec. Reduces ' },
            { text: 'Healing Received', tone: 'red' },
            { text: ' for 60 sec. [Recovery cannot exceed Max 5,000 per instance.]' },
          ],
        },
        {
          title: 'Grace of Goddess',
          displayStyle: 'panel',
          panelTone: 'green',
          items: ['Duration: 10 sec'],
          itemSegments: [
            [{ text: 'Recovers 10% HP per 2 sec.' }],
          ],
        },
      ],
    }

    return [
      {
        level: 1,
        label: '',
        popup: handsOfTheGoddessPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Increases ' },
              { text: 'Attack Power', tone: 'highlight', underline: true },
              { text: ', ' },
              { text: 'Movement Speed', tone: 'highlight', underline: true },
              { text: ', and ' },
              { text: 'Status Effect Resistance', tone: 'highlight', underline: true },
              { text: ' of the caster and allies within a 15m radius for 10 sec. (Up to 10 targets)' },
            ],
          },
        ],
      },
      { level: 100, label: 'Endurance', value: '+50' },
      { level: 200, label: 'Movement Speed', value: '+8%' },
      { level: 300, label: 'Attack Speed', value: '+8%' },
      { level: 400, label: 'Attack Power', value: '+70' },
      {
        level: 500,
        label: '',
        lines: [
          { label: 'Defense Power', value: '+75' },
          { label: 'Cooldown Decrease', value: '+10%' },
        ],
      },
      {
        level: 600,
        label: '',
        popup: descentOfGoddessPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Landing Attack Skill increases the caster\'s ' },
              { text: 'Attack Power', tone: 'highlight', underline: true },
              { text: ', ' },
              { text: 'Defense Power', tone: 'highlight', underline: true },
              { text: ', and ' },
              { text: 'Attack Speed', tone: 'highlight', underline: true },
              { text: ' for 60 sec.' },
            ],
          },
        ],
      },
      {
        level: 700,
        label: '',
        lines: [
          { label: 'Attack Power', value: '+100' },
          { label: 'Attack Speed', value: '+5%' },
        ],
      },
      {
        level: 800,
        label: '',
        popup: graceOfGoddessPopup,
        lines: [
          {
            label: '',
            segments: [
              { text: 'Recovers HP of the caster and party members within a 10m radius equal to ' },
              { text: '10%', tone: 'highlight' },
              { text: ' of Max HP every 2 sec for 10 sec. Reduces ' },
              { text: 'Healing Received', tone: 'red', underline: true},
              { text: ' for 60 sec. [Recovery cannot exceed Max 5,000 per instance.]' },
            ],
          },
        ],
      },
    ]
  }


  const progressionPresets: Record<string, HiddenClassProgressionEntry[]> = {
    'sword-master': createSwordMasterProgressionEntries(),
    'destroyer': createDestroyerProgressionEntries(),
    'frost-knight': createFrostKnightProgressionEntries(),
    'ancient-protector': createAncientProtectorProgressionEntries(),
    'immortal-knight': createImmortalKnightProgressionEntries(),
    'trinity': createTrinityProgressionEntries(),
    'harbinger-of-storms': createHarbingerOfStormsProgressionEntries(),
    'goddess-of-blessings': createGoddessOfBlessingsProgressionEntries(),
  }

  return progressionPresets[classId] ?? progressionPresets['sword-master']
}

const createNodes = (prefix: string, profile: 'offense' | 'defense' | 'support'): HiddenClassNode[] => {
  const nodePresets: Record<typeof profile, HiddenClassNode[]> = {
    offense: [
      {
        id: `${prefix}-enhance-1`,
        name: 'Edge Tempering',
        category: 'enhance',
        currentRank: 100,
        maxRank: 100,
        shortEffect: 'Sharpens burst windows and improves finishing damage.',
        unlockHint: 'Primary enhance node for aggressive builds.',
        milestones: [
          { level: 100, effect: 'Attack Power +18' },
          { level: 200, effect: 'Critical Damage +20' },
          { level: 300, effect: 'Boss Damage +3%' },
        ],
      },
      {
        id: `${prefix}-enhance-2`,
        name: 'Deathblow',
        category: 'enhance',
        currentRank: 100,
        maxRank: 100,
        shortEffect: 'Raises finishing damage after a successful burst window.',
        unlockHint: 'Best paired with critical-chain openers.',
        milestones: [
          { level: 100, effect: 'Critical Hit +18' },
          { level: 200, effect: 'Critical Damage +18' },
          { level: 300, effect: 'Execute Damage +3%' },
        ],
      },
      {
        id: `${prefix}-combat-1`,
        name: 'Battle Instinct',
        category: 'combat',
        currentRank: 96,
        maxRank: 100,
        shortEffect: 'Adds reliable combat tempo after the opening combo.',
        unlockHint: 'Use this to smooth sustained damage output.',
        milestones: [
          { level: 100, effect: 'Accuracy +24' },
          { level: 200, effect: 'Attack Speed +3%' },
          { level: 300, effect: 'Skill Damage +2.5%' },
        ],
      },
      {
        id: `${prefix}-combat-2`,
        name: 'Pressure Hunt',
        category: 'combat',
        currentRank: 84,
        maxRank: 90,
        shortEffect: 'Adds target-focused damage during sustained exchanges.',
        unlockHint: 'Use when bosses or priority kills matter.',
        milestones: [
          { level: 100, effect: 'Boss Damage +2%' },
          { level: 200, effect: 'Attack Power +12' },
          { level: 300, effect: 'Skill Critical Rate +1.5%' },
        ],
      },
      {
        id: `${prefix}-vitality-1`,
        name: 'Predator Vigor',
        category: 'vitality',
        currentRank: 88,
        maxRank: 100,
        shortEffect: 'Turns short pressure windows into stable sustain.',
        unlockHint: 'Best when solo farming or extended skirmishing.',
        milestones: [
          { level: 100, effect: 'Max HP +320' },
          { level: 200, effect: 'Life Steal +2%' },
          { level: 300, effect: 'Potion Recovery +4%' },
        ],
      },
      {
        id: `${prefix}-vitality-2`,
        name: 'Recovery Potion',
        category: 'vitality',
        currentRank: 100,
        maxRank: 100,
        shortEffect: 'Improves sustain pacing between repeated engagements.',
        unlockHint: 'Useful for grind loops and longer field fights.',
        milestones: [
          { level: 100, effect: 'Potion Recovery +6%' },
          { level: 200, effect: 'Damage Reduction +8' },
          { level: 300, effect: 'Debuff Resist +20' },
        ],
      },
    ],
    defense: [
      {
        id: `${prefix}-enhance-1`,
        name: 'Guardian Temper',
        category: 'enhance',
        currentRank: 100,
        maxRank: 100,
        shortEffect: 'Converts durability into reliable retaliation pressure.',
        unlockHint: 'Strong opener for shield-first builds.',
        milestones: [
          { level: 100, effect: 'Attack Power +12' },
          { level: 200, effect: 'Counter Damage +3%' },
          { level: 300, effect: 'Guard Break Resist +14' },
        ],
      },
      {
        id: `${prefix}-enhance-2`,
        name: 'Bulwark Edge',
        category: 'enhance',
        currentRank: 92,
        maxRank: 100,
        shortEffect: 'Improves retaliation damage while holding position.',
        unlockHint: 'A durable second enhance option for frontline builds.',
        milestones: [
          { level: 100, effect: 'Counter Damage +2.5%' },
          { level: 200, effect: 'Attack Power +10' },
          { level: 300, effect: 'Break Resist +12' },
        ],
      },
      {
        id: `${prefix}-combat-1`,
        name: 'Frontline Oath',
        category: 'combat',
        currentRank: 110,
        maxRank: 120,
        shortEffect: 'Improves guard uptime and front-line control.',
        unlockHint: 'Core combat node for anchoring raids and sieges.',
        milestones: [
          { level: 100, effect: 'Damage Reduction +10' },
          { level: 200, effect: 'Guard Rate +2%' },
          { level: 300, effect: 'Area Threat +3%' },
        ],
      },
      {
        id: `${prefix}-combat-2`,
        name: 'Hold the Line',
        category: 'combat',
        currentRank: 88,
        maxRank: 100,
        shortEffect: 'Stabilizes formation pressure during boss and siege phases.',
        unlockHint: 'Best for anchored frontline rotations.',
        milestones: [
          { level: 100, effect: 'Control Chance +1%' },
          { level: 200, effect: 'Area Damage +2%' },
          { level: 300, effect: 'Threat Control +2%' },
        ],
      },
      {
        id: `${prefix}-vitality-1`,
        name: 'Iron Pulse',
        category: 'vitality',
        currentRank: 105,
        maxRank: 120,
        shortEffect: 'Pushes survivability high enough for extended front-line duty.',
        unlockHint: 'Best value node for long encounters.',
        milestones: [
          { level: 100, effect: 'Max HP +460' },
          { level: 200, effect: 'All Resist +18' },
          { level: 300, effect: 'Healing Received +3%' },
        ],
      },
      {
        id: `${prefix}-vitality-2`,
        name: 'Fortified Recovery',
        category: 'vitality',
        currentRank: 94,
        maxRank: 100,
        shortEffect: 'Improves recovery tempo without giving up durability.',
        unlockHint: 'Useful for long raid or siege sessions.',
        milestones: [
          { level: 100, effect: 'Potion Recovery +5%' },
          { level: 200, effect: 'Healing Received +3%' },
          { level: 300, effect: 'Status Resist +16' },
        ],
      },
    ],
    support: [
      {
        id: `${prefix}-enhance-1`,
        name: 'Sacred Resonance',
        category: 'enhance',
        currentRank: 94,
        maxRank: 100,
        shortEffect: 'Amplifies buff skill efficiency and party-wide impact.',
        unlockHint: 'Take early if your role leans on rotation support.',
        milestones: [
          { level: 100, effect: 'Skill Power +16' },
          { level: 200, effect: 'Buff Duration +3%' },
          { level: 300, effect: 'Cooldown Recovery +2.5%' },
        ],
      },
      {
        id: `${prefix}-enhance-2`,
        name: 'Blessed Seal',
        category: 'enhance',
        currentRank: 88,
        maxRank: 100,
        shortEffect: 'Strengthens buff conversion and short support spikes.',
        unlockHint: 'Take when your build leans harder into party scaling.',
        milestones: [
          { level: 100, effect: 'Buff Duration +2%' },
          { level: 200, effect: 'Skill Power +12' },
          { level: 300, effect: 'Party Utility +2%' },
        ],
      },
      {
        id: `${prefix}-combat-1`,
        name: 'Harmony Circuit',
        category: 'combat',
        currentRank: 90,
        maxRank: 100,
        shortEffect: 'Maintains party-safe tempo during sustained encounters.',
        unlockHint: 'Combat node for balanced offense and support cycles.',
        milestones: [
          { level: 100, effect: 'Attack Speed +2%' },
          { level: 200, effect: 'Skill Accuracy +20' },
          { level: 300, effect: 'Party Damage +2%' },
        ],
      },
      {
        id: `${prefix}-combat-2`,
        name: 'Support Rhythm',
        category: 'combat',
        currentRank: 82,
        maxRank: 100,
        shortEffect: 'Maintains pressure while preserving support timing.',
        unlockHint: 'Strong for balanced support-damage rotations.',
        milestones: [
          { level: 100, effect: 'Attack Speed +2%' },
          { level: 200, effect: 'Skill Accuracy +16' },
          { level: 300, effect: 'Cooldown Recovery +2%' },
        ],
      },
      {
        id: `${prefix}-vitality-1`,
        name: 'Blessed Wellspring',
        category: 'vitality',
        currentRank: 102,
        maxRank: 120,
        shortEffect: 'Adds stable sustain so support uptime stays intact.',
        unlockHint: 'Primary vitality node for drawn-out fights.',
        milestones: [
          { level: 100, effect: 'Max HP +340' },
          { level: 200, effect: 'Potion Recovery +5%' },
          { level: 300, effect: 'Debuff Resist +20' },
        ],
      },
      {
        id: `${prefix}-vitality-2`,
        name: 'Greater Recovery Potion',
        category: 'vitality',
        currentRank: 100,
        maxRank: 100,
        shortEffect: 'Extends safe healing uptime between support rotations.',
        unlockHint: 'Reliable sustain option for difficult content.',
        milestones: [
          { level: 100, effect: 'Potion Recovery +6%' },
          { level: 200, effect: 'Max HP +260' },
          { level: 300, effect: 'Debuff Resist +18' },
        ],
      },
    ],
  }

  return nodePresets[profile].map(withNodeImagePath)
}

export const hiddenClasses: HiddenClassDefinition[] = [
  {
    id: 'sword-master',
    name: 'Sword Master',
    title: '',
    weaponClass: '',
    tagLevel: 603,
    accentColor: '#46c3a3',
    imagePath: '/assets/images/Class/Greatsword.png',
    summary: 'Having mastered the art of the sword, Basic Attacks have a chance to deal extra combined damage.',
    traits: ['Burst-focused melee', 'Critical conversions', 'Fast re-engage windows'],
    stats: [
      { label: 'Attack Power', value: '+48' },
      { label: 'Critical Hit', value: '+52' },
      { label: 'Accuracy', value: '+46' },
      { label: 'Attack Speed', value: '+5%' },
    ],
    nodes: createNodes('sword-master', 'offense'),
    progressionEntries: createProgressionEntries('sword-master'),
    boardRows: createBoardRows('sword-master'),
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    title: '',
    weaponClass: '',
    tagLevel: 597,
    accentColor: '#c27846',
    imagePath: '/assets/images/Class/Battle Shield.png',
    summary: 'Wielding the power to destroy all, crushes enemy lines from the very front.',
    traits: ['High-impact engages', 'Break-focused control', 'Durable retaliation'],
    stats: [
      { label: 'Attack Power', value: '+42' },
      { label: 'Armor Penetration', value: '+18' },
      { label: 'Damage Reduction', value: '+20' },
      { label: 'Max HP', value: '+420' },
    ],
    nodes: createNodes('destroyer', 'defense'),
    progressionEntries: createProgressionEntries('destroyer'),
    boardRows: createBoardRows('destroyer'),
  },
  {
    id: 'frost-knight',
    name: 'Frost Knight',
    title: '',
    weaponClass: '',
    tagLevel: 612,
    accentColor: '#71b2e5',
    imagePath: '/assets/images/Class/Sword and Shield.png',
    summary: 'Unleashes a freezing curse that traps the target forever.',
    traits: ['Slow and lock tools', 'Frontline durability', 'Stable control loops'],
    stats: [
      { label: 'Damage Reduction', value: '+28' },
      { label: 'Max HP', value: '+560' },
      { label: 'Control Chance', value: '+3%' },
      { label: 'All Resist', value: '+18' },
    ],
    nodes: createNodes('frost-knight', 'defense'),
    progressionEntries: createProgressionEntries('frost-knight'),
    boardRows: createBoardRows('frost-knight'),
  },
  {
    id: 'ancient-protector',
    name: 'Ancient Protector',
    title: 'Raid anchor guardian',
    weaponClass: 'Battle Shield',
    tagLevel: 605,
    accentColor: '#8db16f',
    imagePath: '/assets/images/Class/Battle Shield.png',
    summary: 'The legendary Ancient Protectors are known to excel in both offense and defense.',
    traits: ['Party shielding', 'Protective uptime', 'Anchor positioning'],
    stats: [
      { label: 'Ally Protection', value: '+4%' },
      { label: 'Guard Rate', value: '+4%' },
      { label: 'Damage Reduction', value: '+26' },
      { label: 'Max HP', value: '+610' },
    ],
    nodes: createNodes('ancient-protector', 'defense'),
    progressionEntries: createProgressionEntries('ancient-protector'),
    boardRows: createBoardRows('ancient-protector'),
  },
  {
    id: 'immortal-knight',
    name: 'Immortal Knight',
    title: '',
    weaponClass: '',
    tagLevel: 618,
    accentColor: '#d0a74b',
    imagePath: '/assets/images/Class/Sword and Shield.png',
    summary: 'The first knight that conquered death after gaining immortality in the unending end.',
    traits: ['Extreme survivability', 'Sustain-focused tanking', 'Long-fight stability'],
    stats: [
      { label: 'Max HP', value: '+720' },
      { label: 'Healing Received', value: '+4%' },
      { label: 'Damage Reduction', value: '+30' },
      { label: 'All Resist', value: '+20' },
    ],
    nodes: createNodes('immortal-knight', 'defense'),
    progressionEntries: createProgressionEntries('immortal-knight'),
    boardRows: createBoardRows('immortal-knight'),
  },
  {
    id: 'trinity',
    name: 'Trinity',
    title: '',
    weaponClass: '',
    tagLevel: 590,
    accentColor: '#c88cff',
    imagePath: '/assets/images/Class/Battle Staff.png',
    summary: 'The hero mastered the 3 flows of perfect battles after their ceaseless struggle to become stronger.',
    traits: ['Hybrid spell cycles', 'Party utility', 'Flexible support damage'],
    stats: [
      { label: 'Skill Power', value: '+36' },
      { label: 'Cooldown Recovery', value: '+4%' },
      { label: 'Party Utility', value: '+3%' },
      { label: 'Max HP', value: '+300' },
    ],
    nodes: createNodes('trinity', 'support'),
    progressionEntries: createProgressionEntries('trinity'),
    boardRows: createBoardRows('trinity'),
  },
  {
    id: 'harbinger-of-storms',
    name: 'Harbinger of Storms',
    title: '',
    weaponClass: '',
    tagLevel: 601,
    accentColor: '#5d9eff',
    imagePath: '/assets/images/Class/Staff.png',
    summary: 'The harbinger of storms ruthlessly sweeps all that stands in their way.',
    traits: ['AoE pressure', 'Elemental burst', 'Zone control casting'],
    stats: [
      { label: 'Skill Power', value: '+40' },
      { label: 'Area Damage', value: '+4%' },
      { label: 'Cooldown Recovery', value: '+3%' },
      { label: 'Skill Accuracy', value: '+24' },
    ],
    nodes: createNodes('harbinger-of-storms', 'support'),
    progressionEntries: createProgressionEntries('harbinger-of-storms'),
    boardRows: createBoardRows('harbinger-of-storms'),
  },
  {
    id: 'goddess-of-blessings',
    name: 'Goddess of Blessings',
    title: '',
    weaponClass: '',
    tagLevel: 593,
    accentColor: '#f0b95a',
    imagePath: '/assets/images/Class/Battle Staff.png',
    summary: 'The goddess stretches her hand of benevolence to protect her men in this war that seems to know no ends.',
    traits: ['Buff uptime', 'Sustain support', 'Recovery management'],
    stats: [
      { label: 'Healing Power', value: '+5%' },
      { label: 'Buff Duration', value: '+4%' },
      { label: 'Max HP', value: '+340' },
      { label: 'Debuff Resist', value: '+18' },
    ],
    nodes: createNodes('goddess-of-blessings', 'support'),
    progressionEntries: createProgressionEntries('goddess-of-blessings'),
    boardRows: createBoardRows('goddess-of-blessings'),
  },
]
