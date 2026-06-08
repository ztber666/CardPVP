import { useEffect, useState } from 'react';
import { BUFF_NAMES, COST_TYPE_NAMES, CostType } from '@shared/types';
import type { CardDef } from '@shared/types';

interface CardTemplate {
  id: string;
  name: string;
  icon: string;
  costType: CostType;
  effects: { buffType: string; value: number; target: string; duration?: number }[];
  description: string;
  weight: number;
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

export default function CardCollection({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<CardTemplate[]>([]);

  useEffect(() => {
    // 动态导入共享模块
    import('@shared/constants').then(mod => {
      setCards(mod.CARDS || []);
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl animate-fade-in my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">卡牌图鉴</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-card-border flex items-center justify-center text-text-secondary hover:bg-card-bg/50 transition-colors"
          >
            ✕
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="text-text-secondary text-center py-8">加载中...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {cards.map(card => {
              const badgeCls = TYPE_BADGE[card.costType] || 'bg-accent-shield/15 text-accent-shield';
              const imgNum = card.id.replace('card_', '');
              const imgExt = imgNum === '21' ? '.gif' : '.png';
              return (
                <div
                  key={card.id}
                  className="bg-card-bg border border-card-border/60 rounded-xl p-3 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
                >
                  {/* 卡面 */}
                  <img
                    src={`/assets/item/${imgNum}${imgExt}`}
                    alt={card.name}
                    className="w-14 h-14 object-contain"
                  />
                  {/* 名称 */}
                  <span className="text-sm font-semibold text-text-primary text-center">{card.name}</span>
                  {/* 消耗类型 */}
                  <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${badgeCls}`}>
                    {COST_TYPE_NAMES[card.costType]}
                  </span>
                  {/* 权重 */}
                  <span className="text-[8px] text-text-secondary/50">权重 {card.weight}</span>
                  {/* 效果列表 */}
                  <div className="w-full space-y-0.5">
                    {card.effects.map((eff, i) => {
                      const buffName = BUFF_NAMES[eff.buffType as keyof typeof BUFF_NAMES];
                      if (!buffName) return null;
                      return (
                        <div key={i} className="text-[10px] text-text-secondary leading-tight flex items-center gap-1">
                          <span className="text-text-primary">•</span>
                          <span>{buffName}</span>
                          {eff.value > 0 && <span className="text-text-primary">{eff.value}</span>}
                          {eff.duration && <span>（{eff.duration}回合）</span>}
                        </div>
                      );
                    })}
                  </div>
                  {/* 描述 */}
                  <span className="text-[9px] text-text-secondary/70 text-center leading-tight">
                    {card.description}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 底部说明 */}
        <p className="text-center text-text-secondary text-xs mt-6">
          共 {cards.length} 种卡牌 · 牌组根据权重随机构成
        </p>
      </div>
    </div>
  );
}
