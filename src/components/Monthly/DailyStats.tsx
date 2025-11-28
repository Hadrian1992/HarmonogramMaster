import React from 'react';

interface DailyStatsProps {
    totalDays: number;
    averageCoverage: number;
    lowCoverageDays: number;
    peakCoverage: number;
    peakDay: number;
}

/**
 * Statistics card for monthly coverage overview
 */
export const DailyStats: React.FC<DailyStatsProps> = ({
    totalDays,
    averageCoverage,
    lowCoverageDays,
    peakCoverage,
    peakDay
}) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Total Days */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Dni w miesiącu</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    {totalDays}
                </div>
            </div>

            {/* Average Coverage */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Średnie pokrycie</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                    {averageCoverage.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">osób/dzień</div>
            </div>

            {/* Low Coverage Days */}
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Dni z niskim pokryciem</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 dark:from-yellow-400 dark:to-orange-400 bg-clip-text text-transparent">
                    {lowCoverageDays}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">&lt;2 osoby</div>
            </div>

            {/* Peak Coverage */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Maksymalne pokrycie</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    {peakCoverage}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">osób</div>
            </div>

            {/* Peak Day */}
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Dzień szczytowy</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {peakDay}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">dzień miesiąca</div>
            </div>
        </div>
    );
};
