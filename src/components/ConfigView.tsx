import { useState, useEffect } from 'react';
import { Save, Download, Server, Shield, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useChatStore } from '../store/useChatStore';

const DEFAULT_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const ConfigView = () => {
    const [serverUrl, setServerUrl] = useState('');
    const [status, setStatus] = useState<{
        type: 'idle' | 'loading' | 'success' | 'error';
        message: string;
    }>({ type: 'idle', message: '' });

    // Staffing Rules State
    const [minStaffing, setMinStaffing] = useState({
        morning: 1,
        afternoon: 1,
        night: 1
    });

    const [customRule, setCustomRule] = useState('');
    const [rulesSaved, setRulesSaved] = useState(false);

    // Ładujemy zapisane reguły przy starcie (symulacja - normalnie z localStorage/store)
    useEffect(() => {
        const savedRules = localStorage.getItem('staffing_rules');
        if (savedRules) {
            try {
                const parsed = JSON.parse(savedRules);
                setMinStaffing(parsed.minStaffing || { morning: 1, afternoon: 1, night: 1 });
                setCustomRule(parsed.customRule || '');
            } catch (e) { console.error('Błąd odczytu reguł', e); }
        }
    }, []);

    const handleSaveRules = () => {
        // Zapisujemy do localStorage (dla uproszczenia, w dużej apce byłby to Store)
        const rulesToSave = { minStaffing, customRule };
        localStorage.setItem('staffing_rules', JSON.stringify(rulesToSave));

        setRulesSaved(true);
        setTimeout(() => setRulesSaved(false), 2000);
    };

    const handlePush = async () => {
        const url = serverUrl || DEFAULT_SERVER_URL;

        try {
            setStatus({ type: 'loading', message: 'Wysyłanie danych...' });
            const data = {
                schedule: useScheduleStore.getState().schedule,
                chatSessions: useChatStore.getState().sessions,
                settings: {
                    apiKey: localStorage.getItem('openai_api_key'),
                    model: localStorage.getItem('openai_model'),
                    staffingRules: { minStaffing, customRule } // Dodajemy reguły do wysyłki
                },
                timestamp: Date.now()
            };

            const response = await fetch(`${url}/api/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Błąd zapisu na serwerze');

            setStatus({ type: 'success', message: 'Dane (wraz z regułami) zapisane na serwerze!' });
            setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Błąd połączenia z serwerem. Sprawdź czy server.js jest uruchomiony.' });
        }
    };

    const handlePull = async () => {
        const url = serverUrl || DEFAULT_SERVER_URL;

        try {
            setStatus({ type: 'loading', message: 'Pobieranie danych...' });

            const response = await fetch(`${url}/api/data`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Błąd połączenia z serwerem.');

            const data = await response.json();

            if (data.schedule) {
                useScheduleStore.getState().restoreSchedule(data.schedule);
            }

            if (data.chatSessions) {
                useChatStore.getState().restoreSessions(data.chatSessions);
            }

            if (data.settings) {
                if (data.settings.apiKey) localStorage.setItem('openai_api_key', data.settings.apiKey);
                if (data.settings.model) localStorage.setItem('openai_model', data.settings.model);

                // Przywracanie reguł
                if (data.settings.staffingRules) {
                    const rules = data.settings.staffingRules;
                    setMinStaffing(rules.minStaffing || { morning: 1, afternoon: 1, night: 1 });
                    setCustomRule(rules.customRule || '');
                    // Zapisz też lokalnie
                    localStorage.setItem('staffing_rules', JSON.stringify(rules));
                }
            }

            setStatus({ type: 'success', message: 'Dane pobrane pomyślnie!' });
            setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Nie udało się pobrać danych.' });
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Panel Konfiguracji
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Zarządzaj inteligentnym asystentem, regułami placówki i synchronizacją chmury.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Karta 1: Strażnik Obsady (Lewa strona) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl">
                    <div className="flex items-center gap-4 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl shadow-inner">
                            <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                Strażnik Obsady AI
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Konfiguracja limitów</p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                        <Info className="w-4 h-4 inline mr-1 mb-1" />
                        Zdefiniuj minimalną liczbę osób na zmianie. Asystent AI będzie automatycznie ostrzegać o naruszeniach tych reguł.
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                Rano (7-15)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minStaffing.morning}
                                onChange={(e) => setMinStaffing({ ...minStaffing, morning: parseInt(e.target.value) || 0 })}
                                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono text-center text-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                Popołudnie (15-20)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minStaffing.afternoon}
                                onChange={(e) => setMinStaffing({ ...minStaffing, afternoon: parseInt(e.target.value) || 0 })}
                                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono text-center text-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                Noc (20-8)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minStaffing.night}
                                onChange={(e) => setMinStaffing({ ...minStaffing, night: parseInt(e.target.value) || 0 })}
                                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono text-center text-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                            Dodatkowe Reguły (Język naturalny)
                        </label>
                        <textarea
                            value={customRule}
                            onChange={(e) => setCustomRule(e.target.value)}
                            placeholder="Np. Pamiętaj, że w piątki musi być Kasia. Nie łącz zmian nocnych z porannymi. W weekendy minimum 2 osoby."
                            className="w-full p-4 border-2 border-gray-200 rounded-xl h-32 resize-none text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-400"
                        />
                    </div>

                    <button
                        onClick={handleSaveRules}
                        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold shadow-lg transition-all transform active:scale-95 ${rulesSaved ? 'bg-green-500 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'
                            }`}
                    >
                        {rulesSaved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                        {rulesSaved ? 'Reguły Zapisane!' : 'Zapisz Reguły Strażnika'}
                    </button>
                </div>

                {/* Karta 2: Synchronizacja (Prawa strona) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl">
                    <div className="flex items-center gap-4 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl shadow-inner">
                            <Server className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                Chmura i Synchronizacja
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Backup i dostęp zdalny</p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800/30">
                        <Info className="w-4 h-4 inline mr-1 mb-1" />
                        Zapisz cały stan aplikacji (grafik, ustawienia, historię czatu) na bezpiecznym serwerze. Pozwala to na dostęp z innych urządzeń.
                    </p>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                                Adres Serwera API
                            </label>
                            <input
                                type="text"
                                placeholder="Automatyczny (domyślny)"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">Zostaw puste, aby użyć wykrytego adresu: {DEFAULT_SERVER_URL}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handlePush}
                                disabled={status.type === 'loading'}
                                className="flex flex-col items-center justify-center gap-2 border-2 border-green-500/20 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-500 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40 py-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <div className="p-2 bg-white dark:bg-green-800 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Save className="w-6 h-6 text-green-600 dark:text-green-300" />
                                </div>
                                <span className="font-semibold">Wyślij na Serwer</span>
                            </button>

                            <button
                                onClick={handlePull}
                                disabled={status.type === 'loading'}
                                className="flex flex-col items-center justify-center gap-2 border-2 border-blue-500/20 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40 py-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <div className="p-2 bg-white dark:bg-blue-800 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Download className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                                </div>
                                <span className="font-semibold">Pobierz z Serwera</span>
                            </button>
                        </div>

                        {status.message && (
                            <div className={`p-4 rounded-xl text-sm flex items-center gap-3 animate-fade-in shadow-sm ${status.type === 'error'
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : status.type === 'success'
                                    ? 'bg-green-50 text-green-700 border border-green-100'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}>
                                {status.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> :
                                    status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> :
                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />}
                                <p className="font-medium">{status.message}</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
