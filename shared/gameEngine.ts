import {
  GameState, PlayerState, CardDef, GamePhase,
  GameLogEntry, PlayCardAction, BuffType,
} from './types';
import { deepClone, applyEffectToPlayer, getBuffStacks } from './buffEngine';
import { drawCards, shuffleDeck, canPlayCard, applyCard, damage, DamageType } from './cardEngine';
import { processTurnStartBuffs, processTurnEndBuffs } from './buffEngine';
import {
  DEFAULT_MAX_HP, INITIAL_DRAW_COUNT, TURN_DRAW_COUNT,
  buildTestDeck, CARDS,
} from './constants';

// ===== 游戏创建 =====
export function createGame(
  roomId: string,
  p1Id: string, p1Name: string,
  p2Id: string, p2Name: string
): GameState {
  return {
    roomId,
    players: [
      {
        id: p1Id, name: p1Name,
        hp: DEFAULT_MAX_HP, maxHp: DEFAULT_MAX_HP,
        deck: shuffleDeck({ deck: buildTestDeck(), hand: [], discardPile: [], buffs: [], equipment: {} } as any).deck,
        hand: [], discardPile: [], buffs: [],
        equipment: {},
        healCountThisTurn: 0,
        attackCountThisTurn: 0,
        actionStrategyCountThisTurn: 0,
        poisonTriggerCountThisTurn: 0,
        handLimitBonus: 0,
        actionLimitBonus: 0,
        shieldOnDiscardCount: 0,
        lastPlayedCardDef: [],
        lastPlayedCardName: '',
        lastPlayedCardEffects: [],
        lastPlayedCardCostType: 'action' as any,
        causePhysicalDamage: false,
        canEnchantDiscard: false,
        pendingGuessCardId: '',
        pendingGuessCardWeight: 0,
    pendingGuessCardName: '',
        playedCardTypesThisTurn: [],
        draftCards: [],
        draftPlayerPick: 0,
        draftPickCount: 0,
        draftPickedBy: {},
        usedPhysicalHealThisTurn: 0,
        usedFireHealThisTurn: 0,
        jungleHpUpTriggered: false,
        pendingBucketChoice: '',
        pendingEquipChoice: '',
      },
      {
        id: p2Id, name: p2Name,
        hp: DEFAULT_MAX_HP, maxHp: DEFAULT_MAX_HP,
        deck: shuffleDeck({ deck: buildTestDeck(), hand: [], discardPile: [], buffs: [], equipment: {} } as any).deck,
        hand: [], discardPile: [], buffs: [],
        equipment: {},
        healCountThisTurn: 0,
        attackCountThisTurn: 0,
        actionStrategyCountThisTurn: 0,
        poisonTriggerCountThisTurn: 0,
        handLimitBonus: 0,
        actionLimitBonus: 0,
        shieldOnDiscardCount: 0,
        lastPlayedCardDef: [],
        lastPlayedCardName: '',
        lastPlayedCardEffects: [],
        lastPlayedCardCostType: 'action' as any,
        causePhysicalDamage: false,
        canEnchantDiscard: false,
        pendingGuessCardId: '',
        pendingGuessCardWeight: 0,
        playedCardTypesThisTurn: [],
        draftCards: [],
        draftPlayerPick: 0,
        draftPickCount: 0,
        draftPickedBy: {},
        usedPhysicalHealThisTurn: 0,
        usedFireHealThisTurn: 0,
        jungleHpUpTriggered: false,
        pendingBucketChoice: '',
        pendingEquipChoice: '',
      },
    ],
    currentTurnIndex: 0,
    turnNumber: 1,
    durationTickCounter: 0,
    phase: GamePhase.Playing,
    log: [],
  };
}

// ===== 初始化对局（洗牌+摸牌+决定先手） =====
export function initGame(state: GameState): GameState {
  const s = deepClone(state);

  // 随机先手
  s.currentTurnIndex = Math.random() < 0.5 ? 0 : 1;

  // 摸初始手牌
  for (let i = 0; i < s.players.length; i++) {
    s.players[i] = drawCards(s.players[i], INITIAL_DRAW_COUNT);
  }

  return s;
}

