import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader, Package2, Pencil, Plus, RefreshCw, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import { useFirestoreMarketplaceItems } from '../hooks/useFirestoreMarketplaceItems';

import {
  getDefaultMarketplacePart,
  formatMarketplaceCategory,
  getMarketplaceImageUrl,
  getMarketplacePartOptions,
  formatMarketplacePart,
  formatMarketplaceRarity,
  formatMarketplaceSubcategory,
  getDefaultMarketplaceSubcategory,
  getMarketplaceSubcategoryOptions,
  MARKETPLACE_CATEGORY_OPTIONS,
  MARKETPLACE_RARITY_OPTIONS,
  type MarketplaceCategory,
  type MarketplaceItem,
  type MarketplacePart,
  type MarketplaceRarity,
  type MarketplaceSubcategory,
} from '../types/marketplace';
import { MarketPriceInfo } from './MarketPriceInfo';
import '../styles/Dashboard.css';
import '../styles/Rankings.css';
import '../styles/Marketplace.css';

const getItemNameSubcategoryLabel = (
  category: MarketplaceCategory,
  subcategory: MarketplaceSubcategory,
): string => {
  const map: Record<string, Record<string, string>> = {
    clothArmor: {
      helm: 'Hat',
      upperArmor: 'Robe',
      lowerArmor: 'Cloth Pants',
      gloves: 'Gloves',
      boots: 'Loafers',
    },
    leatherArmor: {
      helm: 'Hood',
      upperArmor: 'Vest',
      lowerArmor: 'Leather Pants',
      gloves: 'Wristband',
      boots: 'High Boots',
    },
    plateArmor: {
      helm: 'Helm',
      upperArmor: 'Armor',
      lowerArmor: 'Gaiters',
      gloves: 'Gauntlets',
      boots: 'Greaves',
    },
  };
  return map[category]?.[subcategory] ?? formatMarketplaceSubcategory(subcategory);
};

const ABILITY_OPTIONS = [
  { id: 'magneticField', label: 'Magnetic Field', type: 'Spell' },
  { id: 'deathblow', label: 'Deathblow', type: 'Enhance' },
  { id: 'supersense', label: 'Supersense', type: 'Recon' },
  { id: 'disarm', label: 'Disarm', type: 'Combat' },
  { id: 'overcome', label: 'Overcome', type: 'Vitality' },
  { id: 'continuedHeal', label: 'Continued Heal', type: 'Support' },
  { id: 'createZone', label: 'Create Zone', type: 'Defense' },
  { id: 'nearEscape', label: 'Near Escape', type: 'Trick' },
  { id: 'warCry', label: 'War Cry', type: 'Vitality' },
  { id: 'gamble', label: 'Gamble', type: 'Support' },
  { id: 'reverseTime', label: 'Reverse Time', type: 'Trick' },
  { id: 'continuousCuring', label: 'Continuous Curing', type: 'Support' },
  { id: 'anatomy', label: 'Anatomy', type: 'Support' },
  { id: 'purify', label: 'Purify', type: 'Trick' },
  { id: 'lightningSpirit', label: 'Lightning Spirit', type: 'Enhance' },
] as const;

const SKILLBOOK_EPIC_NAMES: Record<string, string> = {
  bareHands: 'Bare Hands: Martial Arts Training',
  swordAndShield: 'Sword and Shield: Battlefield Trailblazer',
  battleStaff: 'Battle Staff: Master of Magic Martial Arts',
  battleShield: 'Battle Shield: Protector of Light',
  greatsword: 'Greatsword: Berserker\'s Pride',
  staff: 'Staff: Element Awakening',
  dualDaggers: 'Dual Daggers: Reorganize',
  bow: 'Bow: Perfect Sniper',
  crossbow: 'Crossbow: Hunter\'s Mark',
};

