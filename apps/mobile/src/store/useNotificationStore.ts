import { create } from 'zustand';

type NotificationReadState = {
  readIds: string[];
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
};

/** Local read marks for fixture data; the server owns read state once notifications are real. */
export const useNotificationStore = create<NotificationReadState>()((set) => ({
  readIds: [],
  markRead: (id) => set((state) => ({ readIds: [...new Set([...state.readIds, id])] })),
  markAllRead: (ids) => set((state) => ({ readIds: [...new Set([...state.readIds, ...ids])] })),
}));
