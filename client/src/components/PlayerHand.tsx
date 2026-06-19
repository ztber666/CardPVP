import { useRef, useState, useEffect } from 'react';
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
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      setScrollState({
        left: el.scrollLeft > 2,
        right: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
      });
    };

    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      observer.disconnect();
    };
  }, [cards.length]);

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-text-secondary/40 text-xs border border-dashed border-card-border/30 rounded-lg bg-card-bg/20">
        无手牌
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto flex-nowrap pt-5 pb-1
          [-webkit-overflow-scrolling:touch]"
      >
        {cards.map((card, i) => (
          <div key={card.id || i} className="shrink-0 transition-ios animate-card-enter"
               style={{ animationDelay: `${i * 0.05}s` }}>
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
      {/* 左边缘淡出 — 有左侧隐藏牌时显示 */}
      <div
        className={`absolute left-0 top-0 bottom-1 w-8 bg-gradient-to-r from-page-bg to-transparent pointer-events-none transition-opacity duration-500 ease-out ${
          scrollState.left ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* 右边缘淡出 — 有右侧隐藏牌时显示 */}
      <div
        className={`absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-page-bg to-transparent pointer-events-none transition-opacity duration-500 ease-out ${
          scrollState.right ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
