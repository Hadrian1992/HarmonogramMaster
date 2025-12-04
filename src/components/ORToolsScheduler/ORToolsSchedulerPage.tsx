import { useState, useRef, useEffect } from 'react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Calendar, Users, Sparkles, AlertOctagon, CheckCircle2, BarChart3, Settings } from 'lucide-react';
import { generateSchedule, type ORToolsEmployee, type ORToolsConstraint, type ORToolsResponse } from '../../utils/ortoolsService';
import DateRangePicker from './DateRangePicker';
import EmployeeShiftConfig from './EmployeeShiftConfig';
import DemandCalendar from './DemandCalendar';
import RuleEditor from './RuleEditor';
import ResultViewer from './ResultViewer';
import type { DemandSpec } from '../../store/useScheduleStore';

export default function ORToolsSchedulerPage() {
    // 1. Pobierz schedule oraz konfigurację OR-Tools ze store'a (który jest zapisywany w localStorage)
    const { schedule, ortoolsConfig, updateORToolsConfig } = useScheduleStore();
    const resultsRef = useRef<HTMLDivElement>(null);

    // 2. Przypisz wartości ze store'a do zmiennych. Jeśli store jest pusty (np. pierwsze uruchomienie), użyj domyślnych wartości.
    // Dzięki temu, po zmianie zakładki i powrocie, te zmienne będą miały wartości z localStorage.
    const dateRange = ortoolsConfig?.dateRange || { start: '', end: '' };
    const employeeConfig = ortoolsConfig?.employees || [];
    const demand = ortoolsConfig?.demand || {};
    const constraints = ortoolsConfig?.constraints || [];

    // 3. Definicja funkcji aktualizujących store.
    // Każda zmiana w inputach wywoła te funkcje, które zapiszą dane globalnie.
    const setDateRange = (val: { start: string; end: string }) => updateORToolsConfig({ dateRange: val });
    const setEmployeeConfig = (val: ORToolsEmployee[]) => updateORToolsConfig({ employees: val });
    const setDemand = (val: Record<string, DemandSpec>) => updateORToolsConfig({ demand: val });
    const setConstraints = (val: ORToolsConstraint[]) => updateORToolsConfig({ constraints: val });

    // 4. Te stany mogą pozostać lokalne, ponieważ wynik generowania/błędy są tymczasowe.
    const [result, setResult] = useState<ORToolsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debug: Sprawdź w konsoli czy config się ładuje
    useEffect(() => {
        console.log('ORTools Config Loaded from Store:', ortoolsConfig);
    }, []);

    const handleGenerate = async () => {
        // Walidacja wstępna
        if (!dateRange.start || !dateRange.end) {
            setError('Krok 1: Wybierz zakres dat dla grafiku.');
            return;
        }

        if (employeeConfig.length === 0) {
            setError('Krok 2: Skonfiguruj listę pracowników i ich zmiany.');
            return;
        }

        // Sprawdzenie czy zapotrzebowanie jest ustawione
        if (Object.keys(demand).length === 0) {
            setError('Krok 3: Ustal zapotrzebowanie na personel (ile osób potrzeba).');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await generateSchedule({
                dateRange,
                employees: employeeConfig,
                constraints,
                demand,
                existingSchedule: schedule
            });

            setResult(response);

            if (response.status !== 'SUCCESS') {
                setError(response.error || 'Nie znaleziono rozwiązania spełniającego wszystkie kryteria.');
            } else {
                // Scroll do wyników po sukcesie
                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } catch (err: any) {
            console.error('Generation failed:', err);
            setError(err.message || 'Wystąpił nieoczekiwany błąd podczas komunikacji z algorytmem.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header Section */}
                <header className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl" />

                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="p-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg shadow-purple-500/20">
                            <Sparkles className="text-white" size={40} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Generator Grafików AI
                            </h1>
                            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
                                Automatyczne tworzenie harmonogramów przy użyciu Google OR-Tools.
                                Zdefiniuj zasoby, określ reguły i pozwól algorytmowi znaleźć optymalne rozwiązanie.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                        <AlertOctagon className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-semibold text-red-800 dark:text-red-200">Wystąpił błąd</h3>
                            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Main Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                    {/* Step 1: Date Range */}
                    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">1</div>
                            <Calendar className="text-gray-400" size={20} />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Zakres Czasowy</h2>
                        </div>
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                    </section>

                    {/* Step 2: Employees */}
                    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">2</div>
                            <Users className="text-gray-400" size={20} />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Zespół i Zmiany</h2>
                        </div>
                        {/* Przekazujemy employees ze store'a oraz config z persistent store'a */}
                        <EmployeeShiftConfig
                            employees={schedule.employees}
                            value={employeeConfig}
                            onChange={setEmployeeConfig}
                        />
                    </section>

                    {/* Step 3: Demand */}
                    <section className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">3</div>
                            <BarChart3 className="text-gray-400" size={20} />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Zapotrzebowanie na personel</h2>
                        </div>
                        <DemandCalendar
                            dateRange={dateRange}
                            value={demand}
                            onChange={setDemand}
                        />
                    </section>

                    {/* Step 4: Rules */}
                    <section className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">4</div>
                            <Settings className="text-gray-400" size={20} />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Reguły i Ograniczenia</h2>
                        </div>
                        <RuleEditor
                            employees={schedule.employees}
                            value={constraints}
                            onChange={setConstraints}
                        />
                    </section>
                </div>

                {/* Generate Action */}
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-purple-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <div className="relative flex items-center gap-3">
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Przetwarzanie danych...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} className="animate-pulse" />
                                    <span>Uruchom Algorytm</span>
                                </>
                            )}
                        </div>
                    </button>
                    {!loading && !result && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Kliknij, aby wysłać dane do silnika optymalizacji
                        </p>
                    )}
                </div>

                {/* Results Section */}
                {result && (
                    <div ref={resultsRef} className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="text-green-500" size={24} />
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Wyniki Generowania
                            </h2>
                        </div>
                        <ResultViewer
                            result={result}
                            employees={schedule.employees}
                            dateRange={dateRange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}