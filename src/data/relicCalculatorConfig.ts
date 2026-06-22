export type RelicKey = 'origin-of-destruction' | 'barrier-of-protection' | 'crystal-of-life' | 'magic-storm';

export type RelicConfig = {
  id: RelicKey;
  name: string;
};

export const relicConfigs: RelicConfig[] = [
  { id: 'origin-of-destruction', name: 'Origin of Destruction' },
  { id: 'barrier-of-protection', name: 'Barrier Protection' },
  { id: 'crystal-of-life', name: 'Crystal of Life' },
  { id: 'magic-storm', name: 'Magic Storm' },
];
