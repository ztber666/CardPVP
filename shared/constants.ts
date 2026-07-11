import { CostType, BuffType, EffectDef, CardDef } from './types';

// ===== 游戏常量 =====
export const DEFAULT_MAX_HP = 20;
export const DEFAULT_HAND_LIMIT = 10;
export const INITIAL_DRAW_COUNT = 3;
export const TURN_DRAW_COUNT = 3;
export const MAX_STRATEGY_PER_TURN = 3;
export const POISON_MAX_TRIGGER_PER_TURN = 2;

// ===== 卡牌类型图标映射 (icon列的最后一位数字 → CostType) =====
const TYPE_MAP: Record<number, CostType> = {
  1: CostType.Action,
  2: CostType.Strategy,
  3: CostType.Heal,
  4: CostType.Attack,
  5: CostType.Buff,
  6: CostType.Debuff,
  7: CostType.Event,
  8: CostType.Equip,
  9: CostType.Weapon,
  10: CostType.Field,
  11: CostType.Counter,
};

// 解析 icon 列：最后一位数字是消耗类型
function parseIcon(iconStr: string): { costType: CostType } {
  const parts = iconStr.split(',').map(Number);
  const costTypeNum = parts[parts.length - 1];
  return { costType: TYPE_MAP[costTypeNum] || CostType.Action };
}

// 便捷创建 EffectDef
function eff(buffType: BuffType, value: number, duration?: number): EffectDef {
  return { buffType, value, duration, target: 'self' };
}

// ===== 卡牌定义 =====
interface CardTemplate {
  id: string;
  name: string;
  icon: string;
  costType: CostType;
  effects: EffectDef[];
  description: string;
  weight: number;
  defaultTarget: 'self' | 'opponent' | 'all';
}

