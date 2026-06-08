/**
 * 游戏引擎快速验证脚本
 * 模拟一局完整对战
 */

import { createGame, initGame, startTurn, playCard, endTurn, checkGameOver } from './gameEngine';
import { GamePhase, CostType } from './types';

// 创建游戏
let state = createGame('test01', 'p1', '玩家A', 'p2', '玩家B');
console.log('===== 游戏初始化 =====');
console.log(`玩家A: HP ${state.players[0].hp}/${state.players[0].maxHp}`);
console.log(`玩家B: HP ${state.players[1].hp}/${state.players[1].maxHp}`);
console.log(`牌组大小: A=${state.players[0].deck.length}, B=${state.players[1].deck.length}`);
console.log();

// 初始化和洗牌
state = initGame(state);
console.log('===== 开局 =====');
const first = state.currentTurnIndex;
console.log(`先手: ${state.players[first].name}`);
console.log(`玩家A 手牌: ${state.players[0].hand.length}张`);
console.log(`玩家B 手牌: ${state.players[1].hand.length}张`);
console.log();

// 开始第一个回合
state = startTurn(state);
console.log('===== 第1回合 =====');
console.log(`当前玩家: ${state.players[state.currentTurnIndex].name}`);
const cp = state.players[state.currentTurnIndex];
console.log(`手牌: ${cp.hand.length}张`);
const firstCard = cp.hand[0] || cp.hand[1];
if (firstCard) {
  console.log(`尝试出牌: ${firstCard.name} (${firstCard.description})`);
  const oppId = state.players[1 - state.currentTurnIndex].id;
  const result = playCard(state, { cardId: firstCard.id, targetId: oppId }, cp.id);
  if (result.success) {
    state = result.gameState;
    console.log(`  出牌成功! ${result.messages.join(', ')}`);
    console.log(`  对手HP: ${state.players[1 - state.currentTurnIndex].hp}`);
    console.log(`  当前玩家HP: ${state.players[state.currentTurnIndex].hp}`);
  } else {
    console.log(`  出牌失败: ${result.error}`);
  }
}
console.log();

// 结束回合
console.log('===== 结束第1回合 =====');
state = endTurn(state);
state = startTurn(state);
console.log(`当前玩家: ${state.players[state.currentTurnIndex].name}`);
console.log(`手牌: ${state.players[state.currentTurnIndex].hand.length}张`);
console.log();

// 模拟出牌攻击
const cp2 = state.players[state.currentTurnIndex];
const attackCard = cp2.hand.find(c => c.costType === CostType.Action || c.costType === CostType.Attack);
if (attackCard) {
  console.log(`出牌: ${attackCard.name}`);
  const oppId2 = state.players[1 - state.currentTurnIndex].id;
  const result2 = playCard(state, { cardId: attackCard.id, targetId: oppId2 }, cp2.id);
  if (result2.success) {
    state = result2.gameState;
    console.log(`  对手HP: ${state.players[1 - state.currentTurnIndex].hp}`);
  }
}

// 测试自我目标（Player A 对自己使用回血或装备）
console.log();
console.log('===== 自我目标测试 =====');
console.log(`玩家A 当前HP: ${state.players[0].hp}, 手牌: ${state.players[0].hand.length}张`);
// 寻找非行动卡（回血或装备）做自目标测试
const selfTargetCard = state.players[0].hand.find(c =>
  c.costType === CostType.Heal || c.costType === CostType.Equip
);
if (selfTargetCard) {
  const result3 = playCard(state, { cardId: selfTargetCard.id, targetId: state.players[0].id }, state.players[0].id);
  if (result3.success) {
    state = result3.gameState;
    console.log(`对自己使用 ${selfTargetCard.name}`);
    console.log(`  结果: ${result3.messages.join('; ')}`);
    console.log(`  玩家A HP: ${state.players[0].hp}`);
    console.log(`  玩家A 手牌: ${state.players[0].hand.length}张`);
    console.log(`  行动标记: ${state.players[0].actionUsedThisTurn} (应该还是true)`);
  } else {
    console.log(`无法使用 ${selfTargetCard.name}: ${result3.error}`);
  }
} else {
  console.log('手牌中没有回血或装备卡用于自目标测试');
}

console.log();
console.log('===== 结果 =====');
console.log(`回合数: ${state.turnNumber}`);
console.log(`游戏阶段: ${state.phase}`);
console.log(`玩家A HP: ${state.players[0].hp}`);
console.log(`玩家B HP: ${state.players[1].hp}`);
console.log(`日志条数: ${state.log.length}`);

const over = checkGameOver(state);
console.log(`游戏结束: ${over.isOver}, 赢家: ${over.winnerId || '无'}`);
console.log();
console.log('===== 日志 =====');
state.log.slice(-5).forEach(l => console.log(`  [${l.turnNumber}] ${l.message}`));
console.log();
console.log('✅ 引擎验证完毕!');