// ===== 刷新装备效果 =====
function refreshEquipment(player: PlayerState): PlayerState {
  const p = deepClone(player);

  // 重置加成字段
  p.handLimitBonus = 0;
  p.actionLimitBonus = 0;
  p.shieldOnDiscardCount = 0;

  // 检查场地卡加成
  if (p.equipment.field?.name === '村庄') p.handLimitBonus = 4;

  return p;
}

// ===== 开始新回合 =====
export function startTurn(state: GameState): GameState {
  const s = deepClone(state);
  s.phase = GamePhase.Playing;

  let player = s.players[s.currentTurnIndex];

  // 刷新装备
  player = refreshEquipment(player);

  // 重置本回合状态
  player.healCountThisTurn = 0;
  player.attackCountThisTurn = 0;
  player.actionStrategyCountThisTurn = 0;
  player.poisonTriggerCountThisTurn = 0;
  player.jungleHpUpTriggered = false;
  player.shieldOnDiscardCount = 0;
  player.playedCardTypesThisTurn = [];


  // 处理回合开始 Buff
  player = processTurnStartBuffs(player);

  // 摸牌
  player = drawCards(player, TURN_DRAW_COUNT);

  s.players[s.currentTurnIndex] = player;
  return s;
}

// ===== 出牌 =====
export interface PlayCardResult {
  success: boolean;
  gameState: GameState;
  error?: string;
  messages?: string[];
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

  const name = s.players[s.currentTurnIndex].name;
  s.log.push({
    turnNumber: s.turnNumber,
    message: `${name}行动结束`,
    timestamp: Date.now(),
  });
  // 切换玩家
  s.currentTurnIndex = 1 - s.currentTurnIndex;

  // 持续时间节拍器：每两次结束出牌减1回合（一轮完整循环）
  s.durationTickCounter = ((s.durationTickCounter || 0) + 1) % 2;
  const shouldDecrement = s.durationTickCounter === 0;
  if (shouldDecrement) {
    // 处理回合结束 Buff
    for (let i = 0; i < s.players.length; i++) {
      s.players[i] = processTurnEndBuffs(s.players[i]);
    }
    //输出回合结束日志
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${s.turnNumber}回合结束，进入第${s.turnNumber + 1}回合`,
      timestamp: Date.now(),
    });

    s.turnNumber += 1;
  }

  return s;
}

// ===== 丢弃手牌 =====
export function discardFromHand(state: GameState, playerId: string, cardId: string): GameState {
  let s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  let player = s.players[idx];
  let target = s.players[1 - idx];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return s;

  const [card] = player.hand.splice(cardIdx, 1);
  // 附魔台：丢弃此牌并触发效果
  if (player.canEnchantDiscard) {
    player.canEnchantDiscard = false;
    // 放回手牌，让 handleEnchantDiscard 通过 applyCard 处理
    player.hand.push(card);
    s = handleEnchantDiscard(s, player.id, card.id);
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}丢弃了${card.name}`,
      timestamp: Date.now(),
    });
    return s;
  }

  player.discardPile.push(card);

  //烈焰棒
  if(player.equipment?.weapon?.name === '烈焰棒' && player.causePhysicalDamage) {
    player.causePhysicalDamage = false;
    damage(player, target, DamageType.Fire, 2);
    s.log.push({
      turnNumber: s.turnNumber,
      message: `烈焰棒生效：${target.name}受到2点火焰伤害`,
      timestamp: Date.now(),
    });
  }

  // 绑定诅咒：丢弃牌时受伤害
  const curseStack = getBuffStacks(player, BuffType.DamageOnDiscard);
  if (curseStack > 0) {
    damage(player, player, DamageType.Real, curseStack);
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}丢弃牌时受到${curseStack}点绑定诅咒伤害`,
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
  s.players[1 - idx] = target;

  s.log.push({
    turnNumber: s.turnNumber,
    message: `${player.name}丢弃了${card.name}`,
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

  let player = s.players[idx];
  const card = player.equipment[slot as keyof typeof player.equipment];
  if (!card) return s;

  delete player.equipment[slot as keyof typeof player.equipment];
  // 移除该装备产生的buff
  player.buffs = player.buffs.filter(b => b.sourceCardId !== card.id);
  // 装备卸下时直接丢弃（进入弃牌堆），触发丢弃事件
  player.discardPile.push(card);

  // 绑定诅咒：丢弃牌时受伤害
  const curseStack = getBuffStacks(player, BuffType.DamageOnDiscard);
  if (curseStack > 0) {
    damage(player, player, DamageType.Real, curseStack);
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}丢弃牌时受到${curseStack}点绑定诅咒伤害`,
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

  const player = s.players[idx];
  if (!player.pendingGuessCardId) return s;

  const correct = player.pendingGuessCardWeight === guessWeight;
  const msg = correct
    ? `${player.name}猜中了权重(${guessWeight})！下次物理伤害×1.5`
    : `${player.name}猜错了权重(${guessWeight})，正确答案是${player.pendingGuessCardWeight}`;

  if (correct) {
    player.buffs.push({
      buffType: BuffType.DamageBoost,
      value: 1,
      stacks: 1,
      sourceCardId: 'detector',
    });
  }

  player.pendingGuessCardId = '';
  player.pendingGuessCardWeight = 0;

  s.log.push({
    turnNumber: s.turnNumber,
    message: msg,
    timestamp: Date.now(),
  });

  return s;
}

