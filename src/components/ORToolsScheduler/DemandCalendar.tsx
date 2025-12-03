import { useEffect, useCallback, useMemo } from 'react';
import { getHolidays } from '../../utils/holidays';

interface DemandCalendarProps {
    dateRange: { start: string; end: string };
    value: Record<string, number>;
    onChange: (value: Record<string, number>) => void;
}

export default function DemandCalendar({ dateRange, value, onChange }: DemandCalendarProps) {

    // Memoizowana lista dat i świąt
    const { dates, holidays, stats } = useMemo(() => {
        const sortedDates = Object.keys(value).sort();

        if (sortedDates.length === 0) {
            return { dates: [], holidays: new Set<string>(), stats: { total: 0, average: 0, weekdays: 0, weekends: 0 } };
        }

        const start = new Date(sortedDates[0]);
        const year = start.getFullYear();
        const month = start.getMonth() + 1;
        const holidayList = getHolidays(year, month);
        const holidayDates = new Set(holidayList.map(h => h.date));

        // Oblicz statystyki
        let total = 0;
        let weekdayCount = 0;
        let weekendCount = 0;

        sortedDates.forEach(date => {
            const dateObj = new Date(date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            total += value[date] || 0;
            if (isWeekend) weekendCount++;
            else weekdayCount++;
        });

        return {
            dates: sortedDates,
            holidays: holidayDates,
            stats: {
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
        const newDemand: Record<string, number> = {};
        const year = start.getFullYear();
        const month = start.getMonth() + 1;
        const holidayList = getHolidays(year, month);
        const holidayDates = new Set(holidayList.map(h => h.date));

        let current = new Date(start);
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            const isWeekend = current.getDay() === 0 || current.getDay() === 6;
            const isHoliday = holidayDates.has(dateStr);

            // Domyślnie: 2 w dni robocze, 1 w weekendy/święta
            newDemand[dateStr] = value[dateStr] ?? (isWeekend || isHoliday ? 2 : 3);

            current.setDate(current.getDate() + 1);
        }

        onChange(newDemand);
    }, [dateRange.start, dateRange.end]); // Usunięto 'value' i 'onChange' z zależności, aby uniknąć pętli

    // Optymalizowana funkcja aktualizacji
    const updateDemand = useCallback((date: string, val: number) => {
        onChange({ ...value, [date]: Math.max(0, Math.min(10, val)) });
    }, [value, onChange]);

    // Bulk operations
    const fillWeekdays = useCallback((val: number) => {
        const updated = { ...value };
        dates.forEach(date => {
            const dateObj = new Date(date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            if (!isWeekend) updated[date] = val;
        });
        onChange(updated);
    }, [dates, value, onChange]);

    const fillWeekends = useCallback((val: number) => {
        const updated = { ...value };
        dates.forEach(date => {
            const dateObj = new Date(date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            if (isWeekend) updated[date] = val;
        });
        onChange(updated);
    }, [dates, value, onChange]);

    const fillAll = useCallback((val: number) => {
        const updated = { ...value };
        dates.forEach(date => {
            updated[date] = val;
        });
        onChange(updated);
    }, [dates, value, onChange]);

    // Kopiowanie wzorca pierwszego tygodnia
    const copyFirstWeekPattern = useCallback(() => {
        if (dates.length < 7) return;

        const updated = { ...value };
        const firstWeek = dates.slice(0, 7);
        const pattern = firstWeek.map(date => value[date] || 0);

        for (let i = 7; i < dates.length; i++) {
            const patternIndex = i % 7;
            updated[dates[i]] = pattern[patternIndex];
        }
        onChange(updated);
    }, [dates, value, onChange]);

    // Obsługa klawiatury
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, date: string, index: number) => {
        const currentValue = value[date] || 0;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateDemand(date, currentValue + 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateDemand(date, currentValue - 1);
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            document.getElementById(`demand-input-${index - 1}`)?.focus();
        } else if (e.key === 'ArrowRight' && index < dates.length - 1) {
            e.preventDefault();
            document.getElementById(`demand-input-${index + 1}`)?.focus();
        }
    }, [value, updateDemand, dates.length]);

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
                        <span className="font-semibold text-gray-900 dark:text-white">{stats.total} osób</span>
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
                        onClick={() => fillWeekdays(3)}
                        className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                        Dni robocze → 3
                    </button>
                    <button
                        onClick={() => fillWeekends(2)}
                        className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        Weekendy → 2
                    </button>
                    <button
                        onClick={() => fillWeekends(0)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Weekendy → 0
                    </button>
                    <button
                        onClick={() => fillAll(0)}
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
                    const currentValue = value[date] || 0;
                    const hasWarning = currentValue === 0;

                    return (
                        <div
                            key={date}
                            className={`p-3 rounded-lg border transition-all ${isWeekend || isHoliday
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-gray-600'
                                } ${hasWarning ? 'ring-2 ring-yellow-400 dark:ring-yellow-600' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {dayName} {dayNum} {monthName}
                                </div>
                                {isHoliday && (
                                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                                        święto
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => updateDemand(date, currentValue - 1)}
                                    className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-gray-700 dark:text-gray-200 font-bold"
                                    aria-label="Zmniejsz"
                                >
                                    -
                                </button>
                                <input
                                    id={`demand-input-${index}`}
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={currentValue}
                                    onChange={(e) => updateDemand(date, parseInt(e.target.value) || 0)}
                                    onKeyDown={(e) => handleKeyDown(e, date, index)}
                                    className="flex-1 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    aria-label={`Zapotrzebowanie na ${dayName} ${dayNum} ${monthName}`}
                                />
                                <button
                                    onClick={() => updateDemand(date, currentValue + 1)}
                                    className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-gray-700 dark:text-gray-200 font-bold"
                                    aria-label="Zwiększ"
                                >
                                    +
                                </button>
                            </div>

                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                {currentValue === 1 ? '1 osoba' : `${currentValue} osób`}
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
