import {
  GameState, PlayerState, CardDef, CostType, BuffType,
  GamePhase, GameLogEntry, ActiveBuff,
} from './types';
import { deepClone, calculateDamage, calculateHeal, applyEffectToPlayer, processTurnEndBuffs } from './buffEngine';
import { DEFAULT_HAND_LIMIT } from './constants';

/**
 * 卡牌效果引擎 — 处理单张卡牌打出的完整流程
 */

// ===== 摸牌 =====
export function drawCards(player: PlayerState, count: number): PlayerState {
  const p = deepClone(player);
  for (let i = 0; i < count; i++) {
    if (p.deck.length === 0) {
      // 牌组空了：弃牌堆洗回牌组
      if (p.discardPile.length === 0) break;
      p.deck = [...p.discardPile];
      p.discardPile = [];
      // Fisher-Yates 洗牌
      for (let j = p.deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [p.deck[j], p.deck[k]] = [p.deck[k], p.deck[j]];
      }
    }
    if (p.hand.length >= DEFAULT_HAND_LIMIT) {
      // 手牌已达上限，新摸的牌立即丢弃
      const drawn = p.deck.shift()!;
      p.discardPile.push(drawn);
    } else {
      const drawn = p.deck.shift()!;
      p.hand.push(drawn);
    }
  }
  return p;
}

// ===== 洗牌 =====
export function shuffleDeck(player: PlayerState): PlayerState {
  const p = deepClone(player);
  const deck = [...p.deck];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  p.deck = deck;
  return p;
}

// ===== 卡牌是否可打出（前置校验） =====
export function canPlayCard(player: PlayerState, card: CardDef, targetSelf?: boolean): { valid: boolean; reason?: string } {
  // 检查手牌中是否有此卡
  const cardInHand = player.hand.find(c => c.id === card.id);
  if (!cardInHand) {
    return { valid: false, reason: '卡牌不在手牌中' };
  }

  // 行动封锁：无法使用行动卡
  if (card.costType === CostType.Action && player.buffs.some(b => b.buffType === BuffType.LockAction)) {
    return { valid: false, reason: '被水桶封锁，本回合无法使用行动牌' };
  }

  // 装备/武器/场地卡只能对自己使用
  if (targetSelf === false && (card.costType === CostType.Equip || card.costType === CostType.Weapon || card.costType === CostType.Field)) {
    return { valid: false, reason: '装备卡只能对自己使用' };
  }

  switch (card.costType) {
    case CostType.Action:
      if (player.actionUsedThisTurn) {
        return { valid: false, reason: '每回合只能出1张行动卡' };
      }
      break;
    case CostType.Strategy:
      if (player.strategyCountThisTurn >= 3) {
        return { valid: false, reason: '每回合最多出3张锦囊卡' };
      }
      break;
    // 其他卡牌类型目前无限额
    default:
      break;
  }

  return { valid: true };
}

// ===== 从手牌移除卡牌 =====
function removeFromHand(player: PlayerState, cardId: string): PlayerState {
  const p = deepClone(player);
  p.hand = p.hand.filter(c => c.id !== cardId);
  return p;
}

// ===== 应用卡牌效果到目标 =====
export interface ApplyCardResult {
  gameState: GameState;
  logMessages: string[];
}

