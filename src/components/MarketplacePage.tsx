import { useMemo, useState } from 'react';
import { BadgePercent, Gem, Loader, Search, ShoppingBag, X } from 'lucide-react';
import { useFirestoreMarketplaceItems } from '../hooks/useFirestoreMarketplaceItems';
import {
  formatMarketplaceRarity,
  getDiscountedMarketplacePriceDisplay,
  MARKETPLACE_RARITY_OPTIONS,
  type MarketplaceRarity,
} from '../types/marketplace';
import '../styles/Dashboard.css';
import '../styles/Rankings.css';
import '../styles/Marketplace.css';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getDiscountedPhpPrice = (item: Parameters<typeof getDiscountedMarketplacePriceDisplay>[0]) => {
  if (item.category === 'weapon' && item.rarity === 'mythic' && item.pricePhp > 50000) {
    return 50000;
  }

  if (item.category === 'weapon' && item.rarity === 'legendary' && item.pricePhp > 20000) {
    return 20000;
  }

  return item.pricePhp * 0.5;
};

const MarketplacePage: React.FC = () => {
  const { items, loading, error } = useFirestoreMarketplaceItems();
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | MarketplaceRarity>('all');
  const [failedThumbnailImages, setFailedThumbnailImages] = useState<Record<string, boolean>>({});

  const publicItems = useMemo(() => items.filter((item) => item.isVisible), [items]);

  const rareListingsCount = useMemo(
    () => publicItems.filter((item) => item.rarity === 'legendary' || item.rarity === 'mythic').length,
    [publicItems]
  );

  const bestDeal = useMemo(() => {
    if (publicItems.length === 0) {
      return null;
    }

    return publicItems.reduce((bestItem, currentItem) => {
      const currentSavingsPhp = Math.max(currentItem.pricePhp - getDiscountedPhpPrice(currentItem), 0);

      if (!bestItem) {
        return currentSavingsPhp > 0
          ? { item: currentItem, savingsPhp: currentSavingsPhp }
          : null;
      }

      if (currentSavingsPhp > bestItem.savingsPhp) {
        return { item: currentItem, savingsPhp: currentSavingsPhp };
      }

      return bestItem;
    }, null as { item: (typeof publicItems)[number]; savingsPhp: number } | null);
  }, [publicItems]);

  const filteredItems = useMemo(() => publicItems.filter((item) => {
    const matchesSearch = [item.name, item.description]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());
    const matchesRarity = rarityFilter === 'all' || item.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  }), [publicItems, rarityFilter, searchQuery]);

  return (
    <div className="page-container marketplace-page">
      <div className="page-header">
        <h2>Marketplace</h2>
        <p className="page-subtitle">Browse listed items available to all guild and faction members.</p>
      </div>

      <div className="members-stats-grid marketplace-stats-grid">
        <div className="members-stat-card marketplace-stat-card">
          <div className="members-stat-icon" aria-hidden="true">
            <ShoppingBag size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Listings</h3>
            <p className="members-stat-value">{publicItems.length}</p>
            <p className="marketplace-stat-subtitle">All public items currently available</p>
          </div>
        </div>
        <div className="members-stat-card marketplace-stat-card marketplace-stat-card-success">
          <div className="members-stat-icon" aria-hidden="true">
            <BadgePercent size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Best Deal</h3>
            <p className={`members-stat-value marketplace-stat-value-text marketplace-stat-value-compact ${bestDeal ? `rarity-text-${bestDeal.item.rarity}` : ''}`}>
              {bestDeal?.item.name ?? 'None yet'}
            </p>
            <p className="marketplace-stat-subtitle">
              {bestDeal ? `Save ${phpFormatter.format(bestDeal.savingsPhp)}` : 'Biggest current discount on the board'}
            </p>
          </div>
        </div>
        <div className="members-stat-card marketplace-stat-card marketplace-stat-card-muted">
          <div className="members-stat-icon" aria-hidden="true">
            <Gem size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Rare Listings</h3>
            <p className="members-stat-value">{rareListingsCount}</p>
            <p className="marketplace-stat-subtitle">Legendary and Mythic items available now</p>
          </div>
        </div>
      </div>

      <div className="rankings-filters marketplace-toolbar">
        <div className="attendance-guest-search-box attendance-manage-search-box marketplace-search-box" role="search">
          <span className="attendance-guest-search-icon" aria-hidden="true">
            <Search size={14} strokeWidth={1.9} />
          </span>
          <input
            type="text"
            className="attendance-guest-search-input attendance-manage-search-input"
            placeholder="Search marketplace item..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search marketplace items"
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
          aria-label="Filter items by rarity"
        >
          <option value="all">All Rarities</option>
          {MARKETPLACE_RARITY_OPTIONS.map((rarity) => (
            <option key={rarity} value={rarity}>{formatMarketplaceRarity(rarity)}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading marketplace... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="marketplace-empty-state">
          <h3>No marketplace listings found.</h3>
          <p>Try adjusting your search or rarity filter, or add items from Manage Marketplace.</p>
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <section className="marketplace-list" aria-label="Marketplace items">
          <div className="marketplace-list-header" aria-hidden="true">
            <span className="marketplace-col-name">Item name</span>
            <span className="marketplace-col-qty">Quantity</span>
            <span className="marketplace-col-price">NEXT Market Price<br />(USD/PHP)</span>
            <span className="marketplace-col-price">Discounted Price<br />(USD/PHP)</span>
            <span className="marketplace-col-rarity">Rarity</span>
          </div>

          <div className="marketplace-list-body">
            {filteredItems.map((item) => {
              const discountedPrice = getDiscountedMarketplacePriceDisplay(item);
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

                <div className="marketplace-cell marketplace-col-price marketplace-price-cell">
                  <span className="marketplace-cell-label">NEXT Market Price (USD/PHP)</span>
                  <strong>{usdFormatter.format(item.priceUsd)}</strong>
                  <strong>{phpFormatter.format(item.pricePhp)}</strong>
                </div>

                <div className="marketplace-cell marketplace-col-price marketplace-price-cell">
                  <span className="marketplace-cell-label">Discounted Price (USD/PHP)</span>
                  <strong>{discountedPrice.usdDisplay}</strong>
                  <strong>{discountedPrice.phpDisplay}</strong>
                </div>

                <div className="marketplace-cell marketplace-col-rarity">
                  <span className="marketplace-cell-label">Rarity</span>
                  <span className={`marketplace-rarity-badge rarity-badge-${item.rarity}`}>
                    {formatMarketplaceRarity(item.rarity)}
                  </span>
                </div>
              </article>
            );})}
          </div>
        </section>
      )}
    </div>
  );
};

export default MarketplacePage;