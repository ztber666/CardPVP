import { create } from 'zustand';

interface Notification {
  id: number;
  text: string;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (text: string) => void;
  removeNotification: (id: number) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (text) => {
    const id = Date.now() + Math.random();
    set({ notifications: [...get().notifications, { id, text }] });
    setTimeout(() => {
      const current = get().notifications;
      if (current.some(n => n.id === id)) {
        set({ notifications: current.filter(n => n.id !== id) });
      }
    }, 3000);
  },

  removeNotification: (id) => {
    set({ notifications: get().notifications.filter(n => n.id !== id) });
  },
}));

/** 任意位置调用：屏幕上方弹出提示，3 秒后消失，多条自动向下堆叠 */
export function displayMessage(text: string) {
  useNotificationStore.getState().addNotification(text);
}
