import { displayMessage } from '../client/src/store/notificationStore';
import {  damage, DamageType, heal } from './cardEngine';
import { PlayerState, ActiveBuff, BuffType } from './types';

/**
 * Buff 引擎 — 纯函数，事件驱动
 */

// ===== 工具函数 =====

export function deepClonePlayer(p: PlayerState): PlayerState {
  return JSON.parse(JSON.stringify(p));
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getBuffStacks(player: PlayerState, type: BuffType, sourcePlayerId?: string): number {
  return player.buffs
    .filter(b => b.buffType === type && (!sourcePlayerId || b.sourcePlayerId === sourcePlayerId))
    .reduce((sum, b) => sum + b.stacks, 0);
}

export function findBuff(player: PlayerState, type: BuffType): ActiveBuff | undefined {
  return player.buffs.find(b => b.buffType === type);
}

// ===== 应用效果到玩家 =====
export function applyEffectToPlayer(
  player: PlayerState,
  buffType: BuffType,
  value: number,
  duration: number | undefined,
  sourceCardId: string,
  sourcePlayerId?: string,
) {
  const stacks = value; // 每次应用效果时，value即为层数/强度
  // 非正数层数/强度时跳过
  if (stacks <= 0 || value <= 0) return player;

  // 钻石胸甲
  if(player.equipment?.equip?.name === '钻石胸甲' && buffType === BuffType.Shield) {
    heal(player, player, value);
    displayMessage(`${player.name}装备了钻石胸甲，${value}点护盾转化为血量`);
    return;
  }
  // 同类型且剩余回合数相同 → 合并层数
  const existing = player.buffs.find(b => b.buffType === buffType && b.remainingTurns === duration);
  if (existing) {
    existing.stacks += stacks;
    existing.value = Math.max(existing.value, value);
    return;
  }

  player.buffs.push({
    buffType: buffType,
    value,
    stacks,
    remainingTurns: duration,
    sourceCardId,
    sourcePlayerId,
  });
}

// ===== 回合开始处理 =====
export function processTurnStartBuffs(player: PlayerState, opponent: PlayerState, opponentId: string): PlayerState {
  let p = deepClonePlayer(player);

  // 龙息 / 尸潮：来自对手的 debuff，用 opponentId 过滤
  const isOpponent = opponent.id === opponentId;
  const source = isOpponent ? opponent : p;
  const damageStacks = getBuffStacks(p, BuffType.Damage, opponentId);
  if(damageStacks > 0) damage(source, p, DamageType.Real, damageStacks, false);
  const hordeStacks = getBuffStacks(p, BuffType.Horde, opponentId);
  if(hordeStacks > 0) damage(source, p, DamageType.Physical, hordeStacks, true);
  // 治愈：来自对手的 buff，用 opponentId 过滤
  const healStacks = getBuffStacks(p, BuffType.Heal, opponentId);
  if(healStacks > 0) heal(source, p, healStacks);

  if (isOpponent) opponent = source;
  
  //钻石胸甲：每回合开始时获得1层抗性
  if(player.equipment?.equip?.name === '钻石胸甲' && player.equipment?.equip?.sourcePlayerId === opponentId) {
    applyEffectToPlayer(p, BuffType.Resistance, 1, 1, 'card_23', p.id);
  }

  //海龟壳：每回合开始时获得抗火
  if(player.equipment?.equip?.name === '海龟壳' && player.equipment?.equip?.sourcePlayerId === opponentId) {
    applyEffectToPlayer(p, BuffType.FireResist, 1, 1, 'card_26', p.id);
  }

  //三叉戟：每回合开始时获得1层力量
  if(player.equipment?.weapon?.name === '三叉戟' && player.equipment?.weapon?.sourcePlayerId === opponentId) {
    applyEffectToPlayer(p, BuffType.Strength, 1, 1, 'card_27', p.id);
  }

  return p;
}

// ===== 回合结束处理 =====
export function processTurnEndBuffs(player: PlayerState, opponentId: string): PlayerState {
  let p = deepClonePlayer(player);

  p.buffs = p.buffs
    .map(buff => {
      const b = { ...buff };
      if (b.remainingTurns !== undefined && b.sourcePlayerId === opponentId) {
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
