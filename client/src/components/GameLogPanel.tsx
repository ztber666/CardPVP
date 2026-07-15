import { GameLogEntry } from '@shared/types';
import GameLog from './GameLog';

interface Props {
  log: GameLogEntry[];
  onClose: () => void;
}

export default function GameLogPanel({ log, onClose }: Props) {
  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-35" 
        onClick={onClose} 
      />

      {/* 面板主体 */}
      <div className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-card-bg/95 backdrop-blur-xl border-l border-card-border/50 shadow-2xl z-35 animate-slide-in-right flex flex-col rounded-l-2xl">
        
        {/* 头部区域 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent-primary rounded-full" />
            <h3 className="text-lg font-semibold text-text-primary tracking-wide">战斗记录</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域：关键修改 -> 使用 flex-1 和 overflow-hidden 约束高度，让子组件自行处理滚动 */}
        <div className="flex-1 overflow-hidden p-4 md:p-6">
          <GameLog log={log} />
        </div>
      </div>
    </>
  );
}
