import { useState } from 'react';

interface Props {
  onDebugDraw: (cardId: string) => void;
}

export default function DebugDrawButton({ onDebugDraw }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const v = input.trim();
    if (!v) return;
    onDebugDraw(v);
    setInput('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-1.5 py-1.5 bg-red-100/40 border border-red-200/30 text-red-700 rounded-lg text-[10px] hover:bg-red-100/60 transition-all"
        title="调试摸牌"
      >
        🛠
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-card-bg border border-card-border rounded-lg p-1.5 shadow-xl z-50 min-w-[140px]">
          <p className="text-[8px] text-text-secondary mb-0.5">卡牌编号</p>
          <div className="flex gap-1">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="flex-1 w-14 px-1.5 py-1 rounded border border-card-border bg-card-bg text-[10px] text-text-primary outline-none"
              placeholder="1"
              autoFocus
            />
            <button onClick={handleSubmit} className="px-1.5 py-1 rounded bg-red-100/40 border border-red-200/30 text-red-700 text-[10px] hover:bg-red-100/60">摸</button>
          </div>
        </div>
      )}
    </div>
  );
}
