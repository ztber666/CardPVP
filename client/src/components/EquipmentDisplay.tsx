import { useState } from 'react';
import { CardDef, BUFF_NAMES, COST_TYPE_NAMES } from '@shared/types';
import { getCardImageUrl } from '../utils/cardImage';

interface Props {
  equipment: { equip?: CardDef; weapon?: CardDef; field?: CardDef };
  isOpponent?: boolean;
  onUnequip?: (slot: string) => void;
}

const SLOT_NAMES: Record<string, string> = { equip: '装备', weapon: '武器', field: '场地' };
const SLOT_ICONS: Record<string, string> = { equip: '🛡️', weapon: '⚔️', field: '🏟️' };

export default function EquipmentDisplay({ equipment, isOpponent, onUnequip }: Props) {
  const [detailCard, setDetailCard] = useState<{ card: CardDef; slot: string } | null>(null);

  const slots = (['equip', 'weapon', 'field'] as const).map(slot => ({
    slot,
    card: equipment[slot],
  }));

  return (
    <>
      <div className="flex items-center justify-center gap-2 h-20">
        {slots.map(({ slot, card }) => (
          <div
            key={slot}
            className={`relative w-16 h-full bg-card-bg/70 border border-card-border/60 rounded-lg flex flex-col items-center justify-center gap-0.5
              ${card ? 'cursor-pointer hover:border-accent-shield/30 hover:bg-card-bg/90' : ''}`}
            onClick={card ? () => setDetailCard({ card, slot }) : undefined}
          >
            {card ? (
              <>
                <img src={getCardImageUrl(card.id)} alt={card.name} className="w-9 h-9 object-contain" />
                <span className="text-[8px] text-text-primary font-medium leading-tight text-center px-0.5 truncate w-full">{card.name}</span>
              </>
            ) : (
              <span className="text-text-secondary/30 text-[9px] flex flex-col items-center gap-0.5">
                <span>{SLOT_ICONS[slot]}</span>
                <span>{SLOT_NAMES[slot]}</span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 装备详情弹窗 */}
      {detailCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setDetailCard(null)}>
          <div className="bg-card-bg border border-card-border rounded-xl p-4 max-w-xs w-full mx-4 shadow-xl animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <img src={getCardImageUrl(detailCard.card.id)} alt={detailCard.card.name} className="w-10 h-10 object-contain" />
              <div>
                <h3 className="text-base font-bold text-text-primary">{detailCard.card.name}</h3>
                <span className="text-[10px] text-text-secondary">
                  {SLOT_NAMES[detailCard.slot] || COST_TYPE_NAMES[detailCard.card.costType] || '其他'}
                </span>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{detailCard.card.description}</p>
            {detailCard.card.effects.length > 0 && (
              <div className="mt-3 space-y-1">
                {detailCard.card.effects.map((eff, i) => (
                  <div key={i} className="text-xs text-text-secondary">
                    • {BUFF_NAMES[eff.buffType as keyof typeof BUFF_NAMES] || eff.buffType}
                    {eff.value > 0 && ` ${eff.value}`}
                    {eff.duration && `（${eff.duration}回合）`}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              {!isOpponent && onUnequip && (
                <button
                  onClick={() => { onUnequip(detailCard.slot); setDetailCard(null); }}
                  className="flex-1 py-2 rounded-lg border border-red-200/30 text-red-400 text-sm hover:bg-red-50 transition-colors"
                >
                  卸下
                </button>
              )}
              <button
                onClick={() => setDetailCard(null)}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-sm hover:bg-card-bg/50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
