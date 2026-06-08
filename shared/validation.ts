import { GameState, PlayerState, CardDef, GamePhase, CostType, BuffType, PlayCardAction } from './types';

/**
 * 动作合法性校验
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 校验出牌动作
 */
export function validatePlayCard(
  state: GameState,
  playerId: string,
  action: PlayCardAction
): ValidationResult {
  // 游戏必须处于进行中
  if (state.phase !== GamePhase.Playing) {
    return { valid: false, error: '游戏未在进行中' };
  }

  // 必须是当前回合玩家
  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.id !== playerId) {
    return { valid: false, error: '不是你的回合' };
  }

  // 卡牌必须在手牌中
  const card = currentPlayer.hand.find(c => c.id === action.cardId);
  if (!card) {
    return { valid: false, error: '卡牌不在手牌中' };
  }

  // 目标必须存在（玩家ID）
  const targetExists = state.players.some(p => p.id === action.targetId);
  if (!targetExists) {
    return { valid: false, error: '无效的目标' };
  }

  // 装备卡只能对自己使用
  const targetSelf = action.targetId === playerId;
  if (!targetSelf && (card.costType === CostType.Equip || card.costType === CostType.Weapon || card.costType === CostType.Field)) {
    return { valid: false, error: '装备卡只能对自己使用' };
  }

  // 行动封锁检查
  if (card.costType === CostType.Action && currentPlayer.buffs.some(b => b.buffType === BuffType.LockAction)) {
    return { valid: false, error: '被水桶封锁，本回合无法使用行动牌' };
  }

  // 消耗类型限制
  switch (card.costType) {
    case CostType.Action:
      if (currentPlayer.actionUsedThisTurn) {
        return { valid: false, error: '每回合只能出1张行动卡' };
      }
      break;

    case CostType.Strategy:
      if (currentPlayer.strategyCountThisTurn >= 3) {
        return { valid: false, error: '每回合最多出3张锦囊卡' };
      }
      break;

    // 装备/武器/场地卡：同类型替换无限制
    // 回血/攻击/增益/减益/事件：无特殊限制（但需要消耗行动卡位？）
    // 根据规则，行动卡和锦囊卡有明确限制，其他类型没有明确说明每回合限制

    default:
      break;
  }

  return { valid: true };
}

/**
 * 校验结束回合
 */
export function validateEndTurn(state: GameState, playerId: string): ValidationResult {
  if (state.phase !== GamePhase.Playing) {
    return { valid: false, error: '游戏未在进行中' };
  }

  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.id !== playerId) {
    return { valid: false, error: '不是你的回合，无法结束' };
  }

  return { valid: true };
}
