import React, { useState } from 'react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { format, addDays, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CoverageChart } from './CoverageChart';
import { EmployeeTimeline } from './EmployeeTimeline';
import { CoverageStats } from './CoverageStats';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { PageHeader } from '../ui/PageHeader';
import { GlassButton } from '../ui/GlassButton';

/**
 * Premium Timeline View - Visualize hourly shift coverage
 * Shows who works when + coverage analytics
 */
export const TimelineView: React.FC = () => {
    const { schedule } = useScheduleStore();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const displayDate = format(selectedDate, 'd MMMM yyyy', { locale: pl });

    // Calculate hourly coverage for selected date
    const calculateHourlyCoverage = () => {
        const coverage = new Array(24).fill(0);

        schedule.employees.forEach(emp => {
            const shift = emp.shifts[dateStr];
            if (!shift || shift.type === 'W' || !shift.startHour || !shift.endHour) return;

            const start = shift.startHour;
            const end = shift.endHour;

            if (start < end) {
                // Normal shift: 8-16
                for (let h = start; h < end; h++) {
                    coverage[h]++;
                }
            } else {
                // Night shift: 20-8 (wraps around midnight)
                for (let h = start; h < 24; h++) coverage[h]++;
                for (let h = 0; h < end; h++) coverage[h]++;
            }
        });

        return coverage;
    };

    // Get employees working on selected date
    const getWorkingEmployees = () => {
        return schedule.employees
            .map(emp => ({
                ...emp,
                shift: emp.shifts[dateStr]
            }))
            .filter(emp => emp.shift && emp.shift.type !== 'W' && emp.shift.startHour !== undefined);
    };

    const coverage = calculateHourlyCoverage();
    const workingEmployees = getWorkingEmployees();

    // Navigation
    const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
    const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
    const goToToday = () => setSelectedDate(new Date());

    return (
        <div className="p-4 md:p-6 max-w-[100vw] overflow-x-hidden min-h-screen">
            <PageHeader
                title="Timeline Wizualizacja"
                description="Pokrycie zmian godzina po godzinie"
            >
                <div className="flex items-center gap-2 mt-4 md:mt-0">
                    <GlassButton
                        onClick={goToPreviousDay}
                        icon={ChevronLeft}
                        variant="secondary"
                        size="sm"
                    />

                    <div className="relative">
                        <input
                            type="date"
                            value={dateStr}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="px-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-slate-700 backdrop-blur-sm text-gray-900 dark:text-white font-medium min-w-[160px] cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <GlassButton
                        onClick={goToNextDay}
                        icon={ChevronRight}
                        variant="secondary"
                        size="sm"
                    />

                    <GlassButton
                        onClick={goToToday}
                        icon={Calendar}
                        variant="primary"
                        size="sm"
                    >
                        Dziś
                    </GlassButton>
                </div>
            </PageHeader>

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="text-center md:text-left">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Calendar className="text-indigo-500" />
                        {displayDate}
                    </h2>
                </div>

                {/* Coverage Stats */}
                <CoverageStats coverage={coverage} />

                {/* Main Coverage Chart */}
                <GlassCard>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        📊 Pokrycie Godzinowe
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                            (liczba pracowników w danej godzinie)
                        </span>
                    </h2>
                    <CoverageChart coverage={coverage} />
                </GlassCard>

                {/* Employee Timelines */}
                <GlassCard>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                        👥 Kto Pracuje ({workingEmployees.length})
                    </h2>

                    {workingEmployees.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <p className="text-lg">Brak pracowników w tym dniu</p>
                            <p className="text-sm mt-2">Wybierz inny dzień lub dodaj zmiany w grafiku</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {workingEmployees.map(emp => (
                                <EmployeeTimeline
                                    key={emp.id}
                                    employee={emp}
                                    shift={emp.shift!}
                                />
                            ))}
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
};
