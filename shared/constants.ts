import { CostType, BuffType, EffectDef, CardDef } from './types';

// ===== 游戏常量 =====
export const DEFAULT_MAX_HP = 10;
export const DEFAULT_HAND_LIMIT = 10;
export const INITIAL_DRAW_COUNT = 2;
export const TURN_DRAW_COUNT = 3;
export const MAX_STRATEGY_PER_TURN = 3;
export const POISON_MAX_TRIGGER_PER_TURN = 2;

// ===== 卡牌类型图标映射 (icon列的第一个数字 → CostType) =====
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

// 解析 icon 列：最后一位数字是消耗类型，前面的数字是显示图标
function parseIcon(iconStr: string): { displayType: number; costType: CostType } {
  const parts = iconStr.split(',').map(Number);
  const costTypeNum = parts[parts.length - 1];
  return {
    displayType: parts[0],
    costType: TYPE_MAP[costTypeNum] || CostType.Action,
  };
}

// 便捷创建 EffectDef
function eff(buffType: BuffType, value: number, target: 'self' | 'opponent', duration?: number): EffectDef {
  return { buffType, value, target, duration };
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
}

// ID 与 assets/item/{id}.png 对应
export const CARDS: CardTemplate[] = [
  {
    id: 'card_1',
    name: '苹果',
    icon: '🍎',
    costType: CostType.Action,
    effects: [eff(BuffType.Heal, 4, 'self')],
    description: '回4点血量',
    weight: 9,
  },
  {
    id: 'card_2',
    name: '烟花',
    icon: '🎆',
    costType: CostType.Action,
    effects: [eff(BuffType.Damage, 5, 'opponent')],
    description: '5点物理伤害',
    weight: 16,
  },
  {
    id: 'card_3',
    name: '龙息',
    icon: '🐉',
    costType: CostType.Action,
    effects: [
      eff(BuffType.Damage, 6, 'opponent'),
      eff(BuffType.Vulnerability, 1, 'opponent', 2),
    ],
    description: '3点伤害[*2] / 易伤+1层持续2回合',
    weight: 3,
  },
  {
    id: 'card_4',
    name: '金苹果',
    icon: '✨',
    costType: CostType.Action,
    effects: [
      eff(BuffType.Resistance, 3, 'self', 2),
      eff(BuffType.Heal, 4, 'self'),
    ],
    description: '抗性+3持续2回合 / 回2点血量[*2]',
    weight: 2,
  },
  {
    id: 'card_5',
    name: '火把',
    icon: '🔥',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Strength, 1, 'self', 3),
      eff(BuffType.RemoveWither, 1, 'self'),
    ],
    description: '力量+1持续3回合 / -1层凋零',
    weight: 4,
  },
  {
    id: 'card_6',
    name: '灯笼',
    icon: '🏮',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Resistance, 2, 'self', 2),
      eff(BuffType.Shield, 1, 'self'),
    ],
    description: '抗性+2持续2回合 / 护盾+1层',
    weight: 4,
  },
  {
    id: 'card_7',
    name: '奶桶',
    icon: '🥛',
    costType: CostType.Action,
    effects: [eff(BuffType.ReduceDuration, 1, 'opponent')],
    description: '目标所有限时状态剩余回合-1',
    weight: 2,
  },
  {
    id: 'card_8',
    name: '灵魂火把',
    icon: '💀',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Weakness, 2, 'opponent', 2),
      eff(BuffType.ReduceMaxHp, 10, 'opponent'),
    ],
    description: '虚弱+2持续2回合 / 生命上限-10%',
    weight: 3,
  },
  {
    id: 'card_9',
    name: '灵魂灯笼',
    icon: '👻',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.Vulnerability, 1, 'opponent', 2),
      eff(BuffType.Wither, 2, 'opponent'),
    ],
    description: '易伤+1持续2回合 / +2层凋零',
    weight: 4,
  },
  {
    id: 'card_10',
    name: '刷怪笼',
    icon: '⚙️',
    costType: CostType.Action,
    effects: [
      eff(BuffType.ConditionalDiscard, 3, 'opponent'),
    ],
    description: '使目标丢弃<烟花>，否则-3点血量（持续2回合）',
    weight: 3,
  },
  {
    id: 'card_11',
    name: '紫水晶',
    icon: '💜',
    costType: CostType.Strategy,
    effects: [eff(BuffType.IncreaseMaxHp, 3, 'self')],
    description: '生命上限+3',
    weight: 3,
  },
  {
    id: 'card_12',
    name: '发光浆果',
    icon: '🫐',
    costType: CostType.Strategy,
    effects: [eff(BuffType.HealBoost, 1, 'self')],
    description: '本回合回血时多回1点血',
    weight: 4,
  },
  {
    id: 'card_13',
    name: '水桶',
    icon: '🪣',
    costType: CostType.Strategy,
    effects: [
      eff(BuffType.LockAction, 1, 'opponent', 2),
      eff(BuffType.Wet, 1, 'opponent', 2),
    ],
    description: '使目标下一回合无法使用行动牌 / 潮湿2回合',
    weight: 1,
  },
  // ===== 新卡牌 14-25 =====
  {
    id: 'card_14', name: '枯萎的灌木', icon: '🌿',
    costType: CostType.Strategy,
    effects: [eff(BuffType.Blight, 3, 'opponent')],
    description: '附着3层枯萎',
    weight: 3,
  },
  {
    id: 'card_15', name: '合金碎片', icon: '⚙️',
    costType: CostType.Strategy,
    effects: [eff(BuffType.Resistance, 5, 'self', 2)],
    description: '下回合受到的物理伤害-5点',
    weight: 3,
  },
  {
    id: 'card_16', name: '望远镜', icon: '🔭',
    costType: CostType.Strategy,
    effects: [eff(BuffType.RevealHand, 3, 'opponent')],
    description: '目标展示随机3张手牌',
    weight: 3,
  },
  {
    id: 'card_17', name: '萝卜钓竿', icon: '🥕',
    costType: CostType.Strategy,
    effects: [eff(BuffType.StealCard, 1, 'opponent')],
    description: '抽取目标一张手牌',
    weight: 3,
  },
  {
    id: 'card_18', name: '诡异钓竿', icon: '🎣',
    costType: CostType.Strategy,
    effects: [eff(BuffType.ForceDiscardEquip, 1, 'opponent')],
    description: '使目标丢弃一张装备/武器/场地',
    weight: 3,
  },
  {
    id: 'card_19', name: '蛋糕', icon: '🎂',
    costType: CostType.Action,
    effects: [
      eff(BuffType.IncreaseMaxHp, 2, 'self'),
      eff(BuffType.HealAll, 3, 'self'),
      eff(BuffType.Heal, 2, 'self'),
    ],
    description: '目标血量上限+2 / 所有人回3点血 / 目标回2点血',
    weight: 4,
  },
  {
    id: 'card_20', name: '潜影盒', icon: '📦',
    costType: CostType.Strategy,
    effects: [eff(BuffType.DrawCard, 3, 'self')],
    description: '摸3张牌',
    weight: 3,
  },
  {
    id: 'card_21', name: '绑定诅咒', icon: '🔗',
    costType: CostType.Strategy,
    effects: [eff(BuffType.DamageOnDiscard, 2, 'opponent', 2)],
    description: '目标2回合内丢弃牌时受2点伤害',
    weight: 2,
  },
  {
    id: 'card_22', name: '迷之炖菜', icon: '🍲',
    costType: CostType.Action,
    effects: [eff(BuffType.HealPerBuff, 1, 'self')],
    description: '每存在一种状态回1点血',
    weight: 2,
  },
  {
    id: 'card_23', name: '钻石胸甲', icon: '💎',
    costType: CostType.Equip,
    effects: [
      eff(BuffType.Resistance, 1, 'self', 1),
    ],
    description: '抗性+1 / 拥有护盾时受伤移除2层凋零',
    weight: 1,
  },
  {
    id: 'card_24', name: '金护腿', icon: '🦵',
    costType: CostType.Equip,
    effects: [
      eff(BuffType.Shield, 2, 'self'),
    ],
    description: '回血溢出转化为护盾 / 最多6点护盾',
    weight: 1,
  },
  {
    id: 'card_25', name: '皮革鞋子', icon: '👟',
    costType: CostType.Equip,
    effects: [],
    description: '回合摸牌量+1',
    weight: 1,
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
      });
    }
  }
  return deck;
}
