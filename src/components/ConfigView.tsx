import { useState } from 'react';
import { Save, Download, Server, Shield, AlertTriangle, Info } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useChatStore } from '../store/useChatStore';

// ZMIANA 1: Dynamiczny adres URL zamiast sztywnego localhosta
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
                },
                timestamp: Date.now()
            };

            // ZMIANA 2: Dodano credentials: 'include'
            const response = await fetch(`${url}/api/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Błąd zapisu na serwerze');

            setStatus({ type: 'success', message: 'Dane zostały pomyślnie zapisane na serwerze!' });
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

            // ZMIANA 3: Dodano credentials: 'include'
            const response = await fetch(`${url}/api/data`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Błąd połączenia z serwerem. Sprawdź czy server.js jest uruchomiony.');

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
            }

            setStatus({ type: 'success', message: 'Dane zostały pomyślnie pobrane!' });
            setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Nie udało się pobrać danych. Sprawdź konsolę.' });
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    Panel Konfiguracji
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Zarządzaj AI, regułami placówki i synchronizacją
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Staffing Rules Card */}
                <div className="bg-white dark:bg-boxdark p-6 rounded-lg shadow-md border border-gray-200 dark:border-strokedark">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                            Strażnik Obsady
                        </h2>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Zdefiniuj minimalną liczbę osób na zmianie. AI będzie ostrzegać o naruszeniach.
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Rano 7-15
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minStaffing.morning}
                                onChange={(e) => setMinStaffing({ ...minStaffing, morning: parseInt(e.target.value) || 0 })}
                                className="w-full p-2 border rounded dark:bg-form-input dark:border-form-strokedark dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Popołudnie 15-20
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minStaffing.afternoon}
                                onChange={(e) => setMinStaffing({ ...minStaffing, afternoon: parseInt(e.target.value) || 0 })}
                                className="w-full p-2 border rounded dark:bg-form-input dark:border-form-strokedark dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Noc 20-8
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={minStaffing.night}
                                onChange={(e) => setMinStaffing({ ...minStaffing, night: parseInt(e.target.value) || 0 })}
                                className="w-full p-2 border rounded dark:bg-form-input dark:border-form-strokedark dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dodatkowe Reguły Dla AI
                        </label>
                        <textarea
                            value={customRule}
                            onChange={(e) => setCustomRule(e.target.value)}
                            placeholder="Np. Pamiętaj, że w piątki musi być Kasia. Nie łącz zmian nocnych z porannymi."
                            className="w-full p-3 border rounded-lg h-32 resize-none text-sm dark:bg-form-input dark:border-form-strokedark dark:text-white"
                        />
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg hover:bg-opacity-90 transition-colors">
                        <Save className="w-4 h-4" />
                        Zapisz Reguły
                    </button>

                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-xs text-blue-600 dark:text-blue-400 flex gap-2 items-start">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Te reguły są brane pod uwagę przez Asystenta AI przy analizie grafiku.</p>
                    </div>
                </div>

                {/* Sync Card */}
                <div className="bg-white dark:bg-boxdark p-6 rounded-lg shadow-md border border-gray-200 dark:border-strokedark">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Server className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                            Synchronizacja
                        </h2>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Zapisz cały stan aplikacji na serwerze, aby mieć do niego dostęp z innych urządzeń.
                        <br />
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                            Wymaga uruchomionego node server.js.
                        </span>
                    </p>

                    <div className="space-y-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Adres serwera (zostaw puste dla domyślnego)"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                className="w-full p-3 border rounded-lg text-sm mb-2 dark:bg-form-input dark:border-form-strokedark dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handlePush}
                                disabled={status.type === 'loading'}
                                className="flex items-center justify-center gap-2 border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Wyślij
                            </button>
                            <button
                                onClick={handlePull}
                                disabled={status.type === 'loading'}
                                className="flex items-center justify-center gap-2 border border-gray-400 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                Pobierz
                            </button>
                        </div>

                        {status.message && (
                            <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${status.type === 'error'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : status.type === 'success'
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                {status.type === 'error' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                                <p>{status.message}</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
