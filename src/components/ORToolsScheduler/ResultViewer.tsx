import { useMemo, useState } from 'react';
import type { Employee } from '../../types';
import type { ORToolsResponse } from '../../utils/ortoolsService';
import { CheckCircle, Clock, TrendingUp, Copy, AlertTriangle, Search, Check, AlertOctagon } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';

interface ResultViewerProps {
    result: ORToolsResponse;
    employees: Employee[];
    dateRange: { start: string; end: string };
}

export default function ResultViewer({ result, employees, dateRange }: ResultViewerProps) {
    const { updateShift } = useScheduleStore();
    const [filter, setFilter] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    // Generate date list (memoized)
    const dates = useMemo(() => {
        const list: string[] = [];
        if (!dateRange.start || !dateRange.end) return list;

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        let current = new Date(start);

        while (current <= end) {
            list.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return list;
    }, [dateRange.start, dateRange.end]);

    // Filtered employees
    const filteredEmployees = useMemo(() => {
        if (!filter) return employees;
        return employees.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
    }, [employees, filter]);

    const copyToMainSchedule = () => {
        if (!result.schedule) return;

        let copiedCount = 0;
        for (const [empId, empSchedule] of Object.entries(result.schedule)) {
            for (const [date, shiftType] of Object.entries(empSchedule)) {
                const match = shiftType.match(/^(\d{1,2})-(\d{1,2})$/);
                if (match) {
                    const start = parseInt(match[1]);
                    const end = parseInt(match[2]);
                    updateShift(empId, date, 'WORK', start, end);
                    copiedCount++;
                }
            }
        }

        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000); // Reset po 3 sekundach
    };

    // Determine status color and icon
    const isOptimal = result.stats.status === 'OPTIMAL';
    const isFeasible = result.stats.status === 'FEASIBLE';

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className={`h-2 w-full ${isOptimal ? 'bg-green-500' : isFeasible ? 'bg-yellow-500' : 'bg-red-500'}`} />

                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${isOptimal ? 'bg-green-100 text-green-600' : isFeasible ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                                }`}>
                                {isOptimal ? <CheckCircle size={32} /> : <AlertOctagon size={32} />}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {isOptimal ? 'Grafik optymalny' : isFeasible ? 'Grafik dopuszczalny' : 'Błąd generowania'}
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    Status algorytmu: <span className="font-mono font-medium">{result.stats.status}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={copyToMainSchedule}
                                disabled={isCopied || !result.schedule}
                                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${isCopied
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 cursor-default'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                                    }`}
                            >
                                {isCopied ? (
                                    <>
                                        <Check size={18} />
                                        Zastosowano!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={18} />
                                        Zatwierdź i zastosuj
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1 text-sm">
                                <Clock size={16} />
                                Czas obliczeń
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {result.stats.solve_time?.toFixed(2)}s
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1 text-sm">
                                <TrendingUp size={16} />
                                Wynik (Score)
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {result.stats.objective_value?.toFixed(0) || '0'}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1 text-sm">
                                <AlertTriangle size={16} />
                                Konflikty
                            </div>
                            <div className={`text-2xl font-bold ${result.stats.num_conflicts && result.stats.num_conflicts > 0 ? 'text-orange-600' : 'text-slate-900 dark:text-white'}`}>
                                {result.stats.num_conflicts || 0}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1 text-sm">
                                <div className="w-4 h-4 rounded-full border-2 border-current opacity-60" />
                                Gałęzie
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {result.stats.num_branches || 0}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Violations (if any) */}
            {result.violations && result.violations.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Znalezione problemy ({result.violations.length})
                    </h3>
                    <ul className="space-y-1">
                        {result.violations.map((v, i) => (
                            <li key={i} className="text-yellow-700 dark:text-yellow-300 text-sm flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                                {v}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Schedule Preview */}
            {result.schedule && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white">Podgląd grafiku</h3>

                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Szukaj pracownika..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50">
                                    <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 p-3 text-left font-semibold text-gray-900 dark:text-white border-b border-r border-slate-200 dark:border-slate-700 min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        Pracownik
                                    </th>
                                    {dates.map(date => {
                                        const d = new Date(date);
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        return (
                                            <th key={date} className={`p-2 text-center font-medium border-b border-r border-slate-200 dark:border-slate-700 min-w-[60px] ${isWeekend ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                                <div className="text-xs uppercase text-gray-500">{d.toLocaleDateString('pl-PL', { weekday: 'short' })}</div>
                                                <div className="text-gray-900 dark:text-white">{d.getDate()}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 p-3 font-medium text-gray-900 dark:text-white border-b border-r border-slate-200 dark:border-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {emp.name}
                                        </td>
                                        {dates.map(date => {
                                            const shift = result.schedule?.[emp.id]?.[date];
                                            const d = new Date(date);
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                                            return (
                                                <td key={date} className={`p-1.5 text-center border-b border-r border-slate-200 dark:border-slate-700 ${isWeekend ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                                    {shift ? (
                                                        <span className="inline-block w-full py-1 px-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-semibold shadow-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                                            {shift}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 dark:text-gray-600">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
