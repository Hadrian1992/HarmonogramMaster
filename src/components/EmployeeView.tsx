import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { exportEmployeePDF } from '../utils/employeePdfExport';
import { format, getDaysInMonth, setDate } from 'date-fns';
import { Download, User as UserIcon, Calendar } from 'lucide-react';
import clsx from 'clsx';

export const EmployeeView: React.FC = () => {
    const { schedule, updateEmployeePreferences } = useScheduleStore();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
        schedule.employees[0]?.id || ''
    );

    const employee = schedule.employees.find(e => e.id === selectedEmployeeId);

    // Filter shifts for the current month
    const monthShifts = useMemo(() => {
        if (!employee) return [];

        const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
        return Object.values(employee.shifts)
            .filter(s => s.date.startsWith(monthKey))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [employee, schedule.year, schedule.month]);

    // Calculate statistics
    const stats = useMemo(() => {
        const workDays = monthShifts.filter(s => s.type === 'WORK').length;
        const vacDays = monthShifts.filter(s => s.type === 'UW').length;
        const sickDays = monthShifts.filter(s => s.type === 'L4').length;

        // Calculate work hours (excluding contact hours type K)
        const workHours = monthShifts.reduce((sum, s) => {
            if (s.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)) {
                return sum + s.hours;
            }
            return sum;
        }, 0);

        // Calculate contact hours separately
        const autoContactHours = monthShifts.reduce((acc, s) =>
            acc + (s.contactHours || (s.type === 'K' ? s.hours : 0)), 0
        );
        const manualContactHours = employee?.monthlyContactHours?.[
            `${schedule.year}-${String(schedule.month).padStart(2, '0')}`
        ] || 0;
        const contactHours = autoContactHours + manualContactHours;

        const totalHours = workHours + contactHours;

        return { workDays, vacDays, sickDays, workHours, contactHours, totalHours };
    }, [monthShifts, employee, schedule.year, schedule.month]);

    if (!employee) {
        return <div className="text-center py-8">Brak pracowników</div>;
    }

    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));
    const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <UserIcon size={32} className="text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Widok Pracownika</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Osobisty kalendarz i statystyki</p>
                        </div>
                    </div>

                    <button
                        onClick={() => exportEmployeePDF(employee, schedule.month, schedule.year)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Download size={18} />
                        Eksportuj PDF
                    </button>
                </div>

                {/* Employee selector */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Wybierz pracownika:
                    </label>
                    <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full md:w-96 px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        {schedule.employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* AI Preferences */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <UserIcon size={20} className="text-purple-600" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preferencje dla AI Doradcy</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Dodaj notatki, które asystent AI ma brać pod uwagę (np. "Woli zmiany poranne", "Studiuje w weekendy").
                </p>
                <textarea
                    value={employee.preferences || ''}
                    onChange={(e) => updateEmployeePreferences(employee.id, e.target.value)}
                    placeholder="Wpisz preferencje pracownika..."
                    className="w-full p-3 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none min-h-[80px] text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Dni robocze</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.workDays}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Urlop (UW)</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.vacDays}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Choroba (L4)</div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.sickDays}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Godziny kontaktów</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.contactHours}h</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Suma godzin</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalHours}h</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        ({stats.workHours}h praca + {stats.contactHours}h kontakty)
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar size={20} className="text-gray-700 dark:text-gray-300" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {monthNames[schedule.month - 1]} {schedule.year}
                    </h3>
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                    {/* Day headers */}
                    {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-gray-600 dark:text-gray-400 py-2">
                            {day}
                        </div>
                    ))}

                    {/* Calendar days */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const date = setDate(new Date(schedule.year, schedule.month - 1, 1), day);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const shift = employee.shifts[dateStr];
                        const dayOfWeek = date.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                        return (
                            <div
                                key={day}
                                className={clsx(
                                    "border dark:border-gray-600 rounded p-2 min-h-[80px]",
                                    isWeekend && "bg-gray-50 dark:bg-gray-700",
                                    shift?.type === 'WORK' && "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700",
                                    shift?.type === 'UW' && "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700",
                                    shift?.type === 'L4' && "bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700",
                                    !shift && "bg-white dark:bg-gray-800"
                                )}
                            >
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{day}</div>
                                {shift && (
                                    <div className="text-xs">
                                        {shift.type === 'WORK' && shift.startHour !== undefined && shift.endHour !== undefined ? (
                                            <div className="font-medium text-blue-700 dark:text-blue-300">
                                                {shift.startHour}:00-{shift.endHour}:00
                                            </div>
                                        ) : (
                                            <div className={clsx(
                                                "font-medium",
                                                shift.type === 'UW' && "text-green-700 dark:text-green-300",
                                                shift.type === 'L4' && "text-orange-700 dark:text-orange-300"
                                            )}>
                                                {shift.type}
                                            </div>
                                        )}
                                        <div className="text-gray-600 dark:text-gray-400 mt-1">{shift.hours}h</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
