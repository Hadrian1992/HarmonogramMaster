import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Sparkles, User, Bot, Settings, Save, History, Plus, Trash2, MessageCircle } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useChatStore, type Message } from '../store/useChatStore';
import { askAI } from '../utils/aiService';

export const AIAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    // API Key is now handled by backend
    const [model, setModel] = useState(() => localStorage.getItem('openai_model') || 'google/gemini-2.0-flash-exp:free');
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string, pricing?: { prompt: string, completion: string } }[]>([]);
    const [fetchError, setFetchError] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { schedule, staffingRules } = useScheduleStore();
    const { sessions, currentSessionId, addSession, deleteSession, selectSession, addMessage } = useChatStore();

    // Fetch models on mount
    useEffect(() => {
        const fetchModels = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/models`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    setAvailableModels(data);
                } else {
                    setFetchError('Nie udało się pobrać modeli.');
                }
            } catch (error) {
                console.error('Failed to fetch models:', error);
                setFetchError('Błąd połączenia z API.');
            }
        };
        fetchModels();
    }, []);

    // Listen for model changes in local storage (sync across tabs)
    useEffect(() => {
        const handleStorageChange = () => {
            const newModel = localStorage.getItem('openai_model');
            if (newModel !== model) setModel(newModel || 'google/gemini-2.0-flash-exp:free');
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('local-storage-update', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('local-storage-update', handleStorageChange);
        };
    }, [model]);

    // Initialize session if none exists
    useEffect(() => {
        if (isOpen && !currentSessionId && sessions.length === 0) {
            addSession();
        } else if (isOpen && !currentSessionId && sessions.length > 0) {
            selectSession(sessions[0].id);
        }
    }, [isOpen, currentSessionId, sessions.length, addSession, selectSession]);

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const messages = currentSession?.messages || [];

    const saveSettings = () => {
        localStorage.setItem('openai_model', model);
        setShowSettings(false);

        window.dispatchEvent(new Event('local-storage-update'));

        if (currentSessionId) {
            addMessage(currentSessionId, {
                id: Date.now().toString(),
                text: `Ustawienia zapisane. Model: ${model}`,
                sender: 'ai',
                timestamp: new Date()
            });
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || !currentSessionId) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date()
        };

        addMessage(currentSessionId, userMessage);
        setInput('');
        setIsTyping(true);

        try {
            // API Key is no longer passed from frontend
            const response = await askAI(input, schedule, '', model, staffingRules);
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: response.text,
                sender: 'ai',
                timestamp: new Date(),
                suggestedActions: response.suggestedActions
            };
            addMessage(currentSessionId, aiMessage);
        } catch (error) {
            console.error(error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Przepraszam, wystąpił błąd połączenia.",
                sender: 'ai',
                timestamp: new Date()
            };
            addMessage(currentSessionId, errorMessage);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Render history sidebar
    const renderHistory = () => (
        <div className="w-64 border-r dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 dark:text-gray-200">Historia</h3>
                <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <X size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <button
                    onClick={() => {
                        addSession();
                        setShowHistory(false);
                    }}
                    className="w-full p-2 flex items-center gap-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:opacity-80 transition-opacity"
                >
                    <Plus size={16} /> Nowa rozmowa
                </button>
                {sessions.map(session => (
                    <div
                        key={session.id}
                        className={`group flex items-center justify-between p-2 rounded text-sm cursor-pointer ${currentSessionId === session.id
                            ? 'bg-white dark:bg-gray-700 shadow-sm'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        onClick={() => {
                            selectSession(session.id);
                            setShowHistory(false);
                        }}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <MessageSquare size={14} className="shrink-0 text-gray-500" />
                            <span className="truncate text-gray-700 dark:text-gray-300">{session.title}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition-opacity"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-105 transition-transform z-50"
            >
                <Sparkles size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border dark:border-gray-700 flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="h-14 bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-between px-4 text-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Asystent AI</h3>
                        <p className="text-xs text-white/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            Online
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${showHistory ? 'bg-white/20' : ''}`}
                        title="Historia rozmów"
                    >
                        <History size={18} />
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${showSettings ? 'bg-white/20' : ''}`}
                        title="Ustawienia"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {showHistory && renderHistory()}

                <div className="flex-1 flex flex-col relative">
                    {/* Settings Overlay */}
                    {showSettings && (
                        <div className="absolute inset-0 bg-white dark:bg-gray-900 z-10 p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-lg dark:text-white">Ustawienia AI</h3>
                                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                    <X size={20} />
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Model AI
                                </label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full p-2 border dark:border-gray-700 rounded focus:ring-2 focus:ring-purple-500 outline-none dark:bg-gray-800 dark:text-white"
                                >
                                    {availableModels.length > 0 ? (
                                        availableModels.map(m => {
                                            // Format pricing to be readable
                                            let pricingText = '';
                                            if (m.pricing?.prompt) {
                                                const price = parseFloat(m.pricing.prompt);
                                                if (price === 0) {
                                                    pricingText = '(Free)';
                                                } else if (price < 0.01) {
                                                    // Show in per-million format for very small prices
                                                    pricingText = `($${(price * 1000000).toFixed(2)}/1M tokens)`;
                                                } else {
                                                    pricingText = `($${price.toFixed(2)}/1K tokens)`;
                                                }
                                            }
                                            return (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} {pricingText}
                                                </option>
                                            );
                                        })
                                    ) : (
                                        <>
                                            <option value="google/gemini-2.0-flash-exp:free">Google Gemini 2.0 Flash (Free)</option>
                                            <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                                        </>
                                    )}
                                </select>
                                {fetchError && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
                            </div>

                            <button
                                onClick={saveSettings}
                                className="mt-auto w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> Zapisz ustawienia
                            </button>
                        </div>
                    )}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950/50">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                                    <MessageCircle size={32} className="text-purple-500" />
                                </div>
                                <div className="text-center">
                                    <p className="font-medium text-gray-600 dark:text-gray-300">Cześć!</p>
                                    <p className="text-sm">Zapytaj mnie o grafik lub poproś o analizę.</p>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center max-w-[80%]">
                                    <button
                                        onClick={() => setInput("Czy są jakieś błędy w grafiku?")}
                                        className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-full hover:border-purple-500 transition-colors"
                                    >
                                        Czy są błędy?
                                    </button>
                                    <button
                                        onClick={() => setInput("Kto ma najwięcej godzin?")}
                                        className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-full hover:border-purple-500 transition-colors"
                                    >
                                        Kto ma nadgodziny?
                                    </button>
                                </div>
                            </div>
                        ) : (
                            messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-purple-600 text-white'
                                        }`}>
                                        {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className={`flex flex-col gap-1 max-w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div
                                            className={`p-3 rounded-2xl text-sm ${msg.sender === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border dark:border-gray-700 rounded-tl-sm'
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-gray-400 px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                        {isTyping && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-white animate-pulse" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-sm shadow-sm border dark:border-gray-700 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-700">
                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Napisz wiadomość..."
                                className="flex-1 p-3 pr-12 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm dark:text-white"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isTyping}
                                className="absolute right-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <div className="text-[10px] text-center text-gray-400 mt-2">
                            Model: {model.split('/')[1] || model}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
