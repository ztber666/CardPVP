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

export default function Game() {
  const { playCard, endTurn, discardCard, unequipCard, disconnect, guessWeight, draftPick, bucketChoice, equipChoice, brewChoice, blazeDiscard, debugDrawCard } = useSocket();
  const { gameState, player, isMyTurn } = useGameStore();

  const [selectedCard, setSelectedCard] = useState<CardDef | null>(null);
  const [detailCard, setDetailCard] = useState<CardDef | null>(null);
  const [pending, setPending] = useState(false);
  const [panelLeaving, setPanelLeaving] = useState(false);
  const lastCardRef = useRef<CardDef | null>(null); // 退出动画期间保留最后选中卡牌
  const [showResult, setShowResult] = useState(false);

  // 交互弹窗状态
  const [showGuessDialog, setShowGuessDialog] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [showEnchantDialog, setShowEnchantDialog] = useState(false);
  const [enchantableCards, setEnchantableCards] = useState<CardDef[]>([]);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftCardsList, setDraftCardsList] = useState<CardDef[]>([]);
  const [showBucketDialog, setShowBucketDialog] = useState(false);
  const [showEquipDialog, setShowEquipDialog] = useState(false);
  const [showBlazeDialog, setShowBlazeDialog] = useState(false);

  // Ref 守卫——确保弹窗只触发一次
  const shownGuess = useRef(false);
  const shownEnchant = useRef(false);
  const shownDraft = useRef(false);
  const shownBucket = useRef(false);
  const shownEquip = useRef(false);
  const shownBlaze = useRef(false);
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
    }
  }, [gameState?.phase]);

  // 取消选中（带动画）
  const doDeselect = useCallback(() => {
    if (selectedCard) lastCardRef.current = selectedCard;
    setPanelLeaving(true);
    setSelectedCard(null);
    setDetailCard(null);
    setTimeout(() => setPanelLeaving(false), 500);
  }, [selectedCard]);

  // 点击空白取消选中
  const handleBgClick = useCallback(() => {
    doDeselect();
  }, [doDeselect]);

  // 选牌（同一张牌切换时带动画取消）
  const handleSelectCard = useCallback((card: CardDef) => {
    if (!isMyTurn || pending || !gameState || !opponent) return;
    if (selectedCard?.id === card.id) {
      doDeselect();
      return;
    }
    lastCardRef.current = card;
    setSelectedCard(card);
    setDetailCard(null);
  }, [isMyTurn, pending, gameState, opponent, selectedCard, doDeselect]);

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

  // 水桶：选择封锁类型
  const handleBucketLock = useCallback(async (lockType: 'action' | 'strategy') => {
    setShowBucketDialog(false);
    setPending(true);
    await bucketChoice(lockType);
    setPending(false);
  }, [bucketChoice]);

  // 诡异钓竿：选择装备丢弃
  // 酿造台：转化卡牌
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

