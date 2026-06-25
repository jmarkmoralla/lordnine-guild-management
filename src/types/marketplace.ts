export const MARKETPLACE_RARITY_OPTIONS = ['epic', 'legendary', 'mythic'] as const;

export const MARKETPLACE_ARMOR_PART_OPTIONS = ['helm', 'upperArmor', 'lowerArmor', 'gloves', 'boots'] as const;

export const MARKETPLACE_CATEGORY_OPTIONS = [
  'weapon',
  'clothArmor',
  'leatherArmor',
  'plateArmor',
  'cloak',
  'accessories',
  'consumables',
] as const;

export const MARKETPLACE_SUBCATEGORY_OPTIONS = {
  weapon: ['gauntlet', 'gadgets', 'swordAndShield', 'battleStaff', 'battleShield', 'greatsword', 'staff', 'dualDaggers', 'bow', 'crossbow'],
  clothArmor: MARKETPLACE_ARMOR_PART_OPTIONS,
  leatherArmor: MARKETPLACE_ARMOR_PART_OPTIONS,
  plateArmor: MARKETPLACE_ARMOR_PART_OPTIONS,
  cloak: ['battleCloak', 'destructionCloak', 'spiritCloak', 'valorCloak'],
  accessories: ['necklace', 'earrings', 'bracelet', 'ring', 'belt'],
  consumables: ['ability', 'skillbook', 'mounts'],
} as const;
export const MARKETPLACE_SKILLBOOK_PART_OPTIONS = [
  'bareHands',
  'swordAndShield',
  'battleStaff',
  'battleShield',
  'greatsword',
  'staff',
  'dualDaggers',
  'bow',
  'crossbow',
] as const;
export const MARKETPLACE_ITEM_OPTION_OPTIONS = {
  mythic: ['terrenos'],
  legendary: ['serus', 'eos', 'pernox', 'orpherta', 'innis', 'iliana'],
  epic: ['azzam', 'serad', 'serbis', 'grayDawn', 'blackThorn', 'elSera', 'kransia', 'aisha'],
} as const;
const MARKETPLACE_CONSUMABLE_IMAGE_RARITIES = {
  ability: ['epic', 'legendary'],
  mounts: ['epic', 'legendary', 'mythic'],
} as const;

export type MarketplaceRarity = typeof MARKETPLACE_RARITY_OPTIONS[number];
export type MarketplaceCategory = typeof MARKETPLACE_CATEGORY_OPTIONS[number];
export type MarketplaceSubcategory = (typeof MARKETPLACE_SUBCATEGORY_OPTIONS)[MarketplaceCategory][number];
export type MarketplaceArmorPart = typeof MARKETPLACE_ARMOR_PART_OPTIONS[number];
export type MarketplaceSkillbookPart = typeof MARKETPLACE_SKILLBOOK_PART_OPTIONS[number];
export type MarketplaceItemOption = (typeof MARKETPLACE_ITEM_OPTION_OPTIONS)[MarketplaceRarity][number];
export type MarketplacePart = MarketplaceArmorPart | MarketplaceSkillbookPart | MarketplaceItemOption;
type MarketplaceConsumableImageSubcategory = keyof typeof MARKETPLACE_CONSUMABLE_IMAGE_RARITIES;

