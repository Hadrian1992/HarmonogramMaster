import React from 'react';
import clsx from 'clsx';

interface CoverageChartProps {
    coverage: number[]; // 24-element array with count per hour
}

/**
 * Beautiful bar chart showing hourly coverage
 * Color-coded by coverage level with gradient fills
 */
export const CoverageChart: React.FC<CoverageChartProps> = ({ coverage }) => {
    const maxCoverage = Math.max(...coverage, 1);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const chartHeight = 200; // 200px for the bars area

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
            <div className="relative bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700 overflow-hidden">
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
                    {/* Hour markers (every 4 hours) */}
                    {[0, 4, 8, 12, 16, 20].map(hour => (
                        <div
                            key={hour}
                            className="absolute top-0 w-px bg-gray-300 dark:bg-slate-600"
                            style={{
                                left: `${(hour / 24) * 100}%`,
                                height: `${chartHeight}px`
                            }}
                        />
                    ))}

                    {/* Bars */}
                    <div className="relative flex items-end gap-[1px]" style={{ height: `${chartHeight}px` }}>
                        {hours.map(hour => {
                            const count = coverage[hour];
                            const barHeight = maxCoverage > 0 ? (count / maxCoverage) * chartHeight : 0;

                            return (
                                <div
                                    key={hour}
                                    className="flex-1 flex flex-col justify-end items-center group cursor-pointer relative"
                                >
                                    {/* Tooltip on hover */}
                                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10 pointer-events-none">
                                        {hour}:00 - {count} {count === 1 ? 'osoba' : count < 5 ? 'osoby' : 'osób'}
                                    </div>

                                    {/* Bar */}
                                    <div
                                        className={clsx(
                                            'w-full rounded-t-md bg-gradient-to-t transition-all duration-300 group-hover:scale-110 shadow-lg',
                                            getColor(count)
                                        )}
                                        style={{
                                            height: `${barHeight}px`,
                                            minHeight: count > 0 ? '6px' : '0px'
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* X-axis labels - positioned absolutely to align with specific hours */}
                    <div className="absolute left-0 right-0 h-8" style={{ top: `${chartHeight + 5}px` }}>
                        {[0, 4, 8, 12, 16, 20, 24].map(hour => (
                            <div
                                key={hour}
                                className="absolute text-xs font-medium text-gray-600 dark:text-gray-400 transform -translate-x-1/2"
                                style={{
                                    left: hour === 24 ? '100%' : `${(hour / 24) * 100}%`
                                }}
                            >
                                {hour}:00
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend - Improved layout */}
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
