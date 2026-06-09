import {
  GameState, PlayerState, CardDef, GamePhase,
  GameLogEntry, PlayCardAction, BuffType,
} from './types';
import { deepClone, applyEffectToPlayer } from './buffEngine';
import { drawCards, shuffleDeck, canPlayCard, applyCard } from './cardEngine';
import { processTurnStartBuffs, processTurnEndBuffs } from './buffEngine';
import {
  DEFAULT_MAX_HP, INITIAL_DRAW_COUNT, TURN_DRAW_COUNT,
  buildTestDeck,
} from './constants';

/**
 * 游戏流程引擎 — 核心游戏循环
 */

// ===== 创建新游戏 =====
export function createGame(
  roomId: string,
  player1Id: string,
  player1Name: string,
  player2Id: string,
  player2Name: string,
): GameState {
  const p1Deck = buildTestDeck();
  const p2Deck = buildTestDeck();

  // 浅拷贝让每个玩家有自己的卡牌对象
  const player1: PlayerState = {
    id: player1Id,
    name: player1Name,
    hp: DEFAULT_MAX_HP,
    maxHp: DEFAULT_MAX_HP,
    deck: JSON.parse(JSON.stringify(p1Deck)),
    hand: [],
    discardPile: [],
    buffs: [],
    equipment: {},
    actionUsedThisTurn: false,
    strategyCountThisTurn: 0,
    poisonTriggerCountThisTurn: 0,
    handLimitBonus: 0,
    actionLimitBonus: 0,
    strategyLimitBonus: 0,
    shieldOnDiscardCount: 0,
    lastPlayedCardName: '',
    lastPlayedCardEffects: [],
    lastPlayedCardCostType: 'action' as any,
    pendingGuessCardId: '',
    pendingGuessCardWeight: 0,
    playedCardTypesThisTurn: [],
    draftCards: [],
    draftPlayerPick: 0,
    draftPickCount: 0,
    usedPhysicalHealThisTurn: 0,
    usedFireHealThisTurn: 0,
    jungleHpUpTriggered: false,
    pendingBucketChoice: '',
  };

  const player2: PlayerState = {
    id: player2Id,
    name: player2Name,
    hp: DEFAULT_MAX_HP,
    maxHp: DEFAULT_MAX_HP,
    deck: JSON.parse(JSON.stringify(p2Deck)),
    hand: [],
    discardPile: [],
    buffs: [],
    equipment: {},
    actionUsedThisTurn: false,
    strategyCountThisTurn: 0,
    poisonTriggerCountThisTurn: 0,
    handLimitBonus: 0,
    actionLimitBonus: 0,
    strategyLimitBonus: 0,
    shieldOnDiscardCount: 0,
    lastPlayedCardName: '',
    lastPlayedCardEffects: [],
    lastPlayedCardCostType: 'action' as any,
    pendingGuessCardId: '',
    pendingGuessCardWeight: 0,
    playedCardTypesThisTurn: [],
    draftCards: [],
    draftPlayerPick: 0,
    draftPickCount: 0,
    usedPhysicalHealThisTurn: 0,
    usedFireHealThisTurn: 0,
    jungleHpUpTriggered: false,
    pendingBucketChoice: '',
  };

  const state: GameState = {
    roomId,
    players: [player1, player2],
    currentTurnIndex: 0,
    turnNumber: 0,
    phase: GamePhase.Playing,
    log: [],
  };

  return state;
}

