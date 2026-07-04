import { create } from 'zustand';
import type { GameState } from '@shared/types';

interface PlayerInfo {
  id: string;
  name: string;
  roomId: string;
}

export type RematchState = null | 'requested' | 'invited' | 'declined';

interface GameStore {
  // 连接状态
  connected: boolean;
  opponentDisconnected: boolean; // 新增：对手是否断线

  // 玩家信息
  player: PlayerInfo | null;

  // 游戏状态
  gameState: GameState | null;
  isMyTurn: boolean;
  waitingForOpponent: boolean;

  // 再战状态
  rematchState: RematchState;
  rematchRequesterName: string | null;

  // 操作
  setConnected: (connected: boolean) => void;
  setOpponentDisconnected: (status: boolean) => void; // 新增
  setPlayer: (player: PlayerInfo) => void;
  setGameState: (state: GameState | null) => void;
  setWaitingForOpponent: (waiting: boolean) => void;
  setRematchState: (state: RematchState, requesterName?: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  player: null,
  gameState: null,
  isMyTurn: false,
  waitingForOpponent: false,
  rematchState: null,
  rematchRequesterName: null,
  opponentDisconnected: false, // 新增：对手是否断线

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

  setRematchState: (state, requesterName) => set({
    rematchState: state,
    rematchRequesterName: requesterName !== undefined ? requesterName : null,
  }),

  setOpponentDisconnected: (status) => set({ opponentDisconnected: status }),

  reset: () => set({
    player: null,
    gameState: null,
    isMyTurn: false,
    waitingForOpponent: false,
    rematchState: null,
    rematchRequesterName: null,
  }),
}));
