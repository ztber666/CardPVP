import {
  GameState, PlayerState, CardDef, CostType, BuffType,
  GamePhase, GameLogEntry, ActiveBuff, COST_TYPE_NAMES,
} from './types';
import { deepClone, applyEffectToPlayer, getBuffStacks, findBuff } from './buffEngine';
import { CARDS, DEFAULT_HAND_LIMIT } from './constants';

// 服务端通知 handler（由 server/index.ts 设置，通过 globalThis 跨模块共享）
// target: 'all'=双方都显示 'self'=仅出牌者 'opponent'=仅对手
function showMessage(msg: string, target: 'all' | 'self' | 'opponent' = 'all') {
  const h = (globalThis as any).__card_notify_handler;
  console.log('[Notify] showMessage:', msg, 'target:', target, 'handler:', !!h);
  if (h) h(msg, target);
}

/**
 * 卡牌效果引擎 — 处理单张卡牌打出的完整流程
 */

/** 根据 icon 前缀判断卡牌属于回血类(icon3)还是攻击类(icon4)，替代旧行动卡限制 */
export function getCardSubtype(card: CardDef): 'heal' | 'attack' | null {
  const parts = card.icon.split(',').map(Number);
  // 最后一个数字是 CostType，前面的数字是视觉 icon
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === 3) return 'heal';
    if (parts[i] === 4) return 'attack';
  }
  return null;
}

