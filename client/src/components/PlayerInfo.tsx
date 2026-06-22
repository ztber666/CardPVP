import { PlayerState } from '@shared/types';

interface Props {
  player: PlayerState;
  isOpponent?: boolean;
  className?: string;
}

export default function PlayerInfo({ player, isOpponent, className }: Props) {
  const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
  const hpColor = hpPercent > 60 ? 'bg-accent-heal' : hpPercent > 30 ? 'bg-accent-equip' : 'bg-accent-attack';

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div className="w-6 h-6 rounded-full bg-card-bg border border-card-border flex items-center justify-center text-xs shrink-0">
        {isOpponent ? '👤' : '🧑'}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-xs text-text-primary truncate max-w-[80px]">{player.name}</span>
          {isOpponent && <span className="text-[8px] text-text-secondary bg-card-bg/60 px-1 rounded-full border border-card-border/50">对手</span>}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono">
            <span className={player.hp <= 3 ? 'text-accent-attack font-semibold' : 'text-text-primary'}>{player.hp}</span>
            <span className="text-text-secondary">/{player.maxHp}</span>
          </span>
          <div className="w-10 h-1.5 bg-card-bg/60 rounded-full overflow-hidden border border-card-border/50">
            <div className={`h-full rounded-full transition-all duration-500 ${hpColor}`} style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
