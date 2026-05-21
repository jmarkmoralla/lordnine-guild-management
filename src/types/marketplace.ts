export const MARKETPLACE_RARITY_OPTIONS = ['epic', 'legendary', 'mythic'] as const;

export const MARKETPLACE_CATEGORY_OPTIONS = [
  'weapon',
  'armor',
  'cloak',
  'accessories',
  'consumables',
] as const;

export const MARKETPLACE_SUBCATEGORY_OPTIONS = {
  weapon: ['gauntlet', 'gadgets', 'swordAndShield', 'battleStaff', 'battleShield', 'greatsword', 'staff', 'dualDaggers', 'bow', 'crossbow'],
  armor: ['cloth', 'leather', 'plate'],
  cloak: ['battleCloak', 'destructionCloak', 'spiritCloak', 'valorCloak'],
  accessories: ['necklace', 'earrings', 'bracelet', 'ring', 'belt'],
  consumables: ['ability', 'skillbook', 'mounts'],
} as const;

export const MARKETPLACE_ARMOR_PART_OPTIONS = ['helm', 'upperArmor', 'lowerArmor', 'gloves', 'boots'] as const;
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
  const pathSegments = ['/assets/images/items', category, subcategory];

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

  if (category === 'weapon' || category === 'armor' || category === 'accessories' || category === 'cloak') {
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
): {
  category: MarketplaceCategory;
  subcategory: MarketplaceSubcategory;
  part: MarketplacePart | null;
} => {
  const legacyCategory = typeof rawCategory === 'string' ? rawCategory : '';

  let category: MarketplaceCategory;
  let defaultSubcategory: MarketplaceSubcategory | null = null;

  if (legacyCategory === 'clothArmor') {
    category = 'armor';
    defaultSubcategory = 'cloth';
  } else if (legacyCategory === 'leatherArmor') {
    category = 'armor';
    defaultSubcategory = 'leather';
  } else if (legacyCategory === 'plateArmor') {
    category = 'armor';
    defaultSubcategory = 'plate';
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
  } else if (category === 'weapon' || category === 'armor' || category === 'accessories' || category === 'cloak') {
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
  armor: 'Armor',
  cloak: 'Cloak',
  accessories: 'Accessories',
  consumables: 'Consumables',
}[category]);

export const formatMarketplaceSubcategory = (subcategory: MarketplaceSubcategory) => ({
  gauntlet: 'Gauntlet',
  gadgets: 'Gadgets',
  swordAndShield: 'Sword and Shield',
  battleStaff: 'Battle Staff',
  battleShield: 'Battle Shield',
  greatsword: 'Greatsword',
  staff: 'Staff',
  dualDaggers: 'Dual Daggers',
  bow: 'Bow',
  crossbow: 'Crossbow',
  cloth: 'Cloth',
  leather: 'Leather',
  plate: 'Plate',
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

  if (item.category === 'armor' && item.rarity === 'mythic') {
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