// ID 与 assets/item/{id}.png/.gif 对应
export const CARDS: CardTemplate[] = [
  // ===== 1-10 基础牌 =====
  {
    id: 'card_1', name: '苹果', icon: '3,1', weight: 10, defaultTarget: 'self',
    costType: CostType.Action,
    effects: [eff(BuffType.Heal, 3)],
    description: '回3点血',
  },
  {
    id: 'card_2', name: '烟花', icon: '4,1', weight: 20, defaultTarget: 'opponent',
    costType: CostType.Action,
    effects: [eff(BuffType.PhysicalDamage, 5)],
    description: '5点物理伤害',
  },
  {
    id: 'card_3', name: '龙息', icon: '4,1', weight: 6, defaultTarget: 'opponent',
    costType: CostType.Action,
    effects: [
      eff(BuffType.Damage, 3, 2)
    ],
    description: '3点真伤[*2]',
  },
  {
    id: 'card_4', name: '金苹果', icon: '3,1', weight: 6, defaultTarget: 'self',
    costType: CostType.Action,
    effects: [
      eff(BuffType.Heal, 2, 2)  // 每回合回2血，持续2回合
    ],
    description: '回2点血[*2]',
  },
  {
    id: 'card_5', name: '火把', icon: '5,2', weight: 5, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Strength, 1, 2),
      eff(BuffType.RemoveWither, 2),
    ],
    description: '力量+1层[*2] / 移除2层凋零',
  },
  {
    id: 'card_6', name: '灯笼', icon: '5,2', weight: 5, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Resistance, 2, 2),
      eff(BuffType.Shield, 1),
    ],
    description: '抗性+2层[*2] / 护盾+1层',
  },
  {
    id: 'card_7', name: '奶桶', icon: '7,1', weight: 2, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [eff(BuffType.ReduceDuration, 1)],
    description: '目标当前所有限时型状态持续时间-1回合',
  },
  {
    id: 'card_8', name: '灵魂火把', icon: '6,2', weight: 5, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Weakness, 2, 2),
      eff(BuffType.ReduceMaxHp, 2),
    ],
    description: '虚弱+2层[*2] / 生命上限-2点',
  },
  {
    id: 'card_9', name: '灵魂灯笼', icon: '6,2', weight: 5, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Vulnerability, 1, 2),
      eff(BuffType.Wither, 2),
    ],
    description: '易伤+1层[*2] / 增加2层凋零',
  },
  {
    id: 'card_10', name: '刷怪笼', icon: '4,1', weight: 4, defaultTarget: 'opponent',
    costType: CostType.Action,
    effects: [eff(BuffType.ConditionalDiscard, 4)],
    description: '使目标立即丢弃一张<烟花>，否则受到4点物理伤害[*2]',
  },

  // ===== 11-20 策略牌 =====
  {
    id: 'card_11', name: '紫水晶', icon: '5,2', weight: 3, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [eff(BuffType.IncreaseMaxHp, 3)],
    description: '生命上限+3点',
  },
  {
    id: 'card_12', name: '发光浆果', icon: '5,2', weight: 3, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [eff(BuffType.HealBoost, 2, 2)],
    description: '治愈增强+2层[*2]',
  },
  {
    id: 'card_13', name: '水桶', icon: '5,6,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [],
    description: '目标下一次被轮到时无法使用行动牌或锦囊牌(自选)',
  },
  {
    id: 'card_14', name: '枯萎的灌木', icon: '6,2', weight: 3, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.FireVuln, 1, 2),  // 火焰伤害+1，持续2回合
      eff(BuffType.Blight, 2, 2),    // 回血少回2点，持续2回合
    ],
    description: '受到的火焰伤害+1[*2] / 回血时少回2点血[*2]',
  },
  {
    id: 'card_15', name: '合金碎片', icon: '5,2', weight: 3, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [eff(BuffType.Block, 5, 2)],
    description: '目标获得2回合「格挡」',
  },
  {
    id: 'card_16', name: '望远镜', icon: '7,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [eff(BuffType.RevealHand, 10)],
    description: '目标展示所有手牌给出牌者',
  },
  {
    id: 'card_17', name: '萝卜钓竿', icon: '7,2', weight: 5, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [eff(BuffType.StealCard, 1)],
    description: '抽取目标一张手牌并获得',
  },
  {
    id: 'card_18', name: '诡异钓竿', icon: '7,2', weight: 4, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [],  // 效果在弹窗中处理
    description: '选择目标一张装备并使其丢弃',
  },
  {
    id: 'card_19', name: '蛋糕', icon: '3,1', weight: 4, defaultTarget: 'self',
    costType: CostType.Action,
    effects: [
      eff(BuffType.HealAll, 4)
    ],
    description: '所有人回4点血',
  },
  {
    id: 'card_20', name: '潜影盒', icon: '7,2', weight: 3, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [eff(BuffType.DrawCard, 3)],
    description: '摸3张牌',
  },

  // ===== 21-30 高级牌 =====
  {
    id: 'card_21', name: '绑定诅咒', icon: '6,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [eff(BuffType.DamageOnDiscard, 3, 2)],
    description: '目标2回合内丢弃牌时受3点魔法伤害(每回合1次)',
  },
  {
    id: 'card_22', name: '迷之炖菜', icon: '3,1', weight: 2, defaultTarget: 'self',
    costType: CostType.Action,
    effects: [eff(BuffType.HealPerBuff, 1)],
    description: '我方每存在一个状态目标回1点血',
  },
  {
    id: 'card_23', name: '钻石胸甲', icon: '8', weight: 1, defaultTarget: 'self',
    costType: CostType.Equip,
    effects: [eff(BuffType.Resistance, 1, 1)],
    description: '抗性+1层[*1] / 获得护盾时改为回对应点血',
  },
  {
    id: 'card_24', name: '金护腿', icon: '8', weight: 1, defaultTarget: 'self',
    costType: CostType.Equip,
    effects: [],
    description: '回血时超出血量上限的血量转化为护盾 / 最多同时拥有5层护盾',
  },
  {
    id: 'card_25', name: '皮革鞋子', icon: '8', weight: 1, defaultTarget: 'self',
    costType: CostType.Equip,
    effects: [],
    description: '装备目标回合摸牌量+1',
  },
  {
    id: 'card_26', name: '海龟壳', icon: '8', weight: 1, defaultTarget: 'self',
    costType: CostType.Equip,
    effects: [eff(BuffType.FireResist, 1, 1)],
    description: '免疫水桶 / 抗火[*1]',
  },
  {
    id: 'card_27', name: '三叉戟', icon: '9', weight: 1, defaultTarget: 'self',
    costType: CostType.Weapon,
    effects: [eff(BuffType.Strength, 1, 1)],
    description: '力量+1层[*1] / 攻击处于凋零状态的玩家时造成额外1点伤害',
  },
  {
    id: 'card_28', name: '烈焰棒', icon: '9', weight: 1, defaultTarget: 'self',
    costType: CostType.Weapon,
    effects: [],
    description: '造成物理伤害后丢弃一张手牌可额外造成1次2点火焰伤害',
  },
  {
    id: 'card_29', name: '玻璃板', icon: '7,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [],
    description: '作为上一张打出的牌打出，若为行动牌额外消耗一次出牌次数',
  },
  {
    id: 'card_30', name: '酿造台', icon: '9', weight: 1, defaultTarget: 'self',
    costType: CostType.Weapon,
    effects: [],
    description: '装备时可将手牌中的苹果转化为烟花，或将烟花转化为苹果',
  },

  // ===== 31-41 高级牌 =====
  {
    id: 'card_31', name: '蜘蛛眼', icon: '6,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [eff(BuffType.Poison, 3, 2)],
    description: '目标获得2回合「中毒」',
  },
  {
    id: 'card_32', name: '侦测器', icon: '5,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [eff(BuffType.RevealHand, 1)],  // 展示随机1张手牌
    description: '选择对方一张手牌猜测权重，猜中则我方下一次物理伤害×1.5(不可叠加)',
  },
  {
    id: 'card_33', name: '下界荒地', icon: '10', weight: 1, defaultTarget: 'self',
    costType: CostType.Field,
    effects: [],
    description: '丢弃牌时获得1点护盾',
  },
  {
    id: 'card_34', name: '冰原', icon: '10', weight: 1, defaultTarget: 'self',
    costType: CostType.Field,
    effects: [],
    description: '回血类和攻击类消耗次数互通',
  },
  {
    id: 'card_35', name: '陷阱箱', icon: '6,2', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Strategy,
    effects: [eff(BuffType.WitherOnDraw, 1, 1)],  // 摸牌得凋零，持续2回合
    description: '目标下回合每获得1张牌+1层凋零',
  },
  {
    id: 'card_36', name: '丛林', icon: '10', weight: 1, defaultTarget: 'self',
    costType: CostType.Field,
    effects: [],
    description: '回血时额外回复1点血 / 回血时若我方有凋零则生命上限+1(每回合1次)',
  },
  {
    id: 'card_37', name: '附魔台', icon: '7,11', weight: 2, defaultTarget: 'opponent',
    costType: CostType.Counter,
    effects: [],
    description: '本回合已打出4种类型牌后，可丢弃任意1张手牌并生效，然后摸2张牌@',
  },
  {
    id: 'card_38', name: '村庄', icon: '10', weight: 1, defaultTarget: 'self',
    costType: CostType.Field,
    effects: [],
    description: '卡牌上限+4',
  },
  {
    id: 'card_39', name: '烈焰粉', icon: '11', weight: 5, defaultTarget: 'opponent',
    costType: CostType.Counter,
    effects: [],
    description: '造成物理伤害后打出可额外造成2点火焰伤害',
  },
  {
    id: 'card_40', name: '滴水石锥', icon: '9', weight: 1, defaultTarget: 'self',
    costType: CostType.Weapon,
    effects: [],
    description: '造成物理伤害时回1点血',
  },
  {
    id: 'card_41', name: '运输矿车', icon: '7,2', weight: 3, defaultTarget: 'self',
    costType: CostType.Strategy,
    effects: [],  // 效果在引擎中处理（选牌弹窗）
    description: '从牌组抽4张牌展示，然后从自己开始轮流选择1张加入手牌',
  },
];

// ===== 根据权重构建牌组 =====
export function buildTestDeck(): CardDef[] {
  const deck: CardDef[] = [];
  for (const template of CARDS) {
    for (let i = 0; i < template.weight; i++) {
      deck.push({
        id: `${template.id}_${i}`,
        name: template.name,
        icon: template.icon,
        costType: template.costType,
        effects: template.effects,
        description: template.description,
        weight: template.weight,
        defaultTarget: template.defaultTarget,
      });
    }
  }
  return deck;
}
