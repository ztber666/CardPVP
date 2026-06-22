interface Props {
  isMyTurn: boolean;
  pending: boolean;
  onEndTurn: () => void;
}

export default function ActionBar({ isMyTurn, pending, onEndTurn }: Props) {
  return (
    <button
      onClick={onEndTurn}
      disabled={!isMyTurn || pending}
      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap
        ${isMyTurn
          ? 'bg-accent-equip/15 border border-accent-equip/25 text-accent-equip hover:bg-accent-equip/25 animate-pulse-glow'
          : 'bg-gray-200/30 border border-gray-300/40 text-text-secondary/60 cursor-not-allowed'
        }
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {pending ? '处理中...' : '结束出牌'}
    </button>
  );
}