const MOUNTS_LEGENDARY_OPTIONS = [
  { id: 'petrolov', label: 'Petrolov' },
  { id: 'lamphon', label: 'Lamphon' },
  { id: 'labartonis', label: 'Labartonis' },
  { id: 'baphon', label: 'Baphon' },
  { id: 'rhodi', label: 'Rhodi' },
  { id: 'vulcanos', label: 'Vulcanos' },
] as const;

const MOUNTS_MYTHIC_OPTIONS = [
  { id: 'undemic', label: 'Undemic' },
  { id: 'glasis', label: 'Glasis' },
  { id: 'jupiter', label: 'Jupiter' },
  { id: 'reptilis', label: 'Reptilis' },
  { id: 'delphon', label: 'Delphon' },
  { id: 'cartenonis', label: 'Cartenonis' },
  { id: 'somnium', label: 'Somnium' },
  { id: 'rabeth', label: 'Rabeth' },
] as const;

const SKILLBOOK_LEGENDARY_NAMES: Record<string, string> = {
  bareHands: 'Bare Hands: Relentless Blow',
  swordAndShield: 'Sword and Shield: Indomitable Confidence',
  battleStaff: 'Battle Staff: Binding Judgement',
  battleShield: 'Battle Shield: Unbreakable Strength',
  greatsword: 'Greatsword: Merciless',
  staff: 'Staff: Unknown Magic',
  dualDaggers: 'Dual Daggers: Cruel Edge',
  bow: 'Bow: Pinnacle of Sniping',
  crossbow: 'Crossbow: Flow of Battle',
};

const generateItemName = (
  category: MarketplaceCategory,
  subcategory: MarketplaceSubcategory,
  part: MarketplacePart | null,
  isAppraised: boolean,
  rarity: MarketplaceRarity,
  abilityOption: string | null,
  mountsOption: string | null,
): string => {
  if (category === 'consumables' && subcategory === 'ability' && abilityOption) {
    const option = ABILITY_OPTIONS.find(o => o.id === abilityOption);
    if (option) return `Ability: ${option.label} [${option.type}]`;
  }

  if (category === 'consumables' && subcategory === 'mounts' && mountsOption) {
    const allMounts = [...MOUNTS_LEGENDARY_OPTIONS, ...MOUNTS_MYTHIC_OPTIONS];
    const option = allMounts.find(o => o.id === mountsOption);
    if (option) return `${option.label} Saddle`;
  }

  if (category === 'consumables' && subcategory === 'skillbook' && part) {
    if (rarity === 'epic') {
      const name = SKILLBOOK_EPIC_NAMES[part];
      if (name) return name;
    }
    if (rarity === 'legendary') {
      const name = SKILLBOOK_LEGENDARY_NAMES[part];
      if (name) return name;
    }
  }

  if (category === 'consumables') {
    if (part) {
      const option = part === 'azzam' ? 'Azzam Hissan' : formatMarketplacePart(part);
      return `${option} ${formatMarketplaceSubcategory(subcategory)}`;
    }
    return `${formatMarketplaceSubcategory(subcategory)} (${formatMarketplaceRarity(rarity)})`;
  }

  if (category === 'accessories') {
    const option = part === 'azzam' ? 'Azzam Hissan' : (part ? formatMarketplacePart(part) : '');
    return `${option} ${getItemNameSubcategoryLabel(category, subcategory)}`;
  }

  const option = part === 'azzam' ? 'Azzam Hissan' : (part ? formatMarketplacePart(part) : '');
  const subcategoryLabel = getItemNameSubcategoryLabel(category, subcategory);
  const statusLabel = isAppraised ? 'Appraise' : 'Not Appraised';
  return `${option} ${subcategoryLabel} (${statusLabel})`;
};

interface ManageMarketplacePageProps {
  userType: 'guest' | 'admin';
}

interface MarketplaceFormState {
  name: string;
  description: string;
  imageUrl: string;
  category: MarketplaceCategory;
  subcategory: MarketplaceSubcategory;
  part: MarketplacePart | null;
  qty: number;
  rarity: MarketplaceRarity;
  isAppraised: boolean;
  abilityOption: string | null;
  mountsOption: string | null;
}

