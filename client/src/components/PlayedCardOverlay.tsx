import { CardDef } from '@shared/types';
import { getCardImageUrl } from '../utils/cardImage';

interface Props {
  card: CardDef;
  playerName: string;
}

export default function PlayedCardOverlay({ card, playerName }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className="bg-card-bg/95 backdrop-blur-sm border-2 border-accent-equip rounded-xl p-3 shadow-2xl flex flex-col items-center gap-1 animate-card-fly-in"
        style={{ animation: 'cardFlyIn 0.4s ease-out both, cardFadeOut 0.5s ease-in 1.8s both' }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} className="w-12 h-12 object-contain" />
        <span className="text-sm font-bold text-text-primary">{card.name}</span>
        <span className="text-[10px] text-text-secondary">{playerName} 打出了此牌</span>
      </div>
    </div>
  );
}
