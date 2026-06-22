import { CardDef, CostType } from '@shared/types';

interface Props {
  card: CardDef;
  isMyTurn: boolean;
  pending: boolean;
  isExhausted: (card: CardDef) => boolean;
  hasBrew: boolean;
  onPlayOnOpponent: () => void;
  onPlayOnSelf: () => void;
  onDiscard: () => void;
  onDeselect: () => void;
  onBrewConvert?: () => void;
}

const isEquipType = (c: CardDef) =>
  c.costType === CostType.Equip || c.costType === CostType.Weapon || c.costType === CostType.Field;

export default function CardActionPanel({
  card, isMyTurn, pending, isExhausted, hasBrew,
  onPlayOnOpponent, onPlayOnSelf, onDiscard, onDeselect, onBrewConvert,
}: Props) {
  const exhausted = isExhausted(card);
  const btnBase = 'w-full py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="bg-card-bg/90 backdrop-blur-sm border border-card-border rounded-xl p-2 shadow-xl flex flex-col gap-1 min-w-[76px]" onClick={e => e.stopPropagation()}>
      {!isEquipType(card) && (
        <button
          onClick={onPlayOnOpponent}
          disabled={!isMyTurn || pending || exhausted}
          className={`${btnBase} bg-accent-attack/15 border border-accent-attack/25 text-accent-attack hover:bg-accent-attack/25`}
        >
          ⚔️ 对手
        </button>
      )}
      <button
        onClick={onPlayOnSelf}
        disabled={!isMyTurn || pending || exhausted}
        className={`${btnBase} bg-accent-heal/15 border border-accent-heal/25 text-accent-heal hover:bg-accent-heal/25`}
      >
        💚 自己
      </button>
      {hasBrew && onBrewConvert && (
        <button
          onClick={onBrewConvert}
          disabled={pending}
          className={`${btnBase} bg-accent-buff/15 border border-accent-buff/25 text-accent-buff hover:bg-accent-buff/25`}
        >
          🧪 转化
        </button>
      )}
      <button
        onClick={onDiscard}
        disabled={pending}
        className={`${btnBase} border border-card-border text-text-secondary hover:bg-red-50 hover:text-accent-attack`}
      >
        🗑️ 丢弃
      </button>
      <button
        onClick={onDeselect}
        className={`${btnBase} border border-card-border text-text-secondary hover:bg-card-bg/50`}
      >
        ✕ 取消
      </button>
    </div>
  );
}
