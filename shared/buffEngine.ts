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

function getBuffStacks(player: PlayerState, type: BuffType): number {
  return player.buffs
    .filter(b => b.buffType === type)
    .reduce((sum, b) => sum + b.stacks, 0);
}

function findBuff(player: PlayerState, type: BuffType): ActiveBuff | undefined {
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
  p.buffs.push({
    buffType: type,
    value,
    stacks,
    remainingTurns: duration,
    sourceCardId,
  });
  return p;
}

function consumeBuffStacks(player: PlayerState, type: BuffType, amount: number): PlayerState {
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

// ===== 伤害计算 =====
export interface DamageResult {
  damage: number;       // 最终实际伤害值（≥0）
  newAttacker: PlayerState;
  newDefender: PlayerState;
}

/**
 * 计算物理伤害，考虑所有相关 Buff
 */
export function calculateDamage(
  base: number,
  attacker: PlayerState,
  defender: PlayerState,
  isFire: boolean = false
): DamageResult {
  let attacker_ = deepClonePlayer(attacker);
  let defender_ = deepClonePlayer(defender);

  // 基础伤害取整（非正数视为0，但仍算1次伤害事件）
  let damage = Math.max(0, base);

  // 潮湿：免疫火焰伤害
  if (isFire && findBuff(defender_, BuffType.Wet)) {
    return { damage: 0, newAttacker: attacker_, newDefender: defender_ };
  }

  // 攻击者 Buff
  damage += getBuffStacks(attacker_, BuffType.Strength);
  damage -= getBuffStacks(attacker_, BuffType.Weakness);

  // 防御者 Buff
  if (isFire) {
    damage -= getBuffStacks(defender_, BuffType.FireResist);
    // 枯萎：受到火焰伤害时消耗n层，伤害+n
    const bstacks = getBuffStacks(defender_, BuffType.Blight);
    if (bstacks > 0) {
      const consume = Math.min(bstacks, Math.max(0, damage));
      if (consume > 0) {
        defender_ = consumeBuffStacks(defender_, BuffType.Blight, consume);
        damage += consume;
      }
    }
  } else {
    damage -= getBuffStacks(defender_, BuffType.Resistance);
  }
  damage += getBuffStacks(defender_, BuffType.Vulnerability);

  // 护盾（物理伤害或火焰伤害可触发）
  if (!isFire || isFire) {
    const shieldStacks = getBuffStacks(defender_, BuffType.Shield);
    if (shieldStacks > 0) {
      const blocked = Math.min(shieldStacks, Math.max(0, damage));
      defender_ = consumeBuffStacks(defender_, BuffType.Shield, blocked);
      damage -= blocked;
      // 钻石胸甲：护盾消耗时移除2层凋零
      if (blocked > 0 && defender_.equipment?.equip?.name === '钻石胸甲') {
        const ws = getBuffStacks(defender_, BuffType.Wither);
        if (ws > 0) defender_ = consumeBuffStacks(defender_, BuffType.Wither, 2);
      }
    }
  }

  // 蓄力：消耗全部层数，增加等量力量，给目标加等量凋零
  const chargeStacks = getBuffStacks(attacker_, BuffType.Charge);
  if (chargeStacks > 0 && damage > 0) {
    attacker_ = consumeBuffStacks(attacker_, BuffType.Charge, chargeStacks);
    damage += chargeStacks;
    // 被伤害者获得凋零（效果量 = 蓄力层数）
    defender_ = addBuff(defender_, BuffType.Wither, 1, chargeStacks, undefined, attacker_.id);
  }

  damage = Math.max(0, damage);
  return { damage, newAttacker: attacker_, newDefender: defender_ };
}

// ===== 回血计算 =====
export interface HealResult {
  heal: number;            // 实际回血量
  newTarget: PlayerState;
  poisonDamage: number;    // 中毒造成的伤害
}

export function calculateHeal(base: number, target: PlayerState): HealResult {
  let target_ = deepClonePlayer(target);
  let heal = Math.max(0, base);

  // 治愈增强：回血量 +额外值
  const healBoostBuff = findBuff(target_, BuffType.HealBoost);
  if (healBoostBuff) {
    heal += healBoostBuff.stacks;
  }

  // 凋零：消耗1层，减少1点回血
  const witherBuff = findBuff(target_, BuffType.Wither);
  if (witherBuff && witherBuff.stacks > 0) {
    target_ = consumeBuffStacks(target_, BuffType.Wither, 1);
    heal = Math.max(0, heal - 1);
  }

  // 枯萎：消耗n层，减少n点回血
  const blightStacks = getBuffStacks(target_, BuffType.Blight);
  if (blightStacks > 0 && heal > 0) {
    const consume = Math.min(blightStacks, heal);
    target_ = consumeBuffStacks(target_, BuffType.Blight, consume);
    heal = Math.max(0, heal - consume);
  }

  // 执行回血
  const oldHp = target_.hp;
  target_.hp = Math.min(target_.maxHp, target_.hp + heal);
  const overflow = (oldHp + heal) - target_.hp;

  // 金护腿：溢出治疗转化为护盾（最多6点）
  if (overflow > 0 && target_.equipment?.equip?.name === '金护腿') {
    const currentShield = getBuffStacks(target_, BuffType.Shield);
    const addShield = Math.min(overflow, 6 - currentShield);
    if (addShield > 0) {
      target_ = addBuff(target_, BuffType.Shield, addShield, addShield, undefined, target_.id);
    }
  }

  // 中毒：回血后扣2HP（每回合限2次）
  let poisonDamage = 0;
  const poisonBuff = findBuff(target_, BuffType.Poison);
  if (poisonBuff && target_.poisonTriggerCountThisTurn < 2) {
    poisonDamage = 2;
    target_.hp = Math.max(0, target_.hp - poisonDamage);
    target_.poisonTriggerCountThisTurn += 1;
  }

  return { heal, newTarget: target_, poisonDamage };
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
      return addBuff(player, BuffType.Strength, value, value, undefined, sourceCardId);
    case BuffType.Weakness:
      return addBuff(player, BuffType.Weakness, value, value, duration, sourceCardId);
    case BuffType.Resistance:
      return addBuff(player, BuffType.Resistance, value, value, duration, sourceCardId);
    case BuffType.Vulnerability:
      return addBuff(player, BuffType.Vulnerability, value, value, duration, sourceCardId);
    case BuffType.Heal:
      // 回血由 calculateHeal 处理，这里返回原状态
      return player;
    case BuffType.Wither:
      return addBuff(player, BuffType.Wither, value, value, duration, sourceCardId);
    case BuffType.Shield:
      return addBuff(player, BuffType.Shield, value, value, duration, sourceCardId);
    case BuffType.FireResist:
      return addBuff(player, BuffType.FireResist, value, value, duration, sourceCardId);
    case BuffType.Poison:
      return addBuff(player, BuffType.Poison, value, value, duration, sourceCardId);
    case BuffType.Blight: {
      // 潮湿免疫枯萎
      if (findBuff(player, BuffType.Wet)) return player;
      return addBuff(player, BuffType.Blight, value, value, duration, sourceCardId);
    }
    case BuffType.Charge:
      return addBuff(player, BuffType.Charge, value, value, undefined, sourceCardId);
    case BuffType.Thorns:
      return addBuff(player, BuffType.Thorns, value, value, duration, sourceCardId);
    case BuffType.Wet: {
      let w = addBuff(player, BuffType.Wet, value, value, duration, sourceCardId);
      // 潮湿移除枯萎
      w = removeBuff(w, BuffType.Blight);
      return w;
    }
    case BuffType.HealBoost:
      return addBuff(player, BuffType.HealBoost, value, value, 1, sourceCardId);
    case BuffType.LockAction:
      return addBuff(player, BuffType.LockAction, value, value, duration, sourceCardId);
    case BuffType.Damage:
      return player;
    case BuffType.DamageOnDiscard:
      return addBuff(player, BuffType.DamageOnDiscard, value, value, duration, sourceCardId);
    case BuffType.HealPerBuff:
      return player;
    default:
      return player;
  }
}

