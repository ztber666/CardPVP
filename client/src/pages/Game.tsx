import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import { CardDef, GamePhase, CostType } from '@shared/types';
import PlayerInfo from '../components/PlayerInfo';
import PlayerHand from '../components/PlayerHand';
import ActionBar from '../components/ActionBar';
import GameLog from '../components/GameLog';
import CardDetail from '../components/CardDetail';

export default function Game() {
  const { playCard, endTurn, discardCard, unequipCard, disconnect } = useSocket();
  const { gameState, player, isMyTurn } = useGameStore();

  const [selectedCard, setSelectedCard] = useState<CardDef | null>(null);
  const [detailCard, setDetailCard] = useState<CardDef | null>(null);
  const [pending, setPending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const me = gameState?.players.find(p => p.id === player?.id);
  const opponent = gameState?.players.find(p => p.id !== player?.id);

  // 显示提示（2秒自动消失）
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // 游戏结束处理
  useEffect(() => {
    if (gameState?.phase === GamePhase.GameOver) {
      const timer = setTimeout(() => setShowResult(true), 600);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase]);

  // 点击空白取消选中
  const handleBgClick = useCallback(() => {
    setSelectedCard(null);
    setDetailCard(null);
  }, []);

  // 选牌
  const handleSelectCard = useCallback((card: CardDef) => {
    if (!isMyTurn || pending || !gameState || !opponent) return;
    setSelectedCard(prev => prev?.id === card.id ? null : card);
    setDetailCard(null);
  }, [isMyTurn, pending, gameState, opponent]);

  // 显示详情
  const handleShowDetail = useCallback(() => {
    if (selectedCard) setDetailCard(selectedCard);
  }, [selectedCard]);

  // 出牌
  const handlePlayCard = useCallback(async (targetId: string) => {
    if (!selectedCard || !isMyTurn || pending) return;
    setPending(true);
    const res = await playCard(selectedCard.id, targetId);
    if (!res.success && res.error) {
      showToast(res.error);
    }
    setSelectedCard(null);
    setPending(false);
  }, [selectedCard, isMyTurn, playCard, pending, showToast]);

  // 丢弃
  const handleDiscard = useCallback(async () => {
    if (!selectedCard || pending) return;
    setPending(true);
    const res = await discardCard(selectedCard.id);
    if (!res.success && res.error) {
      showToast(res.error);
    }
    setSelectedCard(null);
    setPending(false);
  }, [selectedCard, discardCard, pending, showToast]);

  // 结束回合
  const handleEndTurn = useCallback(async () => {
    if (!isMyTurn || pending) return;
    setPending(true);
    const res = await endTurn();
    if (!res.success && res.error) {
      showToast(res.error);
    }
    setSelectedCard(null);
    setPending(false);
  }, [isMyTurn, endTurn, pending, showToast]);

  // 返回大厅
  const handleBackToLobby = useCallback(() => {
    disconnect();
    window.location.reload();
  }, [disconnect]);

  if (!gameState || !me || !opponent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-text-secondary/60">加载中...</span>
      </div>
    );
  }

  const iWin = gameState.winnerId === player?.id;
  const isActionExhausted = me.actionUsedThisTurn;

  return (
    <div className="min-h-screen flex flex-col relative" onClick={handleBgClick}>
      {/* 主内容区 - 点击空白处取消选中 */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-3 py-3 gap-2" onClick={e => e.stopPropagation()}>
        {/* ===== 对手信息 ===== */}
        <div className="animate-fade-in">
          <PlayerInfo player={opponent} isOpponent onUnequip={() => {}} />
        </div>

        {/* 对手手牌（卡背） */}
        <PlayerHand
          cards={opponent.hand}
          disabled={true}
          selectedCardId={null}
          onSelectCard={() => {}}
          hidden={true}
        />

        {/* ===== 战斗日志 ===== */}
        <GameLog log={gameState.log} />

        {/* ===== 操作按钮（选中卡牌时出现） ===== */}
        {selectedCard && isMyTurn && (
          <div
            className="bg-card-bg/80 border border-card-border rounded-xl p-2 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            {/* 选中卡牌简讯 */}
            <div className="flex items-center gap-2 mb-2 px-1">
              {(() => { const n = selectedCard.id.replace('card_', '').split('_')[0]; const ext = n === '21' ? '.gif' : '.png'; return <img src={`/assets/item/${n}${ext}`} alt="" className="w-7 h-7 object-contain" />; })()}
              <span className="text-sm font-semibold text-text-primary">{selectedCard.name}</span>
              <span className={`px-1.5 py-[1px] rounded text-[9px] font-medium ${
                selectedCard.costType === CostType.Action ? 'bg-accent-attack/15 text-accent-attack' :
                selectedCard.costType === CostType.Strategy ? 'bg-accent-equip/15 text-accent-equip' :
                selectedCard.costType === CostType.Heal ? 'bg-accent-heal/15 text-accent-heal' :
                selectedCard.costType === CostType.Equip ? 'bg-accent-equip/15 text-accent-equip' :
                selectedCard.costType === CostType.Attack ? 'bg-accent-attack/15 text-accent-attack' :
                selectedCard.costType === CostType.Buff ? 'bg-accent-buff/15 text-accent-buff' :
                selectedCard.costType === CostType.Debuff ? 'bg-purple-100 text-purple-700' :
                selectedCard.costType === CostType.Event ? 'bg-blue-100 text-blue-700' :
                'bg-accent-buff/15 text-accent-buff'
              }`}>
                {selectedCard.costType === CostType.Action ? '行动' :
                 selectedCard.costType === CostType.Strategy ? '锦囊' :
                 selectedCard.costType === CostType.Heal ? '回血' :
                 selectedCard.costType === CostType.Attack ? '攻击' :
                 selectedCard.costType === CostType.Buff ? '增益' :
                 selectedCard.costType === CostType.Debuff ? '减益' :
                 selectedCard.costType === CostType.Event ? '事件' :
                 selectedCard.costType === CostType.Equip ? '装备' :
                 selectedCard.costType === CostType.Weapon ? '武器' :
                 selectedCard.costType === CostType.Field ? '场地' :
                 selectedCard.costType === CostType.Counter ? '策略' : '其他'}
              </span>
            </div>
            {/* 按钮行 */}
            <div className="flex gap-1.5">
              <button
                onClick={handleShowDetail}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-xs font-medium hover:bg-card-bg/50 transition-colors"
              >
                📋 属性
              </button>
              {selectedCard.costType !== CostType.Equip && selectedCard.costType !== CostType.Weapon && selectedCard.costType !== CostType.Field && (
                <button
                  onClick={() => handlePlayCard(opponent.id)}
                  disabled={isActionExhausted && selectedCard.costType === CostType.Action}
                  className="flex-1 py-2 rounded-lg bg-accent-attack/15 text-accent-attack text-xs font-medium hover:bg-accent-attack/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isActionExhausted && selectedCard.costType === CostType.Action ? '本回合行动卡已用完' : ''}
                >
                  ⚔️ 对对手
                </button>
              )}
              <button
                onClick={() => handlePlayCard(me.id)}
                disabled={isActionExhausted && selectedCard.costType === CostType.Action}
                className="flex-1 py-2 rounded-lg bg-accent-heal/15 text-accent-heal text-xs font-medium hover:bg-accent-heal/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                💚 对自己
              </button>
              <button
                onClick={handleDiscard}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-xs font-medium hover:bg-red-50 hover:text-accent-attack hover:border-accent-attack/20 transition-colors"
              >
                🗑️ 丢弃
              </button>
              <button
                onClick={() => setSelectedCard(null)}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-xs font-medium hover:bg-card-bg/50 transition-colors"
              >
                ✕ 取消
              </button>
            </div>
          </div>
        )}

        {/* ===== 我的手牌 ===== */}
        <PlayerHand
          cards={me.hand}
          disabled={!isMyTurn || pending}
          selectedCardId={selectedCard?.id ?? null}
          onSelectCard={handleSelectCard}
        />

        {/* ===== 我的信息 ===== */}
        <PlayerInfo player={me} onUnequip={unequipCard} />

        {/* ===== 操作栏 ===== */}
        <ActionBar
          player={me}
          isMyTurn={isMyTurn}
          onEndTurn={handleEndTurn}
          pending={pending}
        />
      </div>


      {/* ===== 卡牌详情弹窗 ===== */}
      {detailCard && (
        <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />
      )}

      {/* ===== Toast 提示 ===== */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white border border-red-200 rounded-xl px-5 py-3 shadow-lg text-sm text-accent-attack font-medium">
            ⚠️ {toast}
          </div>
        </div>
      )}

      {/* ===== 行动耗尽提示 ===== */}
      {isActionExhausted && selectedCard && selectedCard.costType === CostType.Action && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white border border-accent-equip/30 rounded-xl px-5 py-3 shadow-lg text-sm text-accent-equip font-medium">
            ⚠️ 本回合行动卡已用完，无法使用行动卡
          </div>
        </div>
      )}

      {/* ===== 游戏结束弹窗 ===== */}
      {showResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleBgClick}>
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-4">{iWin ? '🎉' : '😢'}</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              {iWin ? '恭喜获胜！' : '战败'}
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              {iWin ? `你击败了 ${opponent.name}！` : `${opponent.name} 击败了你`}
            </p>
            <button
              onClick={handleBackToLobby}
              className="w-full py-2.5 rounded-xl bg-accent-shield/15 border border-accent-shield/25 text-accent-shield font-semibold text-sm hover:bg-accent-shield/25 transition-colors"
            >
              返回大厅
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