// ===== 附魔台：处理丢弃牌并触发 =====
export function handleEnchantDiscard(state: GameState, playerId: string, cardId: string): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  const card = s.players[idx].hand.find(c => c.id === cardId);
  if (!card) {
    console.log('[附魔台] 卡牌未找到:', cardId);
    return s;
  }

  console.log('[附魔台] 开始处理丢弃:', card.name, '玩家:', s.players[idx].name, '对手:', s.players[1 - idx].name);

  // 保存消耗计数，applyCard 会修改它们
  const before = {
    healCount: s.players[idx].healCountThisTurn,
    attackCount: s.players[idx].attackCountThisTurn,
    actionStrategyCount: s.players[idx].actionStrategyCountThisTurn,
    playedTypes: [...s.players[idx].playedCardTypesThisTurn],
    lastPlayedDef: [...s.players[idx].lastPlayedCardDef],
    lastPlayedName: s.players[idx].lastPlayedCardName,
  };

  // 将选中的牌像打出去一样生效（目标为对手）
  const oppId = s.players[1 - idx].id;
  console.log('[附魔台] 调用 applyCard, 目标:', oppId);
  const result = applyCard(s, playerId, oppId, card);
  console.log('[附魔台] applyCard 返回, messages:', result.logMessages);
  const gs = result.gameState;

  // 恢复消耗计数（这张牌是被丢弃触发，不是正常打出）
  const pIdx = gs.players.findIndex(p => p.id === playerId);
  gs.players[pIdx].healCountThisTurn = before.healCount;
  gs.players[pIdx].attackCountThisTurn = before.attackCount;
  gs.players[pIdx].actionStrategyCountThisTurn = before.actionStrategyCount;
  gs.players[pIdx].playedCardTypesThisTurn = before.playedTypes;
  gs.players[pIdx].lastPlayedCardDef = before.lastPlayedDef;
  gs.players[pIdx].lastPlayedCardName = before.lastPlayedName;

  // 摸2张牌（附魔自带的奖励）
  gs.players[pIdx] = drawCards(gs.players[pIdx], 2);

  gs.log.push({
    turnNumber: gs.turnNumber,
    message: `附魔台丢弃了${card.name}并触发其效果，摸了2张牌`,
    timestamp: Date.now(),
  });

  return gs;
}

