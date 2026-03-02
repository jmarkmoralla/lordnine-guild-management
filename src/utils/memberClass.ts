export const MEMBER_CLASSES = [
  'Bare Hands',
  'Battle Shield',
  'Battle Staff',
  'Bow',
  'Crossbow',
  'Dual Daggers',
  'Staff',
  'Sword and Shield',
  'Greatsword',
] as const;

export type MemberClass = (typeof MEMBER_CLASSES)[number];

export const DEFAULT_MEMBER_CLASS: MemberClass = 'Bare Hands';

const CLASS_ICON_EXTENSIONS: Partial<Record<MemberClass, 'png' | 'jpg'>> = {
  Greatsword: 'png',
};

export const isMemberClass = (value: unknown): value is MemberClass => (
  typeof value === 'string' && MEMBER_CLASSES.includes(value as MemberClass)
);

export const getMemberClassIconPath = (memberClass: MemberClass): string => {
  const extension = CLASS_ICON_EXTENSIONS[memberClass] ?? 'png';
  return `/assets/images/Class/${encodeURIComponent(memberClass)}.${extension}`;
};