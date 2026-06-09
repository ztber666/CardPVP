import { useState } from 'react';
import { ActiveBuff, BUFF_NAMES, BuffType } from '@shared/types';

// BuffType → assets/buff/ 图片编号
const BUFF_ICON_MAP: Record<string, number> = {
  strength: 1, weakness: 2, resistance: 3, vuln: 4, heal: 5,
  wither: 6, shield: 7, fireResist: 8, poison: 9, fireVuln: 10,
  charge: 11, healBoost: 12, lockAction: 13, lockStrategy: 14, fireDamage: 0,
};

const BUFF_COLORS: Record<string, string> = {
  strength: 'bg-red-100 border-red-200', weakness: 'bg-purple-100 border-purple-200',
  resistance: 'bg-blue-100 border-blue-200', vuln: 'bg-yellow-100 border-yellow-200',
  heal: 'bg-green-100 border-green-200', wither: 'bg-gray-100 border-gray-200',
  shield: 'bg-cyan-100 border-cyan-200', fireResist: 'bg-orange-100 border-orange-200',
  poison: 'bg-emerald-100 border-emerald-200', fireVuln: 'bg-amber-100 border-amber-200',
  charge: 'bg-pink-100 border-pink-200', thorns: 'bg-rose-100 border-rose-200',
  wet: 'bg-sky-100 border-sky-200',
};

const BUFF_DESCRIPTIONS: Record<string, string> = {
  [BuffType.Strength]: '对他人造成的物理伤害增加，每层 +1 伤害。',
  [BuffType.Weakness]: '对他人造成的物理伤害减少，每层 -1 伤害。',
  [BuffType.Resistance]: '受到的物理伤害减少，每层抵消 1 点伤害。',
  [BuffType.Vulnerability]: '受到的物理伤害增加，每层 +1 受伤。',
  [BuffType.Heal]: '回复 n 点血量。',
  [BuffType.Wither]: '回血时消耗 1 层凋零，减少 1 点回血。',
  [BuffType.Shield]: '受到物理/火焰伤害时消耗 1 层，抵消 1 点伤害。',
  [BuffType.FireResist]: '受到的火焰伤害减少，每层抵消 1 点火焰伤害。',
  [BuffType.Poison]: '回血后减少 2 点血量（每回合限 2 次）。',
  [BuffType.FireVuln]: '受到火焰伤害时消耗 1 层，使火焰伤害 +1。',
  [BuffType.Charge]: '造成物理伤害时消耗全部层数，使本次伤害力量和凋零增加等量值。',
  [BuffType.HealBoost]: '本回合回血时额外多回层数等量的血量。',
  [BuffType.LockAction]: '下回合无法使用行动牌。',
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
