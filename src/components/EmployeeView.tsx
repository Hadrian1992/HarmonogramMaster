import React, { useState, useMemo } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { exportEmployeePDF } from '../utils/employeePdfExport';
import { format, getDaysInMonth, setDate } from 'date-fns';
import { Download, User as UserIcon, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { GlassCard } from './ui/GlassCard';
import { PageHeader } from './ui/PageHeader';
import { GlassButton } from './ui/GlassButton';

export const EmployeeView: React.FC = () => {
    const { schedule, updateEmployeePreferences } = useScheduleStore();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(
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
        const workHours = monthShifts.reduce((sum, s) => {
            if (
                s.type === 'WORK' ||
                ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)
            ) {
                return sum + s.hours;
            }
            return sum;
        }, 0);
        const autoContactHours = monthShifts.reduce(
            (acc, s) => acc + (s.contactHours || (s.type === 'K' ? s.hours : 0)),
            0
        );
        const manualContactHours =
            employee?.monthlyContactHours?.[
            `${schedule.year}-${String(schedule.month).padStart(2, '0')}`
            ] || 0;
        const contactHours = autoContactHours + manualContactHours;
        const totalHours = workHours + contactHours;
        return { workDays, vacDays, sickDays, workHours, contactHours, totalHours };
    }, [monthShifts, employee, schedule.year, schedule.month]);

    if (!employee) {
        return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Brak pracowników</div>;
    }

    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));
    const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];

    return (
        <div className="p-4 md:p-6 max-w-[100vw] overflow-x-hidden min-h-screen">
            <PageHeader
                title="Widok Pracownika"
                description="Osobisty kalendarz i statystyki"
            />

            <GlassCard className="max-w-5xl mx-auto">
                {/* Controls */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8 bg-gray-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="w-full md:w-auto">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                            Wybierz pracownika
                        </label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <select
                                value={selectedEmployeeId}
                                onChange={e => setSelectedEmployeeId(e.target.value)}
                                className="w-full md:w-72 pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                            >
                                {schedule.employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <GlassButton
                        onClick={() => exportEmployeePDF(employee, schedule.month, schedule.year)}
                        icon={Download}
                        variant="primary"
                    >
                        Eksportuj PDF
                    </GlassButton>
                </div>

                {/* AI Preferences */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Preferencje dla AI Doradcy
                        </label>
                        <span className="text-xs text-gray-400">
                            Automatycznie zapisywane
                        </span>
                    </div>
                    <textarea
                        value={employee.preferences || ''}
                        onChange={e => updateEmployeePreferences(employee.id, e.target.value)}
                        placeholder="Wpisz preferencje pracownika (np. 'Woli zmiany poranne', 'Studiuje w weekendy')..."
                        className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none min-h-[80px] text-sm bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all resize-y"
                    />
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30">
                        <div className="text-xs font-medium text-blue-600 dark:text-blue-300 mb-1">Dni robocze</div>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.workDays}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-100 dark:border-amber-800/30">
                        <div className="text-xs font-medium text-amber-600 dark:text-amber-300 mb-1">Urlop (UW)</div>
                        <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.vacDays}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-100 dark:border-red-800/30">
                        <div className="text-xs font-medium text-red-600 dark:text-red-300 mb-1">Choroba (L4)</div>
                        <div className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.sickDays}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border border-purple-100 dark:border-purple-800/30">
                        <div className="text-xs font-medium text-purple-600 dark:text-purple-300 mb-1">Godziny kontaktów</div>
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.contactHours}h</div>
                    </div>
                    <div className="col-span-2 md:col-span-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Suma godzin:</span>
                            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">{stats.totalHours}h</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-gray-100 dark:border-slate-600 shadow-sm">
                            {stats.workHours}h praca + {stats.contactHours}h kontakty
                        </span>
                    </div>
                </div>

                {/* Calendar */}
                <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Calendar size={20} />
                        </div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">
                            {monthNames[schedule.month - 1]} {schedule.year}
                        </div>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-2 text-center mb-2">
                        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(day => (
                            <div key={day} className="text-xs font-bold text-gray-400 uppercase tracking-wider">{day}</div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const date = setDate(new Date(schedule.year, schedule.month - 1, 1), day);
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const shift = employee.shifts[dateStr];
                            const dayOfWeek = date.getDay();
                            const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

                            return (
                                <div key={dateStr} className={clsx(
                                    "rounded-xl p-2 min-h-[80px] flex flex-col items-center justify-between border transition-all duration-200 hover:shadow-md",
                                    isWeekendDay
                                        ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                                        : "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700"
                                )}>
                                    <span className={clsx(
                                        "text-sm font-semibold",
                                        isWeekendDay ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
                                    )}>
                                        {day}
                                    </span>
                                    {shift && (
                                        <div className={clsx(
                                            "w-full text-center py-1 rounded text-xs font-medium mt-1",
                                            shift.type === 'WORK' ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" :
                                                shift.type === 'L4' ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                                                    shift.type === 'UW' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                        "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300"
                                        )}>
                                            {shift.type === 'WORK' && shift.startHour !== undefined && shift.endHour !== undefined
                                                ? `${shift.startHour}-${shift.endHour}`
                                                : shift.type}
                                            {shift.hours > 0 && <div className="text-[10px] opacity-75">{shift.hours}h</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