// ===== 初始化游戏（洗牌 + 摸牌 + 决定先手） =====
export function initGame(state: GameState): GameState {
  let s = deepClone(state);

  // 洗牌
  for (let i = 0; i < s.players.length; i++) {
    s.players[i] = shuffleDeck(s.players[i]);
  }

  // 各摸2张
  for (let i = 0; i < s.players.length; i++) {
    s.players[i] = drawCards(s.players[i], INITIAL_DRAW_COUNT);
  }

  // 随机先手
  s.currentTurnIndex = Math.random() < 0.5 ? 0 : 1;

  // 日志
  s.log.push({
    turnNumber: 0,
    message: `${s.players[s.currentTurnIndex].name}获得先手`,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 刷新装备状态（轮到自己回合时重新施加装备效果） =====
function refreshEquipment(player: PlayerState): PlayerState {
  let p = deepClone(player) as PlayerState;
  const slots: (keyof typeof p.equipment)[] = ['equip', 'weapon', 'field'];
  for (const slot of slots) {
    const card = p.equipment[slot];
    if (!card) continue;

    // 先移除该装备之前产生的buff
    p.buffs = p.buffs.filter(b => b.sourceCardId !== card.id);

    // 重新施加装备卡效果（刷新duration）
    for (const effect of card.effects) {
      p = applyEffectToPlayer(p, effect.buffType, effect.value, effect.duration, card.id);
    }
  }

  // 重置加成字段
  p.handLimitBonus = 0;
  p.actionLimitBonus = 0;
  p.strategyLimitBonus = 0;
  p.shieldOnDiscardCount = 0;

  // 检查场地卡加成
  if (p.equipment.field?.name === '村庄') p.handLimitBonus = 4;
  if (p.equipment.field?.name === '冰原') { p.actionLimitBonus = 1; p.strategyLimitBonus = -1; }

  return p;
}

// ===== 开始新回合 =====
export function startTurn(state: GameState): GameState {
  let s = deepClone(state);
  s.turnNumber += 1;

  const idx = s.currentTurnIndex;
  let player = s.players[idx];
  let opponent = s.players[1 - idx];

  // 当前玩家摸3张（皮革鞋子额外+1）
  const extraDraw = (p: PlayerState) => p.equipment?.equip?.name === '皮革鞋子' ? 1 : 0;
  player = drawCards(player, TURN_DRAW_COUNT + extraDraw(player));

  // 重置本回合状态
  player.actionUsedThisTurn = false;
  player.strategyCountThisTurn = 0;
  player.poisonTriggerCountThisTurn = 0;
  player.lastPlayedCardName = '';
  player.lastPlayedCardEffects = [];
  player.lastPlayedCardCostType = 'action' as any;
  player.shieldOnDiscardCount = 0;
  player.playedCardTypesThisTurn = [];
  player.pendingGuessCardId = '';
  player.pendingGuessCardWeight = 0;
  player.draftCards = [];
  player.draftPickCount = 0;
  player.usedPhysicalHealThisTurn = 0;
  player.usedFireHealThisTurn = 0;
  player.jungleHpUpTriggered = false;

  // 处理回合开始 Buff（重置中毒计数、火焰伤害灼烧等）
  player = processTurnStartBuffs(player);
  opponent = processTurnStartBuffs(opponent);

  // 刷新当前玩家的装备状态
  player = refreshEquipment(player);

  s.players[idx] = player;
  s.players[1 - idx] = opponent;

  s.log.push({
    turnNumber: s.turnNumber,
    message: `=== 第${s.turnNumber}回合 — ${player.name}的回合 ===`,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 出牌 =====
export interface PlayCardResult {
  success: boolean;
  gameState: GameState;
  error?: string;
  messages: string[];
}

export function playCard(state: GameState, action: PlayCardAction, playerId: string): PlayCardResult {
  // 校验游戏状态
  if (state.phase !== GamePhase.Playing) {
    return { success: false, gameState: state, error: '游戏未在进行中', messages: [] };
  }

  // 校验是否为当前玩家
  if (state.players[state.currentTurnIndex].id !== playerId) {
    return { success: false, gameState: state, error: '不是你的回合', messages: [] };
  }

  // 找卡牌
  const player = state.players[state.currentTurnIndex];
  const card = player.hand.find(c => c.id === action.cardId);
  if (!card) {
    return { success: false, gameState: state, error: '卡牌不在手牌中', messages: [] };
  }

  // 校验能否打出
  const targetSelf = action.targetId === playerId;
  const check = canPlayCard(player, card, targetSelf);
  if (!check.valid) {
    return { success: false, gameState: state, error: check.reason, messages: [] };
  }

  // 执行卡牌效果
  const result = applyCard(state, playerId, action.targetId, card);
  return {
    success: true,
    gameState: result.gameState,
    messages: result.logMessages,
  };
}

// ===== 结束回合 =====
export function endTurn(state: GameState): GameState {
  let s = deepClone(state);

  if (s.phase !== GamePhase.Playing) return s;

  // 处理回合结束 Buff
  for (let i = 0; i < s.players.length; i++) {
    s.players[i] = processTurnEndBuffs(s.players[i]);
  }

  // 切换玩家
  s.currentTurnIndex = 1 - s.currentTurnIndex;

  s.log.push({
    turnNumber: s.turnNumber,
    message: `${s.players[1 - s.currentTurnIndex].name}结束了回合`,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 检查胜负（外部调用用） =====
export function checkGameOver(state: GameState): { isOver: boolean; winnerId?: string } {
  for (const p of state.players) {
    if (p.hp <= 0) {
      const winner = state.players.find(pl => pl.id !== p.id);
      return { isOver: true, winnerId: winner?.id };
    }
  }
  return { isOver: false };
}

// ===== 丢弃手牌 =====
export function discardFromHand(state: GameState, playerId: string, cardId: string): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  let player = s.players[idx];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return s;

  const [removed] = player.hand.splice(cardIdx, 1);
  player.discardPile.push(removed);

  // 绑定诅咒：丢弃牌时受伤害
  const curseBuff = player.buffs.find(b => b.buffType === BuffType.DamageOnDiscard);
  if (curseBuff) {
    const dmg = curseBuff.value;
    player.hp = Math.max(0, player.hp - dmg);
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}丢弃牌时受到${dmg}点绑定诅咒伤害`,
      timestamp: Date.now(),
    });
  }

  // 下界荒地：丢弃牌时获得1点护盾（每回合限2次）
  if (player.equipment?.field?.name === '下界荒地' && player.shieldOnDiscardCount < 2) {
    player = applyEffectToPlayer(player, BuffType.Shield, 1, undefined, player.equipment.field.id);
    player.shieldOnDiscardCount += 1;
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}丢弃牌时获得1点护盾（下界荒地）`,
      timestamp: Date.now(),
    });
  }

  s.players[idx] = player;

  s.log.push({
    turnNumber: s.turnNumber,
    message: `${player.name}丢弃了${removed.name}`,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 获取对手ID =====
export function getOpponentId(state: GameState, playerId: string): string {
  return state.players.find(p => p.id !== playerId)?.id || '';
}

// ===== 卸下装备 =====
export function unequipCard(state: GameState, playerId: string, slot: string): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  const player = s.players[idx];
  const card = player.equipment[slot as keyof typeof player.equipment];
  if (!card) return s;

  delete player.equipment[slot as keyof typeof player.equipment];
  player.hand.push(card);
  // 移除该装备产生的buff
  player.buffs = player.buffs.filter(b => b.sourceCardId !== card.id);
  s.players[idx] = player;

  s.log.push({
    turnNumber: s.turnNumber,
    message: `${player.name}卸下了${card.name}`,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 侦测器：处理权重猜测 =====
export function handleGuessWeight(state: GameState, playerId: string, guessWeight: number): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  let player = s.players[idx];
  if (!player.pendingGuessCardId) {
    s.log.push({ turnNumber: s.turnNumber, message: '没有待猜测的卡牌', timestamp: Date.now() });
    return s;
  }

  const correct = guessWeight === player.pendingGuessCardWeight;
  s.log.push({
    turnNumber: s.turnNumber,
    message: `猜测权重${guessWeight}，${correct ? '猜中了！' : '猜错了（实际权重' + player.pendingGuessCardWeight + '）'}${correct ? ' 下次物理伤害×1.5' : ''}`,
    timestamp: Date.now(),
  });

  if (correct) {
    player = applyEffectToPlayer(player, BuffType.DamageBoost, 1, undefined, 'detector_boost');
  }

  player.pendingGuessCardId = '';
  player.pendingGuessCardWeight = 0;
  s.players[idx] = player;
  return s;
}

// ===== 附魔台：丢弃指定牌并触发效果 =====
export function handleEnchantDiscard(state: GameState, playerId: string, cardId: string): GameState {
  let s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  const player = s.players[idx];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) {
    s.log.push({ turnNumber: s.turnNumber, message: '附魔台：牌不在手牌中', timestamp: Date.now() });
    return s;
  }

  // 不从手牌移除（applyCard会做），直接应用效果
  const cardApplyResult = applyCard(s, playerId, playerId, player.hand[cardIdx]);
  s = cardApplyResult.gameState;

  // 摸1张牌
  const updatedPlayer = s.players.find(p => p.id === playerId);
  if (updatedPlayer) {
    const drawn = drawCards(updatedPlayer, 1);
    s.players[s.players.findIndex(p => p.id === playerId)] = drawn;
  }

  s.log.push({
    turnNumber: s.turnNumber,
    message: `附魔台触发了丢弃牌的效果并摸了1张牌`,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 运输矿车：选牌 =====
export function handleDraftPick(state: GameState, playerId: string, cardIndex: number): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  let player = s.players[idx];
  const oppIdx = 1 - idx;
  let opponent = s.players[oppIdx];

  if (!player.draftCards || player.draftCards.length === 0) {
    s.log.push({ turnNumber: s.turnNumber, message: '没有待选的牌', timestamp: Date.now() });
    return s;
  }

  if (cardIndex < 0 || cardIndex >= player.draftCards.length) return s;

  const [picked] = player.draftCards.splice(cardIndex, 1);
  // 当前玩家轮到他选时，牌归他
  if (player.draftPlayerPick === 0) {
    player.hand.push(picked);
    s.log.push({ turnNumber: s.turnNumber, message: `${player.name}选择了${picked.name}`, timestamp: Date.now() });
  } else {
    opponent.hand.push(picked);
    s.log.push({ turnNumber: s.turnNumber, message: `${opponent.name}获得了${picked.name}`, timestamp: Date.now() });
  }

  player.draftPickCount += 1;

  // 切换选牌方
  if (player.draftCards.length > 0) {
    player.draftPlayerPick = 1 - player.draftPlayerPick;
  } else {
    // 选完了
    player.draftPickCount = 0;
  }

  s.players[idx] = player;
  s.players[oppIdx] = opponent;
  return s;
}

// ===== 水桶：选择封锁类型 =====
export function handleBucketChoice(state: GameState, playerId: string, lockType: 'action' | 'strategy'): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  let player = s.players[idx];
  // 找到对手（被水桶的目标）
  const oppIdx = 1 - idx;
  let opponent = s.players[oppIdx];

  if (opponent.pendingBucketChoice !== 'pending') {
    return s;
  }

  // 海龟壳：免疫水桶封锁
  if (opponent.equipment?.equip?.name === '海龟壳') {
    opponent.pendingBucketChoice = '';
    s.log.push({ turnNumber: s.turnNumber, message: '水桶被海龟壳免疫！', timestamp: Date.now() });
    s.players[idx] = player;
    s.players[oppIdx] = opponent;
    return s;
  }

  if (lockType === 'action') {
    opponent = applyEffectToPlayer(opponent, BuffType.LockAction, 1, 2, 'bucket_lock');
    s.log.push({ turnNumber: s.turnNumber, message: `水桶封锁了${opponent.name}的行动牌`, timestamp: Date.now() });
  } else {
    opponent = applyEffectToPlayer(opponent, BuffType.LockStrategy, 1, 2, 'bucket_lock');
    s.log.push({ turnNumber: s.turnNumber, message: `水桶封锁了${opponent.name}的锦囊牌`, timestamp: Date.now() });
  }

  opponent.pendingBucketChoice = '';
  s.players[idx] = player;
  s.players[oppIdx] = opponent;
  return s;
}
