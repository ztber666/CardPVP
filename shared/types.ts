// ===== 卡牌消耗类型 =====
export enum CostType {
  Action = 'action',       // icon1 行动卡 - 每回合1张
  Strategy = 'strategy',   // icon2 锦囊卡 - 每回合3张
  Heal = 'heal',           // icon3 回血卡
  Attack = 'attack',       // icon4 攻击卡
  Buff = 'buff',           // icon5 增益卡
  Debuff = 'debuff',       // icon6 减益卡
  Event = 'event',         // icon7 事件卡
  Equip = 'equip',         // icon8 装备卡
  Weapon = 'weapon',       // icon9 武器卡
  Field = 'field',         // icon10 场地卡
  Counter = 'counter',     // icon11 策略卡
}

// ===== Buff 类型 =====
export enum BuffType {
  Strength = 'strength',       // buff1 力量
  Weakness = 'weakness',       // buff2 虚弱
  Resistance = 'resistance',   // buff3 抗性
  Vulnerability = 'vuln',      // buff4 易伤
  Heal = 'heal',              // buff5 回血
  Wither = 'wither',          // buff6 凋零
  Shield = 'shield',          // buff7 护盾
  FireResist = 'fireResist',  // buff8 抗火
  Poison = 'poison',          // buff9 中毒
  FireVuln = 'fireVuln',      // buff10 火焰易伤（受到火焰伤害+n）
  //Charge = 'charge',          // buff11 蓄力
  HealBoost = 'healBoost',    // buff12 治愈增强
  LockAction = 'lockAction',  // buff13 行动封锁
  LockStrategy = 'lockStrategy', // buff16 锦囊封锁
  WitherOnDraw = 'witherOnDraw', // buff18 摸牌凋零（陷阱箱）
  DamageBoost = 'damageBoost',   // buff19 伤害加成（侦测器）
  RemoveWither = 'removeWither',   // 特殊：移除凋零
  ReduceDuration = 'reduceDuration', // 特殊：减少限时状态回合
  ReduceMaxHp = 'reduceMaxHp',   // 特殊：降低生命上限
  IncreaseMaxHp = 'increaseMaxHp', // 特殊：提升生命上限
  ConditionalDiscard = 'conditionalDiscard', // 特殊：条件丢弃
  PhysicalDamage = 'phydamage',  // 物理伤害
  Damage = 'damage',             // 真伤
  DrawCard = 'drawCard',         // 摸牌
  StealCard = 'stealCard',       // 抽取目标手牌
  RevealHand = 'revealHand',     // 展示目标手牌
  ForceDiscardEquip = 'forceDiscardEquip', // 强制丢弃装备/武器/场地
  DamageOnDiscard = 'damageOnDiscard',     // 丢弃时受伤害
  HealPerBuff = 'healPerBuff',   // 每存在一种状态回1点血
  HealAll = 'healAll',           // 所有人回血
  Horde = 'horde',               // 尸潮
  Blight = 'blight',             // 枯萎
  Block = 'block',               // 格挡
}

// ===== 效果目标 =====
export type TargetType = 'self' | 'opponent';

// ===== 卡牌效果定义 =====
export interface EffectDef {
  buffType: BuffType;
  value: number;
  duration?: number;    // 持续回合数（限时状态）
  target: TargetType;
}

// ===== 卡牌定义（静态数据） =====
export interface CardDef {
  id: string;
  name: string;
  icon: string;           // emoji 或图标标识
  costType: CostType;
  effects: EffectDef[];
  description: string;
  weight?: number;         // 牌组权重（侦测器需要）
  sourcePlayerId?: string;   // 牌来源玩家ID (计算装备/场地效果时需要)
  defaultTarget: 'self' | 'opponent' | 'all'; // 默认目标（用于客户端提示）
}

// ===== 激活的 Buff（运行时数据） =====
export interface ActiveBuff {
  buffType: BuffType;
  value: number;
  stacks: number;
  remainingTurns?: number;
  sourceCardId: string;
  sourcePlayerId?: string;
}

