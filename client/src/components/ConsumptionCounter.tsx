import { PlayerState } from '@shared/types';

interface Props {
  player: PlayerState;
}

export default function ConsumptionCounter({ player }: Props) {
  return (
    <div className="flex flex-col gap-1 text-[10px]">
      <span className={`px-1.5 py-0.5 rounded-md border
        ${player.healCountThisTurn >= 1
          ? 'bg-accent-heal/10 border-accent-heal/20 text-accent-heal'
          : 'bg-card-bg/60 border-card-border text-text-secondary'
        }`}
      >
        回血 {player.healCountThisTurn}/1
      </span>
      <span className={`px-1.5 py-0.5 rounded-md border
        ${player.attackCountThisTurn >= 1
          ? 'bg-accent-attack/10 border-accent-attack/20 text-accent-attack'
          : 'bg-card-bg/60 border-card-border text-text-secondary'
        }`}
      >
        攻击 {player.attackCountThisTurn}/1
      </span>
      <span className={`px-1.5 py-0.5 rounded-md border
        ${(player.actionStrategyCountThisTurn || 0) >= 5
          ? 'bg-accent-equip/10 border-accent-equip/20 text-accent-equip'
          : 'bg-card-bg/60 border-card-border text-text-secondary'
        }`}
      >
        行动/锦囊 {player.actionStrategyCountThisTurn || 0}/{5 + (player.actionLimitBonus || 0)}
      </span>
    </div>
  );
}
