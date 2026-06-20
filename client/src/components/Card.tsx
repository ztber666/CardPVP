import { CardDef, CostType, COST_TYPE_NAMES } from '@shared/types';
import { getCardImageUrl } from '../utils/cardImage';

interface Props {
  card: CardDef;
  compact?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  hidden?: boolean;
}

const TYPE_BADGE: Record<string, string> = {
  [CostType.Action]:  'bg-accent-attack/15 text-accent-attack',
  [CostType.Strategy]:'bg-accent-equip/15 text-accent-equip',
  [CostType.Heal]:    'bg-accent-heal/15 text-accent-heal',
  [CostType.Attack]:  'bg-accent-attack/15 text-accent-attack',
  [CostType.Buff]:    'bg-accent-buff/15 text-accent-buff',
  [CostType.Debuff]:  'bg-purple-100 text-purple-700',
  [CostType.Equip]:   'bg-accent-equip/15 text-accent-equip',
  [CostType.Weapon]:  'bg-accent-equip/15 text-accent-equip',
  [CostType.Field]:   'bg-accent-equip/15 text-accent-equip',
  [CostType.Event]:   'bg-blue-100 text-blue-700',
  [CostType.Counter]: 'bg-cyan-100 text-cyan-700',
};

const TYPE_BORDER: Record<string, string> = {
  [CostType.Action]:  'border-l-accent-attack',
  [CostType.Strategy]:'border-l-accent-equip',
  [CostType.Heal]:    'border-l-accent-heal',
  [CostType.Attack]:  'border-l-accent-attack',
  [CostType.Buff]:    'border-l-accent-buff',
  [CostType.Debuff]:  'border-l-purple-500',
  [CostType.Equip]:   'border-l-accent-equip',
  [CostType.Weapon]:  'border-l-accent-equip',
  [CostType.Field]:   'border-l-accent-equip',
  [CostType.Event]:   'border-l-blue-500',
  [CostType.Counter]: 'border-l-cyan-500',
};

const COST_TYPE_LABELS: Record<string, string> = {
  [CostType.Action]: '行动', [CostType.Strategy]: '锦囊', [CostType.Heal]: '回血',
  [CostType.Attack]: '攻击', [CostType.Buff]: '增益', [CostType.Debuff]: '减益',
  [CostType.Event]: '事件', [CostType.Equip]: '装备', [CostType.Weapon]: '武器',
  [CostType.Field]: '场地', [CostType.Counter]: '策略',
};

export default function Card({ card, compact, disabled, selected, onClick, hidden }: Props) {
  // 卡背
  if (hidden) {
    return (
      <div className="w-14 h-20 bg-gradient-to-br from-card-bg to-card-border/30 border border-card-border rounded-lg flex items-center justify-center shadow-card select-none">
        <span className="text-xl font-bold text-text-secondary/30">?</span>
      </div>
    );
  }

  const badgeCls = TYPE_BADGE[card.costType] || TYPE_BADGE[CostType.Action];
  const borderCls = TYPE_BORDER[card.costType] || TYPE_BORDER[CostType.Action];
  const imgUrl = getCardImageUrl(card.id);

  // ===== 紧凑模式（手牌显示） =====
  if (compact) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          w-14 h-20 bg-card-bg border border-card-border rounded-lg
          flex flex-col items-center justify-start gap-0.5 px-1 pt-1
          shadow-card select-none transition-ios
          border-l-[3px] ${borderCls}
          ${selected
            ? '-translate-y-3 shadow-xl ring-2 ring-accent-shield/30'
            : disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'
          }
        `}
      >
        <img src={imgUrl} alt={card.name} className="w-8 h-8 object-contain" />
        <span className="text-[9px] font-semibold text-text-primary leading-tight text-center line-clamp-2">{card.name}</span>
        <span className={`px-1 py-[0.5px] rounded text-[7px] font-medium ${badgeCls}`}>
          {COST_TYPE_LABELS[card.costType]}
        </span>
      </button>
    );
  }

  // ===== 完整模式（详情用） =====
  return (
    <div className={`
      w-32 h-44 bg-card-bg border border-card-border rounded-xl
      flex flex-col items-center justify-between p-3
      shadow-card select-none border-l-[4px] ${borderCls}
    `}>
      <img src={imgUrl} alt={card.name} className="w-12 h-12 object-contain mt-1" />
      <span className="text-sm font-semibold text-text-primary text-center">{card.name}</span>
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${badgeCls}`}>
        {COST_TYPE_LABELS[card.costType]}
      </span>
      <span className="text-[10px] text-text-secondary text-center leading-tight">
        {card.description}
      </span>
    </div>
  );
}
