import { useMemo } from 'react';

interface DateRangePickerProps {
    value: { start: string; end: string };
    onChange: (value: { start: string; end: string }) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {

    // Obliczanie liczby dni (z zabezpieczeniem przed błędami)
    const daysCount = useMemo(() => {
        if (!value.start || !value.end) return 0;
        const start = new Date(value.start);
        const end = new Date(value.end);
        const diff = end.getTime() - start.getTime();
        if (diff < 0) return 0;
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    }, [value.start, value.end]);

    // Funkcja pomocnicza do szybkich wyborów
    const setPreset = (days: number, nextPeriod = false) => {
        const start = new Date();
        if (nextPeriod) {
            // Np. jeśli dzisiaj jest wtorek, zacznij od przyszłego poniedziałku
            // (Tutaj prosta logika: zacznij od jutra)
            start.setDate(start.getDate() + 1);
        }

        const end = new Date(start);
        end.setDate(start.getDate() + days - 1); // -1 bo wliczamy dzień startowy

        onChange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    };

    const setNextMonth = () => {
        const now = new Date();
        // Ustaw na 1 dzień następnego miesiąca
        const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        // Ustaw na ostatni dzień następnego miesiąca
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

        onChange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data początkowa
                    </label>
                    <input
                        type="date"
                        value={value.start}
                        onChange={(e) => onChange({ ...value, start: e.target.value })}
                        max={value.end} // Nie pozwól wybrać daty późniejszej niż koniec
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-sm"
                    />
                </div>

                <div className="hidden sm:flex pb-3 text-gray-400 dark:text-gray-500">
                    →
                </div>

                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data końcowa
                    </label>
                    <input
                        type="date"
                        value={value.end}
                        min={value.start} // Nie pozwól wybrać daty wcześniejszej niż start
                        onChange={(e) => onChange({ ...value, end: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-sm"
                    />
                </div>

                {daysCount > 0 && (
                    <div className="pb-2 min-w-[80px]">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${daysCount > 31
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            }`}>
                            📅 {daysCount} {daysCount === 1 ? 'dzień' : 'dni'}
                        </span>
                    </div>
                )}
            </div>

            {/* Szybkie wybory (Presets) */}
            <div className="flex flex-wrap gap-2 text-xs">
                <span className="py-1 text-gray-500 dark:text-gray-400 mr-1">Szybki wybór:</span>
                <button
                    onClick={() => setPreset(7)}
                    className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
                >
                    7 dni
                </button>
                <button
                    onClick={() => setPreset(14)}
                    className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
                >
                    14 dni
                </button>
                <button
                    onClick={() => setPreset(30)}
                    className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
                >
                    30 dni
                </button>
                <button
                    onClick={setNextMonth}
                    className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded text-purple-700 dark:text-purple-300 transition-colors border border-purple-200 dark:border-purple-800/50"
                >
                    Następny miesiąc
                </button>
            </div>
        </div>
    );
}