export function applyCard(
  gameState: GameState,
  playerId: string,
  targetId: string,
  card: CardDef
): ApplyCardResult {
  const state = deepClone(gameState);
  const msgs: string[] = [];

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const targetIndex = state.players.findIndex(p => p.id === targetId);
  if (playerIndex === -1 || targetIndex === -1) {
    return { gameState: state, logMessages: ['无效的玩家或目标'] };
  }

  const isSelfTarget = playerIndex === targetIndex;
  const cardName = card.name;

  // ===== 用一份统一的状态 p 代表卡牌使用者 =====
  // 效果产生"攻击者"和"防御者"两份修改时，最终合并回 p
  let p = deepClone(state.players[playerIndex]);
  // 当目标非己时，targetState 是另一个玩家
  let t = isSelfTarget ? p : deepClone(state.players[targetIndex]);

  // 从手牌移除
  p = removeFromHand(p, card.id);

  // 更新消耗计数
  if (card.costType === CostType.Action) p.actionUsedThisTurn = true;
  if (card.costType === CostType.Strategy) p.strategyCountThisTurn += 1;

  // 处理装备/武器/场地替换（始终作用在卡牌使用者身上）
  if (card.costType === CostType.Equip ||
      card.costType === CostType.Weapon ||
      card.costType === CostType.Field) {
    const slotKey = card.costType === CostType.Equip ? 'equip'
                  : card.costType === CostType.Weapon ? 'weapon' : 'field';
    if (p.equipment[slotKey]) {
      const oldCard = p.equipment[slotKey]!;
      p.discardPile.push(oldCard);
      msgs.push(`${cardName}替换了已有的${oldCard.name}，${oldCard.name}进入废牌堆`);
      p.buffs = p.buffs.filter(b => b.sourceCardId !== oldCard.id);
    }
    p.equipment[slotKey] = card;
    msgs.push(`${cardName}已装备`);
  } else {
    p.discardPile.push(card);
  }

  // ===== 逐条执行效果 =====
  for (const effect of card.effects) {
    const targetLabel = isSelfTarget ? '自己' : '对手';

    if (effect.buffType === BuffType.Heal) {
      // 回血
      const target = isSelfTarget ? p : t;
      const result = calculateHeal(effect.value, target);
      if (isSelfTarget) {
        p = result.newTarget;
      } else {
        t = result.newTarget;
      }
      if (result.heal > 0) msgs.push(`${cardName}为${targetLabel}回复了${result.heal}点血量`);
      if (result.poisonDamage > 0) msgs.push(`中毒触发，${targetLabel}受到${result.poisonDamage}点伤害`);

    } else if (effect.buffType === BuffType.HealAll) {
      // 全体回血（无论目标选择，双方都回血）
      const r1 = calculateHeal(effect.value, p);
      p = r1.newTarget;
      let oppHeal = 0;
      if (isSelfTarget) {
        // 自目标时，治疗对手（直接写回state）
        const oppIdx = state.players[0].id === p.id ? 1 : 0;
        const r2 = calculateHeal(effect.value, state.players[oppIdx]);
        state.players[oppIdx] = r2.newTarget;
        oppHeal = r2.heal;
      } else {
        const r2 = calculateHeal(effect.value, t);
        t = r2.newTarget;
        oppHeal = r2.heal;
      }
      msgs.push(`${cardName}为双方回复了${r1.heal + oppHeal}点血量`);

    } else if (effect.buffType === BuffType.Damage) {
      // 直接伤害（对目标生效，不经过力量/虚弱等Buff）
      const target = isSelfTarget ? p : t;
      target.hp = Math.max(0, target.hp - effect.value);
      msgs.push(`${cardName}对${targetLabel}造成${effect.value}点伤害`);
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.RemoveWither) {
      // 移除凋零
      const target = isSelfTarget ? p : t;
      const witherIdx = target.buffs.findIndex(b => b.buffType === BuffType.Wither);
      if (witherIdx !== -1) {
        const buff = target.buffs[witherIdx];
        const removed = Math.min(effect.value, buff.stacks);
        buff.stacks -= removed;
        if (buff.stacks <= 0) target.buffs.splice(witherIdx, 1);
        msgs.push(`${cardName}为${targetLabel}移除了${removed}层凋零`);
      } else {
        msgs.push(`${cardName}试图移除凋零，但${targetLabel}没有凋零效果`);
      }
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.ReduceDuration) {
      // 减少限时状态回合数
      const target = isSelfTarget ? p : t;
      target.buffs = target.buffs
        .map(buff => {
          if (buff.remainingTurns === undefined) return buff;
          return { ...buff, remainingTurns: Math.max(0, buff.remainingTurns - 1) };
        });
      msgs.push(`${cardName}使${targetLabel}所有限时状态剩余回合-1`);
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.ReduceMaxHp) {
      // 降低生命上限（%）
      const target = isSelfTarget ? p : t;
      const reduction = Math.ceil(target.maxHp * effect.value / 100);
      target.maxHp = Math.max(1, target.maxHp - reduction);
      target.hp = Math.min(target.hp, target.maxHp);
      msgs.push(`${cardName}使${targetLabel}生命上限降低${reduction}点`);
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.IncreaseMaxHp) {
      // 提升生命上限
      const target = isSelfTarget ? p : t;
      target.maxHp += effect.value;
      msgs.push(`${cardName}使${targetLabel}生命上限提升${effect.value}点`);
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.ConditionalDiscard) {
      // 条件丢弃：检查目标手牌是否有<烟花>，有则丢弃，否则造成伤害
      const target = isSelfTarget ? p : t;
      const fireworkIdx = target.hand.findIndex(c => c.name === '烟花');
      if (fireworkIdx !== -1) {
        const [discarded] = target.hand.splice(fireworkIdx, 1);
        target.discardPile.push(discarded);
        msgs.push(`${cardName}使${targetLabel}丢弃了${discarded.name}`);
      } else {
        target.hp = Math.max(0, target.hp - effect.value);
        msgs.push(`${cardName}对${targetLabel}造成${effect.value}点伤害（未丢弃<烟花>）`);
      }
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.DrawCard) {
      // 摸牌
      const target = isSelfTarget ? p : t;
      const oldHandLen = target.hand.length;
      const drawn = drawCards(target, effect.value);
      const newCards = drawn.hand.length - oldHandLen;
      msgs.push(`${cardName}使${targetLabel}摸了${Math.max(0, newCards)}张牌`);
      if (isSelfTarget) p = drawn; else t = drawn;

    } else if (effect.buffType === BuffType.StealCard) {
      // 抽取目标一张手牌
      const target = isSelfTarget ? p : t;
      if (target.hand.length > 0) {
        const idx = Math.floor(Math.random() * target.hand.length);
        const [stolen] = target.hand.splice(idx, 1);
        if (isSelfTarget) {
          p.hand.push(stolen);
          msgs.push(`${cardName}从目标手中抽取了${stolen.name}`);
        } else {
          // 从对手抽牌给自己
          t = target;
          p.hand.push(stolen);
          msgs.push(`${cardName}从${targetLabel}手中抽取了${stolen.name}`);
        }
      } else {
        msgs.push(`${cardName}试图抽牌，但${targetLabel}手牌为空`);
        if (isSelfTarget) p = target; else t = target;
      }

    } else if (effect.buffType === BuffType.RevealHand) {
      // 展示手牌：在日志中记录目标手牌信息
      const target = isSelfTarget ? p : t;
      const count = Math.min(effect.value, target.hand.length);
      const revealed = target.hand.slice(0, count).map(c => c.name).join('、');
      msgs.push(`${cardName}揭示了${targetLabel}的手牌：${revealed}`);
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.ForceDiscardEquip) {
      // 强制丢弃装备/武器/场地
      const target = isSelfTarget ? p : t;
      const slots = ['equip', 'weapon', 'field'] as const;
      const equipped = slots.filter(s => target.equipment[s]);
      if (equipped.length > 0) {
        const slot = equipped[Math.floor(Math.random() * equipped.length)];
        const discarded = target.equipment[slot]!;
        delete target.equipment[slot];
        target.discardPile.push(discarded);
        // 移除该装备相关的buff
        target.buffs = target.buffs.filter(b => b.sourceCardId !== discarded.id);
        msgs.push(`${cardName}使${targetLabel}丢弃了${discarded.name}`);
      } else {
        msgs.push(`${cardName}试图卸装，但${targetLabel}没有装备`);
      }
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.DamageOnDiscard) {
      // 丢弃伤害Debuff
      const target = isSelfTarget ? p : t;
      const modified = applyEffectToPlayer(target, BuffType.DamageOnDiscard, effect.value, effect.duration, card.id);
      if (isSelfTarget) p = modified; else t = modified;
      msgs.push(`${cardName}使${targetLabel}在丢弃牌时受到${effect.value}点伤害（持续${effect.duration}回合）`);

    } else if (effect.buffType === BuffType.HealPerBuff) {
      // 每存在一种状态回1点血
      const target = isSelfTarget ? p : t;
      // 统计不同的buff类型数量（排除特殊类型）
      const buffTypes = new Set(target.buffs.map(b => b.buffType));
      const healAmount = buffTypes.size * effect.value;
      if (healAmount > 0) {
        target.hp = Math.min(target.maxHp, target.hp + healAmount);
        msgs.push(`${cardName}为${targetLabel}回复了${healAmount}点血量（${buffTypes.size}种状态）`);
      } else {
        msgs.push(`${cardName}没有检测到任何状态，未回血`);
      }
      if (isSelfTarget) p = target; else t = target;

    } else {
      // 其他Buff效果
      const target = isSelfTarget ? p : t;
      const modified = applyEffectToPlayer(target, effect.buffType, effect.value, effect.duration, card.id);
      if (isSelfTarget) {
        p = modified;
      } else {
        t = modified;
      }
      msgs.push(`${cardName}对${targetLabel}施加了${effect.buffType}效果`);
    }
  }

  // ===== 写入状态 =====
  if (isSelfTarget) {
    state.players[playerIndex] = p;  // p 已包含所有变化
  } else {
    state.players[playerIndex] = p;
    state.players[targetIndex] = t;
  }

  // 检查胜负
  for (const p of state.players) {
    if (p.hp <= 0) {
      state.phase = GamePhase.GameOver;
      state.winnerId = state.players.find(pl => pl.id !== p.id)?.id;
      msgs.push(`${p.name}的HP降为0，${state.winnerId ? state.players.find(pl => pl.id === state.winnerId)?.name : '对方'}获胜！`);
      break;
    }
  }

  // 记录日志
  const entry: GameLogEntry = {
    turnNumber: state.turnNumber,
    message: msgs[msgs.length - 1] || `${cardName}被使用`,
    timestamp: Date.now(),
  };
  state.log.push(entry);

  return { gameState: state, logMessages: msgs };
}
