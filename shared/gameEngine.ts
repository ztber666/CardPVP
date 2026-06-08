import {
  GameState, PlayerState, CardDef, GamePhase,
  GameLogEntry, PlayCardAction,
} from './types';
import { deepClone } from './buffEngine';
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

// ===== 开始新回合 =====
export function startTurn(state: GameState): GameState {
  let s = deepClone(state);
  s.turnNumber += 1;

  const idx = s.currentTurnIndex;
  let player = s.players[idx];
  let opponent = s.players[1 - idx];

  // 双方各摸3张（皮革鞋子额外+1）
  const extraDraw = (p: any) => p.equipment?.equip?.name === '皮革鞋子' ? 1 : 0;
  player = drawCards(player, TURN_DRAW_COUNT + extraDraw(player));
  opponent = drawCards(opponent, TURN_DRAW_COUNT + extraDraw(opponent));

  // 重置本回合状态
  player.actionUsedThisTurn = false;
  player.strategyCountThisTurn = 0;
  player.poisonTriggerCountThisTurn = 0;

  // 处理回合开始 Buff
  player = processTurnStartBuffs(player);
  opponent = processTurnStartBuffs(opponent);

  // 尖刺效果：对手每层尖刺 → 当前玩家获得等量凋零
  // （规则：尖刺 — 每回合轮到附着对象时增加2点凋零效果）
  // "轮到附着对象"指尖刺附着者的回合开始时。但这里尖刺贴在对方身上，
  // 实际应该是"轮到附着对象时" = 被附着者的回合开始时，给自己加凋零
  // 更准确：尖刺在持有者自己的回合开始时，给对方施加凋零
  // 但规则写"每回合轮到附着对象时增加2点凋零效果"——
  // 指持有尖刺buff的人，到他的回合时，给对方加凋零
  // 所以在这里：当前玩家是 active player，对方有尖刺的话...
  // 实际上规则是：尖刺buff附着在玩家A身上，当轮到A的回合时，A给对方增加2层凋零
  // 所以这里应该是检查当前玩家的buff中有没有尖刺

  // 修正理解：尖刺在轮到"附着对象"（即持有者）时生效
  // 所以每个玩家的回合开始时，检查自己有没有尖刺，有的话给对方加凋零
  // 但我们的流程是 startTurn 被 active player 调用，所以:
  const thornBuff = player.buffs.find(b => b.buffType === 'thorns');
  if (thornBuff) {
    // 给对方加凋零，值为 thornBuff.stacks * 2（或根据规则）
    const witherAmount = thornBuff.value * 2; // 规则写"增加2点凋零效果"
    opponent = {
      ...opponent,
      buffs: [
        ...opponent.buffs,
        {
          buffType: 'wither' as any,
          value: witherAmount,
          stacks: witherAmount,
          sourceCardId: thornBuff.sourceCardId,
        },
      ],
    };
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}的尖刺效果触发，${opponent.name}获得${witherAmount}层凋零`,
      timestamp: Date.now(),
    });
  }

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

  const player = s.players[idx];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return s;

  const [removed] = player.hand.splice(cardIdx, 1);
  player.discardPile.push(removed);

  // 绑定诅咒：丢弃牌时受伤害
  const curseBuff = player.buffs.find(b => b.buffType === 'damageOnDiscard');
  if (curseBuff) {
    const dmg = curseBuff.value;
    player.hp = Math.max(0, player.hp - dmg);
    s.log.push({
      turnNumber: s.turnNumber,
      message: `${player.name}丢弃牌时受到${dmg}点绑定诅咒伤害`,
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
