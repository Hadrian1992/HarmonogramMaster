import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

interface CustomDatePickerProps {
    value: string; // Format: YYYY-MM-DD
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
}

export default function CustomDatePicker({ value, onChange, placeholder = 'dd.mm.rrrr', label, className = '' }: CustomDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        if (value) {
            const date = new Date(value);
            return { year: date.getFullYear(), month: date.getMonth() };
        }
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const polishMonths = [
        'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
        'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];

    const polishDays = ['pon', 'wto', 'śro', 'czw', 'pią', 'sob', 'nie'];

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Monday=0
    };

    const handleDateClick = (day: number) => {
        const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const changeMonth = (delta: number) => {
        let newMonth = viewDate.month + delta;
        let newYear = viewDate.year;

        if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        } else if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        }

        setViewDate({ year: newYear, month: newMonth });
    };

    const changeYear = (delta: number) => {
        setViewDate({ ...viewDate, year: viewDate.year + delta });
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
        const firstDay = getFirstDayOfMonth(viewDate.year, viewDate.month);
        const days: (number | null)[] = [];

        // Add empty cells for days before the first day of month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Add actual days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        const selectedDate = value ? new Date(value) : null;
        const isSelectedDay = (day: number | null) => {
            if (!day || !selectedDate) return false;
            return selectedDate.getFullYear() === viewDate.year &&
                selectedDate.getMonth() === viewDate.month &&
                selectedDate.getDate() === day;
        };

        const today = new Date();
        const isToday = (day: number | null) => {
            if (!day) return false;
            return today.getFullYear() === viewDate.year &&
                today.getMonth() === viewDate.month &&
                today.getDate() === day;
        };

        return (
            <div className="grid grid-cols-7 gap-1">
                {polishDays.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                        {day}
                    </div>
                ))}
                {days.map((day, index) => (
                    <button
                        key={index}
                        onClick={() => day && handleDateClick(day)}
                        disabled={!day}
                        className={`
                            aspect-square rounded text-sm font-medium transition-all
                            ${!day ? 'invisible' : ''}
                            ${isSelectedDay(day)
                                ? 'bg-purple-600 text-white shadow-md'
                                : isToday(day)
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold'
                                    : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                            }
                        `}
                    >
                        {day}
                    </button>
                ))}
            </div>
        );
    };

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {label && (
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                </label>
            )}

            {/* Input Field */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-sm text-left flex items-center justify-between"
            >
                <span className={value ? '' : 'text-gray-400'}>
                    {value ? formatDisplayDate(value) : placeholder}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>

            {/* Calendar Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-72">
                    {/* Month/Year Selector */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => changeMonth(-1)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                            type="button"
                        >
                            <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => changeYear(-1)}
                                className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                                type="button"
                            >
                                <ChevronUp size={14} className="text-gray-500" />
                            </button>
                            <div className="text-center min-w-[160px]">
                                <div className="font-semibold text-gray-900 dark:text-white text-sm">
                                    {polishMonths[viewDate.month]} {viewDate.year}
                                </div>
                            </div>
                            <button
                                onClick={() => changeYear(1)}
                                className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                                type="button"
                            >
                                <ChevronDown size={14} className="text-gray-500" />
                            </button>
                        </div>

                        <button
                            onClick={() => changeMonth(1)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                            type="button"
                        >
                            <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    {renderCalendar()}

                    {/* Action Buttons */}
                    <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => {
                                const today = new Date();
                                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                onChange(todayStr);
                                setIsOpen(false);
                            }}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                            type="button"
                        >
                            Wyczyść
                        </button>
                        <button
                            onClick={() => {
                                const today = new Date();
                                setViewDate({ year: today.getFullYear(), month: today.getMonth() });
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            type="button"
                        >
                            Dzisiaj
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
