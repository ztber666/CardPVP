import { CardDef, CostType, COST_TYPE_NAMES, BUFF_NAMES, BuffType } from '@shared/types';

interface Props {
  card: CardDef;
  onClose: () => void;
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

function getCardImageUrl(cardId: string): string {
  const num = cardId.replace('card_', '').split('_')[0];
  const ext = num === '21' ? '.gif' : '.png';
  return `/assets/item/${num}${ext}`;
}

export default function CardDetail({ card, onClose }: Props) {
  const imgUrl = getCardImageUrl(card.id);
  const badgeCls = TYPE_BADGE[card.costType] || 'bg-accent-shield/15 text-accent-shield';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-xs w-full mx-4 shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 图标和标题 */}
        <div className="flex items-center gap-3 mb-4">
          <img src={imgUrl} alt={card.name} className="w-12 h-12 object-contain" />
          <div>
            <h2 className="text-lg font-bold text-text-primary">{card.name}</h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium inline-block mt-0.5 ${badgeCls}`}>
              {COST_TYPE_NAMES[card.costType]}
            </span>
          </div>
        </div>

        {/* 分隔 */}
        <div className="h-px bg-card-border mb-4" />

        {/* 效果列表 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">效果</p>
          {card.effects.map((eff, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-text-primary mt-0.5">•</span>
              <div>
                <span className="text-text-primary font-medium">
                  {BUFF_NAMES[eff.buffType] || eff.buffType}
                </span>
                <span className="text-text-secondary"> {eff.value > 0 ? eff.value : ''}</span>
                {eff.duration ? (
                  <span className="text-text-secondary text-xs">（持续{eff.duration}回合）</span>
                ) : ''}
              </div>
            </div>
          ))}
        </div>

        {/* 描述 */}
        <div className="mt-4 p-3 bg-card-bg/50 border border-card-border/50 rounded-xl">
          <p className="text-xs text-text-secondary">{card.description}</p>
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 rounded-xl border border-card-border text-text-secondary text-sm hover:bg-card-bg/50 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
