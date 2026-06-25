import { useFetchNextMarketPrice } from '../hooks/useFetchNextMarketPrice';
import { getNextMarketSearchUrl } from '../types/marketplace';
import type { MarketplaceItem } from '../types/marketplace';

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

const getDiscountedPriceCap = (
  category: string,
  subcategory: string,
  rarity: string,
): number | null => {
  if (category === 'weapon' && rarity === 'legendary') return 20000;
  if (category === 'weapon' && rarity === 'mythic') return 50000;
  if (category === 'accessories' && subcategory === 'necklace' && rarity === 'legendary') return 10000;
  if (['clothArmor', 'leatherArmor', 'plateArmor'].includes(category) && rarity === 'mythic') return 10000;
  return null;
};

interface MarketPriceInfoProps {
  item: MarketplaceItem;
  refreshCounter?: number;
}

export const MarketPriceInfo: React.FC<MarketPriceInfoProps> = ({ item, refreshCounter = 0 }) => {
  const searchUrl = getNextMarketSearchUrl(item);
  const { match, loading } = useFetchNextMarketPrice(searchUrl, item, refreshCounter);
  const saleUrl = getNextMarketSearchUrl(item);

  const isLoading = match === undefined && loading;

  let discountPhp: number | null = null;
  let discountUsd: number | null = null;
  let showDiscountUsd = false;

  if (match) {
    const halfPhp = match.fiatPrice / 2;
    const halfUsd = match.usdPrice / 2;
    const cap = getDiscountedPriceCap(item.category, item.subcategory, item.rarity);
    showDiscountUsd = cap === null || halfPhp <= cap;
    discountPhp = showDiscountUsd ? halfPhp : cap!;
    discountUsd = halfUsd;
  }

  return (
    <>
      <div className="marketplace-cell marketplace-col-sale-price">
        <span className="marketplace-cell-label">Sale Price</span>
        {isLoading ? (
          <span className="marketplace-price-loading">Loading...</span>
        ) : match ? (
          <strong>{phpFormatter.format(match.fiatPrice)}</strong>
        ) : (
          <span className="marketplace-price-na">—</span>
        )}
      </div>
      <div className="marketplace-cell marketplace-col-converted-price">
        <span className="marketplace-cell-label">Converted Price</span>
        {isLoading ? (
          <span className="marketplace-price-loading">Loading...</span>
        ) : match ? (
          <strong>{usdFormatter.format(match.usdPrice)}</strong>
        ) : (
          <span className="marketplace-price-na">—</span>
        )}
      </div>
      <div className="marketplace-cell marketplace-col-discounted-price">
        <span className="marketplace-cell-label">Discounted Price</span>
        {isLoading ? (
          <span className="marketplace-price-loading">Loading...</span>
        ) : match ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
            <strong style={{ color: '#2ecc71' }}>{phpFormatter.format(discountPhp!)}</strong>
            {showDiscountUsd && (
              <span style={{ fontSize: '0.8rem', color: '#2ecc71' }}>
                {usdFormatter.format(discountUsd!)}
              </span>
            )}
          </div>
        ) : (
          <span className="marketplace-price-na">—</span>
        )}
      </div>
      <div className="marketplace-cell marketplace-col-next-market">
        <span className="marketplace-cell-label">Next Market</span>
        {isLoading ? (
          <span className="marketplace-price-loading">Loading...</span>
        ) : match ? (
          <a
            href={saleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="marketplace-market-link"
            title={match.matchedSaleName}
          >
            {match.isExactMatch !== false ? 'View listing' : 'Search'}
          </a>
        ) : (
          <a
            href={saleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="marketplace-market-link"
            title={`Search NEXT Market for ${item.name}`}
          >
            Search
          </a>
        )}
      </div>
    </>
  );
};
