import { useState } from 'react';
import { CostType, COST_TYPE_NAMES, PlayerState } from '@shared/types';

interface Props {
  player: PlayerState;
  isMyTurn: boolean;
  onEndTurn: () => void;
  pending: boolean;
  onDebugDraw?: (cardId: string) => void;
}

export default function ActionBar({ player, isMyTurn, onEndTurn, pending, onDebugDraw }: Props) {
  const [showDebug, setShowDebug] = useState(false);
  const [debugInput, setDebugInput] = useState('');

  const handleDebugSubmit = () => {
    const trimmed = debugInput.trim();
    if (!trimmed || !onDebugDraw) return;
    onDebugDraw(trimmed);
    setDebugInput('');
    setShowDebug(false);
  };

  return (
    <div className="flex items-center justify-between">
      {/* 消耗计数 */}
      <div className="flex gap-1.5 text-[11px]">
        <span className={`px-2 py-0.5 rounded-md border
          ${player.healCountThisTurn >= 1
            ? 'bg-accent-heal/10 border-accent-heal/20 text-accent-heal'
            : 'bg-card-bg/60 border-card-border text-text-secondary'
          }`}
        >
          回血 {player.healCountThisTurn}/1
        </span>
        <span className={`px-2 py-0.5 rounded-md border
          ${player.attackCountThisTurn >= 1
            ? 'bg-accent-attack/10 border-accent-attack/20 text-accent-attack'
            : 'bg-card-bg/60 border-card-border text-text-secondary'
          }`}
        >
          攻击 {player.attackCountThisTurn}/1
        </span>
        <span className={`px-2 py-0.5 rounded-md border
          ${(player.actionStrategyCountThisTurn || 0) >= 5
            ? 'bg-accent-equip/10 border-accent-equip/20 text-accent-equip'
            : 'bg-card-bg/60 border-card-border text-text-secondary'
          }`}
        >
          行动/锦囊 {player.actionStrategyCountThisTurn || 0}/{5 + (player.actionLimitBonus || 0)}
        </span>
      </div>

      {/* 右侧按钮组 */}
      <div className="flex items-center gap-2">
        {/* 调试按钮 */}
        {isMyTurn && onDebugDraw && (
          <div className="relative">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-2 py-2 bg-red-100/40 border border-red-200/30 text-red-700 rounded-lg text-xs hover:bg-red-100/60 transition-all"
              title="调试摸牌"
            >
              🛠
            </button>
            {showDebug && (
              <div className="absolute bottom-full right-0 mb-2 bg-card-bg border border-card-border rounded-xl p-3 shadow-xl z-50 min-w-[180px]">
                <p className="text-[10px] text-text-secondary mb-1.5">输入卡牌编号（如 1 或 card_1）</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={debugInput}
                    onChange={e => setDebugInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDebugSubmit()}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-card-border bg-card-bg text-xs text-text-primary outline-none focus:border-accent-shield/40"
                    placeholder="例: 1 或 card_1"
                    autoFocus
                  />
                  <button
                    onClick={handleDebugSubmit}
                    className="px-2.5 py-1.5 rounded-lg bg-red-100/40 border border-red-200/30 text-red-700 text-xs hover:bg-red-100/60"
                  >
                    摸
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
    </div>
  );
}
