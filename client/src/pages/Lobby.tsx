import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import CardCollection from '../components/CardCollection';
import BuffCollection from '../components/BuffCollection';

export default function Lobby() {
  const { createRoom, joinRoom, leaveRoom } = useSocket();
  const { connected, waitingForOpponent, player } = useGameStore();

  const [playerName, setPlayerName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCardCollection, setShowCardCollection] = useState(false);
  const [showBuffCollection, setShowBuffCollection] = useState(false);

  const displayName = playerName.trim() || `玩家${Math.random().toString(36).slice(2, 6)}`;

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createRoom(displayName);
      setRoomId(result.roomId);
    } catch (e: any) {
      setError(e.message || '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!roomInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await joinRoom(roomInput.trim().toUpperCase(), displayName);
      if (!result.success) {
        setError(result.error || '加入房间失败');
      }
    } catch (e: any) {
      setError(e.message || '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  // 等待对手中
  if (waitingForOpponent && roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <img src="/assets/connect.png" alt="" className="w-20 h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">等待对手加入</h1>
          <div className="bg-card-bg border border-card-border rounded-xl p-8 mb-6 inline-block">
            <p className="text-text-secondary mb-2">房间码</p>
            <p className="text-4xl font-bold tracking-[0.3em] text-accent-shield">{roomId}</p>
          </div>
          <div className="flex justify-center gap-2">
            <span className="w-3 h-3 rounded-full bg-accent-shield animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-3 h-3 rounded-full bg-accent-shield animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-3 h-3 rounded-full bg-accent-shield animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="text-text-secondary mt-4 text-sm">
            将此房间码发送给好友即可对战
          </p>
          <p className="text-text-secondary text-xs mt-2">
            玩家: {displayName}
          </p>
          <button
            onClick={() => {
              leaveRoom();
              setRoomId(null);
              setError(null);
            }}
            className="mt-6 px-6 py-2 rounded-xl border border-card-border text-text-secondary text-sm hover:bg-card-bg/50 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/assets/game.png" alt="" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gradient">CardPVP</h1>
          <p className="text-text-secondary mt-2">线上卡牌对战</p>
        </div>

        {/* 玩家名称 */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="输入昵称（可选）"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-card-bg border border-card-border rounded-xl px-4 py-3 text-text-primary placeholder-text-secondary/50 outline-none focus:border-accent-shield/50 transition-colors"
            maxLength={12}
          />
        </div>

        {/* 创建房间 */}
        <button
          onClick={handleCreate}
          disabled={!connected || loading}
          className="w-full bg-accent-shield/20 border border-accent-shield/30 text-accent-shield rounded-xl py-3 font-semibold hover:bg-accent-shield/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          {loading ? '创建中...' : '创建对战房间'}
        </button>

        {/* 分隔 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-card-border" />
          <span className="text-text-secondary text-sm">或</span>
          <div className="flex-1 h-px bg-card-border" />
        </div>

        {/* 加入房间 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="输入房间码"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            className="flex-1 bg-card-bg border border-card-border rounded-xl px-4 py-3 text-text-primary placeholder-text-secondary/50 outline-none focus:border-accent-shield/50 transition-colors uppercase tracking-widest"
            maxLength={4}
          />
          <button
            onClick={handleJoin}
            disabled={!connected || !roomInput.trim() || loading}
            className="bg-card-bg border border-card-border rounded-xl px-6 py-3 text-text-primary font-semibold hover:border-accent-heal/50 hover:text-accent-heal transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            加入
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* 图鉴入口 */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowCardCollection(true)}
            className="flex-1 py-2 rounded-xl border border-card-border text-text-secondary text-xs font-medium hover:bg-card-bg/50 transition-colors"
          >
            🃏 卡牌图鉴
          </button>
          <button
            onClick={() => setShowBuffCollection(true)}
            className="flex-1 py-2 rounded-xl border border-card-border text-text-secondary text-xs font-medium hover:bg-card-bg/50 transition-colors"
          >
            ✨ 效果图鉴
          </button>
        </div>

        {/* 底部提示 */}
        <p className="text-center text-text-secondary text-xs mt-3">
          无需注册，创建或加入房间即可开始对战
        </p>
      </div>

      {/* 图鉴弹窗 */}
      {showCardCollection && (
        <CardCollection onClose={() => setShowCardCollection(false)} />
      )}
      {showBuffCollection && (
        <BuffCollection onClose={() => setShowBuffCollection(false)} />
      )}
    </div>
  );
}
