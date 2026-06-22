import { useRef } from 'react';
import { CardDef } from '@shared/types';
import CardComponent from './Card';

interface Props {
  cards: CardDef[];
  disabled: boolean;
  selectedCardId: string | null;
  onSelectCard: (card: CardDef) => void;
  hidden?: boolean;
}

export default function PlayerHand({ cards, disabled, selectedCardId, onSelectCard, hidden }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (cards.length === 0) {
    return <div className="text-text-secondary/40 text-xs p-4 text-center">无手牌</div>;
  }

  return (
    <div className="relative">
      <div ref={scrollRef} style={{ scrollbarWidth: 'none' }}
        className="flex gap-1 overflow-x-auto overflow-y-hidden flex-nowrap pt-4 pb-1 [-webkit-overflow-scrolling:touch]">
        {cards.map((card, i) => (
          <div key={card.id || i} className="shrink-0 transition-ios">
            <CardComponent card={card} compact={!hidden} hidden={hidden}
              disabled={disabled} selected={selectedCardId === card.id}
              onClick={() => onSelectCard(card)} />
          </div>
        ))}
      </div>
    </div>
  );
}
