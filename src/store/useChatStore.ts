import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
    suggestedActions?: string[];
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
}

interface ChatState {
    sessions: ChatSession[];
    currentSessionId: string | null;
    addSession: () => string;
    deleteSession: (id: string) => void;
    selectSession: (id: string) => void;
    addMessage: (sessionId: string, message: Message) => void;
    updateSessionTitle: (sessionId: string, title: string) => void;
    restoreSessions: (sessions: ChatSession[]) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            sessions: [],
            currentSessionId: null,

            addSession: () => {
                const newSession: ChatSession = {
                    id: Date.now().toString(),
                    title: 'Nowa rozmowa',
                    messages: [{
                        id: 'welcome',
                        text: 'Cześć! Jestem Twoim asystentem harmonogramu. W czym mogę pomóc?',
                        sender: 'ai',
                        timestamp: new Date()
                    }],
                    createdAt: Date.now()
                };
                set((state) => ({
                    sessions: [newSession, ...state.sessions],
                    currentSessionId: newSession.id
                }));
                return newSession.id;
            },

            deleteSession: (id) => {
                set((state) => {
                    const newSessions = state.sessions.filter(s => s.id !== id);
                    return {
                        sessions: newSessions,
                        currentSessionId: state.currentSessionId === id
                            ? (newSessions[0]?.id || null)
                            : state.currentSessionId
                    };
                });
            },

            selectSession: (id) => {
                set({ currentSessionId: id });
            },

            addMessage: (sessionId, message) => {
                set((state) => {
                    const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
                    if (sessionIndex === -1) return state;

                    const updatedSessions = [...state.sessions];
                    updatedSessions[sessionIndex] = {
                        ...updatedSessions[sessionIndex],
                        messages: [...updatedSessions[sessionIndex].messages, message]
                    };

                    // Auto-update title based on first user message
                    if (updatedSessions[sessionIndex].messages.length === 2 && message.sender === 'user') {
                        updatedSessions[sessionIndex].title = message.text.slice(0, 30) + (message.text.length > 30 ? '...' : '');
                    }

                    return { sessions: updatedSessions };
                });
            },

            updateSessionTitle: (sessionId, title) => {
                set((state) => ({
                    sessions: state.sessions.map(s =>
                        s.id === sessionId ? { ...s, title } : s
                    )
                }));
            },

            restoreSessions: (sessions) => {
                set(() => ({
                    sessions,
                    currentSessionId: sessions[0]?.id || null
                }));
            }
        }),
        {
            name: 'chat-storage',
            partialize: (state) => ({ sessions: state.sessions, currentSessionId: state.currentSessionId }),
        }
    )
);
