import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { calculateWeeklyCoverage, getWeekStart } from '../utils/timeline';
import { addWeeks, subWeeks, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export const WeeklyTimeline: React.FC = () => {
    const { schedule } = useScheduleStore();
    const [selectedWeek, setSelectedWeek] = useState<Date>(() =>
        getWeekStart(new Date(schedule.year, schedule.month - 1, 1))
    );

    const coverage = useMemo(() =>
        calculateWeeklyCoverage(schedule, selectedWeek),
        [schedule, selectedWeek]
    );

    const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8-22

    // Calculate summary stats
    const totalGaps = coverage.reduce((sum, day) =>
        sum + day.hours.filter(h => h.hasGap).length, 0
    );

    return (
        <div className="space-y-4">
            {/* Header & Week Selector */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Timeline Tygodniowy</h2>
                    <p className="text-sm text-gray-600">
                        {format(selectedWeek, 'dd MMM yyyy', { locale: pl })} - {format(addWeeks(selectedWeek, 1), 'dd MMM yyyy', { locale: pl })}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Gap indicator */}
                    {totalGaps > 0 ? (
                        <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle size={20} />
                            <span className="font-medium">{totalGaps} dziur w grafiku</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle size={20} />
                            <span className="font-medium">Brak problemów</span>
                        </div>
                    )}

                    {/* Week navigation */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedWeek(prev => subWeeks(prev, 1))}
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Poprzedni tydzień"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => setSelectedWeek(getWeekStart(new Date(schedule.year, schedule.month - 1, 1)))}
                            className="px-3 py-2 text-sm font-medium hover:bg-gray-100 rounded"
                        >
                            Bieżący miesiąc
                        </button>
                        <button
                            onClick={() => setSelectedWeek(prev => addWeeks(prev, 1))}
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Następny tydzień"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline Grid */}
            <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 border-r">
                                Dzień
                            </th>
                            {hours.map(hour => (
                                <th key={hour} className="px-2 py-2 text-center font-medium text-gray-700 border-r min-w-[60px]">
                                    {hour}:00
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {coverage.map((day, dayIdx) => (
                            <tr key={day.date} className={clsx(
                                "border-t",
                                dayIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                            )}>
                                <td className="px-3 py-3 font-medium text-gray-900 border-r whitespace-nowrap">
                                    <div>{day.dayName}</div>
                                    <div className="text-gray-500 text-xs">{format(new Date(day.date), 'dd.MM')}</div>
                                </td>
                                {day.hours.map(hourData => (
                                    <td
                                        key={hourData.hour}
                                        className={clsx(
                                            "border-r px-1 py-2 text-center",
                                            hourData.hasGap && "bg-red-100 text-red-900",
                                            !hourData.hasGap && hourData.employees.length > 0 && "bg-green-50",
                                            hourData.employees.length === 0 && "bg-gray-100"
                                        )}
                                        title={
                                            hourData.hasGap
                                                ? `Dziura! Wymagane: ${hourData.requiredCount}, Obecnych: ${hourData.employees.length}`
                                                : hourData.employees.map(e => e.name).join(', ') || 'Brak pracowników'
                                        }
                                    >
                                        {hourData.employees.length > 0 ? (
                                            <div className="space-y-0.5">
                                                {hourData.employees.map(emp => (
                                                    <div key={emp.id} className="truncate font-medium">
                                                        {getInitials(emp.name)}
                                                    </div>
                                                ))}
                                                {hourData.hasGap && (
                                                    <div className="text-red-600 font-bold">⚠</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">Legenda</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-50 border rounded"></div>
                        <span>Wystarczająco osób</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 border rounded flex items-center justify-center">⚠</div>
                        <span>Dziura (za mało osób)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 border rounded"></div>
                        <span>Brak pracowników</span>
                    </div>
                    <div className="text-gray-600">
                        Inicjały = pracownicy na zmianie
                    </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                    <p>• Dzień (8-20): wymagane minimum 2 osoby</p>
                    <p>• Noc (20-8): wymagane minimum 1 osoba</p>
                </div>
            </div>

            {/* Employee list */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">Pracownicy ({schedule.employees.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                    {schedule.employees.map(emp => (
                        <div key={emp.id} className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">{getInitials(emp.name)}</span>
                            <span className="text-gray-600">-</span>
                            <span className="text-gray-900">{emp.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}
