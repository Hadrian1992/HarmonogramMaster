import { useEffect, useCallback, useMemo } from 'react';
import { getHolidays } from '../../utils/holidays';
import type { DemandSpec } from '../../store/useScheduleStore';

interface DemandCalendarProps {
    dateRange: { start: string; end: string };
    value: Record<string, DemandSpec>;
    onChange: (value: Record<string, DemandSpec>) => void;
}

export default function DemandCalendar({ dateRange, value, onChange }: DemandCalendarProps) {

    // Memoizowana lista dat i świąt
    const { dates, holidays, stats } = useMemo(() => {
        const sortedDates = Object.keys(value).sort();

        if (sortedDates.length === 0) {
            return { dates: [], holidays: new Set<string>(), stats: { totalDay: 0, totalNight: 0, total: 0, average: 0, weekdays: 0, weekends: 0 } };
        }

        const start = new Date(sortedDates[0]);
        const year = start.getFullYear();
        const month = start.getMonth() + 1;
        const holidayList = getHolidays(year, month);
        const holidayDates = new Set(holidayList.map(h => h.date));

        // Oblicz statystyki
        let totalDay = 0;
        let totalNight = 0;
        let weekdayCount = 0;
        let weekendCount = 0;

        sortedDates.forEach(date => {
            const dateObj = new Date(date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const demand = value[date];
            totalDay += demand?.day || 0;
            totalNight += demand?.night || 0;
            if (isWeekend) weekendCount++;
            else weekdayCount++;
        });

        const total = totalDay + totalNight;

        return {
            dates: sortedDates,
            holidays: holidayDates,
            stats: {
                totalDay,
                totalNight,
                total,
                average: sortedDates.length > 0 ? (total / sortedDates.length).toFixed(1) : 0,
                weekdays: weekdayCount,
                weekends: weekendCount
            }
        };
    }, [value]);

    // Auto-fill z optymalizacją (uruchamia się gdy zmieni się zakres dat)
    useEffect(() => {
        if (!dateRange.start || !dateRange.end) return;

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);

        // Sprawdź czy aktualny zakres dat pasuje do istniejących danych
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const existingDates = Object.keys(value).sort();

        const firstExisting = existingDates[0];
        const lastExisting = existingDates[existingDates.length - 1];

        // Jeśli dane dokładnie pasują do zakresu, nie rób nic
        if (firstExisting === startStr && lastExisting === endStr && existingDates.length > 0) {
            return;
        }

        // W przeciwnym razie, wygeneruj nowy kalendarz
        const newDemand: Record<string, DemandSpec> = {};
        const year = start.getFullYear();
        const month = start.getMonth() + 1;
        const holidayList = getHolidays(year, month);
        const holidayDates = new Set(holidayList.map(h => h.date));

        let current = new Date(start);
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            const isWeekend = current.getDay() === 0 || current.getDay() === 6;
            const isHoliday = holidayDates.has(dateStr);

            // Domyślnie: dni robocze (3, 1), weekendy/święta (2, 1)
            newDemand[dateStr] = value[dateStr] ?? {
                day: isWeekend || isHoliday ? 2 : 3,
                night: 1
            };

            current.setDate(current.getDate() + 1);
        }

        onChange(newDemand);
    }, [dateRange.start, dateRange.end]); // Usunięto 'value' i 'onChange' z zależności, aby uniknąć pętli

    // Optymalizowane funkcje aktualizacji
    const updateDayDemand = useCallback((date: string, val: number) => {
        onChange({
            ...value,
            [date]: {
                day: Math.max(0, Math.min(10, val)),
                night: value[date]?.night || 0
            }
        });
    }, [value, onChange]);

    const updateNightDemand = useCallback((date: string, val: number) => {
        onChange({
            ...value,
            [date]: {
                day: value[date]?.day || 0,
                night: Math.max(0, Math.min(10, val))
            }
        });
    }, [value, onChange]);

    // Bulk operations
    const fillWeekdays = useCallback((dayVal: number, nightVal: number) => {
        const updated = { ...value };
        dates.forEach(date => {
            const dateObj = new Date(date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            if (!isWeekend) updated[date] = { day: dayVal, night: nightVal };
        });
        onChange(updated);
    }, [dates, value, onChange]);

    const fillWeekends = useCallback((dayVal: number, nightVal: number) => {
        const updated = { ...value };
        dates.forEach(date => {
            const dateObj = new Date(date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            if (isWeekend) updated[date] = { day: dayVal, night: nightVal };
        });
        onChange(updated);
    }, [dates, value, onChange]);

    const fillAll = useCallback((dayVal: number, nightVal: number) => {
        const updated = { ...value };
        dates.forEach(date => {
            updated[date] = { day: dayVal, night: nightVal };
        });
        onChange(updated);
    }, [dates, value, onChange]);

    // Kopiowanie wzorca pierwszego tygodnia
    const copyFirstWeekPattern = useCallback(() => {
        if (dates.length < 7) return;

        const updated = { ...value };
        const firstWeek = dates.slice(0, 7);
        const pattern = firstWeek.map(date => value[date] || { day: 0, night: 0 });

        for (let i = 7; i < dates.length; i++) {
            const patternIndex = i % 7;
            updated[dates[i]] = { ...pattern[patternIndex] };
        }
        onChange(updated);
    }, [dates, value, onChange]);

    // Obsługa klawiatury
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, date: string, index: number, type: 'day' | 'night') => {
        const currentValue = type === 'day' ? (value[date]?.day || 0) : (value[date]?.night || 0);
        const updateFn = type === 'day' ? updateDayDemand : updateNightDemand;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateFn(date, currentValue + 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateFn(date, currentValue - 1);
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            document.getElementById(`demand-${type}-input-${index - 1}`)?.focus();
        } else if (e.key === 'ArrowRight' && index < dates.length - 1) {
            e.preventDefault();
            document.getElementById(`demand-${type}-input-${index + 1}`)?.focus();
        }
    }, [value, updateDayDemand, updateNightDemand, dates.length]);

    if (dates.length === 0) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Wybierz zakres dat, aby skonfigurować zapotrzebowanie
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Statystyki i bulk operations */}
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Łączne zapotrzebowanie: </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {stats.total} osób (☀️ {stats.totalDay} + 🌙 {stats.totalNight})
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Średnia dzienna: </span>
                        <span className="font-semibold text-gray-900 dark:text-white">{stats.average}</span>
                    </div>
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Dni: </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {stats.weekdays} roboczych, {stats.weekends} weekendowych
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => fillWeekdays(2, 1)}
                        className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                        Dni robocze → ☀️2 🌙1
                    </button>
                    <button
                        onClick={() => fillWeekends(1, 1)}
                        className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        Weekendy → ☀️1 🌙1
                    </button>
                    <button
                        onClick={() => fillWeekends(0, 0)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Weekendy → 0
                    </button>
                    <button
                        onClick={() => fillAll(0, 0)}
                        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                        Wyczyść wszystko
                    </button>
                    {dates.length >= 7 && (
                        <button
                            onClick={copyFirstWeekPattern}
                            className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Powtórz pierwszy tydzień
                        </button>
                    )}
                </div>
            </div>

            {/* Kalendarz */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {dates.map((date, index) => {
                    const dateObj = new Date(date);
                    const dayName = dateObj.toLocaleDateString('pl-PL', { weekday: 'short' });
                    const dayNum = dateObj.getDate();
                    const monthName = dateObj.toLocaleDateString('pl-PL', { month: 'short' });
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    const isHoliday = holidays.has(date);
                    const currentDay = value[date]?.day || 0;
                    const currentNight = value[date]?.night || 0;
                    const hasWarning = currentDay === 0 && currentNight === 0;

                    return (
                        <div
                            key={date}
                            className={`p-3 rounded-lg border transition-all ${isWeekend || isHoliday
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-gray-600'
                                } ${hasWarning ? 'ring-2 ring-yellow-400 dark:ring-yellow-600' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {dayName} {dayNum} {monthName}
                                </div>
                                {isHoliday && (
                                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                                        święto
                                    </span>
                                )}
                            </div>

                            {/* Day shift input */}
                            <div className="mb-2">
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ☀️ Dzień
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => updateDayDemand(date, currentDay - 1)}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-gray-700 dark:text-gray-200 text-xs font-bold"
                                        aria-label="Zmniejsz dzień"
                                    >
                                        -
                                    </button>
                                    <input
                                        id={`demand-day-input-${index}`}
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={currentDay}
                                        onChange={(e) => updateDayDemand(date, parseInt(e.target.value) || 0)}
                                        onKeyDown={(e) => handleKeyDown(e, date, index, 'day')}
                                        className="flex-1 px-1 py-0.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                        aria-label={`Dzień ${dayName} ${dayNum} ${monthName}`}
                                    />
                                    <button
                                        onClick={() => updateDayDemand(date, currentDay + 1)}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-gray-700 dark:text-gray-200 text-xs font-bold"
                                        aria-label="Zwiększ dzień"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Night shift input */}
                            <div>
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    🌙 Noc
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => updateNightDemand(date, currentNight - 1)}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-gray-700 dark:text-gray-200 text-xs font-bold"
                                        aria-label="Zmniejsz noc"
                                    >
                                        -
                                    </button>
                                    <input
                                        id={`demand-night-input-${index}`}
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={currentNight}
                                        onChange={(e) => updateNightDemand(date, parseInt(e.target.value) || 0)}
                                        onKeyDown={(e) => handleKeyDown(e, date, index, 'night')}
                                        className="flex-1 px-1 py-0.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                        aria-label={`Noc ${dayName} ${dayNum} ${monthName}`}
                                    />
                                    <button
                                        onClick={() => updateNightDemand(date, currentNight + 1)}
                                        className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-gray-700 dark:text-gray-200 text-xs font-bold"
                                        aria-label="Zwiększ noc"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Total summary */}
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                                Razem: {currentDay + currentNight} {currentDay + currentNight === 1 ? 'osoba' : 'osób'}
                            </div>

                            {hasWarning && (
                                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 text-center">
                                    ⚠️ Brak zapotrzebowania
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Podpowiedź o klawiszach */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                💡 Wskazówka: Użyj strzałek ↑↓ aby zmienić wartość, ←→ aby przełączać między dniami
            </div>
        </div>
    );
}