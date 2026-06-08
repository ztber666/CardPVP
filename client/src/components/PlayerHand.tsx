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
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-text-secondary/40 text-xs border border-dashed border-card-border/30 rounded-lg bg-card-bg/20">
        无手牌
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-1.5 flex-wrap">
      {cards.map((card, i) => (
        <div key={card.id || i} className="transition-all duration-150">
          <CardComponent
            card={card}
            compact={!hidden}
            hidden={hidden}
            disabled={disabled}
            selected={selectedCardId === card.id}
            onClick={() => onSelectCard(card)}
          />
        </div>
      ))}
    </div>
  );
}