// 返回大厅
  const handleBackToLobby = useCallback(() => {
    disconnect();
    window.location.reload();
  }, [disconnect]);

  // 侦测器：提交猜测
  const handleGuessSubmit = useCallback(async () => {
    const guess = parseInt(guessInput);
    if (isNaN(guess) || guess < 0) {
      showToast('请输入有效数字');
      return;
    }
    setShowGuessDialog(false);
    setPending(true);
    await guessWeight(guess);
    setPending(false);
    setGuessInput('');
  }, [guessInput, guessWeight, showToast]);

  // 附魔台：选择丢弃的牌（通过 discardCard 触发 canEnchantDiscard 流程）
  const handleEnchantSelect = useCallback(async (cardId: string) => {
    setShowEnchantDialog(false);
    setEnchantableCards([]);
    setPending(true);
    await discardCard(cardId);
    setPending(false);
  }, [discardCard]);

  // 运输矿车：选牌
  const handleDraftSelect = useCallback(async (index: number) => {
    setShowDraftDialog(false);
    setDraftCardsList([]);
    setPending(true);
    await draftPick(index);
    setPending(false);
  }, [draftPick]);

  if (!gameState || !me || !opponent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-text-secondary/60">加载中...</span>
      </div>
    );
  }

  const iWin = gameState.winnerId === player?.id;

  // 根据 icon 判断卡牌子类型（回血/攻击），替代旧行动卡判断
  function getSubtypeLabel(card: CardDef): string | null {
    const parts = card.icon.split(',').map(Number);
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === 3) return '回血';
      if (parts[i] === 4) return '攻击';
    }
    return null;
  }

  function isCardExhausted(card: CardDef): boolean {
    if (!me) return true;
    // 所有行动牌（含回血/攻击类）+ 锦囊牌 → 先检查共享池
    if (card.costType === CostType.Action || card.costType === CostType.Strategy) {
      const poolLimit = 5 + (me.actionLimitBonus || 0);
      if ((me.actionStrategyCountThisTurn || 0) >= poolLimit) return true;
    }
    // 回血类/攻击类：各1张/回合（额外限制）
    const subtype = getSubtypeLabel(card);
    if (subtype === '回血') return (me.healCountThisTurn || 0) >= 1;
    if (subtype === '攻击') return (me.attackCountThisTurn || 0) >= 1;
    return false;
  }

  return (
    <div className="min-h-screen flex flex-col relative" onClick={handleBgClick}>
      {/* 全局通知 */}
      <NotificationToast />
      {/* 主内容区 */}
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
        {(() => {
          const panelCard = selectedCard || (panelLeaving ? lastCardRef.current : null);
          if (!panelCard || !isMyTurn) return null;
          return (
          <div
            className={`bg-card-bg/90 backdrop-blur-sm border border-card-border rounded-xl p-2 shadow-card ${
              panelLeaving ? 'animate-slide-down' : 'animate-slide-up'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* 选中卡牌简讯 */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <img src={getCardImageUrl(panelCard.id)} alt="" className="w-7 h-7 object-contain" />
              <span className="text-sm font-semibold text-text-primary">{panelCard.name}</span>
              {(() => {
                const subtype = getSubtypeLabel(panelCard);
                const typeLabel = subtype !== null ? subtype :
                  panelCard.costType === CostType.Strategy ? '锦囊' :
                  panelCard.costType === CostType.Equip ? '装备' :
                  panelCard.costType === CostType.Weapon ? '武器' :
                  panelCard.costType === CostType.Field ? '场地' :
                  panelCard.costType === CostType.Counter ? '策略' :
                  panelCard.costType === CostType.Buff ? '增益' :
                  panelCard.costType === CostType.Debuff ? '减益' :
                  panelCard.costType === CostType.Event ? '事件' :
                  panelCard.costType === CostType.Heal ? '回血' :
                  panelCard.costType === CostType.Attack ? '攻击' :
                  panelCard.costType === CostType.Action ? '行动' : '其他';
                const style = subtype === '回血' ? 'bg-accent-heal/15 text-accent-heal' :
                  subtype === '攻击' ? 'bg-accent-attack/15 text-accent-attack' :
                  panelCard.costType === CostType.Strategy ? 'bg-accent-equip/15 text-accent-equip' :
                  panelCard.costType === CostType.Equip || panelCard.costType === CostType.Weapon || panelCard.costType === CostType.Field ? 'bg-accent-equip/15 text-accent-equip' :
                  panelCard.costType === CostType.Counter ? 'bg-accent-shield/15 text-accent-shield' :
                  panelCard.costType === CostType.Buff ? 'bg-accent-buff/15 text-accent-buff' :
                  panelCard.costType === CostType.Debuff ? 'bg-purple-100 text-purple-700' :
                  panelCard.costType === CostType.Event ? 'bg-blue-100 text-blue-700' :
                  'bg-accent-buff/15 text-accent-buff';
                return <span className={`px-1.5 py-[1px] rounded text-[9px] font-medium ${style}`}>{typeLabel}</span>;
              })()}
            </div>
            {/* 按钮行 */}
            <div className="flex gap-1.5">
              <button
                onClick={handleShowDetail}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-xs font-medium hover:bg-card-bg/50 transition-colors"
              >
                📋 属性
              </button>
              {panelCard.costType !== CostType.Equip && panelCard.costType !== CostType.Weapon && panelCard.costType !== CostType.Field && (
                <button
                  onClick={() => handlePlayCard(opponent.id)}
                  disabled={isCardExhausted(panelCard)}
                  className="flex-1 py-2 rounded-lg bg-accent-attack/15 text-accent-attack text-xs font-medium hover:bg-accent-attack/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isCardExhausted(panelCard) ? '本回合行动/锦囊次数已用完' : ''}
                >
                  ⚔️ 对对手
                </button>
              )}
              {/* 酿造台转化：选中苹果/烟花时显示 */}
              {panelCard && (panelCard.name === '苹果' || panelCard.name === '烟花') && me?.equipment?.weapon?.name === '酿造台' && (
                <button
                  onClick={handleBrewConvert}
                  disabled={pending}
                  className="flex-1 py-2 rounded-lg bg-accent-buff/15 text-accent-buff text-xs font-medium hover:bg-accent-buff/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={panelCard.name === '苹果' ? '转化为烟花' : '转化为苹果'}
                >
                  🧪 转化
                </button>
              )}
              <button
                onClick={() => handlePlayCard(me.id)}
                disabled={isCardExhausted(panelCard)}
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
                onClick={doDeselect}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-xs font-medium hover:bg-card-bg/50 transition-colors"
              >
                ✕ 取消
              </button>
            </div>
          </div>
          );
        })()}

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
          onDebugDraw={debugDrawCard}
        />
      </div>

      {/* ===== 卡牌详情弹窗 ===== */}
      {detailCard && (
        <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />
      )}

      {/* ===== 侦测器：猜测权重弹窗 ===== */}
      {showGuessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowGuessDialog(false)}>
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">🔍 侦测器</h3>
            {me?.pendingGuessCardName && <p className="text-sm text-accent-attack font-semibold mb-1">目标卡牌：{me.pendingGuessCardName}</p>}
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

      {/* ===== 次数耗尽提示 ===== */}
      {selectedCard && isCardExhausted(selectedCard) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white border border-accent-equip/30 rounded-xl px-5 py-3 shadow-lg text-sm text-accent-equip font-medium">
            ⚠️ 本回合行动/锦囊次数已用完
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
