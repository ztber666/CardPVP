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

  // 永久状态（无持续时间）且已有同类型永久状态 → 合并层数
  if (duration === undefined) {
    const existing = p.buffs.find(b => b.buffType === type && b.remainingTurns === undefined);
    if (existing) {
      existing.stacks += stacks;
      existing.value = Math.max(existing.value, value);
      return p;
    }
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

  // 攻击者 Buff
  damage += getBuffStacks(attacker_, BuffType.Strength);
  damage -= getBuffStacks(attacker_, BuffType.Weakness);

  // 防御者 Buff
  if (isFire) {
    // 抗火：免疫火焰伤害
    if (getBuffStacks(defender_, BuffType.FireResist) > 0) {
      return { damage: 0, newAttacker: attacker_, newDefender: defender_ };
    }
    // 火焰易伤：受到火焰伤害时消耗n层，伤害+n
    const fvStacks = getBuffStacks(defender_, BuffType.FireVuln);
    if (fvStacks > 0) {
      const consume = Math.min(fvStacks, Math.max(0, damage));
      if (consume > 0) {
        defender_ = consumeBuffStacks(defender_, BuffType.FireVuln, consume);
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

  // 丛林（场地）：回血时额外回复1点血
  if (target_.equipment?.field?.name === '丛林') {
    heal += 1;
  }

  // 凋零：消耗1层，减少1点回血
  const witherBuff = findBuff(target_, BuffType.Wither);
  if (witherBuff && witherBuff.stacks > 0) {
    target_ = consumeBuffStacks(target_, BuffType.Wither, 1);
    heal = Math.max(0, heal - 1);
  }

  // 执行回血
  const oldHp = target_.hp;
  target_.hp = Math.min(target_.maxHp, target_.hp + heal);
  const overflow = (oldHp + heal) - target_.hp;

  // 丛林：回血时若有凋零则生命上限+1（每回合1次）
  if (target_.equipment?.field?.name === '丛林' && heal > 0 && !target_.jungleHpUpTriggered) {
    const hasWither = target_.buffs.some(b => b.buffType === BuffType.Wither && b.stacks > 0);
    if (hasWither) {
      target_.maxHp += 1;
      target_.jungleHpUpTriggered = true;
    }
  }

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
      return addBuff(player, BuffType.Strength, value, value, duration, sourceCardId);
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
    case BuffType.FireVuln:
      return addBuff(player, BuffType.FireVuln, value, value, duration, sourceCardId);
    case BuffType.Charge:
      return addBuff(player, BuffType.Charge, value, value, duration, sourceCardId);
    case BuffType.HealBoost:
      return addBuff(player, BuffType.HealBoost, value, value, duration, sourceCardId);
    case BuffType.LockAction:
      return addBuff(player, BuffType.LockAction, value, value, duration, sourceCardId);
    case BuffType.LockStrategy:
      return addBuff(player, BuffType.LockStrategy, value, value, duration, sourceCardId);
    case BuffType.FireDamage:
      return addBuff(player, BuffType.FireDamage, value, value, duration, sourceCardId);
    case BuffType.WitherOnDraw:
      return addBuff(player, BuffType.WitherOnDraw, value, value, duration, sourceCardId);
    case BuffType.DamageBoost:
      return addBuff(player, BuffType.DamageBoost, value, value, duration, sourceCardId);
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

  // 重置回合计数器
  p.poisonTriggerCountThisTurn = 0;

  // 治愈（buff5）：每回合开始时回复 value 点血量，duration控制持续回合数
  const healBuffs = p.buffs.filter(b => b.buffType === BuffType.Heal);
  for (const hb of healBuffs) {
    if (hb.value > 0) {
      p.hp = Math.min(p.maxHp, p.hp + hb.value);
    }
  }
  // 不在这里过滤 Heal buff——由回合结束的 duration -1 机制处理移除

  // 刷怪笼（条件丢弃）：每回合检查手牌是否有烟花
  const cdBuff = p.buffs.find(b => b.buffType === BuffType.ConditionalDiscard);
  if (cdBuff && cdBuff.stacks > 0) {
    const fireworkIdx = p.hand.findIndex(c => c.name === '烟花');
    if (fireworkIdx !== -1) {
      const [discarded] = p.hand.splice(fireworkIdx, 1);
      p.discardPile.push(discarded);
    } else {
      p.hp = Math.max(0, p.hp - cdBuff.value);
    }
    cdBuff.stacks -= 1;
  }
  p.buffs = p.buffs.filter(b => b.buffType !== BuffType.ConditionalDiscard || b.stacks > 0);

  // 火焰伤害（灼烧）：每回合开始时消耗全部灼烧层数，受到等量火焰伤害
  const fireStacks = getBuffStacks(p, BuffType.FireDamage);
  if (fireStacks > 0) {
    p = consumeBuffStacks(p, BuffType.FireDamage, fireStacks);
    const emptyAttacker: PlayerState = JSON.parse(JSON.stringify(p));
    emptyAttacker.id = 'burn';
    emptyAttacker.buffs = [];
    const result = calculateDamage(fireStacks, emptyAttacker, p, true);
    p = result.newDefender;
  }

  return p;
}

// ===== 回合结束处理 =====
export function processTurnEndBuffs(player: PlayerState): PlayerState {
  let p = deepClonePlayer(player);

  // 弩：未使用行动牌时获得1层蓄力（上限3层）
  if (p.equipment?.weapon?.name === '弩' && !p.actionUsedThisTurn) {
    const currentCharge = getBuffStacks(p, BuffType.Charge);
    if (currentCharge < 3) {
      p = addBuff(p, BuffType.Charge, 1, 1, undefined, 'crossbow_charge');
    }
  }

  // 海龟壳：结束出牌时移除1层凋零
  if (p.equipment?.equip?.name === '海龟壳') {
    const ws = getBuffStacks(p, BuffType.Wither);
    if (ws > 0) p = consumeBuffStacks(p, BuffType.Wither, 1);
  }

  // 限时状态持续回合数 -1，强度或时长为0/负时移除
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
