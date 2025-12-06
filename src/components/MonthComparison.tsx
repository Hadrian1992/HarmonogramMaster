import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { calculateMonthComparison, type MonthData } from '../utils/monthComparison';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

const MONTH_NAMES = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const MonthComparison: React.FC = () => {
    const { schedule } = useScheduleStore();

    const [month1, setMonth1] = useState<MonthData>({
        month: schedule.month === 1 ? 12 : schedule.month - 1,
        year: schedule.month === 1 ? schedule.year - 1 : schedule.year
    });

    const [month2, setMonth2] = useState<MonthData>({
        month: schedule.month,
        year: schedule.year
    });

    const comparison = useMemo(() =>
        calculateMonthComparison(schedule, month1, month2),
        [schedule, month1, month2]
    );

    // Data for charts
    const barChartData = comparison.employees.slice(0, 10).map(emp => ({
        name: emp.name.split(' ')[0], // First name only
        [MONTH_NAMES[month1.month - 1]]: emp.month1Hours,
        [MONTH_NAMES[month2.month - 1]]: emp.month2Hours
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Porównanie Miesięcy</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Analiza zmian i trendów w czasie</p>
                    </div>
                </div>

                {/* Month selectors */}
                <div className="mt-6 flex items-center gap-4 flex-wrap">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Miesiąc 1:
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={month1.month}
                                onChange={(e) => setMonth1({ ...month1, month: parseInt(e.target.value) })}
                                className="px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={idx} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                value={month1.year}
                                onChange={(e) => setMonth1({ ...month1, year: parseInt(e.target.value) })}
                                className="w-24 px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                min="2020"
                                max="2030"
                            />
                        </div>
                    </div>

                    <div className="flex items-center pt-6">
                        <ArrowRight size={24} className="text-gray-400" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Miesiąc 2:
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={month2.month}
                                onChange={(e) => setMonth2({ ...month2, month: parseInt(e.target.value) })}
                                className="px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={idx} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                value={month2.year}
                                onChange={(e) => setMonth2({ ...month2, year: parseInt(e.target.value) })}
                                className="w-24 px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                min="2020"
                                max="2030"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Zespół - {MONTH_NAMES[month1.month - 1]}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{comparison.teamTotal1}h</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Zespół - {MONTH_NAMES[month2.month - 1]}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{comparison.teamTotal2}h</div>
                </div>
                <div className={clsx(
                    "bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm",
                    comparison.teamDifference > 0 && "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800",
                    comparison.teamDifference < 0 && "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                )}>
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        Różnica
                        {comparison.teamDifference > 0 ? <TrendingUp size={16} className="text-green-600 dark:text-green-400" /> : <TrendingDown size={16} className="text-red-600 dark:text-red-400" />}
                    </div>
                    <div className={clsx(
                        "text-2xl font-bold",
                        comparison.teamDifference > 0 && "text-green-600 dark:text-green-400",
                        comparison.teamDifference < 0 && "text-red-600 dark:text-red-400",
                        comparison.teamDifference === 0 && "text-gray-900 dark:text-white"
                    )}>
                        {comparison.teamDifference > 0 && '+'}{comparison.teamDifference}h
                        <span className="text-sm ml-2">({comparison.teamPercentChange > 0 && '+'}{comparison.teamPercentChange.toFixed(1)}%)</span>
                    </div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Porównanie Godzin - Top 10 Pracowników</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ value: 'Godziny', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey={MONTH_NAMES[month1.month - 1]} fill="#3b82f6" />
                        <Bar dataKey={MONTH_NAMES[month2.month - 1]} fill="#10b981" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Comparison Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Szczegółowe porównanie pracowników
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3">Pracownik</th>
                                <th className="px-6 py-3 text-right">Godziny ({MONTH_NAMES[month1.month - 1]} vs {MONTH_NAMES[month2.month - 1]})</th>
                                <th className="px-6 py-3 text-right">Zmiany</th>
                                <th className="px-6 py-3 text-right">Nocki</th> {/* NOWA KOLUMNA */}
                                <th className="px-6 py-3 text-right">Kontakty</th> {/* NOWA KOLUMNA */}
                                <th className="px-6 py-3 text-right">Urlopy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {comparison.employees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">

                                    {/* Pracownik */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900 dark:text-white">{emp.name}</div>
                                    </td>

                                    {/* Godziny (istniejące) */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-xs">{emp.month1Hours}h</span>
                                                <span className="text-gray-300">→</span>
                                                <span className="font-bold text-gray-900 dark:text-white">{emp.month2Hours}h</span>
                                            </div>
                                            <div className={clsx(
                                                "text-xs font-medium px-1.5 py-0.5 rounded",
                                                emp.difference > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                    emp.difference < 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                            )}>
                                                {emp.difference > 0 ? '+' : ''}{emp.difference}h ({emp.percentChange > 0 ? '+' : ''}{emp.percentChange.toFixed(1)}%)
                                            </div>
                                        </div>
                                    </td>

                                    {/* Zmiany (istniejące, odświeżone) */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-300">
                                        <div>{emp.month2Shifts}</div>
                                        <div className="text-xs text-gray-400">{emp.month1Shifts} w poprz.</div>
                                    </td>

                                    {/* Nocki (NOWE) */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm text-gray-900 dark:text-white font-medium">{emp.month2NightShifts}</div>
                                        {emp.month2NightShifts !== emp.month1NightShifts && (
                                            <div className={clsx("text-xs",
                                                emp.month2NightShifts > emp.month1NightShifts ? "text-green-500" : "text-red-400"
                                            )}>
                                                {emp.month2NightShifts > emp.month1NightShifts ? '+' : ''}{emp.month2NightShifts - emp.month1NightShifts}
                                            </div>
                                        )}
                                    </td>

                                    {/* Kontakty (NOWE) */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm text-gray-900 dark:text-white font-medium">{emp.month2ContactHours}h</div>
                                        {emp.month2ContactHours !== emp.month1ContactHours && (
                                            <div className="text-xs text-gray-400">
                                                Poprzednio: {emp.month1ContactHours}h
                                            </div>
                                        )}
                                    </td>

                                    {/* Urlopy (istniejące) */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                                        {emp.month1Vacation} / {emp.month2Vacation}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
