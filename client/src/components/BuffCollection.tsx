import { useState } from 'react';
import { BUFF_NAMES, BuffType } from '@shared/types';

// Buff 效果描述
const BUFF_DESCRIPTIONS: Record<string, string> = {
  [BuffType.Strength]: '使附着对象对他人造成的物理伤害增加 n 点。每层 +1 伤害。',
  [BuffType.Weakness]: '使附着对象对他人造成的物理伤害减少 n 点。每层 -1 伤害。',
  [BuffType.Resistance]: '使附着对象受到的物理伤害减少 n 点。每层抵消 1 点伤害。',
  [BuffType.Vulnerability]: '使附着对象受到的物理伤害增加 n 点。每层 +1 受伤。',
  [BuffType.Heal]: '回复附着对象 n 点血量。',
  [BuffType.Wither]: '附着对象回血时消耗 1 层凋零并减少 1 点回血。',
  [BuffType.Shield]: '附着对象受到物理伤害或火焰伤害时消耗 1 层护盾抵消 1 点伤害。',
  [BuffType.FireResist]: '使附着对象受到的火焰伤害减少 n 点。每层抵消 1 点火焰伤害。',
  [BuffType.Poison]: '附着对象回血后减少 2 点血量（每回合限 2 次）。',
  [BuffType.Blight]: '附着对象回血或受到火焰伤害时消耗 1 层，减少 1 点回血或使火焰伤害 +1。',
  [BuffType.Charge]: '附着对象对他人造成物理伤害时消耗全部蓄力层数，使本次伤害力量和凋零增加等量层数。',
  [BuffType.Thorns]: '每回合轮到附着对象时增加 2 点凋零效果。',
  [BuffType.Wet]: '免疫火焰伤害，移除火焰效果，移除枯萎效果。',
  [BuffType.HealBoost]: '本回合回血时额外多回相当于层数的血量。',
  [BuffType.LockAction]: '附着对象下回合无法使用行动牌。',
};

// Buff 与 BuffType 编号映射
const BUFF_ICON_MAP: Record<string, number> = {
  strength: 1, weakness: 2, resistance: 3, vuln: 4, heal: 5,
  wither: 6, shield: 7, fireResist: 8, poison: 9, blight: 10,
  charge: 11, thorns: 12, wet: 13,
  healBoost: 14, lockAction: 15,
};

// 忽略特殊效果类型（不显示在图鉴中）
const SKIP_TYPES = [
  BuffType.RemoveWither, BuffType.ReduceDuration,
  BuffType.ReduceMaxHp, BuffType.IncreaseMaxHp,
  BuffType.ConditionalDiscard, BuffType.Damage,
];

export default function BuffCollection({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const buffTypes = Object.values(BuffType).filter(
    t => !SKIP_TYPES.includes(t as BuffType)
  ) as BuffType[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-card-bg border border-card-border rounded-2xl p-6 max-w-xl w-full mx-4 shadow-xl animate-fade-in my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">效果图鉴</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-card-border flex items-center justify-center text-text-secondary hover:bg-card-bg/50 transition-colors">✕</button>
        </div>

        {/* 列表 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {buffTypes.map(type => {
            const iconNum = BUFF_ICON_MAP[type];
            const name = BUFF_NAMES[type] || type;
            const desc = BUFF_DESCRIPTIONS[type] || '';
            return (
              <div
                key={type}
                className={`border rounded-xl p-3 cursor-pointer transition-all ${
                  selected === type
                    ? 'border-accent-shield/40 bg-accent-shield/5'
                    : 'border-card-border/60 hover:border-card-border'
                }`}
                onClick={() => setSelected(selected === type ? null : type)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {iconNum ? (
                    <img src={`/assets/buff/buff${iconNum}.png`} alt="" className="w-5 h-5" />
                  ) : (
                    <span className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-[10px]">?</span>
                  )}
                  <span className="text-sm font-semibold text-text-primary">{name}</span>
                </div>
                {selected === type && (
                  <p className="text-xs text-text-secondary leading-relaxed mt-1 pl-7">{desc}</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-text-secondary text-xs mt-4">
          共 {buffTypes.length} 种效果 · 点击展开详情
        </p>
      </div>
    </div>
  );
}