export interface MarketplaceItem {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  category: MarketplaceCategory;
  subcategory: MarketplaceSubcategory;
  part: MarketplacePart | null;
  qty: number;
  priceUsd: number;
  pricePhp: number;
  rarity: MarketplaceRarity;
  isVisible: boolean;
  isAppraised: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplacePricingSettings {
  phpPerUsd: number | null;
  source: string;
  sourceDate: string;
  fetchedAt: string;
  updatedAt: string;
}

const marketplaceUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const marketplacePhpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const DEFAULT_MARKETPLACE_IMAGE_URL = '';

export const getMarketplaceImageUrl = (
  category: MarketplaceCategory,
  subcategory: MarketplaceSubcategory,
  part: MarketplacePart | null,
  rarity: MarketplaceRarity,
) => {
  const pathSegments = ['/assets/images/items'];

  pathSegments.push(category, subcategory);

  if (part) {
    pathSegments.push(rarity, `${part}.png`);
  } else {
    pathSegments.push(`${rarity}.png`);
  }

  return pathSegments.join('/');
};

export const isMarketplaceRarity = (value: unknown): value is MarketplaceRarity => (
  typeof value === 'string' && MARKETPLACE_RARITY_OPTIONS.includes(value as MarketplaceRarity)
);

export const normalizeMarketplaceRarity = (value: unknown): MarketplaceRarity => {
  if (value === 'common' || value === 'uncommon' || value === 'rare') {
    return 'epic';
  }

  return isMarketplaceRarity(value) ? value : 'epic';
};

export const isMarketplaceCategory = (value: unknown): value is MarketplaceCategory => (
  typeof value === 'string' && MARKETPLACE_CATEGORY_OPTIONS.includes(value as MarketplaceCategory)
);

export const getDefaultMarketplaceSubcategory = (category: MarketplaceCategory): MarketplaceSubcategory => (
  MARKETPLACE_SUBCATEGORY_OPTIONS[category][0]
);

export const getMarketplaceSubcategoryOptions = (category: MarketplaceCategory) => (
  MARKETPLACE_SUBCATEGORY_OPTIONS[category]
);

export const isMarketplaceSubcategory = (value: unknown): value is MarketplaceSubcategory => (
  typeof value === 'string'
  && Object.values(MARKETPLACE_SUBCATEGORY_OPTIONS).some((options) => options.includes(value as never))
);

export const isMarketplaceSubcategoryForCategory = (
  category: MarketplaceCategory,
  value: unknown,
): value is MarketplaceSubcategory => (
  typeof value === 'string' && MARKETPLACE_SUBCATEGORY_OPTIONS[category].includes(value as never)
);

export const isMarketplaceArmorPart = (value: unknown): value is MarketplaceArmorPart => (
  typeof value === 'string' && MARKETPLACE_ARMOR_PART_OPTIONS.includes(value as MarketplaceArmorPart)
);

export const isMarketplaceSkillbookPart = (value: unknown): value is MarketplaceSkillbookPart => (
  typeof value === 'string' && MARKETPLACE_SKILLBOOK_PART_OPTIONS.includes(value as MarketplaceSkillbookPart)
);

export const isMarketplaceItemOption = (value: unknown): value is MarketplaceItemOption => (
  typeof value === 'string'
  && Object.values(MARKETPLACE_ITEM_OPTION_OPTIONS).some((options) => options.includes(value as never))
);

export const getMarketplacePartOptions = (
  category: MarketplaceCategory,
  subcategory: MarketplaceSubcategory,
  rarity: MarketplaceRarity,
): readonly MarketplacePart[] => {
  if (category === 'consumables' && subcategory === 'skillbook') {
    return MARKETPLACE_SKILLBOOK_PART_OPTIONS;
  }

  if (
    category === 'weapon'
    || category === 'clothArmor'
    || category === 'leatherArmor'
    || category === 'plateArmor'
    || category === 'accessories'
    || category === 'cloak'
  ) {
    return MARKETPLACE_ITEM_OPTION_OPTIONS[rarity];
  }

  return [];
};

export const getDefaultMarketplacePart = (
  category: MarketplaceCategory,
  subcategory: MarketplaceSubcategory,
  rarity: MarketplaceRarity,
): MarketplacePart | null => {
  const options = getMarketplacePartOptions(category, subcategory, rarity);

  return options.length > 0 ? options[0] : null;
};

const isMarketplaceConsumableImageSubcategory = (
  value: MarketplaceSubcategory,
): value is MarketplaceConsumableImageSubcategory => (
  value in MARKETPLACE_CONSUMABLE_IMAGE_RARITIES
);

export const getMarketplaceConsumableImageUrl = (
  subcategory: MarketplaceSubcategory,
  rarity: MarketplaceRarity,
) => {
  if (!isMarketplaceConsumableImageSubcategory(subcategory)) {
    return DEFAULT_MARKETPLACE_IMAGE_URL;
  }

  const supportedRarities = MARKETPLACE_CONSUMABLE_IMAGE_RARITIES[subcategory] as readonly MarketplaceRarity[];

  if (!supportedRarities.includes(rarity)) {
    return DEFAULT_MARKETPLACE_IMAGE_URL;
  }

  return getMarketplaceImageUrl('consumables', subcategory, null, rarity);
};

export const normalizeMarketplaceSelection = (
  rawCategory: unknown,
  rawSubcategory: unknown,
  rawPart: unknown,
  rawRarity: unknown,
  rawArmorSlot?: unknown,
): {
  category: MarketplaceCategory;
  subcategory: MarketplaceSubcategory;
  part: MarketplacePart | null;
} => {
  const legacyCategory = typeof rawCategory === 'string' ? rawCategory : '';

  let category: MarketplaceCategory;
  let defaultSubcategory: MarketplaceSubcategory | null = null;

  if (legacyCategory === 'clothArmor') {
    category = 'clothArmor';
    defaultSubcategory = isMarketplaceArmorPart(rawSubcategory) ? rawSubcategory : isMarketplaceArmorPart(rawArmorSlot) ? rawArmorSlot : 'helm';
  } else if (legacyCategory === 'leatherArmor') {
    category = 'leatherArmor';
    defaultSubcategory = isMarketplaceArmorPart(rawSubcategory) ? rawSubcategory : isMarketplaceArmorPart(rawArmorSlot) ? rawArmorSlot : 'helm';
  } else if (legacyCategory === 'plateArmor') {
    category = 'plateArmor';
    defaultSubcategory = isMarketplaceArmorPart(rawSubcategory) ? rawSubcategory : isMarketplaceArmorPart(rawArmorSlot) ? rawArmorSlot : 'helm';
  } else if (legacyCategory === 'armor') {
    if (rawSubcategory === 'cloth') {
      category = 'clothArmor';
    } else if (rawSubcategory === 'leather') {
      category = 'leatherArmor';
    } else {
      category = 'plateArmor';
    }
    defaultSubcategory = isMarketplaceArmorPart(rawArmorSlot) ? rawArmorSlot : 'helm';
  } else if (legacyCategory === 'box') {
    category = 'consumables';
    defaultSubcategory = 'ability';
  } else if (isMarketplaceCategory(rawCategory)) {
    category = rawCategory;
  } else {
    category = 'weapon';
  }

  const subcategory = isMarketplaceSubcategoryForCategory(category, rawSubcategory)
    ? rawSubcategory
    : defaultSubcategory ?? getDefaultMarketplaceSubcategory(category);
  const rarity = normalizeMarketplaceRarity(rawRarity);

  let part: MarketplacePart | null = null;

  if (category === 'consumables' && subcategory === 'skillbook') {
    part = isMarketplaceSkillbookPart(rawPart)
      ? rawPart
      : getDefaultMarketplacePart(category, subcategory, rarity);
  } else if (
    category === 'weapon'
    || category === 'clothArmor'
    || category === 'leatherArmor'
    || category === 'plateArmor'
    || category === 'accessories'
    || category === 'cloak'
  ) {
    part = isMarketplaceItemOption(rawPart)
      ? rawPart
      : getDefaultMarketplacePart(category, subcategory, rarity);
  }

  return { category, subcategory, part };
};

export const formatMarketplaceRarity = (rarity: MarketplaceRarity) => (
  rarity.charAt(0).toUpperCase() + rarity.slice(1)
);

export const formatMarketplaceCategory = (category: MarketplaceCategory) => ({
  weapon: 'Weapon',
  clothArmor: 'Cloth Armor',
  leatherArmor: 'Leather Armor',
  plateArmor: 'Plate Armor',
  cloak: 'Cloak',
  accessories: 'Accessories',
  consumables: 'Consumables',
}[category]);

export const formatMarketplaceSubcategory = (subcategory: MarketplaceSubcategory) => ({
  gauntlet: 'Knuckles',
  gadgets: 'Gadgets',
  swordAndShield: 'Sword and Shield',
  battleStaff: 'Battle Staff',
  battleShield: 'Battle Shield',
  greatsword: 'Greatsword',
  staff: 'Staff',
  dualDaggers: 'Dual Daggers',
  bow: 'Bow',
  crossbow: 'Crossbow',
  helm: 'Helm',
  upperArmor: 'Upper Armor',
  lowerArmor: 'Lower Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  battleCloak: 'Battle Cloak',
  destructionCloak: 'Destruction Cloak',
  spiritCloak: 'Spirit Cloak',
  valorCloak: 'Valor Cloak',
  necklace: 'Necklace',
  earrings: 'Earrings',
  bracelet: 'Bracelet',
  ring: 'Ring',
  belt: 'Belt',
  ability: 'Ability',
  skillbook: 'Skillbook',
  mounts: 'Mounts',
}[subcategory]);

export const formatMarketplacePart = (part: MarketplacePart) => ({
  bareHands: 'Bare Hands',
  swordAndShield: 'Sword and Shield',
  battleStaff: 'Battle Staff',
  battleShield: 'Battle Shield',
  greatsword: 'Greatsword',
  staff: 'Staff',
  dualDaggers: 'Dual Daggers',
  bow: 'Bow',
  crossbow: 'Crossbow',
  terrenos: 'Terrenos',
  serus: 'Serus',
  eos: 'Eos',
  pernox: 'Pernox',
  orpherta: 'Orpherta',
  innis: 'Innis',
  iliana: 'Iliana',
  azzam: 'Azzam',
  serad: 'Serad',
  serbis: 'Serbis',
  grayDawn: 'Gray Dawn',
  blackThorn: 'Black Thorn',
  elSera: 'El Sera',
  kransia: 'Kransia',
  aisha: 'Aisha',
  helm: 'Helm',
  upperArmor: 'Upper Armor',
  lowerArmor: 'Lower Armor',
  gloves: 'Gloves',
  boots: 'Boots',
}[part]);

const getItemPhpCap = (item: MarketplaceItem) => {
  if (item.category === 'weapon') {
    if (item.rarity === 'mythic') return 50000;
    if (item.rarity === 'legendary') return 20000;
  }

  if (item.category === 'accessories' && item.subcategory === 'necklace' && item.rarity === 'legendary') {
    return 10000;
  }

  if ((item.category === 'clothArmor' || item.category === 'leatherArmor' || item.category === 'plateArmor') && item.rarity === 'mythic') {
    return 10000;
  }

  return null;
};

const getUsdFromPhpAmount = (
  phpAmount: number,
  pricingSettings?: MarketplacePricingSettings,
) => {
  const phpPerUsd = pricingSettings?.phpPerUsd;

  if (typeof phpPerUsd !== 'number' || !Number.isFinite(phpPerUsd) || phpPerUsd <= 0) {
    return null;
  }

  return phpAmount / phpPerUsd;
};

export const getDiscountedMarketplacePriceValues = (
  item: MarketplaceItem,
  pricingSettings?: MarketplacePricingSettings,
) => {
  const discountedPhp = item.pricePhp * 0.5;
  const discountedUsd = item.priceUsd * 0.5;
  const phpCap = getItemPhpCap(item);

  if (phpCap === null) {
    return {
      php: discountedPhp,
      usd: discountedUsd,
    };
  }

  const cappedPhp = Math.min(discountedPhp, phpCap);

  if (cappedPhp < phpCap) {
    return {
      php: cappedPhp,
      usd: getUsdFromPhpAmount(cappedPhp, pricingSettings),
    };
  }

  return {
    php: cappedPhp,
    usd: discountedUsd,
  };
};

export interface NextMarketPriceInfo {
  currencyType: string;
  price: number;
  unitPrice: number;
}

export interface NextMarketItem {
  name: string;
  imageUrl: string;
  amount: number;
  description: string;
}

export interface NextMarketSale {
  id: number;
  item: NextMarketItem;
  displayAmount: number;
  fiatPriceInfo: NextMarketPriceInfo;
  cryptoPriceInfo: NextMarketPriceInfo;
  isCryptoPaymentOnly: boolean;
  isOrderInProgress: boolean;
}

export interface NextMarketSearchResponse {
  content: NextMarketSale[];
  pageNumber: number;
  totalElements: number;
  first: boolean;
  last: boolean;
}

export interface NextMarketPriceMatch {
  matchedSaleName: string;
  saleId: number;
  usdPrice: number;
  usdtPrice: number;
  fiatPrice: number;
  fiatCurrency: string;
  quantity: number;
  isExactMatch?: boolean;
}

export interface NextMarketPriceResult {
  itemName: string;
  matchedSaleName: string;
  saleUrl: string;
  usdPrice: number;
  usdtPrice: number;
  quantity: number;
}

export const getDiscountedMarketplacePriceDisplay = (
  item: MarketplaceItem,
  pricingSettings?: MarketplacePricingSettings,
) => {
  const discountedPrice = getDiscountedMarketplacePriceValues(item, pricingSettings);

  return {
    usdDisplay: discountedPrice.usd === null ? '-' : marketplaceUsdFormatter.format(discountedPrice.usd),
    phpDisplay: marketplacePhpFormatter.format(discountedPrice.php),
  };
};

const NEXT_MARKET_PRESET_IDS: Record<MarketplaceCategory, { presetId: number; subPresetMap: Partial<Record<MarketplaceSubcategory, number>>; rarityMap: Record<MarketplaceRarity, number> }> = {
  weapon: { presetId: 1, subPresetMap: { gauntlet: 2, gadgets: 58, swordAndShield: 3, battleStaff: 4, battleShield: 5, greatsword: 6, staff: 7, dualDaggers: 8, bow: 9, crossbow: 10 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
  clothArmor: { presetId: 11, subPresetMap: { helm: 12, upperArmor: 13, lowerArmor: 14, gloves: 15, boots: 16 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
  leatherArmor: { presetId: 17, subPresetMap: { helm: 12, upperArmor: 13, lowerArmor: 14, gloves: 15, boots: 16 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
  plateArmor: { presetId: 23, subPresetMap: { helm: 12, upperArmor: 13, lowerArmor: 14, gloves: 15, boots: 16 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
  cloak: { presetId: 53, subPresetMap: { battleCloak: 54, destructionCloak: 55, spiritCloak: 56, valorCloak: 57 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
  accessories: { presetId: 29, subPresetMap: { necklace: 30, earrings: 31, bracelet: 32, ring: 33, belt: 34 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
  consumables: { presetId: 42, subPresetMap: { ability: 43, skillbook: 44, mounts: 45 }, rarityMap: { epic: 50, legendary: 51, mythic: 52 } },
};

export const getNextMarketSearchUrl = (item: Pick<MarketplaceItem, 'name' | 'category' | 'subcategory' | 'rarity'>): string => {
  const params = new URLSearchParams();
  const cleanKeyword = item.name.replace(/\s*\((?:Not\s+)?Apprais(?:e|ed)\)\s*$/i, '').trim();
  params.set('keyword', cleanKeyword || item.name);
  params.set('viewType', 'fiat');
  params.set('sort', 'PRICE_ASC');
  params.set('realmCode', 'OLD_REALM');

  const presets = getNextMarketPresetIds(item);
  if (presets) {
    params.set('presetId', String(presets.presetId));
    if (presets.subPresetId != null) params.set('subPresetId', String(presets.subPresetId));
    params.set('refPresetId', String(presets.refPresetId));
  }

  return `https://l9asia.nextmarket.games/marketplace?${params.toString()}`;
};

export const getNextMarketPresetIds = (item: Pick<MarketplaceItem, 'category' | 'subcategory' | 'rarity'>): { presetId: number; subPresetId?: number; refPresetId: number } | undefined => {
  const preset = NEXT_MARKET_PRESET_IDS[item.category];
  if (!preset) return undefined;
  return {
    presetId: preset.presetId,
    subPresetId: preset.subPresetMap[item.subcategory],
    refPresetId: preset.rarityMap[item.rarity],
  };
};