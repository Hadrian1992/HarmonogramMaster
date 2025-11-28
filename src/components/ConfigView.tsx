import React, { useState } from 'react';
import {
    Save, Server, Shield, RefreshCw, CheckCircle, AlertCircle, Info as InfoIcon,
} from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { useChatStore } from '../store/useChatStore';
import { GlassCard } from './ui/GlassCard';
import { PageHeader } from './ui/PageHeader';
import { GlassButton } from './ui/GlassButton';

export const ConfigView: React.FC = () => {
    const { schedule, staffingRules, updateStaffingRules } = useScheduleStore();
    const { sessions } = useChatStore();
    const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [minStaffMorning, setMinStaffMorning] = useState(staffingRules?.minStaffMorning || 2);
    const [minStaffEvening, setMinStaffEvening] = useState(staffingRules?.minStaffEvening || 1);
    const [minStaffNight, setMinStaffNight] = useState(staffingRules?.minStaffNight || 1);
    const [customRules, setCustomRules] = useState(staffingRules?.customRules || '');

    const handleSaveRules = () => {
        updateStaffingRules({
            minStaffMorning,
            minStaffEvening,
            minStaffNight,
            customRules,
        });
        setSyncStatus('success');
        setSyncMessage('Reguły obsady zapisane.');
        setTimeout(() => setSyncStatus('idle'), 3000);
    };

    const handleSyncPush = async () => {
        setSyncStatus('loading');
        try {
            const data = {
                schedule,
                chatSessions: sessions,
                settings: {
                    staffingRules: { minStaffMorning, minStaffEvening, minStaffNight, customRules },
                },
                timestamp: Date.now(),
            };
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
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
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Błąd pobierania z serwera');
            const data = await response.json();
            if (data.schedule) useScheduleStore.getState().restoreSchedule(data.schedule);
            if (data.chatSessions && Array.isArray(data.chatSessions)) {
                useChatStore.getState().restoreSessions(data.chatSessions);
            }
            if (data.settings) {
                if (data.settings.staffingRules) {
                    const rules = data.settings.staffingRules;
                    if (rules.minStaffMorning !== undefined) setMinStaffMorning(rules.minStaffMorning);
                    if (rules.minStaffEvening !== undefined) setMinStaffEvening(rules.minStaffEvening);
                    if (rules.minStaffNight !== undefined) setMinStaffNight(rules.minStaffNight);
                    if (rules.customRules) setCustomRules(rules.customRules);
                }
            }
            window.dispatchEvent(new Event('local-storage-update'));
            setSyncStatus('success');
            setSyncMessage('Dane pomyślnie pobrane z serwera!');
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            setSyncMessage('Błąd połączenia z serwerem.');
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[100vw] overflow-x-hidden min-h-screen">
            <PageHeader
                title="Panel Konfiguracji"
                description="Zarządzaj AI, regułami placówki i synchronizacją"
            />

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Staffing Rules */}
                <GlassCard className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <Shield size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Strażnik Obsady</h2>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Zdefiniuj minimalną liczbę osób na zmianie. AI będzie ostrzegać o naruszeniach.
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Rano 7-15</label>
                            <input
                                type="number"
                                value={minStaffMorning}
                                onChange={e => setMinStaffMorning(Number(e.target.value))}
                                className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-center bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Popołudnie 15-20</label>
                            <input
                                type="number"
                                value={minStaffEvening}
                                onChange={e => setMinStaffEvening(Number(e.target.value))}
                                className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-center bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Noc 20-8</label>
                            <input
                                type="number"
                                value={minStaffNight}
                                onChange={e => setMinStaffNight(Number(e.target.value))}
                                className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-center bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Dodatkowe Reguły Dla AI</label>
                        <textarea
                            value={customRules}
                            onChange={e => setCustomRules(e.target.value)}
                            placeholder="Np. Pamiętaj, że w piątki musi być Kasia. Nie łącz zmian nocnych z porannymi."
                            className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        />
                    </div>

                    <GlassButton
                        onClick={handleSaveRules}
                        icon={Save}
                        variant="primary"
                        className="w-full justify-center"
                    >
                        Zapisz Reguły
                    </GlassButton>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-lg border border-blue-100 dark:border-blue-800/30 flex items-start gap-2">
                        <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Te reguły są brane pod uwagę przez Asystenta AI przy analizie grafiku.</span>
                    </div>
                </GlassCard>

                {/* Server Sync */}
                <GlassCard className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                            <Server size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Synchronizacja</h2>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Zapisz cały stan aplikacji na serwerze, aby mieć do niego dostęp z innych urządzeń.<br />
                        <span className="text-xs opacity-75">Wymaga uruchomionego <code>node server.js</code>.</span>
                    </p>

                    <div className="space-y-4">
                        <input
                            type="text"
                            value={serverUrl}
                            onChange={e => setServerUrl(e.target.value)}
                            className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            placeholder="Adres serwera (zostaw puste dla domyślnego)"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <GlassButton
                                onClick={handleSyncPush}
                                disabled={syncStatus === 'loading'}
                                icon={Save}
                                variant="secondary"
                                className="justify-center bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            >
                                Wyślij
                            </GlassButton>
                            <GlassButton
                                onClick={handleSyncPull}
                                disabled={syncStatus === 'loading'}
                                icon={RefreshCw}
                                variant="secondary"
                                className="justify-center"
                            >
                                Pobierz
                            </GlassButton>
                        </div>
                    </div>

                    {syncMessage && (
                        <div
                            className={
                                `p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-fade-in ${syncStatus === 'success'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800'
                                    : syncStatus === 'error'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                }`
                            }
                        >
                            {syncStatus === 'success' ? <CheckCircle size={18} /> : syncStatus === 'error' ? <AlertCircle size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                            {syncMessage}
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
};
