import { CardDef, COST_TYPE_NAMES } from '@shared/types';
import { getCardImageUrl } from '../utils/cardImage';

interface Props {
  card: CardDef;
}

const TYPE_STYLE: Record<string, string> = {
  action: 'bg-accent-attack/15 text-accent-attack',
  strategy: 'bg-accent-equip/15 text-accent-equip',
  heal: 'bg-accent-heal/15 text-accent-heal',
  attack: 'bg-accent-attack/15 text-accent-attack',
  buff: 'bg-accent-buff/15 text-accent-buff',
  debuff: 'bg-purple-100 text-purple-700',
  event: 'bg-blue-100 text-blue-700',
  equip: 'bg-accent-equip/15 text-accent-equip',
  weapon: 'bg-accent-equip/15 text-accent-equip',
  field: 'bg-accent-equip/15 text-accent-equip',
  counter: 'bg-accent-shield/15 text-accent-shield',
};

export default function SelectedCardDetail({ card }: Props) {
  const typeLabel = COST_TYPE_NAMES[card.costType] || '其他';
  const typeStyle = TYPE_STYLE[card.costType] || 'bg-accent-shield/15 text-accent-shield';

  return (
    <div className="w-44 bg-card-bg/95 backdrop-blur-sm border border-card-border rounded-xl p-3 shadow-xl flex flex-col animate-fade-in">
      {/* 卡牌图标 + 名称 */}
      <div className="flex items-center gap-2 mb-2">
        <img src={getCardImageUrl(card.id)} alt={card.name} className="w-10 h-10 object-contain" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-text-primary truncate">{card.name}</div>
          <span className={`inline-block px-1.5 py-[1px] rounded text-[9px] font-medium ${typeStyle}`}>
            {typeLabel}
          </span>
        </div>
      </div>

      <div className="h-px bg-card-border/60 mb-2" />

      {/* 仅显示描述 */}
      <p className="text-[11px] text-text-secondary leading-relaxed">{card.description}</p>
    </div>
  );
}
