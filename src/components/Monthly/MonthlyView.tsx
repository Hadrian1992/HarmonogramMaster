import React from 'react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { getDaysInMonth } from 'date-fns';
import { GlassCard } from '../ui/GlassCard';
import { PageHeader } from '../ui/PageHeader';
import { MonthlyCoverageChart } from './MonthlyCoverageChart';
import { DailyStats } from './DailyStats';

/**
 * Monthly Coverage View - Shows daily staffing levels across the entire month
 */
export const MonthlyView: React.FC = () => {
    const { schedule } = useScheduleStore();

    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));

    // Calculate daily coverage for the entire month
    const calculateDailyCoverage = () => {
        const coverage = new Array(daysInMonth).fill(0);

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            schedule.employees.forEach(emp => {
                const shift = emp.shifts[dateStr];
                // Count employees working (exclude 'W' - day off)
                if (shift && shift.type !== 'W') {
                    coverage[day - 1]++;
                }
            });
        }

        return coverage;
    };

    const coverage = calculateDailyCoverage();

    // Calculate statistics
    const totalDays = daysInMonth;
    const averageCoverage = coverage.reduce((sum, count) => sum + count, 0) / daysInMonth;
    const lowCoverageDays = coverage.filter(count => count < 2).length;
    const peakCoverage = Math.max(...coverage);
    const peakDay = coverage.indexOf(peakCoverage) + 1;

    return (
        <div className="p-4 md:p-6 max-w-[100vw] overflow-x-hidden min-h-screen">
            <PageHeader
                title="Pokrycie Miesięczne"
                description={`Analiza pokrycia dziennego dla całego miesiąca`}
            />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Statistics Cards */}
                <DailyStats
                    totalDays={totalDays}
                    averageCoverage={averageCoverage}
                    lowCoverageDays={lowCoverageDays}
                    peakCoverage={peakCoverage}
                    peakDay={peakDay}
                />

                {/* Daily Coverage Chart */}
                <GlassCard>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        📊 Pokrycie Dzienne
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                            (liczba pracowników w danym dniu)
                        </span>
                    </h2>
                    <MonthlyCoverageChart coverage={coverage} daysInMonth={daysInMonth} />
                </GlassCard>

                {/* Daily Breakdown */}
                <GlassCard>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                        📋 Szczegółowe Pokrycie
                    </h2>

                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const count = coverage[day - 1];
                            const dateStr = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const date = new Date(dateStr);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                            return (
                                <div
                                    key={day}
                                    className={`
                                        p-3 rounded-lg text-center transition-all hover:scale-105 cursor-pointer
                                        ${isWeekend ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}
                                        ${count === 0 ? 'opacity-50' : ''}
                                    `}
                                >
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {day}
                                    </div>
                                    <div className={`
                                        text-lg font-bold
                                        ${count === 0 ? 'text-gray-400 dark:text-gray-600' :
                                            count === 1 ? 'text-red-600 dark:text-red-400' :
                                                count <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                                                    'text-green-600 dark:text-green-400'}
                                    `}>
                                        {count}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                                        {count === 1 ? 'os.' : 'osób'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};
