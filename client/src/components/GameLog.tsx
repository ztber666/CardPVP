import { useEffect, useRef } from 'react';
import { GameLogEntry } from '@shared/types';

interface Props {
  log: GameLogEntry[];
}

export default function GameLog({ log }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div
      ref={scrollRef}
      className="bg-card-bg/50 border border-card-border/60 rounded-xl p-3 overflow-y-auto text-xs space-y-1"
    >
      {log.length === 0 ? (
        <p className="text-text-secondary/50 italic">暂无事件记录</p>
      ) : (
        log.map((entry, i) => (
          <p key={i} className="animate-fade-in">
            <span className="text-text-secondary/60 mr-1">[{entry.turnNumber}]</span>
            <span className="text-text-primary/80">{entry.message}</span>
          </p>
        ))
      )}
    </div>
  );
}
