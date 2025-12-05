import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

type MonthlyHours = { month: string; hours: number };
const WORKING_HOURS: Record<number, MonthlyHours[]> = {
    2025: [
        { month: 'Grudzień', hours: 160 }
    ],
    2026: [
        { month: 'Styczeń', hours: 160 },
        { month: 'Luty', hours: 160 },
        { month: 'Marzec', hours: 176 },
        { month: 'Kwiecień', hours: 168 },
        { month: 'Maj', hours: 160 },
        { month: 'Czerwiec', hours: 168 },
        { month: 'Lipiec', hours: 184 },
        { month: 'Sierpień', hours: 160 },
        { month: 'Wrzesień', hours: 176 },
        { month: 'Październik', hours: 176 },
        { month: 'Listopad', hours: 160 },
        { month: 'Grudzień', hours: 160 },
    ]
};

export const WorkingHoursReference: React.FC<{ currentMonth: number, currentYear: number }> = ({ currentMonth, currentYear }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Find current month hours
    const currentMonthData = WORKING_HOURS[currentYear]?.find((_, index) => {
        // Map 1-based month index to array index? 
        // The array for 2026 is full 12 months.
        // But 2025 has only December.
        if (currentYear === 2026) return index === currentMonth - 1;
        if (currentYear === 2025 && currentMonth === 12) return true;
        return false;
    });

    const currentHours = currentMonthData ? currentMonthData.hours : '-';

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-sm border border-indigo-100 dark:border-indigo-900/30 rounded-xl transition-all group"
            >
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                    <Calendar size={16} />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Norma</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{currentHours}h</span>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Normy Godzinowe</h3>
                            <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">2026</span>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-2">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-slate-700/50">
                                        <th className="pb-2 pl-2 font-medium">Miesiąc</th>
                                        <th className="pb-2 pr-2 text-right font-medium">Godziny</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/30">
                                    {WORKING_HOURS[2026].map((item, index) => {
                                        const isCurrent = currentYear === 2026 && (index + 1) === currentMonth;
                                        return (
                                            <tr
                                                key={item.month}
                                                className={`
                                                    group transition-colors
                                                    ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}
                                                `}
                                            >
                                                <td className="py-2 pl-2 text-gray-600 dark:text-gray-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {item.month}
                                                </td>
                                                <td className="py-2 pr-2 text-right font-bold text-gray-800 dark:text-gray-200">
                                                    {item.hours}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                                <div className="text-xs font-medium text-gray-400 mb-1 px-2">2025</div>
                                <div className="flex justify-between items-center px-2 py-1 bg-gray-50 dark:bg-slate-800/50 rounded text-sm text-gray-600 dark:text-gray-400">
                                    <span>Grudzień</span>
                                    <span className="font-bold">160</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
