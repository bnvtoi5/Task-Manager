import React from 'react';
import { Mascot } from 'page-mascot';
import { getMascotSprite, MASCOT_SPRITES } from './mascotSprites';
import { MascotPersona } from './mascotPersonas';

interface MascotSpriteAvatarProps {
  persona?: MascotPersona;
  spriteId?: string;
  size?: number;
  interactive?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function resolveSpriteIdForPersona(
  persona?: Partial<MascotPersona>,
  spriteId?: string
): string {
  if (spriteId && MASCOT_SPRITES[spriteId]) return spriteId;
  if (persona?.defaultSpriteId && MASCOT_SPRITES[persona.defaultSpriteId]) {
    return persona.defaultSpriteId;
  }

  // Check category or categoryLabel
  const cat = (persona?.categoryLabel || persona?.category || '').toLowerCase();
  if (cat.includes('hổ') || cat.includes('cọp') || cat.includes('tiger')) return 'tiger';
  if (cat.includes('mèo') || cat.includes('cat') || cat.includes('neko')) return 'cat';
  if (cat.includes('cáo') || cat.includes('fox')) return 'fox';
  if (cat.includes('gấu') || cat.includes('bear')) return 'bear';
  if (
    cat.includes('khủng long') ||
    cat.includes('dino') ||
    cat.includes('long') ||
    cat.includes('rồng')
  ) {
    return 'dino';
  }
  if (cat.includes('hươu') || cat.includes('deer')) return 'deer';
  if (cat.includes('lười') || cat.includes('sloth')) return 'sloth';
  if (cat.includes('thỏ') || cat.includes('bunny') || cat.includes('rabbit')) return 'bunny';

  // Check persona ID
  const id = (persona?.id || '').toLowerCase();
  if (
    id.startsWith('tiger') ||
    id === 'president' ||
    id === 'emperor' ||
    id === 'badboy' ||
    id === 'marshal'
  ) {
    return 'tiger';
  }
  if (
    id.startsWith('cat') ||
    id === 'cat_tsundere' ||
    id === 'cat_maid' ||
    id === 'cat_butler' ||
    id === 'cat_yandere'
  ) {
    return 'cat';
  }
  if (
    id.startsWith('fox') ||
    id === 'fox_scholar' ||
    id === 'fox_detective' ||
    id === 'fox_spirit' ||
    id === 'fox_ninja'
  ) {
    return 'fox';
  }
  if (
    id.startsWith('bear') ||
    id === 'bear_delinquent' ||
    id === 'bear_bodyguard' ||
    id === 'bear_gladiator' ||
    id === 'bear_chef'
  ) {
    return 'bear';
  }
  if (
    id.startsWith('dino') ||
    id === 'dino_dragon' ||
    id === 'dino_baby' ||
    id === 'dino_mecha' ||
    id === 'dino_alien'
  ) {
    return 'dino';
  }
  if (
    id.startsWith('deer') ||
    id === 'deer_doctor' ||
    id === 'deer_prince' ||
    id === 'deer_fairy' ||
    id === 'deer_poet'
  ) {
    return 'deer';
  }
  if (
    id.startsWith('sloth') ||
    id === 'sloth_sensei' ||
    id === 'sloth_philosopher' ||
    id === 'sloth_hacker' ||
    id === 'sloth_zen'
  ) {
    return 'sloth';
  }
  if (id.startsWith('bunny')) return 'bunny';

  // Check persona Name or tagline or emoji
  const text = `${persona?.name || ''} ${persona?.tagline || ''} ${
    persona?.emoji || ''
  }`.toLowerCase();
  if (
    text.includes('hổ') ||
    text.includes('cọp') ||
    text.includes('🐯') ||
    text.includes('chúa sơn lâm') ||
    text.includes('tổng tài') ||
    text.includes('vương gia') ||
    text.includes('hoàng thượng') ||
    text.includes('soái ca')
  ) {
    return 'tiger';
  }
  if (
    text.includes('mèo') ||
    text.includes('🐱') ||
    text.includes('meow') ||
    text.includes('neko') ||
    text.includes('tsundere') ||
    text.includes('hầu gái') ||
    text.includes('yandere')
  ) {
    return 'cat';
  }
  if (
    text.includes('cáo') ||
    text.includes('🦊') ||
    text.includes('hồ ly') ||
    text.includes('học bá') ||
    text.includes('thám tử') ||
    text.includes('tiên cáo') ||
    text.includes('ninja')
  ) {
    return 'fox';
  }
  if (
    text.includes('gấu') ||
    text.includes('🐻') ||
    text.includes('đầu gấu') ||
    text.includes('vệ sĩ') ||
    text.includes('đấu sĩ') ||
    text.includes('bếp trưởng')
  ) {
    return 'bear';
  }
  if (
    text.includes('khủng long') ||
    text.includes('dino') ||
    text.includes('🦖') ||
    text.includes('rồng') ||
    text.includes('🐉') ||
    text.includes('chiến binh rồng') ||
    text.includes('mecha') ||
    text.includes('người ngoài hành tinh')
  ) {
    return 'dino';
  }
  if (
    text.includes('hươu') ||
    text.includes('nai') ||
    text.includes('🦌') ||
    text.includes('bác sĩ') ||
    text.includes('bạch mã') ||
    text.includes('hoàng tử') ||
    text.includes('tiên rừng') ||
    text.includes('thi sĩ')
  ) {
    return 'deer';
  }
  if (
    text.includes('lười') ||
    text.includes('🦥') ||
    text.includes('sensei') ||
    text.includes('triết gia') ||
    text.includes('hacker') ||
    text.includes('thiền sư')
  ) {
    return 'sloth';
  }
  if (
    text.includes('thỏ') ||
    text.includes('🐰') ||
    text.includes('bunny') ||
    text.includes('idol') ||
    text.includes('thần tượng')
  ) {
    return 'bunny';
  }

  return 'bunny';
}

export const MascotSpriteAvatar: React.FC<MascotSpriteAvatarProps> = ({
  persona,
  spriteId,
  size = 40,
  interactive = false,
  className = '',
  onClick,
}) => {
  const chosenSpriteId = resolveSpriteIdForPersona(persona, spriteId);
  const sprite = getMascotSprite(chosenSpriteId);

  if (interactive) {
    return (
      <div
        className={`inline-flex items-center justify-center select-none bg-transparent filter drop-shadow-sm ${className}`}
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        <Mascot
          directions={sprite.directions}
          reactions={sprite.reactions}
          size={size}
        />
      </div>
    );
  }

  // 100% Transparent Mascot Avatar (NO BOX, NO BORDER, NO BACKGROUND)
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${sprite.directions}")`,
        backgroundSize: '300% 300%',
        backgroundPosition: '50% 50%',
        backgroundRepeat: 'no-repeat',
      }}
      className={`shrink-0 select-none bg-transparent filter drop-shadow-sm transition-transform duration-200 ${className}`}
      title={persona?.name || sprite.name}
    />
  );
};
