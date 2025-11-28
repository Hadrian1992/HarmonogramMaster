import React from 'react';
import { TrendingUp, TrendingDown, Users, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface CoverageStatsProps {
    coverage: number[];
}

/**
 * Premium stat cards showing coverage analytics
 * Peak, low, average, and alerts
 */
export const CoverageStats: React.FC<CoverageStatsProps> = ({ coverage }) => {
    // Calculate stats
    const maxCoverage = Math.max(...coverage);
    const minCoverage = Math.min(...coverage);
    const avgCoverage = coverage.reduce((a, b) => a + b, 0) / 24;

    const peakHour = coverage.indexOf(maxCoverage);
    const lowHour = coverage.indexOf(minCoverage);

    const coveragePercent = (coverage.filter(c => c > 0).length / 24) * 100;

    // Low coverage warnings (less than 2 people)
    const lowCoverageHours = coverage
        .map((count, hour) => ({ hour, count }))
        .filter(({ count }) => count > 0 && count < 2);

    const stats = [
        {
            icon: TrendingUp,
            label: 'Szczyt Pokrycia',
            value: `${peakHour}:00`,
            subValue: `${maxCoverage} ${maxCoverage === 1 ? 'osoba' : maxCoverage < 5 ? 'osoby' : 'osób'}`,
            color: 'from-green-500 to-emerald-600',
            bgColor: 'bg-green-50 dark:bg-green-900/20',
            textColor: 'text-green-700 dark:text-green-400'
        },
        {
            icon: lowCoverageHours.length > 0 ? AlertTriangle : TrendingDown,
            label: lowCoverageHours.length > 0 ? 'Ostrzeżenie' : 'Najniższe Pokrycie',
            value: lowCoverageHours.length > 0
                ? `${lowCoverageHours.length} ${lowCoverageHours.length === 1 ? 'godzina' : 'godziny'}`
                : `${lowHour}:00`,
            subValue: lowCoverageHours.length > 0
                ? 'Niskie pokrycie'
                : `${minCoverage} ${minCoverage === 1 ? 'osoba' : 'osób'}`,
            color: lowCoverageHours.length > 0 ? 'from-red-500 to-orange-600' : 'from-yellow-500 to-orange-600',
            bgColor: lowCoverageHours.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20',
            textColor: lowCoverageHours.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'
        },
        {
            icon: Users,
            label: 'Średnie Pokrycie',
            value: avgCoverage.toFixed(1),
            subValue: `${coveragePercent.toFixed(0)}% dnia`,
            color: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            textColor: 'text-blue-700 dark:text-blue-400'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat, index) => (
                <div
                    key={index}
                    className={clsx(
                        'relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-105',
                        'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl',
                        'border-white/20 dark:border-slate-700/50',
                        'shadow-lg hover:shadow-2xl'
                    )}
                >
                    {/* Gradient overlay */}
                    <div className={clsx(
                        'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20',
                        `bg-gradient-to-br ${stat.color}`
                    )} />

                    <div className="relative p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {stat.label}
                                </p>
                                <p className={clsx(
                                    'text-3xl font-bold mt-2',
                                    stat.textColor
                                )}>
                                    {stat.value}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {stat.subValue}
                                </p>
                            </div>

                            <div className={clsx(
                                'w-12 h-12 rounded-lg flex items-center justify-center',
                                stat.bgColor
                            )}>
                                <stat.icon className={stat.textColor} size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
