import { CostType, COST_TYPE_NAMES, PlayerState } from '@shared/types';

interface Props {
  player: PlayerState;
  isMyTurn: boolean;
  onEndTurn: () => void;
  pending: boolean;
}

export default function ActionBar({ player, isMyTurn, onEndTurn, pending }: Props) {
  return (
    <div className="flex items-center justify-between">
      {/* 消耗计数 */}
      <div className="flex gap-1.5 text-[11px]">
        <span className={`px-2 py-0.5 rounded-md border
          ${player.actionUsedThisTurn
            ? 'bg-accent-attack/10 border-accent-attack/20 text-accent-attack'
            : 'bg-card-bg/60 border-card-border text-text-secondary'
          }`}
        >
          行动 {player.actionUsedThisTurn ? 1 : 0}/1
        </span>
        <span className={`px-2 py-0.5 rounded-md border
          ${player.strategyCountThisTurn >= 3
            ? 'bg-accent-equip/10 border-accent-equip/20 text-accent-equip'
            : 'bg-card-bg/60 border-card-border text-text-secondary'
          }`}
        >
          锦囊 {player.strategyCountThisTurn}/3
        </span>
      </div>

      {/* 结束回合按钮 */}
      {isMyTurn && (
        <button
          onClick={onEndTurn}
          disabled={pending}
          className="px-6 py-2 bg-accent-equip/15 border border-accent-equip/25 text-accent-equip rounded-xl font-semibold text-sm hover:bg-accent-equip/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed animate-pulse-glow"
        >
          {pending ? '处理中...' : '结束回合'}
        </button>
      )}
      {!isMyTurn && (
        <span className="text-text-secondary text-sm px-4 py-2 border border-card-border rounded-xl bg-card-bg/40">
          等待对手操作...
        </span>
      )}
    </div>
  );
}