// ===== 摸牌 =====
export function drawCards(player: PlayerState, count: number): PlayerState {
  let p = deepClone(player);
  const handLimit = DEFAULT_HAND_LIMIT + (p.handLimitBonus || 0);
  const equippedCount = [p.equipment.equip, p.equipment.weapon, p.equipment.field].filter(Boolean).length;
  let drawnCount = 0;
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
    if (p.hand.length + equippedCount >= handLimit) {
      // 手牌已达上限：先加入手牌再丢弃（触发丢弃事件）
      const drawn = p.deck.shift()!;
      p.hand.push(drawn);
      // 丢弃事件：绑定诅咒
      const curseBuff = findBuff(p, BuffType.DamageOnDiscard);
      if (curseBuff) p.hp = Math.max(0, p.hp - curseBuff.value);
      // 丢弃事件：下界荒地
      if (p.equipment?.field?.name === '下界荒地' && (p.shieldOnDiscardCount || 0) < 2) {
        p = applyEffectToPlayer(p, BuffType.Shield, 1, undefined, p.equipment.field.id);
        p.shieldOnDiscardCount = (p.shieldOnDiscardCount || 0) + 1;
      }
      // 从手牌移除
      p.hand = p.hand.filter(c => c.id !== drawn.id);
      p.discardPile.push(drawn);
    } else {
      const drawn = p.deck.shift()!;
      p.hand.push(drawn);
      drawnCount++;
    }
  }

  // 陷阱箱：摸牌时获得凋零
  const witherOnDraw = getBuffStacks(p, BuffType.WitherOnDraw);
  if (witherOnDraw > 0 && drawnCount > 0) {
    for (let i = 0; i < drawnCount; i++) {
      p = applyEffectToPlayer(p, BuffType.Wither, 1, undefined, 'wither_on_draw');
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

  //烈焰粉：不满足条件无法打出
  if (card.name === '烈焰粉' && !player.causePhysicalDamage) {
    return { valid: false, reason: '上一张未造成物理伤害，无法打出烈焰粉' };
  }

  //附魔台：不满足条件无法打出
  if (card.name === '附魔台') {
    const checkTypes = [CostType.Heal, CostType.Attack, CostType.Buff, CostType.Debuff, CostType.Event];
    const played = player.playedCardTypesThisTurn || [];
    const matchedTypes = checkTypes.filter(ct => played.includes(ct));
    if (matchedTypes.length < 4) {
      return { valid: false, reason: '本回合未打出4种类型牌，无法打出附魔台' };
    }
  }

  //玻璃板：复制行动牌时检查消耗次数
  if (card.name === '玻璃板' && player.lastPlayedCardCostType === CostType.Action && (player.actionStrategyCountThisTurn || 0) >= (3 + (player.actionLimitBonus || 0))) {
    return { valid: false, reason: '本回合行动/锦囊牌已达上限' };
  }

  //运输矿车：牌组中剩余牌数不足4张时无法打出
  if (card.name === '运输矿车' && player.deck.length < 4) {
    return { valid: false, reason: '牌组剩余牌数不足4张，无法打出运输矿车' };
  }

  // 行动封锁：无法使用行动卡/回血卡/攻击卡
  const isActionType = card.costType === CostType.Action || card.costType === CostType.Heal || card.costType === CostType.Attack;
  if (isActionType && player.buffs.some(b => b.buffType === BuffType.LockAction)) {
    return { valid: false, reason: '被水桶封锁，本回合无法使用' };
  }

  // 锦囊封锁：无法使用锦囊卡
  if (card.costType === CostType.Strategy && player.buffs.some(b => b.buffType === BuffType.LockStrategy)) {
    return { valid: false, reason: '被水桶封锁，本回合无法使用锦囊牌' };
  }

  // 装备/武器/场地卡只能对自己使用
  if (targetSelf === false && (card.costType === CostType.Equip || card.costType === CostType.Weapon || card.costType === CostType.Field)) {
    return { valid: false, reason: '装备卡只能对自己使用' };
  }

  // 所有行动牌（含回血/攻击类）+ 锦囊牌 → 先检查共享池
  const subtype = getCardSubtype(card);
  const isPoolCard = card.costType === CostType.Action || card.costType === CostType.Strategy;
  if (isPoolCard) {
    const poolLimit = 5 + (player.actionLimitBonus || 0);
    if ((player.actionStrategyCountThisTurn || 0) >= poolLimit) {
      return { valid: false, reason: `本回合行动/锦囊牌已达上限(${poolLimit}张)` };
    }
  }
  // 回血类/攻击类：各1张/回合（额外限制）
  if (subtype === 'heal' && (player.healCountThisTurn || 0) >= 1) {
    if (player.equipment?.field?.name === '冰原' && (player.attackCountThisTurn || 0) < 1) {
      return { valid: true }; // 冰原场地加成：回血类和攻击类消耗次数互通
    } else return { valid: false, reason: '每回合最多出1张回血类卡牌' };
  }
  if (subtype === 'attack' && (player.attackCountThisTurn || 0) >= 1) {
    if (player.equipment?.field?.name === '冰原' && (player.healCountThisTurn || 0) < 1) {
      return { valid: true }; // 冰原场地加成：回血类和攻击类消耗次数互通
    } else return { valid: false, reason: '每回合最多出1张攻击类卡牌' };
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

export function heal(target: PlayerState, number: number) {
  let healAmt = Math.max(0, number);
  //治愈增强
  healAmt += getBuffStacks(target, BuffType.HealBoost);
  //枯萎：减少层数等量回血但不消耗层数
  healAmt -= getBuffStacks(target, BuffType.Blight);

  //凋零：消耗1层，减少1点回血
  const witherStacks = getBuffStacks(target, BuffType.Wither);
  if (witherStacks > 0 && target.equipment?.equip?.name !== "钻石胸甲") {
    const consumed = Math.min(witherStacks, healAmt);
    if(consumed > 0) consumeInPlace(target, BuffType.Wither, consumed);
    healAmt -= consumed;
  }
  
  //中毒：回血后扣3HP（每回合限2次）
  const poisonBuff = getBuffStacks(target, BuffType.Poison) > 0;
  if (poisonBuff && target.poisonTriggerCountThisTurn < 2) {
    damage(target, target, DamageType.Real, 3);
    target.poisonTriggerCountThisTurn += 1;
  }
  //丛林被动
  if (target.equipment?.field?.name === '丛林') {
    if (getBuffStacks(target, BuffType.Wither) > 0 && !target.jungleHpUpTriggered) { 
      target.maxHp += 1;
      target.jungleHpUpTriggered = true;
    }
    healAmt += 1; // 丛林场地加成：每次回血+1
  }
  //实际回血
  const oldHp = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + healAmt);
  const overflow = (oldHp + healAmt) - target.maxHp;
  //金护腿：溢出转护盾
  if (overflow > 0 && target.equipment?.equip?.name === '金护腿') {
    const curShield = getBuffStacks(target, BuffType.Shield);
    const add = Math.min(overflow, 5 - curShield);
    if (add > 0) consumeInPlace(target, BuffType.Shield, add);
  }

  return healAmt;
}
export enum DamageType {
  Physical,
  Fire,
  Real
}
/** 原地消耗 buff 层数（修改原对象 buffs 数组，不创建新对象） */
export function consumeInPlace(player: PlayerState, type: BuffType, amount: number): number {
  let remaining = amount;
  for (const b of player.buffs) {
    if (b.buffType !== type || remaining <= 0) continue;
    const c = Math.min(remaining, b.stacks);
    b.stacks -= c; remaining -= c;
  }
  player.buffs = player.buffs.filter(b => b.stacks > 0);
  return amount - remaining;
}

export function damage(source: PlayerState, target: PlayerState, type: DamageType, base: number): number {
  let number = Math.max(0, base);
  if(type === DamageType.Physical) {
    //力量（所有实例求和）
    number += getBuffStacks(source, BuffType.Strength);
    //虚弱（所有实例求和）
    number -= getBuffStacks(source, BuffType.Weakness);
    //抗性（所有实例求和）
    number -= getBuffStacks(target, BuffType.Resistance);
    //易伤
    number += getBuffStacks(target, BuffType.Vulnerability);
    //护盾
    const shieldStacks = getBuffStacks(target, BuffType.Shield);
    if (shieldStacks > 0) {
      const blocked = Math.min(shieldStacks, Math.max(0, number));
      if (blocked > 0) {
        consumeInPlace(target, BuffType.Shield, blocked);
        number -= blocked;
      }
    }
    //格挡：减5点物理伤害，消耗全部层数后状态消失
    const blockStacks = getBuffStacks(target, BuffType.Block);
    if (blockStacks > 0 && number > 0) {
      const reduced = Math.min(5, number);
      number -= reduced;
      consumeInPlace(target, BuffType.Block, blockStacks);
    }
    //侦测器暴击
    const dmgBoost = getBuffStacks(source, BuffType.DamageBoost);
    if (dmgBoost > 0) {
      number = Math.ceil(number * 1.5);
      consumeInPlace(source, BuffType.DamageBoost, dmgBoost);
    }
    //滴水石锥（物伤回血）
    if (source.equipment?.weapon?.name === '滴水石锥') heal(source, 1);
    //烈焰棒：标记触发条件
    if (source.equipment?.weapon?.name === '烈焰棒') {
      source.causePhysicalDamage = true;
      showMessage('丢弃一张牌可造成两点火焰伤害', "self")
    }
    //烈焰粉提示
    if(source.hand.filter(card => card.name === '烈焰粉').length > 0) {
      source.causePhysicalDamage = true;
      showMessage('打出烈焰粉可额外造成2点火焰伤害', "self");
    }
    
  } else if(type === DamageType.Fire) {
    //抗火：免疫
    const fireResist = getBuffStacks(target, BuffType.FireResist);
    if (fireResist > 0) return 0;
    //火焰易伤：消耗层数增加伤害
    const fvStacks = getBuffStacks(target, BuffType.FireVuln);
    if (fvStacks > 0) {
      const consumed = Math.min(fvStacks, Math.max(0, number));
      if (consumed > 0) consumeInPlace(target, BuffType.FireVuln, consumed);
      number += consumed;
    }
  } else if(type === DamageType.Real) {
    //真实伤害：无视所有buff
    target.hp = Math.max(0, target.hp - number);
    return number;
  }

  //三叉戟：攻击凋零目标额外伤害
  if (source.equipment?.weapon?.name === '三叉戟') {
    const hasWither = target.buffs.some(b => b.buffType === BuffType.Wither && b.stacks > 0);
    if (hasWither) number += 1;
  }
  target.hp = Math.max(0, target.hp - number);
  return number;
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
  const subtype = getCardSubtype(card);
  if (subtype === 'heal') {
    if (p.equipment?.field?.name === '冰原' && (p.healCountThisTurn || 0) >=1) {
      showMessage(`${p.name}触发冰原效果`, 'all');
      p.attackCountThisTurn = (p.attackCountThisTurn || 0) + 1; // 冰原场地加成：回血类和攻击类消耗次数互通
    } else p.healCountThisTurn = (p.healCountThisTurn || 0) + 1;
  }
  if (subtype === 'attack'){
    if (p.equipment?.field?.name === '冰原' && (p.attackCountThisTurn || 0) >=1) {
      showMessage(`${p.name}触发冰原效果`, 'all');
      p.healCountThisTurn = (p.healCountThisTurn || 0) + 1; // 冰原场地加成：回血类和攻击类消耗次数互通
    } else p.attackCountThisTurn = (p.attackCountThisTurn || 0) + 1;
  }
  // 所有行动牌（含回血/攻击类）+ 锦囊牌 → 共享池
  if (card.costType === CostType.Action || card.costType === CostType.Strategy) {
    p.actionStrategyCountThisTurn = (p.actionStrategyCountThisTurn || 0) + 1;
  }

  // 记录本回合消耗类型（附魔台用）
  if (!p.playedCardTypesThisTurn.includes(card.costType)) {
    p.playedCardTypesThisTurn.push(card.costType);
  }
  // 按 icon 前缀补充记录子类型（附魔台需要，因为 costType 不再区分回血/攻击/增益/减益/事件）
  const iconNums = card.icon.split(',').map(Number).slice(0, -1);
  for (const num of iconNums) {
    const mappedType = num === 3 ? CostType.Heal
      : num === 4 ? CostType.Attack
      : num === 5 ? CostType.Buff
      : num === 6 ? CostType.Debuff
      : num === 7 ? CostType.Event
      : null;
    if (mappedType && !p.playedCardTypesThisTurn.includes(mappedType)) {
      p.playedCardTypesThisTurn.push(mappedType);
    }
  }

  // 保存当前 lastPlayedCard（即上一张牌）供后续参考
  const prevCardName = p.lastPlayedCardName;
  const prevCardEffects = p.lastPlayedCardEffects.map(e => ({ ...e }));
  const prevCardCostType = p.lastPlayedCardCostType;

  // 更新上一张牌为当前这张（玻璃板本身不覆盖）
  if (card.name !== '玻璃板' && card.name !== '烈焰粉') {
    p.lastPlayedCardDef.push(card);
    p.lastPlayedCardName = card.name;
    p.lastPlayedCardEffects = card.effects.map(e => ({ ...e }));
    p.lastPlayedCardCostType = card.costType;
  }

  //处理烈焰粉判断逻辑
  if(card.name !== '烈焰粉' && p.causePhysicalDamage) p.causePhysicalDamage = false;

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
      if (effect.duration && effect.duration > 0) {
        // 持续回血（治愈 buff，每回合回复）
        const target = isSelfTarget ? p : t;
        const modified = applyEffectToPlayer(target, BuffType.Heal, effect.value, effect.duration, card.id);
        heal(modified, effect.value);
        if (isSelfTarget) p = modified; else t = modified;
        msgs.push(`${cardName}使${targetLabel}获得持续回血${effect.value}点（${effect.duration}回合）`);
      } else {// 即时回血
        const target = isSelfTarget ? p : t;
        heal(target, effect.value);
      }

    } else if (effect.buffType === BuffType.HealAll) {
      // 全体回血（无论目标选择，双方都回血）
      heal (p, effect.value);
      heal (state.players[1 - state.currentTurnIndex], effect.value);
      msgs.push(`${cardName}为双方回复了${effect.value}点血量`);
    } else if (effect.buffType === BuffType.PhysicalDamage) {
      //物理伤害
      const target = isSelfTarget ? p : t;
      damage(p, target, DamageType.Physical, effect.value);
    } else if (effect.buffType === BuffType.Damage) {
      // 真伤/魔法伤害
      const target = isSelfTarget ? p : t;
      if (effect.duration && effect.duration > 0) {
        // 持续真伤（治愈 buff，每回合回复）
        const modified = applyEffectToPlayer(target, BuffType.Damage, effect.value, effect.duration, card.id);
        damage(p, modified, DamageType.Real, effect.value);
        if (isSelfTarget) p = modified; else t = modified;
        msgs.push(`${cardName}使${targetLabel}获得龙息${effect.value}点（${effect.duration}回合）`);
      } else damage(p, target, DamageType.Real, effect.value);
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
        })
        .filter(b => b.remainingTurns === undefined || b.remainingTurns > 0);
      msgs.push(`${cardName}使${targetLabel}所有限时状态剩余回合-1`);
      if (isSelfTarget) p = target; else t = target;

    } else if (effect.buffType === BuffType.ReduceMaxHp) {
      // 降低生命上限（固定值）
      const target = isSelfTarget ? p : t;
      const reduction = Math.min(effect.value, target.maxHp - 1);
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
                if (isSelfTarget) p = target; else t = target;
        msgs.push(`${cardName}使${targetLabel}丢弃了${discarded.name}`);
      } else {
        const modified = applyEffectToPlayer(target, BuffType.Horde, 1, 2, card.id);
        damage(modified, modified, DamageType.Physical, 4);
        if (isSelfTarget) p = modified; else t = modified;
        msgs.push(`${cardName}给予${targetLabel} 2回合尸潮（未丢弃<烟花>）`);
      }

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
      if (buffTypes.size > 0) {
        heal(target, buffTypes.size);
        msgs.push(`${cardName}为${targetLabel}回复了${buffTypes.size}点血量（${buffTypes.size}种状态）`);
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

  // ===== 特殊卡牌处理 =====

  // 水桶：设置待选封锁类型
  if (card.name === '水桶') {
    p.pendingBucketChoice = 'pending';
    msgs.push('水桶：请选择封锁行动牌还是锦囊牌');
  }

  // 诡异钓竿：设置待选装备
  if (card.name === '诡异钓竿') {
    p.pendingEquipChoice = 'pending';
    msgs.push('诡异钓竿：请选择要丢弃的装备');
  }

  // 玻璃板：复制上一张牌的效果
  if (card.name === '玻璃板') {
    if (p.lastPlayedCardDef.length > 0) {
      const lastCard = p.lastPlayedCardDef[p.lastPlayedCardDef.length - 1];
      const newState = deepClone(gameState);
      newState.players[0] = p;
      newState.players[1] = t;
      const result = applyCard(newState, playerId, targetId, lastCard);
      const pIdx = result.gameState.players.findIndex(pl => pl.id === playerId);
      p = result.gameState.players[pIdx];
      t = result.gameState.players[1 - pIdx];
      msgs.push(`玻璃板复制了「${lastCard.name}」的效果`);
      result.logMessages.forEach(msg => msgs.push(msg));
      if (lastCard.costType === CostType.Action) {
        p.actionStrategyCountThisTurn = (p.actionStrategyCountThisTurn || 0) + 1;
        msgs.push('（玻璃板复制行动牌，额外消耗一次行动/锦囊次数）');
      }
    } else {
      msgs.push('玻璃板没有可复制的牌');
    }
  }


  // 侦测器：展示一张随机对手手牌，记录待猜权重
  if (card.name === '侦测器') {
    if (!isSelfTarget && t.hand.length > 0) {
      const randIdx = Math.floor(Math.random() * t.hand.length);
      const revealedCard = t.hand[randIdx];
      const w = revealedCard.weight || 0;
      msgs.push(`侦测器揭示了「${revealedCard.name}」(权重:${w})，请输入你的猜测`);
      // 将待猜信息存到玩家状态中
      p.pendingGuessCardId = revealedCard.id;
      p.pendingGuessCardWeight = w;
      p.pendingGuessCardName = revealedCard.name;
    } else {
      msgs.push('侦测器：目标手牌为空');
    }
  }

  // 附魔台：检查本回合已打出的类型
  if (card.name === '附魔台') {
    const checkTypes = [CostType.Heal, CostType.Attack, CostType.Buff, CostType.Debuff, CostType.Event];
    const played = p.playedCardTypesThisTurn || [];
    const matchedTypes = checkTypes.filter(ct => played.includes(ct));
    if (matchedTypes.length >= 4) {
      p.canEnchantDiscard = true;
      msgs.push(`附魔台触发！丢弃一张牌触发其效果并摸2张`);
    } else {
      msgs.push(`附魔台未触发：仅打出${matchedTypes.length}种类型（需4种）`);
    }
  }

  // 运输矿车：从牌组抽4张牌展示，双方轮流选
  if (card.name === '运输矿车') {
    if (p.deck.length >= 4) {
      const deckCards = p.deck.splice(0, 4);
      p.draftCards = deckCards.map(c => JSON.parse(JSON.stringify(c)));
      p.draftPlayerPick = 0; // 当前玩家先选
      p.draftPickCount = 0;
      msgs.push(`运输矿车展示了${deckCards.length}张牌，请选1张`);
    } else {
      msgs.push('运输矿车：牌组不足4张');
    }
  }

  // 烈焰粉：上一张牌造成物理伤害后打出额外造成火焰伤害
  if (card.name === '烈焰粉' && p.causePhysicalDamage) {
    p.causePhysicalDamage = false;
    damage(p, t, DamageType.Fire, 2);
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
