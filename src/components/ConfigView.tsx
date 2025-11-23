import React, { useState } from 'react';
import { Settings, Save, Server, Shield, Cpu, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useChatStore } from '../store/useChatStore';

export const ConfigView: React.FC = () => {
    const { schedule, staffingRules, updateStaffingRules } = useScheduleStore();
    const { sessions } = useChatStore();

    // AI Settings State (persisted via server sync)
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '');
    const [model, setModel] = useState(() => localStorage.getItem('openai_model') || 'google/gemini-2.0-flash-exp:free');

    // Sync State
    const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [serverUrl, setServerUrl] = useState('');

    // Staffing Rules State
    const [minStaffMorning, setMinStaffMorning] = useState(staffingRules?.minStaffMorning || 2);
    const [minStaffEvening, setMinStaffEvening] = useState(staffingRules?.minStaffEvening || 1);
    const [minStaffNight, setMinStaffNight] = useState(staffingRules?.minStaffNight || 1);
    const [customRules, setCustomRules] = useState(staffingRules?.customRules || '');

    const handleSaveRules = () => {
        updateStaffingRules({ minStaffMorning, minStaffEvening, minStaffNight, customRules });
        setSyncStatus('success');
        setSyncMessage('Reguły obsady zapisane.');
        setTimeout(() => setSyncStatus('idle'), 3000);
    };

    const handleSaveAISettings = () => {
        localStorage.setItem('openai_api_key', apiKey);
        localStorage.setItem('openai_model', model);
        setSyncStatus('success');
        setSyncMessage('Ustawienia AI zapisane lokalnie.');
        setTimeout(() => setSyncStatus('idle'), 3000);
    };

    const handleSyncPush = async () => {
        setSyncStatus('loading');
        try {
            const data = {
                schedule,
                chatSessions: sessions,
                settings: {
                    apiKey,
                    model,
                    staffingRules: { minStaffMorning, minStaffEvening, minStaffNight, customRules }
                },
                timestamp: Date.now()
            };

            // 2. Zmiana: Usunięte ${serverUrl}, została sama ścieżka '/api/data'
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Błąd zapisu na serwerze');
            setSyncStatus('success');
            setSyncMessage('Dane pomyślnie wysłane na serwer!');
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            setSyncMessage('Błąd połączenia z serwerem. Sprawdź czy server.js jest uruchomiony.');
        }
    };

    const handleSyncPull = async () => {
        setSyncStatus('loading');
        try {
            // 3. Zmiana: Tutaj też sama ścieżka '/api/data'
            const response = await fetch('/api/data');

            if (!response.ok) throw new Error('Błąd pobierania z serwera');
            const data = await response.json();

            // Restore schedule
            if (data.schedule) {
                useScheduleStore.getState().restoreSchedule(data.schedule);
            }
            // Restore chat sessions
            if (data.chatSessions && Array.isArray(data.chatSessions)) {
                useChatStore.getState().restoreSessions(data.chatSessions);
            }
            // Restore settings and persist to localStorage
            if (data.settings) {
                if (data.settings.apiKey) {
                    setApiKey(data.settings.apiKey);
                    localStorage.setItem('openai_api_key', data.settings.apiKey);
                }
                if (data.settings.model) {
                    setModel(data.settings.model);
                    localStorage.setItem('openai_model', data.settings.model);
                }
                if (data.settings.staffingRules) {
                    const rules = data.settings.staffingRules;
                    if (rules.minStaffMorning !== undefined) setMinStaffMorning(rules.minStaffMorning);
                    if (rules.minStaffEvening !== undefined) setMinStaffEvening(rules.minStaffEvening);
                    if (rules.minStaffNight !== undefined) setMinStaffNight(rules.minStaffNight);
                    if (rules.customRules) setCustomRules(rules.customRules);
                }
            }
            setSyncStatus('success');
            setSyncMessage('Dane pomyślnie pobrane z serwera!');
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            setSyncMessage('Błąd połączenia z serwerem.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-6 text-white shadow-lg flex items-center gap-4">
                <Settings size={32} className="text-blue-400" />
                <div>
                    <h1 className="text-2xl font-bold">Panel Konfiguracji</h1>
                    <p className="text-slate-300">Zarządzaj AI, regułami placówki i synchronizacją</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Settings */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Cpu className="text-purple-600" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ustawienia AI</h2>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model AI</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full p-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="x-ai/grok-4.1-fast">Grok 4.1 Fast</option>
                            <option value="google/gemini-2.0-flash-exp:free">Google Gemini 2.0 Flash (Free)</option>
                            <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                            <option value="qwen/qwen-2.5-vl-72b-instruct:free">Qwen 2.5 VL 72B (Free)</option>
                            <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (Free)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Klucz API (OpenRouter)</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-or-..."
                            className="w-full p-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Klucz jest zapisywany lokalnie w przeglądarce.</p>
                    </div>
                    <button
                        onClick={handleSaveAISettings}
                        className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={18} /> Zapisz Ustawienia AI
                    </button>
                </div>

                {/* Staffing Rules */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="text-blue-600" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Strażnik Obsady</h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Zdefiniuj minimalną liczbę osób na zmianie. AI będzie ostrzegać o naruszeniach.</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Rano (7-15)</label>
                            <input
                                type="number"
                                value={minStaffMorning}
                                onChange={(e) => setMinStaffMorning(Number(e.target.value))}
                                className="w-full p-2 border dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Popołudnie (15-20)</label>
                            <input
                                type="number"
                                value={minStaffEvening}
                                onChange={(e) => setMinStaffEvening(Number(e.target.value))}
                                className="w-full p-2 border dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Noc (20-8)</label>
                            <input
                                type="number"
                                value={minStaffNight}
                                onChange={(e) => setMinStaffNight(Number(e.target.value))}
                                className="w-full p-2 border dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Dodatkowe Reguły (Dla AI)</label>
                        <textarea
                            value={customRules}
                            onChange={(e) => setCustomRules(e.target.value)}
                            placeholder="Np. Pamiętaj, że w piątki musi być Kasia. Nie łącz zmian nocnych z porannymi."
                            className="w-full p-2 border dark:border-gray-600 rounded text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        />
                    </div>
                    <button
                        onClick={handleSaveRules}
                        className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={18} /> Zapisz Reguły
                    </button>
                    <div className="p-3 bg-blue-50 text-blue-800 text-sm rounded border border-blue-200 flex items-start gap-2">
                        <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Te reguły są brane pod uwagę przez Asystenta AI przy analizie grafiku.</span>
                    </div>
                </div>
            </div>

            {/* Server Sync */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Server className="text-green-600" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Synchronizacja i Kopia Zapasowa</h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Zapisz cały stan aplikacji na serwerze, aby mieć do niego dostęp z innych urządzeń (np. telefonu).<br />
                    Wymaga uruchomionego `node server.js`.
                </p>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <input
                        type="text"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        className="flex-1 p-2 border dark:border-gray-600 rounded text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="http://localhost:3001"
                    />
                    <button
                        onClick={handleSyncPush}
                        disabled={syncStatus === 'loading'}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} /> Wyślij na Serwer
                    </button>
                    <button
                        onClick={handleSyncPull}
                        disabled={syncStatus === 'loading'}
                        className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={18} /> Pobierz z Serwera
                    </button>
                </div>
                {/* Status Message */}
                {syncMessage && (
                    <div className={`p-3 rounded flex items-center gap-2 ${syncStatus === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        syncStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                        {syncStatus === 'success' ? <CheckCircle size={18} /> :
                            syncStatus === 'error' ? <AlertCircle size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                        {syncMessage}
                    </div>
                )}
            </div>
        </div>
    );
};

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    );
}
