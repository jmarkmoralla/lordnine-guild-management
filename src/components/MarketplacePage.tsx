import { useMemo, useState } from 'react';
import { Loader, Search, ShoppingBag, X } from 'lucide-react';
import { useFirestoreMarketplaceItems } from '../hooks/useFirestoreMarketplaceItems';
import {
  formatMarketplaceRarity,
  MARKETPLACE_RARITY_OPTIONS,
  type MarketplaceRarity,
} from '../types/marketplace';
import { MarketPriceInfo } from './MarketPriceInfo';
import '../styles/Dashboard.css';
import '../styles/Rankings.css';
import '../styles/Marketplace.css';

const MarketplacePage: React.FC = () => {
  const { items, loading, error } = useFirestoreMarketplaceItems();
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | MarketplaceRarity>('all');
  const [failedThumbnailImages, setFailedThumbnailImages] = useState<Record<string, boolean>>({});
  const [priceRefreshCounter, setPriceRefreshCounter] = useState(0);

  const publicItems = useMemo(() => items.filter((item) => item.isVisible), [items]);

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
            <span className="marketplace-col-sale-price">Sale Price</span>
            <span className="marketplace-col-converted-price">Converted Price</span>
            <span className="marketplace-col-discounted-price">Discounted Price</span>
            <span className="marketplace-col-next-market">Next Market</span>
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
              </article>
            );})}
          </div>
        </section>
      )}
    </div>
  );
};

export default MarketplacePage;