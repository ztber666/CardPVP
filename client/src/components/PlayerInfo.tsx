import { useState } from 'react';
import { PlayerState, CardDef, BUFF_NAMES, COST_TYPE_NAMES } from '@shared/types';
import BuffBadge from './BuffBadge';
import { getCardImageUrl } from '../utils/cardImage';

interface Props {
  player: PlayerState;
  isOpponent?: boolean;
  onUnequip?: (slot: string) => void;
}

const SLOT_NAMES: Record<string, string> = { equip: '装备', weapon: '武器', field: '场地' };
const SLOT_ICONS: Record<string, string> = { equip: '🛡️', weapon: '⚔️', field: '🏟️' };

export default function PlayerInfo({ player, isOpponent, onUnequip }: Props) {
  const [detailCard, setDetailCard] = useState<{ card: CardDef; slot: string } | null>(null);
  const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
  const hpColor = hpPercent > 60 ? 'bg-accent-heal' : hpPercent > 30 ? 'bg-accent-equip' : 'bg-accent-attack';

  return (
    <div className="flex flex-col gap-2">
      {/* 名称 + HP */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-card-bg border border-card-border flex items-center justify-center text-xs">
          {isOpponent ? '👤' : '🧑'}
        </div>
        <span className="font-semibold text-sm text-text-primary">{player.name}</span>
        {isOpponent && <span className="text-[10px] text-text-secondary bg-card-bg/60 px-1.5 py-0.5 rounded-full border border-card-border/50">对手</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs font-mono">
            <span className={player.hp <= 3 ? 'text-accent-attack font-semibold' : 'text-text-primary'}>{player.hp}</span>
            <span className="text-text-secondary">/{player.maxHp}</span>
          </span>
          <div className="w-12 h-1.5 bg-card-bg/60 rounded-full overflow-hidden border border-card-border/50">
            <div className={`h-full rounded-full transition-all duration-500 ${hpColor}`} style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Buffs */}
      {player.buffs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {player.buffs.map((buff, i) => (
            <BuffBadge key={`${buff.buffType}-${i}`} buff={buff} />
          ))}
        </div>
      )}

      {/* 装备槽 */}
      <div className="flex gap-2">
        {(['equip', 'weapon', 'field'] as const).map((slot) => {
          const card = player.equipment[slot];
          return (
            <div
              key={slot}
              className={`flex-1 bg-card-bg/50 border border-card-border/60 rounded-lg p-1.5 min-h-[2.5rem] flex flex-col items-center justify-center gap-0.5 ${card ? 'cursor-pointer hover:border-accent-shield/30 hover:bg-card-bg/80' : ''}`}
              onClick={card ? () => setDetailCard({ card, slot }) : undefined}
              title={card ? `${card.name}: ${card.description}` : SLOT_NAMES[slot]}
            >
              {card ? (
                <>
                  <img src={getCardImageUrl(card.id)} alt={card.name} className="w-6 h-6 object-contain" />
                  <span className="text-[10px] text-text-primary font-medium">{card.name}</span>
                </>
              ) : (
                <span className="text-text-secondary/40 text-[10px]">{SLOT_ICONS[slot]} {SLOT_NAMES[slot]}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 装备操作弹窗 */}
      {detailCard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setDetailCard(null)}
        >
          <div
            className="bg-card-bg border border-card-border rounded-xl p-5 max-w-xs w-full mx-4 shadow-xl animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
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
            <div className="mt-3 space-y-1">
              {detailCard.card.effects.map((eff, i) => (
                <div key={i} className="text-xs text-text-secondary">
                  • {BUFF_NAMES[eff.buffType as keyof typeof BUFF_NAMES] || eff.buffType}
                  {eff.value > 0 && ` ${eff.value}`}
                  {eff.duration && `（${eff.duration}回合）`}
                </div>
              ))}
            </div>
            {/* 操作按钮 */}
            <div className="flex gap-2 mt-4">
              {!isOpponent && onUnequip && (
                <button
                  onClick={() => {
                    onUnequip(detailCard.slot);
                    setDetailCard(null);
                  }}
                  className="flex-1 py-2 rounded-lg border border-red-200/30 text-red-400 text-sm hover:bg-red-50 transition-colors"
                >
                  卸下
                </button>
              )}
              <button
                onClick={() => setDetailCard(null)}
                className="flex-1 py-2 rounded-lg border border-card-border text-text-secondary text-sm hover:bg-card-bg/50 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