// ===== 玩家运行时状态 =====
export interface PlayerState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  deck: CardDef[];
  hand: CardDef[];
  discardPile: CardDef[];
  buffs: ActiveBuff[];
  equipment: {
    equip?: CardDef;
    weapon?: CardDef;
    field?: CardDef;
  };
  healCountThisTurn: number;     // 回血类(icon3)消耗计数
  attackCountThisTurn: number;   // 攻击类(icon4)消耗计数
  actionStrategyCountThisTurn: number; // 行动+锦囊共享消耗计数
  handLimitBonus: number;       // 手牌上限加成（村庄+4）
  actionLimitBonus: number;     // 行动上限加成（冰原+1）
  damageOnDiscardCount: number;   // 绑定诅咒丢弃次数限制
  lastPlayedCardDef: CardDef[];
  lastPlayedCardName: string;     // 本回合上一张打出的牌名
  lastPlayedCardEffects: EffectDef[];  // 上一张牌的效果（玻璃板用）
  lastPlayedCardCostType: CostType;    // 上一张牌的消耗类型
  causePhysicalDamage: boolean;   // 上一张牌是否造成物理伤害
  canEnchantDiscard: boolean;
  pendingGuessCardId: string;     // 侦测器：待猜测的对手牌ID
  pendingGuessCardWeight: number; // 侦测器：待猜测的权重
  pendingGuessCardName?: string;  // 侦测器：待猜测的卡牌名称
  playedCardTypesThisTurn: CostType[]; // 附魔台：本回合已打出的消耗类型
  draftCards: CardDef[];          // 运输矿车：待选牌列表
  draftPlayerPick: number;        // 当前轮到谁选(0=当前玩家, 1=对手)
  draftPickCount: number;         // 已选次数
  draftPickedBy: Record<number, string>; // 运输矿车：已选标记 {卡牌索引→玩家名}
  jungleHpUpTriggered: boolean;     // 丛林：血量上限+1已触发
  pendingBucketChoice: string;       // 水桶：待选封锁类型(action/strategy)
  pendingEquipChoice: string;        // 诡异钓竿：待选装备槽位
}

// ===== 游戏阶段 =====
export enum GamePhase {
  Waiting = 'waiting',
  Playing = 'playing',
  GameOver = 'gameOver',
}

// ===== 日志条目 =====
export interface GameLogEntry {
  turnNumber: number;
  message: string;
  type?: 'endTurn' | 'warning' | 'error';
  timestamp: number;
}

// ===== 游戏全局状态 =====
export interface GameState {
  roomId: string;
  players: [PlayerState, PlayerState];
  currentTurnIndex: number;
  durationTickCounter: number; // 全局持续时间节拍器（每两次结束出牌减1回合，0/1交替）
  turnNumber: number;
  phase: GamePhase;
  log: GameLogEntry[];
  winnerId?: string;
}

// ===== 客户端动作（Socket.IO 事件负载） =====
export interface PlayCardAction {
  cardId: string;
  targetId: string;
}

// ===== 房间信息 =====
export interface RoomInfo {
  roomId: string;
  playerCount: number;
  isFull: boolean;
}

// ===== Buff 名称映射（显示用） =====
export const BUFF_NAMES: Record<BuffType, string> = {
  [BuffType.Strength]: '力量',
  [BuffType.Weakness]: '虚弱',
  [BuffType.Resistance]: '抗性',
  [BuffType.Vulnerability]: '易伤',
  [BuffType.Heal]: '生命恢复',
  [BuffType.Wither]: '凋零',
  [BuffType.Shield]: '护盾',
  [BuffType.FireResist]: '抗火',
  [BuffType.Poison]: '中毒',
  [BuffType.FireVuln]: '易燃',
  [BuffType.HealBoost]: '治愈增强',
  [BuffType.LockAction]: '行动封锁',
  [BuffType.LockStrategy]: '锦囊封锁',
  [BuffType.WitherOnDraw]: '陷阱',
  [BuffType.DamageBoost]: '暴击',
  [BuffType.RemoveWither]: '移除凋零',
  [BuffType.ReduceDuration]: '缩减时效',
  [BuffType.ReduceMaxHp]: '生命上限降低',
  [BuffType.IncreaseMaxHp]: '生命上限提升',
  [BuffType.ConditionalDiscard]: '条件丢弃',
  [BuffType.PhysicalDamage]: '物理伤害',
  [BuffType.Damage]: '龙息伤害',
  [BuffType.DrawCard]: '摸牌',
  [BuffType.StealCard]: '抽牌',
  [BuffType.RevealHand]: '展示手牌',
  [BuffType.ForceDiscardEquip]: '强制卸装',
  [BuffType.DamageOnDiscard]: '丢弃伤害',
  [BuffType.HealPerBuff]: '状态回血',
  [BuffType.HealAll]: '全体回血',
  [BuffType.Horde]: '尸潮',
  [BuffType.Blight]: '枯萎',
  [BuffType.Block]: '格挡',
};

// ===== 消耗类型名称 =====
export const COST_TYPE_NAMES: Record<CostType, string> = {
  [CostType.Action]: '行动卡',
  [CostType.Strategy]: '锦囊卡',
  [CostType.Heal]: '回血卡',
  [CostType.Attack]: '攻击卡',
  [CostType.Buff]: '增益卡',
  [CostType.Debuff]: '减益卡',
  [CostType.Event]: '事件卡',
  [CostType.Equip]: '装备卡',
  [CostType.Weapon]: '武器卡',
  [CostType.Field]: '场地卡',
  [CostType.Counter]: '策略卡',
};
