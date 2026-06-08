import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './store/gameStore';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

export default function App() {
  const { connect, disconnect } = useSocket();
  const { connected, player, gameState, isMyTurn } = useGameStore();
  const [inGame, setInGame] = useState(false);

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  }, []);

  useEffect(() => {
    if (gameState) setInGame(true);
    else setInGame(false);
  }, [gameState]);

  return (
    <div className="min-h-screen bg-page-bg">
      {!inGame ? (
        <Lobby />
      ) : (
        <Game />
      )}

      {/* 连接状态指示器 */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-text-secondary">{connected ? '已连接' : '未连接'}</span>
      </div>
    </div>
  );
}