const defaultFormState = (): MarketplaceFormState => ({
  name: '',
  description: '',
  imageUrl: getMarketplaceImageUrl('weapon', 'gauntlet', getDefaultMarketplacePart('weapon', 'gauntlet', 'epic'), 'epic'),
  category: 'weapon',
  subcategory: 'gauntlet',
  part: getDefaultMarketplacePart('weapon', 'gauntlet', 'epic'),
  qty: 1,
  priceUsd: 0,
  pricePhp: 0,
  rarity: 'epic',
  isAppraised: false,
  abilityOption: null,
  mountsOption: null,
});

const ManageMarketplacePage: React.FC<ManageMarketplacePageProps> = ({ userType }) => {
  const { items, loading, error, addItem, updateItem, deleteItem } = useFirestoreMarketplaceItems();
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | MarketplaceRarity>('all');
  const [showItemModal, setShowItemModal] = useState(false);
  const [priceRefreshCounter, setPriceRefreshCounter] = useState(0);
  const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);
  const [formState, setFormState] = useState<MarketplaceFormState>(defaultFormState());
  const [failedThumbnailImages, setFailedThumbnailImages] = useState<Record<string, boolean>>({});
  const [previewImageFailed, setPreviewImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MarketplaceItem | null>(null);

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = [item.name, item.description]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());
    const matchesRarity = rarityFilter === 'all' || item.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  }), [items, rarityFilter, searchQuery]);

  const previewName = formState.name.trim() || 'Sample marketplace item';
  const previewDescription = formState.description.trim() || 'Describe the item perks, stats, or notes shown to public viewers.';
  const subcategoryOptions = getMarketplaceSubcategoryOptions(formState.category);
  const partOptions = getMarketplacePartOptions(formState.category, formState.subcategory, formState.rarity);
  const showsPartOptions = partOptions.length > 0;
  const isAbilitySubcategory = formState.category === 'consumables' && formState.subcategory === 'ability';
  const isSkillbookSubcategory = formState.category === 'consumables' && formState.subcategory === 'skillbook';
  const isMountsSubcategory = formState.category === 'consumables' && formState.subcategory === 'mounts';
  const mountsOptionsList = isMountsSubcategory && formState.rarity === 'legendary' ? MOUNTS_LEGENDARY_OPTIONS
    : isMountsSubcategory && formState.rarity === 'mythic' ? MOUNTS_MYTHIC_OPTIONS : [];
  const hasMountsOptions = mountsOptionsList.length > 0;
  const hasAbilityOptions = isAbilitySubcategory && ABILITY_OPTIONS.length > 0;
  const derivedImageUrl = getMarketplaceImageUrl(
    formState.category,
    formState.subcategory,
    formState.part,
    formState.rarity,
  );
  const previewImageUrl = derivedImageUrl.trim();

  useEffect(() => {
    setPreviewImageFailed(false);
  }, [previewImageUrl, showItemModal]);

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      name: generateItemName(current.category, current.subcategory, current.part, current.isAppraised, current.rarity, current.abilityOption, current.mountsOption),
    }));
  }, [formState.category, formState.subcategory, formState.part, formState.isAppraised, formState.rarity, formState.abilityOption, formState.mountsOption]);

  const handleCategorySelect = (category: MarketplaceCategory) => {
    const nextSubcategory = getDefaultMarketplaceSubcategory(category);
    const isAbility = category === 'consumables' && nextSubcategory === 'ability';
    const rarity = isAbility ? 'legendary' : formState.rarity;
    const nextPart = getDefaultMarketplacePart(category, nextSubcategory, rarity);

    setFormState((current) => ({
      ...current,
      category,
      subcategory: nextSubcategory,
      rarity,
      part: nextPart,
      abilityOption: isAbility ? ABILITY_OPTIONS[0].id : null,
      imageUrl: getMarketplaceImageUrl(category, nextSubcategory, nextPart, rarity),
    }));
  };

  const handleSubcategorySelect = (subcategory: MarketplaceSubcategory) => {
    setFormState((current) => {
      const isAbility = current.category === 'consumables' && subcategory === 'ability';
      const isSkillbook = current.category === 'consumables' && subcategory === 'skillbook';
      const isMounts = current.category === 'consumables' && subcategory === 'mounts';
      const rarity = isAbility ? 'legendary'
        : isSkillbook && current.rarity === 'mythic' ? 'epic'
        : isMounts && current.rarity === 'epic' ? 'legendary'
        : current.rarity;
      const nextPart = getDefaultMarketplacePart(current.category, subcategory, rarity);

      return {
        ...current,
        subcategory,
        rarity,
        part: nextPart,
        abilityOption: isAbility ? ABILITY_OPTIONS[0].id : null,
        mountsOption: isMounts ? MOUNTS_LEGENDARY_OPTIONS[0].id : null,
        imageUrl: getMarketplaceImageUrl(
          current.category,
          subcategory,
          nextPart,
          rarity,
        ),
      };
    });
  };

  const handleRaritySelect = (rarity: MarketplaceRarity) => {
    setFormState((current) => {
      const isMounts = current.category === 'consumables' && current.subcategory === 'mounts';
      const nextPart = getDefaultMarketplacePart(current.category, current.subcategory, rarity);
      const currentOption = current.mountsOption;
      const isValidMountsOption = isMounts && currentOption && [...MOUNTS_LEGENDARY_OPTIONS, ...MOUNTS_MYTHIC_OPTIONS].some(o => o.id === currentOption);

      return {
        ...current,
        rarity,
        part: nextPart,
        mountsOption: isMounts && rarity === 'legendary'
          ? (isValidMountsOption && MOUNTS_LEGENDARY_OPTIONS.some(o => o.id === currentOption) ? currentOption : MOUNTS_LEGENDARY_OPTIONS[0].id)
          : isMounts && rarity === 'mythic'
          ? (isValidMountsOption && MOUNTS_MYTHIC_OPTIONS.some(o => o.id === currentOption) ? currentOption : MOUNTS_MYTHIC_OPTIONS[0].id)
          : current.mountsOption,
        imageUrl: getMarketplaceImageUrl(current.category, current.subcategory, nextPart, rarity),
      };
    });
  };

  const openCreateModal = () => {
    setEditingItem(null);
    const defaults = defaultFormState();
    setFormState({ ...defaults, name: generateItemName(defaults.category, defaults.subcategory, defaults.part, defaults.isAppraised, defaults.rarity, null, null) });
    setShowItemModal(true);
  };

  const openEditModal = (item: MarketplaceItem) => {
    setEditingItem(item);
    setFormState({
      name: item.name,
      description: item.description,
      imageUrl: getMarketplaceImageUrl(item.category, item.subcategory, item.part, item.rarity),
      category: item.category,
      subcategory: item.subcategory,
      part: item.part,
      qty: 1,
      priceUsd: item.priceUsd,
      pricePhp: item.pricePhp,
      rarity: item.rarity,
      isAppraised: item.isAppraised,
      abilityOption: null,
      mountsOption: null,
    });
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    if (saving) return;
    setShowItemModal(false);
    setEditingItem(null);
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const itemPayload = {
      ...formState,
      imageUrl: derivedImageUrl,
      qty: 1,
      isVisible: editingItem?.isVisible ?? true,
      isAppraised: formState.isAppraised,
    };

    try {
      setSaving(true);
      if (editingItem?.id) {
        await updateItem(editingItem.id, itemPayload);
      } else {
        await addItem(itemPayload);
      }
      setShowItemModal(false);
      setEditingItem(null);
    } catch (submitError) {
      console.error('Failed to save marketplace item:', submitError);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (item: MarketplaceItem) => {
    if (!item.id) return;

    try {
      setSaving(true);
      await updateItem(item.id, { ...item, isVisible: !item.isVisible });
    } catch (toggleError) {
      console.error('Failed to toggle marketplace visibility:', toggleError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem?.id) return;

    try {
      setSaving(true);
      await deleteItem(deletingItem.id);
      setDeletingItem(null);
    } catch (deleteError) {
      console.error('Failed to delete marketplace item:', deleteError);
    } finally {
      setSaving(false);
    }
  };

  if (userType !== 'admin') {
    return (
      <div className="page-container marketplace-page">
        <div className="page-header">
          <h2>Manage Marketplace</h2>
          <p className="page-subtitle">Admin access required</p>
        </div>
        <div className="error-state">
          <p>Access denied. Please sign in as admin to manage marketplace items.</p>
        </div>
      </div>
    );
  }

  const previewVisibility = editingItem?.isVisible ?? true;

  return (
    <div className="page-container marketplace-page manage-marketplace-page">
      <div className="page-header">
        <h2>Manage Marketplace</h2>
        <p className="page-subtitle">Control which items are displayed on the public marketplace.</p>
      </div>

      <div className="members-stats-grid marketplace-stats-grid">
        <div className="members-stat-card marketplace-stat-card marketplace-stat-card-primary">
          <div className="members-stat-icon marketplace-stat-icon" aria-hidden="true">
            <Package2 size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Total Items</h3>
            <p className="members-stat-value">{items.length}</p>
          </div>
        </div>
        <div className="members-stat-card marketplace-stat-card marketplace-stat-card-success">
          <div className="members-stat-icon marketplace-stat-icon" aria-hidden="true">
            <ShoppingBag size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Visible Items</h3>
            <p className="members-stat-value">{items.filter((item) => item.isVisible).length}</p>
          </div>
        </div>
        <div className="members-stat-card marketplace-stat-card marketplace-stat-card-muted">
          <div className="members-stat-icon marketplace-stat-icon" aria-hidden="true">
            <EyeOff size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Hidden Items</h3>
            <p className="members-stat-value">{items.filter((item) => !item.isVisible).length}</p>
          </div>
        </div>
      </div>

      <div className="rankings-filters marketplace-toolbar manage-marketplace-toolbar">
        <div className="attendance-guest-search-box attendance-manage-search-box marketplace-search-box" role="search">
          <span className="attendance-guest-search-icon" aria-hidden="true">
            <Search size={14} strokeWidth={1.9} />
          </span>
          <input
            type="text"
            className="attendance-guest-search-input attendance-manage-search-input"
            placeholder="Search managed items..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search managed marketplace items"
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              className="attendance-guest-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <select
          className="filter-select marketplace-filter-select"
          value={rarityFilter}
          onChange={(event) => setRarityFilter(event.target.value as 'all' | MarketplaceRarity)}
          aria-label="Filter managed items by rarity"
        >
          <option value="all">All Rarities</option>
          {MARKETPLACE_RARITY_OPTIONS.map((rarity) => (
            <option key={rarity} value={rarity}>{formatMarketplaceRarity(rarity)}</option>
          ))}
        </select>

        <button
          type="button"
          className="refresh-btn-filter marketplace-add-button"
          onClick={openCreateModal}
        >
          <Plus size={16} strokeWidth={1.8} />
          Add Item
        </button>

        <button
          type="button"
          className="refresh-btn-filter icon-only"
          onClick={() => setPriceRefreshCounter((c) => c + 1)}
          aria-label="Refresh NEXT Market prices"
          title="Refresh NEXT Market prices"
        >
          <RefreshCw size={16} strokeWidth={1.8} />
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading marketplace items... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="marketplace-empty-state">
          <h3>No managed items found.</h3>
          <p>Create your first marketplace listing to display it publicly.</p>
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <section className="marketplace-list manage-marketplace-list" aria-label="Managed marketplace items">
          <div className="marketplace-list-header manage-marketplace-header" aria-hidden="true">
            <span className="marketplace-col-name">Item name</span>
            <span className="marketplace-col-qty">Quantity</span>
            <span className="marketplace-col-sale-price">Sale Price</span>
            <span className="marketplace-col-converted-price">Converted Price</span>
            <span className="marketplace-col-discounted-price">Discounted Price</span>
            <span className="marketplace-col-next-market">Next Market</span>
            <span className="marketplace-col-actions">Actions</span>
          </div>

          <div className="marketplace-list-body">
            {filteredItems.map((item) => {
              const thumbnailImageKey = `${item.id ?? item.name}:${item.imageUrl}`;
              const showThumbnailImage = item.imageUrl.trim().length > 0 && !failedThumbnailImages[thumbnailImageKey];

              return (
              <article key={item.id} className={`marketplace-row rarity-${item.rarity}`}>
                <div className="marketplace-col-name marketplace-item-main">
                  <div className="marketplace-item-thumb-wrap">
                    {showThumbnailImage
                      ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="marketplace-item-thumb"
                          loading="lazy"
                          onError={() => setFailedThumbnailImages((current) => ({
                            ...current,
                            [thumbnailImageKey]: true,
                          }))}
                        />
                      )
                      : (
                        <div className="marketplace-item-thumb-placeholder" aria-hidden="true">
                          <ShoppingBag size={22} strokeWidth={1.8} />
                        </div>
                      )}
                  </div>
                  <div className="marketplace-item-text">
                    <h3 className={`marketplace-item-name rarity-text-${item.rarity}`}>{item.name}</h3>
                    <p className="marketplace-item-description">
                      {item.description.trim() || `${formatMarketplaceRarity(item.rarity)} item listing`}
                    </p>
                  </div>
                </div>

                <div className="marketplace-cell marketplace-col-qty">
                  <span className="marketplace-cell-label">Quantity</span>
                  <strong>{item.qty.toLocaleString()}</strong>
                </div>

                <MarketPriceInfo item={item} refreshCounter={priceRefreshCounter} />

                <div className="marketplace-cell marketplace-col-actions marketplace-action-cell">
                  <span className="marketplace-cell-label">Actions</span>
                  <div className="marketplace-row-actions">
                    <button
                      type="button"
                      className={`marketplace-icon-button ${item.isVisible ? 'visible' : 'hidden'}`}
                      onClick={() => handleToggleVisibility(item)}
                      aria-label={item.isVisible ? `Hide ${item.name}` : `Show ${item.name}`}
                      title={item.isVisible ? 'Hide from public marketplace' : 'Show on public marketplace'}
                      disabled={saving}
                    >
                      {item.isVisible ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                    </button>
                    <button
                      type="button"
                      className="marketplace-icon-button"
                      onClick={() => openEditModal(item)}
                      aria-label={`Edit ${item.name}`}
                      title="Edit item"
                    >
                      <Pencil size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className="marketplace-icon-button danger"
                      onClick={() => setDeletingItem(item)}
                      aria-label={`Delete ${item.name}`}
                      title="Delete item"
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </article>
            );})}
          </div>
        </section>
      )}

      {showItemModal && (
        <div
          className="marketplace-modal-overlay modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={editingItem ? 'Edit marketplace item' : 'Add marketplace item'}
        >
          <form className="marketplace-modal marketplace-editor-modal modal-content add-member-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleFormSubmit}>
            <div className="marketplace-modal-header modal-header marketplace-editor-header">
              <div className="marketplace-editor-heading">
                <h3>{editingItem ? 'Edit Marketplace Item' : 'Add Marketplace Item'}</h3>
              </div>
              <button type="button" className="marketplace-icon-button marketplace-modal-close modal-close" onClick={closeItemModal} aria-label="Close item modal">
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="marketplace-modal-body modal-body marketplace-editor-body">
              <section className="marketplace-editor-preview" aria-label="Marketplace item preview">
                <div className={`marketplace-editor-preview-card rarity-${formState.rarity}`}>
                  <div className="marketplace-editor-preview-thumb-wrap">
                    {previewImageUrl && !previewImageFailed
                      ? <img src={previewImageUrl} alt={previewName} className="marketplace-editor-preview-thumb" onError={() => setPreviewImageFailed(true)} />
                      : (
                        <div className="marketplace-editor-preview-thumb-placeholder" aria-hidden="true">
                          <ShoppingBag size={38} strokeWidth={1.9} />
                        </div>
                      )}
                  </div>
                  <div className="marketplace-editor-preview-copy">
                    <div className="marketplace-editor-preview-topline">
                      <span className={`marketplace-rarity-badge rarity-badge-${formState.rarity}`}>
                        {formatMarketplaceRarity(formState.rarity)}
                      </span>
                      <span className={`marketplace-visibility-badge ${previewVisibility ? 'visible' : 'hidden'}`}>
                        {previewVisibility ? 'Visible to public' : 'Hidden from public'}
                      </span>
                    </div>
                    <h4 className={`marketplace-item-name rarity-text-${formState.rarity}`}>{previewName}</h4>
                    <p className="marketplace-editor-preview-description">{previewDescription}</p>
                  </div>
                </div>
              </section>

              <section className="marketplace-editor-category-section" aria-label="Marketplace item category">
                <div className="marketplace-editor-category-heading">
                  <h4 className="marketplace-editor-label">Category</h4>
                </div>
                <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Marketplace categories">
                  {MARKETPLACE_CATEGORY_OPTIONS.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`marketplace-category-pill ${formState.category === category ? 'active' : ''}`}
                      onClick={() => handleCategorySelect(category)}
                      aria-pressed={formState.category === category}
                    >
                      {formatMarketplaceCategory(category)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="marketplace-editor-category-section" aria-label="Marketplace item subcategory">
                <div className="marketplace-editor-category-heading">
                  <h4 className="marketplace-editor-label">Sub Category</h4>
                </div>
                <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Marketplace subcategories">
                  {subcategoryOptions.map((subcategory) => (
                    <button
                      key={subcategory}
                      type="button"
                      className={`marketplace-category-pill ${formState.subcategory === subcategory ? 'active' : ''}`}
                      onClick={() => handleSubcategorySelect(subcategory)}
                      aria-pressed={formState.subcategory === subcategory}
                    >
                      {formatMarketplaceSubcategory(subcategory)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="marketplace-editor-category-section" aria-label="Marketplace item rarity">
                <div className="marketplace-editor-category-heading">
                  <h4 className="marketplace-editor-label">Rarity</h4>
                </div>
                <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Marketplace rarities">
                  {(isAbilitySubcategory ? ['legendary'] : isSkillbookSubcategory ? ['epic', 'legendary'] : isMountsSubcategory ? ['legendary', 'mythic'] : MARKETPLACE_RARITY_OPTIONS).map((rarity) => (
                    <button
                      key={rarity}
                      type="button"
                      className={`marketplace-category-pill ${formState.rarity === rarity ? 'active' : ''}`}
                      onClick={() => handleRaritySelect(rarity)}
                      aria-pressed={formState.rarity === rarity}
                    >
                      {formatMarketplaceRarity(rarity)}
                    </button>
                  ))}
                </div>
              </section>

              {showsPartOptions && (
                <section className="marketplace-editor-category-section" aria-label="Marketplace item options">
                  <div className="marketplace-editor-category-heading">
                    <h4 className="marketplace-editor-label">Options</h4>
                  </div>
                  <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Marketplace item options">
                    {partOptions.map((part) => (
                      <button
                        key={part}
                        type="button"
                        className={`marketplace-category-pill ${formState.part === part ? 'active' : ''}`}
                        onClick={() => setFormState((current) => ({
                          ...current,
                          part,
                          imageUrl: getMarketplaceImageUrl(current.category, current.subcategory, part, current.rarity),
                        }))}
                        aria-pressed={formState.part === part}
                      >
                        {formatMarketplacePart(part)}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {hasAbilityOptions && (
                <section className="marketplace-editor-category-section" aria-label="Marketplace ability options">
                  <div className="marketplace-editor-category-heading">
                    <h4 className="marketplace-editor-label">Options</h4>
                  </div>
                  <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Marketplace ability options">
                    {ABILITY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`marketplace-category-pill ${formState.abilityOption === option.id ? 'active' : ''}`}
                        onClick={() => setFormState((current) => ({ ...current, abilityOption: option.id }))}
                        aria-pressed={formState.abilityOption === option.id}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {hasMountsOptions && (
                <section className="marketplace-editor-category-section" aria-label="Marketplace mounts options">
                  <div className="marketplace-editor-category-heading">
                    <h4 className="marketplace-editor-label">Options</h4>
                  </div>
                  <div className="marketplace-category-pill-list" role="radiogroup" aria-label="Marketplace mounts options">
                    {mountsOptionsList.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`marketplace-category-pill ${formState.mountsOption === option.id ? 'active' : ''}`}
                        onClick={() => setFormState((current) => ({ ...current, mountsOption: option.id }))}
                        aria-pressed={formState.mountsOption === option.id}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="marketplace-form">
                <div className="form-group marketplace-form-full">
                  <label className="marketplace-editor-label" htmlFor="marketplace-item-name">Item Name</label>
                  <input
                    id="marketplace-item-name"
                    type="text"
                    value={formState.name}
                    disabled
                    placeholder="Sword and Shield: Defense Training"
                    required
                  />
                </div>

                {formState.category !== 'accessories' && formState.category !== 'consumables' && (
                  <>
                <div className="form-group marketplace-form-full">
                  <label className="marketplace-editor-label" htmlFor="marketplace-item-description">Description</label>
                  <textarea
                    id="marketplace-item-description"
                    value={formState.description}
                    disabled={!formState.isAppraised}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    placeholder="Melee Defense 91 · Ranged Defense 100 · Magic Defense 163"
                  />
                </div>
                    <label className="marketplace-checkbox-field" style={{ flex: 1, width: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={!formState.isAppraised}
                        onChange={() => setFormState((current) => ({ ...current, isAppraised: false }))}
                      />
                      <span>Not Appraised</span>
                    </label>
                    <label className="marketplace-checkbox-field" style={{ flex: 1, width: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={formState.isAppraised}
                        onChange={() => setFormState((current) => ({ ...current, isAppraised: true }))}
                      />
                      <span>Appraise</span>
                    </label>
                  </>
                )}

              </div>
            </div>

            <div className="marketplace-form-actions modal-footer marketplace-editor-footer">
              <div className="marketplace-editor-footer-note">
                {editingItem ? 'Listings stay ordered by creation date, with newest items shown first.' : 'New listings appear at the top of the marketplace after creation.'}
              </div>
              <div className="marketplace-editor-footer-actions">
                <button type="button" className="btn btn-secondary marketplace-secondary-button" onClick={closeItemModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {deletingItem && (
        <div className="marketplace-modal-overlay" role="dialog" aria-modal="true" aria-label="Delete marketplace item">
          <div className="marketplace-modal marketplace-confirm-modal">
            <div className="marketplace-modal-header">
              <div>
                <h3>Delete Marketplace Item</h3>
                <p>This action removes the item from the public marketplace.</p>
              </div>
              <button type="button" className="marketplace-icon-button" onClick={() => setDeletingItem(null)} aria-label="Close delete modal">
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>
            <p className="marketplace-confirm-copy">Delete <strong>{deletingItem.name}</strong>?</p>
            <div className="marketplace-form-actions">
              <button type="button" className="marketplace-secondary-button" onClick={() => setDeletingItem(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="marketplace-danger-button" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMarketplacePage;
