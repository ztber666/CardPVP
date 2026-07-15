import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import { CardDef, GamePhase, CostType, COST_TYPE_NAMES } from '@shared/types';
import PlayerInfo from '../components/PlayerInfo';
import PlayerHand from '../components/PlayerHand';
import ActionBar from '../components/ActionBar';
import GameLog from '../components/GameLog';
import CardDetail from '../components/CardDetail';
import NotificationToast from '../components/NotificationToast';
import { displayMessage } from '../store/notificationStore';
import { getCardImageUrl } from '../utils/cardImage';
import SelectedCardDetail from '../components/SelectedCardDetail';
import CardActionPanel from '../components/CardActionPanel';
import ConsumptionCounter from '../components/ConsumptionCounter';
import EquipmentDisplay from '../components/EquipmentDisplay';
import PlayedCardOverlay from '../components/PlayedCardOverlay';
import DebugDrawButton from '../components/DebugDrawButton';
import GameLogPanel from '../components/GameLogPanel';
import BuffBadge from '../components/BuffBadge';

export default function Game() {
  const { playCard, endTurn, discardCard, unequipCard, disconnect, guessWeight, draftPick, bucketChoice, equipChoice, brewChoice, blazeDiscard, debugDrawCard, rematchRequest, rematchAccept, rematchDecline } = useSocket();
  const { gameState, player, isMyTurn, rematchState, rematchRequesterName, opponentDisconnected } = useGameStore();

  const [selectedCard, setSelectedCard] = useState<CardDef | null>(null);
  const [pending, setPending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showGameLog, setShowGameLog] = useState(false);
  const [handCollapsed, setHandCollapsed] = useState(false);
  const [recentPlayedCard, setRecentPlayedCard] = useState<{ card: CardDef; playerName: string; key: number } | null>(null);
  const playedCardTimer = useRef<ReturnType<typeof setTimeout>>();
  const playedCardKey = useRef(0);

  // 交互弹窗状态
  const [showGuessDialog, setShowGuessDialog] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [showEnchantDialog, setShowEnchantDialog] = useState(false);
  const [enchantableCards, setEnchantableCards] = useState<CardDef[]>([]);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftCardsList, setDraftCardsList] = useState<CardDef[]>([]);
  const [showBucketDialog, setShowBucketDialog] = useState(false);
  const [showEquipDialog, setShowEquipDialog] = useState(false);

  // Ref 守卫——确保弹窗只触发一次
  const shownGuess = useRef(false);
  const shownEnchant = useRef(false);
  const shownDraft = useRef(false);
  const shownBucket = useRef(false);
  const shownEquip = useRef(false);
  const shownEnchantReady = useRef(false);

  const me = gameState?.players.find(p => p.id === player?.id);
  const opponent = gameState?.players.find(p => p.id !== player?.id);

  // 检测需要显示的交互弹窗
  useEffect(() => {
    if (!me) return;

    // 状态清空时重置 ref（避免下次无法弹窗）
    if (!me.pendingGuessCardId) shownGuess.current = false;
    if (!opponent?.pendingBucketChoice) shownBucket.current = false;
    if (!me.draftCards?.length) shownDraft.current = false;

    // 侦测器：有待猜的牌
    if (me.pendingGuessCardId && !shownGuess.current) {
      shownGuess.current = true;
      setShowGuessDialog(true);
      setGuessInput('');
    }

    // 附魔台：日志中有"附魔台触发"提示时
    const lastLog = gameState?.log?.[gameState.log.length - 1]?.message || '';
    if (lastLog.includes('附魔台触发') && isMyTurn && !shownEnchant.current) {
      const checkTypes = [CostType.Heal, CostType.Attack, CostType.Buff, CostType.Debuff];
      const played = me.playedCardTypesThisTurn || [];
      const missingType = checkTypes.find(ct => !played.includes(ct));
      if (missingType && me.hand) {
        // 通过 icon 前缀匹配类型（costType 已不再区分回血/攻击/增益/减益/事件）
        const iconPrefixForType: Partial<Record<CostType, number>> = {
          [CostType.Heal]: 3,
          [CostType.Attack]: 4,
          [CostType.Buff]: 5,
          [CostType.Debuff]: 6,
          [CostType.Event]: 7,
        };
        const validCards = me.hand.filter(c => {
          if (c.costType === missingType) return true;
          const prefix = iconPrefixForType[missingType];
          if (prefix) {
            const parts = c.icon.split(',').map(Number);
            return parts.slice(0, -1).includes(prefix);
          }
          return false;
        });
        if (validCards.length > 0) {
          shownEnchant.current = true;
          setEnchantableCards(validCards);
          setShowEnchantDialog(true);
        }
      }
    }
    if (!lastLog.includes('请丢弃一张')) shownEnchant.current = false;

    // 运输矿车：有待选牌
    if (me.draftCards && me.draftCards.length > 0 && !shownDraft.current) {
      shownDraft.current = true;
      setDraftCardsList(me.draftCards);
      setShowDraftDialog(true);
    }
    // 运输矿车：选牌结束（draftCards 清空时关闭弹窗）
    if ((!me.draftCards || me.draftCards.length === 0) && showDraftDialog) {
      setShowDraftDialog(false);
      setDraftCardsList([]);
    }

    // 水桶：选择封锁类型
    if (me?.pendingBucketChoice === 'pending' && !shownBucket.current) {
      shownBucket.current = true;
      setShowBucketDialog(true);
    }
    if (!me?.pendingBucketChoice) shownBucket.current = false;

    // 诡异钓竿：选择装备
    if (me?.pendingEquipChoice === 'pending' && !shownEquip.current) {
      shownEquip.current = true;
      setShowEquipDialog(true);
    }
    if (!me?.pendingEquipChoice) shownEquip.current = false;

    // 运输矿车：有 draftCards 时重置 ref 让弹窗可以重新显示
    if (me.draftCards && me.draftCards.length > 0 && shownDraft.current && !showDraftDialog) {
      shownDraft.current = false;
    }

    // 附魔台：满足条件时 toast 提示
    const checkTypes = [CostType.Heal, CostType.Attack, CostType.Buff, CostType.Debuff, CostType.Event];
    const played = me.playedCardTypesThisTurn || [];
    const matchedCount = checkTypes.filter(ct => played.includes(ct)).length;
    const hasEnchantInHand = me.hand.some(c => c.name === '附魔台');
    if (hasEnchantInHand && matchedCount >= 4 && !shownEnchantReady.current) {
      shownEnchantReady.current = true;
      displayMessage('满足附魔台打出条件');
    }
    if (!hasEnchantInHand || matchedCount < 4) shownEnchantReady.current = false;
  }, [me, opponent, gameState, isMyTurn, showDraftDialog]);

  // 显示提示（3秒自动消失）
  const showToast = useCallback((msg: string) => {
    displayMessage(msg);
  }, []);

  // 游戏结束处理
  useEffect(() => {
    if (gameState?.phase === GamePhase.GameOver) {
      const timer = setTimeout(() => setShowResult(true), 600);
      return () => clearTimeout(timer);
    } else {
      setShowResult(false);
    }
  }, [gameState?.phase]);

  // 取消选中
  const doDeselect = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const toggleHand = useCallback(() => {
  setHandCollapsed(prev => {
    if (prev) {
      // 展开时不清除选中
    } else {
      setSelectedCard(null); // 收起时取消选中
    }
    return !prev;
  });
}, []);

  // 点击空白取消选中
  const handleAreaClick = useCallback(() => {
    setSelectedCard(null);
  }, []);

  // 回合开始时自动展开手牌
  const prevTurnRef = useRef(isMyTurn);
