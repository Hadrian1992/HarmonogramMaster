import React from 'react';
import clsx from 'clsx';

interface MonthlyCoverageChartProps {
    coverage: number[]; // Array with count per day (length = days in month)
    daysInMonth: number;
}

/**
 * Bar chart showing daily coverage across the entire month
 * Similar to CoverageChart but for days instead of hours
 */
export const MonthlyCoverageChart: React.FC<MonthlyCoverageChartProps> = ({ coverage, daysInMonth }) => {
    const maxCoverage = Math.max(...coverage, 1);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const chartHeight = 240; // 240px for the bars area

    // Get color based on coverage level
    const getColor = (count: number) => {
        if (count === 0) return 'from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600';
        if (count === 1) return 'from-red-400 to-red-500 dark:from-red-500 dark:to-red-600';
        if (count <= 3) return 'from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600';
        return 'from-green-400 to-emerald-500 dark:from-green-500 dark:to-emerald-600';
    };

    return (
        <div className="space-y-6">
            {/* Chart */}
            <div className="relative bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                {/* Y-axis labels */}
                <div className="absolute left-2 top-6 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400" style={{ height: `${chartHeight}px` }}>
                    {[maxCoverage, Math.floor(maxCoverage / 2), 0].map((val, i) => (
                        <div key={i} className="font-medium">
                            {val}
                        </div>
                    ))}
                </div>

                {/* Chart area container */}
                <div className="ml-8 relative" style={{ height: `${chartHeight + 40}px` }}>
                    {/* Week separators (every 7 days) */}
                    {[7, 14, 21, 28].filter(day => day < daysInMonth).map(day => (
                        <div
                            key={day}
                            className="absolute top-0 w-px bg-gray-300 dark:bg-slate-600"
                            style={{
                                left: `${(day / daysInMonth) * 100}%`,
                                height: `${chartHeight}px`
                            }}
                        />
                    ))}

                    {/* Bars */}
                    <div className="relative flex items-end gap-[2px]" style={{ height: `${chartHeight}px` }}>
                        {days.map(day => {
                            const count = coverage[day - 1] || 0;
                            const barHeight = maxCoverage > 0 ? (count / maxCoverage) * chartHeight : 0;

                            return (
                                <div
                                    key={day}
                                    className="flex-1 flex flex-col justify-end items-center group cursor-pointer relative"
                                >
                                    {/* Tooltip on hover */}
                                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10 pointer-events-none">
                                        Dzień {day}: {count} {count === 1 ? 'osoba' : count < 5 ? 'osoby' : 'osób'}
                                    </div>

                                    {/* Bar */}
                                    <div
                                        className={clsx(
                                            'w-full rounded-t-md bg-gradient-to-t transition-all duration-300 group-hover:scale-110 shadow-lg',
                                            getColor(count)
                                        )}
                                        style={{
                                            height: `${barHeight}px`,
                                            minHeight: count > 0 ? '8px' : '0px'
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* X-axis labels - show every 5 days */}
                    <div className="absolute left-0 right-0 h-10 flex items-center" style={{ top: `${chartHeight + 5}px` }}>
                        {days.filter(day => day % 5 === 0 || day === 1 || day === daysInMonth).map(day => (
                            <div
                                key={day}
                                className="absolute text-xs font-medium text-gray-600 dark:text-gray-400 transform -translate-x-1/2"
                                style={{
                                    left: day === daysInMonth ? '100%' : `${((day - 1) / daysInMonth) * 100}%`
                                }}
                            >
                                {day}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-slate-800/50 dark:to-indigo-900/10 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 shadow-sm" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">4+ osób</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 shadow-sm" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">2-3 osoby</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-red-400 to-red-500 shadow-sm" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">1 osoba</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600 shadow-sm" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Brak</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
