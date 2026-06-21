import { useState } from 'react';
import { ActiveBuff, BUFF_NAMES, BuffType } from '@shared/types';
import { BUFF_DESCRIPTIONS, BUFF_ICON_MAP } from './BuffCollection';

const BUFF_COLORS: Record<string, string> = {
  strength: 'bg-red-100 border-red-200', weakness: 'bg-purple-100 border-purple-200',
  resistance: 'bg-blue-100 border-blue-200', vuln: 'bg-yellow-100 border-yellow-200',
  heal: 'bg-green-100 border-green-200', wither: 'bg-gray-100 border-gray-200',
  shield: 'bg-cyan-100 border-cyan-200', fireResist: 'bg-orange-100 border-orange-200',
  poison: 'bg-emerald-100 border-emerald-200', fireVuln: 'bg-amber-100 border-amber-200',
  charge: 'bg-pink-100 border-pink-200', fireDamage: 'bg-rose-100 border-rose-200',
  lockStrategy: 'bg-sky-100 border-sky-200',
  horde: 'bg-red-200 border-red-300', blight: 'bg-lime-100 border-lime-200',
  block: 'bg-indigo-100 border-indigo-200',
};


interface Props {
  buff: ActiveBuff;
}

export default function BuffBadge({ buff }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const colorClass = BUFF_COLORS[buff.buffType] || 'bg-gray-100 border-gray-200';
  const name = BUFF_NAMES[buff.buffType] || buff.buffType;
  const iconNum = BUFF_ICON_MAP[buff.buffType];
  const hasDuration = buff.remainingTurns !== undefined;
  const desc = BUFF_DESCRIPTIONS[buff.buffType] || '';

  return (
    <>
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
      >
        {iconNum ? (
          <img src={`/assets/buff/buff${iconNum}.png`} alt="" className="w-3.5 h-3.5" />
        ) : (
          <span className="text-[10px]">●</span>
        )}
        <span className="text-text-primary font-medium">{name}</span>
        {buff.stacks > 1 && <span className="text-text-secondary">×{buff.stacks}</span>}
        {hasDuration && (
          <span className="text-text-secondary/70 text-[9px]">{buff.remainingTurns}回合</span>
        )}
      </span>

      {/* 详情弹窗 */}
      {showDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-card-bg border border-card-border rounded-xl p-5 max-w-xs w-full mx-4 shadow-xl animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              {iconNum && <img src={`/assets/buff/buff${iconNum}.png`} alt="" className="w-8 h-8" />}
              <div>
                <h3 className="text-base font-bold text-text-primary">{name}</h3>
                <span className="text-[11px] text-text-secondary">层数: {buff.stacks}</span>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
            {hasDuration && (
              <p className="text-xs text-text-secondary/70 mt-2">剩余 {buff.remainingTurns} 回合</p>
            )}
            <button
              onClick={() => setShowDetail(false)}
              className="w-full mt-4 py-2 rounded-lg border border-card-border text-text-secondary text-sm hover:bg-card-bg/50 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}
