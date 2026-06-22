import { GameLogEntry } from '@shared/types';
import GameLog from './GameLog';

interface Props {
  log: GameLogEntry[];
  onClose: () => void;
}

export default function GameLogPanel({ log, onClose }: Props) {
  return (
    <>
      {/* 半透明背景 */}
      <div className="fixed inset-0 bg-black/20 z-35" onClick={onClose} />
      {/* 滑出面板 */}
      <div className="fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-card-bg border-l border-card-border shadow-2xl z-35 animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
          <h3 className="text-sm font-bold text-text-primary">战斗记录</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-lg leading-none">&times;</button>
        </div>
        <div className="flex-1 p-3 overflow-y-auto">
          <GameLog log={log} />
        </div>
      </div>
    </>
  );
}
