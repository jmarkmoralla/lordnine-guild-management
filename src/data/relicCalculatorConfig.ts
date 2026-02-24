export type RelicKey = 'origin-of-destruction' | 'barrier-of-protection' | 'crystal-of-life' | 'magic-storn';

export type RelicConfig = {
  id: RelicKey;
  name: string;
  baseTemporalPieceCost: number;
  temporalPieceGrowth: number;
};

export const relicConfigs: RelicConfig[] = [
  {
    id: 'origin-of-destruction',
    name: 'Origin of Destruction',
    baseTemporalPieceCost: 28,
    temporalPieceGrowth: 6,
  },
  {
    id: 'barrier-of-protection',
    name: 'Barrier Protection',
    baseTemporalPieceCost: 24,
    temporalPieceGrowth: 5,
  },
  {
    id: 'crystal-of-life',
    name: 'Crystal of Life',
    baseTemporalPieceCost: 20,
    temporalPieceGrowth: 4,
  },
  {
    id: 'magic-storn',
    name: 'Magic Storm',
    baseTemporalPieceCost: 26,
    temporalPieceGrowth: 5,
  },
];

const MAX_RELIC_LEVEL = 100;

export const buildDefaultTemporalPieceLevelMap = (): Record<RelicKey, number[]> => {
  const result = {} as Record<RelicKey, number[]>;

  relicConfigs.forEach((relic) => {
    result[relic.id] = Array.from({ length: MAX_RELIC_LEVEL + 1 }, (_, level) => {
      if (level === 0) return 0;
      return Math.round(relic.baseTemporalPieceCost + (level - 1) * relic.temporalPieceGrowth);
    });
  });

  return result;
};