useEffect(() => {
  if (isMyTurn && !prevTurnRef.current) {
    setHandCollapsed(false); // 回合开始自动展开手牌
  }
  prevTurnRef.current = isMyTurn;
}, [isMyTurn]);

  // 出牌动画（双方）
  useEffect(() => {
    if (!opponent?.lastPlayedCardDef?.length || isMyTurn) return;
    const latest = opponent.lastPlayedCardDef[opponent.lastPlayedCardDef.length - 1];
    if (latest?.name) {
      playedCardKey.current += 1;
      setRecentPlayedCard({ card: latest, playerName: opponent.name, key: playedCardKey.current });
      if (playedCardTimer.current) clearTimeout(playedCardTimer.current);
      playedCardTimer.current = setTimeout(() => setRecentPlayedCard(null), 2200);
    }
  }, [opponent?.lastPlayedCardDef?.length, me?.lastPlayedCardDef?.length]);

  // 选牌
  const handleSelectCard = useCallback((card: CardDef) => {
    if (!isMyTurn || pending || !gameState || !opponent) return;
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }, [isMyTurn, pending, gameState, opponent]);

  // 出牌
  const handlePlayCard = useCallback(async (targetId: string) => {
    if (!selectedCard || !isMyTurn || pending) return;
    setPending(true);
    const res = await playCard(selectedCard.id, targetId);
    if (!res.success && res.error) showToast(res.error);
    setSelectedCard(null);
    setPending(false);
  }, [selectedCard, isMyTurn, playCard, pending, showToast]);

  // 丢弃
  const handleDiscard = useCallback(async () => {
    if (!selectedCard || pending) return;
    setPending(true);
    const res = await discardCard(selectedCard.id);
    if (!res.success && res.error) showToast(res.error);
    setSelectedCard(null);
    setPending(false);
  }, [selectedCard, discardCard, pending, showToast]);

  // 结束回合
  const handleEndTurn = useCallback(async () => {
    if (!isMyTurn || pending) return;
    setPending(true);
    const res = await endTurn();
    if (!res.success && res.error) showToast(res.error);
    setSelectedCard(null);
    setPending(false);
  }, [isMyTurn, endTurn, pending, showToast]);

  // 水桶
  const handleBucketLock = useCallback(async (lockType: 'action' | 'strategy') => {
    setShowBucketDialog(false);
    setPending(true);
    await bucketChoice(lockType);
    setPending(false);
  }, [bucketChoice]);

  // 酿造台转化
  const handleBrewConvert = useCallback(async () => {
    if (!selectedCard) return;
    setPending(true);
    await brewChoice(selectedCard.id);
    setSelectedCard(null);
    setPending(false);
  }, [selectedCard, brewChoice]);

  const handleEquipSelect = useCallback(async (slot: string) => {
    setShowEquipDialog(false);
    setPending(true);
    await equipChoice(slot);
    setPending(false);
  }, [equipChoice]);

  // 回大厅
  const handleBackToLobby = useCallback(() => {
    disconnect();
    window.location.reload();
  }, [disconnect]);

  // 再战
  const [rematchPending, setRematchPending] = useState(false);
  const handleRematchRequest = useCallback(async () => {
    setRematchPending(true);
    const res = await rematchRequest();
    setRematchPending(false);
    if (res.success) {
      useGameStore.getState().setRematchState('requested');
    } else {
      showToast(res.error || '请求失败');
    }
  }, [rematchRequest, showToast]);

  const handleRematchAccept = useCallback(async () => {
    await rematchAccept();
  }, [rematchAccept]);

  const handleRematchDecline = useCallback(async () => {
    await rematchDecline();
  }, [rematchDecline]);

  // 侦测器
  const handleGuessSubmit = useCallback(async () => {
    const guess = parseInt(guessInput);
    if (isNaN(guess) || guess < 0) { showToast('请输入有效数字'); return; }
    setShowGuessDialog(false);
    setPending(true);
    await guessWeight(guess);
    setPending(false);
    setGuessInput('');
  }, [guessInput, guessWeight, showToast]);

  // 附魔台选牌
  const handleEnchantSelect = useCallback(async (cardId: string) => {
    setShowEnchantDialog(false);
    setEnchantableCards([]);
    setPending(true);
    await discardCard(cardId);
    setPending(false);
  }, [discardCard]);

  // 运输矿车
  const handleDraftSelect = useCallback(async (index: number) => {
    setShowDraftDialog(false);
    setDraftCardsList([]);
    setPending(true);
    await draftPick(index);
    setPending(false);
  }, [draftPick]);

  if (!gameState || !me || !opponent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg">
        <span className="text-text-secondary/60">加载中...</span>
      </div>
    );
  }

  const iWin = gameState.winnerId === player?.id;

  function isCardExhausted(card: CardDef): boolean {
    if (!me) return true;
    if (card.costType === CostType.Action || card.costType === CostType.Strategy) {
      const poolLimit = 5 + (me.actionLimitBonus || 0);
      if ((me.actionStrategyCountThisTurn || 0) >= poolLimit) return true;
    }
    return false;
  }

  const hasBrew = !!(selectedCard && (selectedCard.name === '苹果' || selectedCard.name === '烟花') &&
    me?.equipment?.weapon?.name === '酿造台');

  return (
    <div className="h-screen flex flex-col bg-page-bg overflow-hidden" onClick={handleAreaClick}>
      <NotificationToast />

      {/* ===== 新增：对手掉线遮罩 ===== */}
        {opponentDisconnected && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none">
                <div className="text-5xl mb-4 animate-bounce">⚠️</div>
                <div className="text-2xl font-bold mb-2">对手已断开连接</div>
                <div className="text-sm opacity-80">等待对方重连中...</div>
            </div>
      )}

      {/* 顶部对手栏 */}
