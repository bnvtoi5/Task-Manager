export interface MascotSpriteInfo {
  id: string;
  name: string;
  directions: string;
  reactions: string;
}

export const MASCOT_SPRITES: Record<string, MascotSpriteInfo> = {
  bunny: {
    id: 'bunny',
    name: 'Thỏ Tuyết',
    directions: '/mascots/bunny-directions.webp',
    reactions: '/mascots/bunny-reactions.webp',
  },
  cat: {
    id: 'cat',
    name: 'Mèo Mun',
    directions: '/mascots/cat-directions.webp',
    reactions: '/mascots/cat-reactions.webp',
  },
  fox: {
    id: 'fox',
    name: 'Cáo Lửa',
    directions: '/mascots/fox-directions.webp',
    reactions: '/mascots/fox-reactions.webp',
  },
  bear: {
    id: 'bear',
    name: 'Gấu Nâu',
    directions: '/mascots/bear-directions.webp',
    reactions: '/mascots/bear-reactions.webp',
  },
  dino: {
    id: 'dino',
    name: 'Khủng Long',
    directions: '/mascots/dino-directions.webp',
    reactions: '/mascots/dino-reactions.webp',
  },
  deer: {
    id: 'deer',
    name: 'Hươu Sao',
    directions: '/mascots/deer-directions.webp',
    reactions: '/mascots/deer-reactions.webp',
  },
  sloth: {
    id: 'sloth',
    name: 'Chú Lười',
    directions: '/mascots/sloth-directions.webp',
    reactions: '/mascots/sloth-reactions.webp',
  },
  tiger: {
    id: 'tiger',
    name: 'Hổ / Cọp',
    directions: '/mascots/tiger-directions.webp',
    reactions: '/mascots/cat-reactions.webp',
  },
};

export function getMascotSprite(spriteId?: string): MascotSpriteInfo {
  if (!spriteId) return MASCOT_SPRITES.bunny;
  const normalized = spriteId.toLowerCase().trim();
  
  if (MASCOT_SPRITES[normalized]) {
    return MASCOT_SPRITES[normalized];
  }
  
  if (normalized.includes('tho') || normalized.includes('bunny') || normalized.includes('rabbit')) {
    return MASCOT_SPRITES.bunny;
  }
  if (normalized.includes('cop') || normalized.includes('ho') || normalized.includes('tiger') || normalized.includes('president')) {
    return MASCOT_SPRITES.tiger;
  }
  if (normalized.includes('meo') || normalized.includes('cat')) {
    return MASCOT_SPRITES.cat;
  }
  if (normalized.includes('cao') || normalized.includes('fox')) {
    return MASCOT_SPRITES.fox;
  }
  if (normalized.includes('gau') || normalized.includes('bear')) {
    return MASCOT_SPRITES.bear;
  }
  if (normalized.includes('khung') || normalized.includes('dino')) {
    return MASCOT_SPRITES.dino;
  }
  if (normalized.includes('huou') || normalized.includes('deer')) {
    return MASCOT_SPRITES.deer;
  }
  if (normalized.includes('luoi') || normalized.includes('sloth')) {
    return MASCOT_SPRITES.sloth;
  }

  // Default to bunny as requested
  return MASCOT_SPRITES.bunny;
}