// ===== 回合开始处理 =====
export function processTurnStartBuffs(player: PlayerState): PlayerState {
  let p = deepClonePlayer(player);

  // 尖刺：每回合轮到附着对象时增加2层凋零
  // 注意：这里"轮到"应该是指回合开始时，给对手加
  // 尖刺的实际效果在 gameEngine 中处理，因为需要跨玩家
  // 这里只是重置回合计数器
  p.poisonTriggerCountThisTurn = 0;

  // 刷新装备状态（装备在轮到自己回合时刷新状态）
  // 目前装备的"刷新"概念未在规则中明确定义为具体效果，保留钩子

  return p;
}

// ===== 回合结束处理 =====
export function processTurnEndBuffs(player: PlayerState): PlayerState {
  let p = deepClonePlayer(player);

  // 限时状态持续回合数 -1，强度或时长为0/负时移除
  p.buffs = p.buffs
    .map(buff => {
      // 深度拷贝避免修改原始引用
      const b = { ...buff };
      if (b.remainingTurns !== undefined) {
        b.remainingTurns -= 1;
      }
      return b;
    })
    .filter(b => {
      // 强度必须为正数
      if (b.value <= 0) return false;
      // 层数必须为正数
      if (b.stacks <= 0) return false;
      // 有限时且剩余回合≤0则移除
      if (b.remainingTurns !== undefined && b.remainingTurns <= 0) return false;
      return true;
    });

  return p;
}