<div className="flex items-center justify-between h-12 shrink-0 px-4 border-b border-card-border/30 bg-page-dark/20" onClick={e => e.stopPropagation()}>
  <div className="flex items-center gap-2">
    <PlayerInfo player={opponent} isOpponent />
    <span className="text-xs">🃏</span>
    <span className="text-xs font-semibold text-text-primary tabular-nums">{opponent.hand.length}</span>
  </div>
    <button onClick={() => setShowGameLog(true)} className="text-[10px] text-text-secondary hover:text-text-primary px-1.5 py-0.5 rounded border border-card-border/30">📋 记录</button>
</div>


      {/* 对手装备区 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 overflow-hidden p-2" onClick={e => e.stopPropagation()}>
        <EquipmentDisplay equipment={opponent.equipment} isOpponent />
        <div className="flex items-center gap-1 flex-wrap">
          {opponent.buffs.map((buff, i) => <BuffBadge key={`${buff.buffType}-${i}`} buff={buff} compactMode={opponent.buffs.length > 4} />)}
        </div>
        {recentPlayedCard && <PlayedCardOverlay key={recentPlayedCard.key} card={recentPlayedCard.card} playerName={recentPlayedCard.playerName} />}
      </div>

      {/* 中间操作区 */}
      <div className="flex items-center justify-center gap-4 h-14 shrink-0 border-y border-card-border/20 bg-page-dark/10 px-4" onClick={e => e.stopPropagation()}>
        <ActionBar isMyTurn={isMyTurn} onEndTurn={handleEndTurn} pending={pending} />
        {isMyTurn && <DebugDrawButton onDebugDraw={debugDrawCard} />}
        {isMyTurn && <ConsumptionCounter player={me} />}
      </div>

      {/* 我方装备区 */}
      {/* 修改：添加 relative 和动态 z-index，手牌收起时 z-40 保证可点击，展开时 z-10 保证手牌在上层 */}
      <div 
        className={`flex-1 flex flex-col items-center justify-center gap-2 overflow-hidden p-2 relative ${handCollapsed ? 'z-40' : 'z-10'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 flex-wrap">
          {me.buffs.map((buff, i) => <BuffBadge key={`${buff.buffType}-${i}`} buff={buff} compactMode={me.buffs.length > 4} />)}
        </div>
        <EquipmentDisplay equipment={me.equipment} onUnequip={unequipCard} />
      </div>

      {/* ===== 底部：手牌区 + 玩家信息栏（一体化） ===== */}
      {/* 修改：底部容器 z-index 保持为 30 */}
      <div className="shrink-0 relative z-30" onClick={e => e.stopPropagation()}>
        {/* 手牌区 — 绝对定位在玩家信息栏正上方 */}
        <div className="absolute bottom-full left-0 right-0">
          <PlayerHand
            cards={me.hand}
            disabled={!isMyTurn || pending}
            selectedCardId={selectedCard?.id ?? null}
            onSelectCard={handleSelectCard}
            collapsed={handCollapsed}
            onToggle={toggleHand}
          />
        </div>

      {/* 玩家信息栏 */}
      <div className="flex items-center justify-between py-2 px-3 bg-page-bg/95 backdrop-blur-sm border-t border-card-border/20">
      <div className="flex items-center gap-2">
      <PlayerInfo player={me} />
      {/* 重新设计的手牌数按钮 — 兼具展开/收起功能 */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleHand(); }}
        className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all duration-300 shadow-sm
          ${me.hand.length >= 7
            ? (handCollapsed
              ? 'bg-red-100/80 border-red-300/60 text-accent-attack hover:bg-red-200/80'
              : 'bg-red-50/60 border-red-300/40 text-accent-attack')
            : handCollapsed
              ? 'bg-gradient-to-br from-accent-shield/15 to-accent-shield/5 border-accent-shield/40 text-accent-shield hover:from-accent-shield/25 hover:to-accent-shield/10 hover:border-accent-shield/60'
              : 'bg-card-bg/70 border-card-border/50 text-text-primary hover:bg-card-bg hover:border-card-border'
          }`}
        title={handCollapsed ? '展开手牌' : '收起手牌'}
      >
        <span className="text-sm leading-none">🃏</span>
        <span className="text-xs font-bold tabular-nums">{me.hand.length}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${handCollapsed ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  </div> 
</div>

      {/* ===== 固定覆盖层 ===== */}

      {/* 选中牌图鉴（左上） */}
      {selectedCard && (
        <div className="fixed right-2 top-12 z-40" onClick={e => e.stopPropagation()}>
          <SelectedCardDetail card={selectedCard} />
        </div>
      )}

      {/* 操作按钮（右边缘竖列） */}
      {selectedCard && isMyTurn && (
        <div className="fixed right-2 top-1/2 -translate-y-1/2 z-40" onClick={e => e.stopPropagation()}>
          <div className="animate-fade-in">
            <CardActionPanel card={selectedCard} isMyTurn={isMyTurn} pending={pending}
            isExhausted={isCardExhausted} hasBrew={hasBrew}
            onPlayOnOpponent={() => handlePlayCard(opponent.id)}
            onPlayOnSelf={() => handlePlayCard(me.id)}
            onDiscard={handleDiscard} onDeselect={doDeselect}
            onBrewConvert={handleBrewConvert} />
          </div>
        </div>
      )}

      {/* 次数耗尽提示 */}
      {selectedCard && isCardExhausted(selectedCard) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="bg-white border border-accent-equip/30 rounded-xl px-5 py-3 shadow-lg text-sm text-accent-equip font-medium">⚠️ 本回合行动/锦囊次数已用完</div>
        </div>
      )}

      {/* 对局日志面板 */}
      {showGameLog && <GameLogPanel log={gameState.log} onClose={() => setShowGameLog(false)} />}

      {/* ===== 游戏结束弹窗 ===== */}
      {showResult && gameState?.phase === GamePhase.GameOver && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleAreaClick}>
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-4">{iWin ? '🎉' : '😢'}</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">{iWin ? '恭喜获胜！' : '战败'}</h2>
            <p className="text-text-secondary text-sm mb-6">{iWin ? `你击败了 ${opponent.name}！` : `${opponent.name} 击败了你`}</p>
            <div className="flex gap-2">
              {rematchState === 'requested' ? (
                <button disabled className="flex-1 py-2.5 rounded-xl bg-accent-equip/15 border border-accent-equip/25 text-accent-equip font-semibold text-sm opacity-60 cursor-not-allowed">
                  ⏳ 等待对方接受...
                </button>
              ) : (
                <button onClick={handleRematchRequest} disabled={rematchPending} className="flex-1 py-2.5 rounded-xl bg-accent-equip/15 border border-accent-equip/25 text-accent-equip font-semibold text-sm hover:bg-accent-equip/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {rematchPending ? '⏳' : '⚔️'} 再战
                </button>
              )}
              <button onClick={handleBackToLobby} className="flex-1 py-2.5 rounded-xl bg-accent-shield/15 border border-accent-shield/25 text-accent-shield font-semibold text-sm hover:bg-accent-shield/25 transition-colors">返回大厅</button>
            </div>
            {rematchState === 'declined' && (
              <p className="text-xs text-accent-attack/70 mt-3 animate-fade-in">对方拒绝了再战请求</p>
            )}
          </div>
        </div>
      )}

      {/* ===== 侦测器：猜测权重弹窗 ===== */}
      {showGuessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowGuessDialog(false)}>
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">🔍 侦测器</h3>
            {me?.pendingGuessCardName && <p className="text-sm text-accent-attack font-semibold mb-1">随机选择了一张卡牌</p>}
            <p className="text-sm text-text-secondary mb-4">猜测这张牌在牌组中的权重：</p>
            <input
              type="number"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuessSubmit()}
              className="w-full bg-card-bg border border-card-border rounded-xl px-4 py-3 text-text-primary text-center text-lg font-bold outline-none focus:border-accent-shield/50 mb-4"
              placeholder="输入数字"
              autoFocus
              min={0}
              max={50}
            />
            <div className="flex gap-2">
              <button onClick={handleGuessSubmit} className="flex-1 py-2.5 rounded-xl bg-accent-shield/15 border border-accent-shield/25 text-accent-shield font-semibold text-sm hover:bg-accent-shield/25">
                ✅ 确认
              </button>
              <button onClick={() => setShowGuessDialog(false)} className="flex-1 py-2.5 rounded-xl border border-card-border text-text-secondary text-sm hover:bg-card-bg/50">
                ✕ 取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 附魔台：选牌弹窗 ===== */}
      {showEnchantDialog && enchantableCards.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowEnchantDialog(false)}>
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">⚗️ 附魔台</h3>
            <p className="text-sm text-text-secondary mb-4">选择一张牌丢弃并触发其效果：</p>
            <div className="space-y-2">
              {enchantableCards.map(card => {
                return (
                  <button
                    key={card.id}
                    onClick={() => handleEnchantSelect(card.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-card-border hover:border-accent-shield/40 transition-colors hover:bg-card-bg/50 text-left"
                  >
                    <img src={getCardImageUrl(card.id)} alt="" className="w-8 h-8 object-contain" />
                    <div>
                      <span className="text-sm font-semibold text-text-primary">{card.name}</span>
                      <span className="text-xs text-text-secondary ml-2">{COST_TYPE_NAMES[card.costType]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowEnchantDialog(false)}
              className="w-full mt-4 py-2.5 rounded-xl border border-card-border text-text-secondary text-sm hover:bg-card-bg/50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ===== 水桶：选择封锁类型弹窗 ===== */}
      {showBucketDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-xs w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">🪣 水桶</h3>
            <p className="text-sm text-text-secondary mb-4">选择要封锁的类型：</p>
            <div className="flex gap-3">
              <button onClick={() => handleBucketLock('action')} className="flex-1 py-3 rounded-xl bg-accent-attack/15 border border-accent-attack/25 text-accent-attack font-semibold text-sm hover:bg-accent-attack/25">
                🗡️ 行动牌
              </button>
              <button onClick={() => handleBucketLock('strategy')} className="flex-1 py-3 rounded-xl bg-accent-equip/15 border border-accent-equip/25 text-accent-equip font-semibold text-sm hover:bg-accent-equip/25">
                🎯 锦囊牌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 诡异钓竿：选择装备弹窗 ===== */}
      {showEquipDialog && opponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-xs w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">🎣 诡异钓竿</h3>
            <p className="text-sm text-text-secondary mb-4">选择要丢弃的装备：</p>
            <div className="space-y-2">
              {(['equip', 'weapon', 'field'] as const).map(slot => {
                const item = opponent.equipment[slot];
                if (!item) return null;
                return (
                  <button key={slot} onClick={() => handleEquipSelect(slot)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-card-border hover:border-accent-attack/40 transition-colors hover:bg-card-bg/50 text-left"
                  >
                    <img src={getCardImageUrl(item.id)} alt="" className="w-8 h-8 object-contain" />
                    <div>
                      <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                      <span className="text-xs text-text-secondary ml-2">{slot === 'equip' ? '装备' : slot === 'weapon' ? '武器' : '场地'}</span>
                    </div>
                  </button>
                );
              })}
              {(!opponent.equipment.equip && !opponent.equipment.weapon && !opponent.equipment.field) && (
                <p className="text-sm text-text-secondary text-center py-4">目标没有任何装备</p>
              )}
            </div>
            <button onClick={() => setShowEquipDialog(false)} className="w-full mt-4 py-2.5 rounded-xl border border-card-border text-text-secondary text-sm hover:bg-card-bg/50">
              取消   
            </button>
          </div>
        </div>
      )}

            {/* ===== 运输矿车：选牌弹窗 ===== */}
      {showDraftDialog && draftCardsList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowDraftDialog(false)}>
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">🚂 运输矿车</h3>
            <p className="text-sm text-text-secondary mb-4">选择一张牌加入手牌：</p>
            <p className="text-xs text-accent-shield mb-2">{me?.draftPlayerPick === 0 ? "轮到出牌方选牌" : "轮到对手选牌"}</p>
            <div className="grid grid-cols-2 gap-2">
              {draftCardsList.map((card, idx) => {
                const isPicked = me?.draftPickedBy && me.draftPickedBy[idx];
                const pickerName = isPicked ? me.draftPickedBy[idx] : null;
                return (
                  <button
                    key={idx}
                    onClick={() => handleDraftSelect(idx)}
                    disabled={!!isPicked || !((me?.draftPlayerPick === 0 && isMyTurn) || (me?.draftPlayerPick === 1 && !isMyTurn))}
                    className={'flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ' + (isPicked ? 'border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-card-border hover:border-accent-shield/40 hover:bg-card-bg/50')}
                  >
                    <img src={getCardImageUrl(card.id)} alt="" className="w-10 h-10 object-contain" />
                    <span className="text-xs font-semibold text-text-primary text-center">{card.name}</span>
                    {pickerName && <span className="text-[9px] text-text-secondary">{pickerName} 已选</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== 再战邀请弹窗 ===== */}
      {rematchState === 'invited' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl text-center">
            <div className="text-4xl mb-3">⚔️</div>
            <h3 className="text-lg font-bold text-text-primary mb-2">再战邀请</h3>
            <p className="text-sm text-text-secondary mb-6">
              {rematchRequesterName ? `${rematchRequesterName} ` : '对方'}请求再来一局！
            </p>
            <div className="flex gap-3">
              <button onClick={handleRematchAccept} className="flex-1 py-2.5 rounded-xl bg-accent-heal/15 border border-accent-heal/25 text-accent-heal font-semibold text-sm hover:bg-accent-heal/25 transition-colors">
                ✅ 接受
              </button>
              <button onClick={handleRematchDecline} className="flex-1 py-2.5 rounded-xl border border-card-border text-text-secondary text-sm hover:bg-card-bg/50 transition-colors">
                ✕ 拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 次数耗尽提示 ===== */}
      {selectedCard && isCardExhausted(selectedCard) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white border border-accent-equip/30 rounded-xl px-5 py-3 shadow-lg text-sm text-accent-equip font-medium">
            ⚠️ 本回合行动/锦囊次数已用完
          </div>
        </div>
      )}
    </div>
  );
}
