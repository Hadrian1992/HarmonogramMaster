import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Sparkles, User, Bot, Settings, Save, History, Plus, Trash2, MessageCircle } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useChatStore, type Message } from '../store/useChatStore';
import { askAI, type AIResponse } from '../utils/aiService';
import clsx from 'clsx';

export const AIAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
    const [model, setModel] = useState(() => localStorage.getItem('openai_model') || 'google/gemini-2.0-flash-exp:free');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { schedule, staffingRules } = useScheduleStore();
    const { sessions, currentSessionId, addSession, deleteSession, selectSession, addMessage } = useChatStore();

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
        localStorage.setItem('openai_api_key', apiKey);
        localStorage.setItem('openai_model', model);
        setShowSettings(false);

        if (currentSessionId) {
            addMessage(currentSessionId, {
                id: Date.now().toString(),
                text: apiKey ? `Ustawienia zapisane. Model: ${model}` : 'Klucz API usunięty. Wracam do trybu podstawowego.',
                sender: 'ai',
                timestamp: new Date()
            });
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, showHistory]);

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
            const response: AIResponse = await askAI(userMessage.text, schedule, apiKey, model, staffingRules);

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: response.text,
                sender: 'ai',
                timestamp: new Date(),
                suggestedActions: response.suggestedActions
            };

            addMessage(currentSessionId, aiMessage);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Przepraszam, wystąpił błąd podczas przetwarzania Twojego zapytania.',
                sender: 'ai',
                timestamp: new Date()
            };
            addMessage(currentSessionId, errorMessage);
        } finally {
            setIsTyping(false);
        }
    };

    const handleNewChat = () => {
        addSession();
        setShowHistory(false);
    };

    const handleSelectSession = (id: string) => {
        selectSession(id);
        setShowHistory(false);
    };

    const handleDeleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteSession(id);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInput(suggestion);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white rounded-2xl shadow-2xl w-80 sm:w-96 h-[500px] flex flex-col border border-gray-200 mb-4 animate-in slide-in-from-bottom-10 fade-in duration-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
                                <Sparkles size={18} />
                            </div>
                            <div className="truncate">
                                <h3 className="font-bold text-sm truncate">
                                    {currentSession?.title || 'Asystent AI'}
                                </h3>
                                <p className="text-xs text-blue-100">
                                    {model.split('/')[1]?.split(':')[0] || 'Local Mode'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={clsx(
                                    "hover:bg-white/20 p-1.5 rounded-full transition-colors",
                                    showHistory && "bg-white/20"
                                )}
                                title="Historia czatów"
                            >
                                <History size={18} />
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={clsx(
                                    "hover:bg-white/20 p-1.5 rounded-full transition-colors",
                                    showSettings && "bg-white/20"
                                )}
                                title="Ustawienia AI"
                            >
                                <Settings size={18} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex overflow-hidden relative">

                        {/* History Sidebar (Overlay) */}
                        {showHistory && (
                            <div className="absolute inset-0 z-20 bg-white flex flex-col animate-in slide-in-from-left-10 duration-200">
                                <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h4 className="font-bold text-gray-700 text-sm">Twoje rozmowy</h4>
                                    <button
                                        onClick={handleNewChat}
                                        className="bg-blue-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus size={14} /> Nowy czat
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {sessions.map(session => (
                                        <div
                                            key={session.id}
                                            onClick={() => handleSelectSession(session.id)}
                                            className={clsx(
                                                "p-3 rounded-lg cursor-pointer flex justify-between items-center group transition-colors",
                                                currentSessionId === session.id ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50 border border-transparent"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <MessageCircle size={16} className={currentSessionId === session.id ? "text-blue-500" : "text-gray-400"} />
                                                <div className="truncate">
                                                    <p className={clsx("text-sm font-medium truncate", currentSessionId === session.id ? "text-blue-700" : "text-gray-700")}>
                                                        {session.title}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {new Date(session.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session.id)}
                                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                title="Usuń czat"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {sessions.length === 0 && (
                                        <div className="text-center text-gray-400 text-xs py-8">
                                            Brak historii rozmów
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Settings Panel (Overlay) */}
                        {showSettings && (
                            <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-800">Ustawienia AI</h4>
                                    <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Klucz API OpenRouter
                                        </label>
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Model AI
                                        </label>
                                        <select
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="x-ai/grok-4.1-fast">Grok 4.1 Fast</option>
                                            <option value="google/gemini-2.0-flash-exp:free">Google Gemini 2.0 Flash (Free)</option>
                                            <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                                            <option value="qwen/qwen-2.5-vl-72b-instruct:free">Qwen 2.5 VL 72B (Free)</option>
                                            <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (Free)</option>
                                        </select>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={saveSettings}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-green-700 transition-colors shadow-sm"
                                        >
                                            <Save size={16} /> Zapisz ustawienia
                                        </button>
                                    </div>

                                    <p className="text-[10px] text-gray-500 text-center mt-4">
                                        Dane są zapisywane lokalnie w Twojej przeglądarce.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 w-full">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={clsx(
                                        "flex gap-3 max-w-[90%]",
                                        msg.sender === 'user' ? "ml-auto flex-row-reverse" : ""
                                    )}
                                >
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                        msg.sender === 'user' ? "bg-blue-600 text-white" : "bg-purple-600 text-white"
                                    )}>
                                        {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className={clsx(
                                            "p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap break-words",
                                            msg.sender === 'user'
                                                ? "bg-blue-600 text-white rounded-tr-none"
                                                : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                                        )}>
                                            {msg.text}
                                        </div>

                                        {/* Suggested Actions */}
                                        {msg.suggestedActions && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {msg.suggestedActions.map((action, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSuggestionClick(action)}
                                                        className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full border border-purple-100 hover:bg-purple-100 transition-colors"
                                                    >
                                                        {action}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <span className="text-[10px] text-gray-400 px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                        <Bot size={16} />
                                    </div>
                                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex gap-1 items-center">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Zapytaj o grafik..."
                                className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isTyping}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isTyping}
                                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center",
                    isOpen ? "bg-gray-500 text-white rotate-90" : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                )}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
        </div>
    );
};
