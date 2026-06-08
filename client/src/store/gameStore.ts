import { create } from 'zustand';
import type { GameState } from '@shared/types';

interface PlayerInfo {
  id: string;
  name: string;
  roomId: string;
}

interface GameStore {
  // 连接状态
  connected: boolean;

  // 玩家信息
  player: PlayerInfo | null;

  // 游戏状态
  gameState: GameState | null;
  isMyTurn: boolean;
  waitingForOpponent: boolean;

  // 操作
  setConnected: (connected: boolean) => void;
  setPlayer: (player: PlayerInfo) => void;
  setGameState: (state: GameState | null) => void;
  setWaitingForOpponent: (waiting: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  player: null,
  gameState: null,
  isMyTurn: false,
  waitingForOpponent: false,

  setConnected: (connected) => set({ connected }),

  setPlayer: (player) => {
    const state = get();
    const isMyTurn = state.gameState
      ? state.gameState.players[state.gameState.currentTurnIndex]?.id === player.id
      : false;
    set({ player, isMyTurn });
  },

  setGameState: (gameState) => {
    const state = get();
    const isMyTurn = gameState
      ? gameState.players[gameState.currentTurnIndex]?.id === state.player?.id
      : false;
    set({ gameState, isMyTurn });
  },

  setWaitingForOpponent: (waiting) => set({ waitingForOpponent: waiting }),

  reset: () => set({
    player: null,
    gameState: null,
    isMyTurn: false,
    waitingForOpponent: false,
  }),
}));