// ===== 运输矿车：处理选牌 =====
export function handleDraftPick(state: GameState, playerId: string, cardIndex: number): GameState {
  const s = deepClone(state);
  const pickerIdx = s.players.findIndex(p => p.id === playerId);
  if (pickerIdx === -1) return s;

  // 选牌数据始终在打出运输矿车的玩家身上
  const ownerIdx = s.players.findIndex(p => p.draftCards?.length > 0);
  if (ownerIdx === -1) return s;

  const owner = s.players[ownerIdx];
  if (!owner.draftCards || owner.draftCards.length === 0) return s;

  // 判断该轮到谁选
  const isOwnerPick = owner.id === playerId;
  const expectedPick = isOwnerPick ? 0 : 1;
  if (owner.draftPlayerPick !== expectedPick) return s;

  if (cardIndex < 0 || cardIndex >= owner.draftCards.length) return s;
  if (owner.draftPickedBy && owner.draftPickedBy[cardIndex]) return s;

  // 牌给当前选牌的玩家
  const picked = owner.draftCards[cardIndex];
  s.players[pickerIdx].hand.push(picked);
  owner.draftPickCount += 1;
  if (!owner.draftPickedBy) owner.draftPickedBy = {};
  owner.draftPickedBy[cardIndex] = s.players[pickerIdx].name;

  // 切换选牌方
  if (owner.draftCards.length > 0 && owner.draftPickCount < 4) {
    owner.draftPlayerPick = 1 - owner.draftPlayerPick;
  } else {
    owner.draftCards = [];
    owner.draftPickedBy = {};
    owner.draftPlayerPick = 0;
    owner.draftPickCount = 0;
  }

  s.players[ownerIdx] = owner;
  s.log.push({ turnNumber: s.turnNumber, message: s.players[pickerIdx].name + "选择了" + picked.name, timestamp: Date.now() });
  return s;
}

// ===== 水桶：处理封锁选择 =====
export function handleBucketChoice(state: GameState, playerId: string, lockType: string): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  const player = s.players[idx];
  if (player.pendingBucketChoice !== 'pending') return s;

  const oppIdx = 1 - idx;
  const opponent = s.players[oppIdx];
  if (lockType === 'action') {
    opponent.buffs.push({ buffType: BuffType.LockAction, value: 1, stacks: 1, remainingTurns: 1, sourceCardId: 'bucket' });
    s.log.push({ turnNumber: s.turnNumber, message: `${player.name}封锁了对手的行动牌`, timestamp: Date.now() });
  } else if (lockType === 'strategy') {
    opponent.buffs.push({ buffType: BuffType.LockStrategy, value: 1, stacks: 1, remainingTurns: 1, sourceCardId: 'bucket' });
    s.log.push({ turnNumber: s.turnNumber, message: `${player.name}封锁了对手的锦囊牌`, timestamp: Date.now() });
  }

  player.pendingBucketChoice = '';
  s.players[idx] = player;
  s.players[oppIdx] = opponent;
  return s;
}

// ===== 诡异钓竿：处理装备丢弃 =====
export function handleEquipChoice(state: GameState, playerId: string, slot: string): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;

  const player = s.players[idx];
  if (player.pendingEquipChoice !== 'pending') return s;

  const oppIdx = 1 - idx;
  const opponent = s.players[oppIdx];

  const slotKey = slot as keyof typeof opponent.equipment;
  const card = opponent.equipment[slotKey];
  if (!card) {
    s.log.push({ turnNumber: s.turnNumber, message: '该槽位没有装备', timestamp: Date.now() });
    return s;
  }

  delete opponent.equipment[slotKey];
  opponent.discardPile.push(card);
  opponent.buffs = opponent.buffs.filter(b => b.sourceCardId !== card.id);
  player.pendingEquipChoice = '';

  s.log.push({
    turnNumber: s.turnNumber,
    message: `${opponent.name}的${card.name}被丢弃`,
    timestamp: Date.now(),
  });

  s.players[idx] = player;
  s.players[oppIdx] = opponent;
  return s;
}

// ===== 酿造台：处理卡牌转化 =====
export function handleBrewConversion(state: GameState, playerId: string, cardId: string): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex(p => p.id === playerId);
  if (idx === -1) return s;
  const player = s.players[idx];
  if (player.equipment?.weapon?.name !== '酿造台') return s;
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return s;
  const card = player.hand[cardIdx];
  let targetName: string;
  if (card.name === '苹果') targetName = '烟花';
  else if (card.name === '烟花') targetName = '苹果';
  else return s;
  const template = CARDS.find(c => c.name === targetName);
  if (!template) return s;
  player.hand[cardIdx] = { ...template, id: `brew_${template.id}_${Date.now()}` };
  s.log.push({ turnNumber: s.turnNumber, message: `酿造台：将1张${card.name}转化为${targetName}`, timestamp: Date.now() });
  return s;
}
