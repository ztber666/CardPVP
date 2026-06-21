import { consumeInPlace, damage, DamageType, heal } from './cardEngine';
import { PlayerState, ActiveBuff, BuffType } from './types';

/**
 * Buff 引擎 — 纯函数，事件驱动
 * 每个计算函数接收状态，返回新状态（不修改原对象）
 */

// ===== 工具函数 =====

export function deepClonePlayer(p: PlayerState): PlayerState {
  return JSON.parse(JSON.stringify(p));
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getBuffStacks(player: PlayerState, type: BuffType): number {
  return player.buffs
    .filter(b => b.buffType === type)
    .reduce((sum, b) => sum + b.stacks, 0);
}

export function findBuff(player: PlayerState, type: BuffType): ActiveBuff | undefined {
  return player.buffs.find(b => b.buffType === type);
}

function addBuff(
  player: PlayerState,
  type: BuffType,
  value: number,
  stacks: number,
  duration: number | undefined,
  sourceCardId: string
): PlayerState {
  const p = deepClonePlayer(player);
  // 非正数层数/强度时跳过
  if (stacks <= 0 || value <= 0) return p;

  // 同类型且剩余回合数相同 → 合并层数
  const existing = p.buffs.find(b => b.buffType === type && b.remainingTurns === duration);
  if (existing) {
    existing.stacks += stacks;
    existing.value = Math.max(existing.value, value);
    return p;
  }

  p.buffs.push({
    buffType: type,
    value,
    stacks,
    remainingTurns: duration,
    sourceCardId,
  });
  return p;
}

export function consumeBuffStacks(player: PlayerState, type: BuffType, amount: number): PlayerState {
  const p = deepClonePlayer(player);
  let remaining = amount;
  p.buffs = p.buffs.filter(b => {
    if (b.buffType !== type) return true;
    if (remaining <= 0) return true;
    const consumed = Math.min(remaining, b.stacks);
    b.stacks -= consumed;
    remaining -= consumed;
    return b.stacks > 0;
  });
  return p;
}

function removeBuff(player: PlayerState, type: BuffType): PlayerState {
  const p = deepClonePlayer(player);
  p.buffs = p.buffs.filter(b => b.buffType !== type);
  return p;
}


// ===== 应用效果到玩家 =====
export function applyEffectToPlayer(
  player: PlayerState,
  buffType: BuffType,
  value: number,
  duration: number | undefined,
  sourceCardId: string
): PlayerState {
  switch (buffType) {
    case BuffType.Strength:
      return addBuff(player, BuffType.Strength, value, value, duration, sourceCardId);
    case BuffType.Weakness:
      return addBuff(player, BuffType.Weakness, value, value, duration, sourceCardId);
    case BuffType.Resistance:
      return addBuff(player, BuffType.Resistance, value, value, duration, sourceCardId);
    case BuffType.Vulnerability:
      return addBuff(player, BuffType.Vulnerability, value, value, duration, sourceCardId);
    case BuffType.Heal:
      return addBuff(player, BuffType.Heal, value, value, duration, sourceCardId);
    case BuffType.Wither:
      return addBuff(player, BuffType.Wither, value, value, duration, sourceCardId);
    case BuffType.Shield:
      return addBuff(player, BuffType.Shield, value, value, duration, sourceCardId);
    case BuffType.FireResist:
      return addBuff(player, BuffType.FireResist, value, value, duration, sourceCardId);
    case BuffType.Poison:
      return addBuff(player, BuffType.Poison, value, value, duration, sourceCardId);
    case BuffType.FireVuln:
      return addBuff(player, BuffType.FireVuln, value, value, duration, sourceCardId);
    case BuffType.HealBoost:
      return addBuff(player, BuffType.HealBoost, value, value, duration, sourceCardId);
    case BuffType.LockAction:
      return addBuff(player, BuffType.LockAction, value, value, duration, sourceCardId);
    case BuffType.LockStrategy:
      return addBuff(player, BuffType.LockStrategy, value, value, duration, sourceCardId);
    case BuffType.WitherOnDraw:
      return addBuff(player, BuffType.WitherOnDraw, value, value, duration, sourceCardId);
    case BuffType.DamageBoost:
      return addBuff(player, BuffType.DamageBoost, value, value, duration, sourceCardId);
    case BuffType.Damage:
      return addBuff(player, BuffType.Damage, value, value, duration, sourceCardId);
    case BuffType.DamageOnDiscard:
      return addBuff(player, BuffType.DamageOnDiscard, value, value, duration, sourceCardId);
    case BuffType.HealPerBuff:
      return player;
    case BuffType.Horde:
      return addBuff(player, BuffType.Horde, value, value, duration, sourceCardId);
    case BuffType.Blight:
      return addBuff(player, BuffType.Blight, value, value, duration, sourceCardId);
    case BuffType.Block:
      return addBuff(player, BuffType.Block, value, value, duration, sourceCardId);
    default:
      return player;
  }
}

// ===== 回合开始处理 =====
export function processTurnStartBuffs(player: PlayerState): PlayerState {
  let p = deepClonePlayer(player);

  // 重置回合计数器
  p.poisonTriggerCountThisTurn = 0;

  // 治愈（buff5）：每回合开始时回复 value 点血量，duration控制持续回合数
  const healStacks = getBuffStacks(p, BuffType.Heal)
  if(healStacks > 0) heal(p, healStacks);
  // 不在这里过滤 Heal buff——由回合结束的 duration -1 机制处理移除

  // 尸潮：对附着玩家造成4点物理伤害
  const hordeStacks = getBuffStacks(p, BuffType.Horde)
  if(hordeStacks > 0) damage(p, p, DamageType.Physical, 4);

  //钻石胸甲：每回合开始时获得1层抗性
  if(player.equipment?.equip?.name === '钻石胸甲') {
    p = applyEffectToPlayer(p, BuffType.Resistance, 1, 1, 'card_23');
  }

  //海龟壳：每回合开始时获得抗火
  if(player.equipment?.equip?.name === '海龟壳') {
    p = applyEffectToPlayer(p, BuffType.FireResist, 1, 1, 'card_26');
  }

  //三叉戟：每回合开始时获得1层力量
  if(player.equipment?.weapon?.name === '三叉戟') {
    p = applyEffectToPlayer(p, BuffType.Strength, 1, 1, 'card_27');
  }

  return p;
}

// ===== 回合结束处理 =====
export function processTurnEndBuffs(player: PlayerState): PlayerState {
  let p = deepClonePlayer(player);

  p.buffs = p.buffs
    .map(buff => {
      const b = { ...buff };
      if (b.remainingTurns !== undefined) {
        b.remainingTurns -= 1;
      }
      return b;
    })
    .filter(b => {
      if (b.value <= 0) return false;
      if (b.stacks <= 0) return false;
      if (b.remainingTurns !== undefined && b.remainingTurns <= 0) return false;
      return true;
    });

  return p;
}
