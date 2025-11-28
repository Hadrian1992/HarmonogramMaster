import React, { useState } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { getDaysInMonth, format, setDate, isWeekend } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { ShiftType } from '../types';
import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Mobile-optimized view of schedule grid
 * Card-based layout with horizontal scroll for days
 */
export const ScheduleGridMobile: React.FC = () => {
    const { schedule, updateShift } = useScheduleStore();
    const [editingCell, setEditingCell] = useState<{ empId: string, date: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        return setDate(new Date(schedule.year, schedule.month - 1), i + 1);
    });

    const handleCellClick = (empId: string, date: string, currentVal: string) => {
        setEditingCell({ empId, date });
        setEditValue(currentVal);
    };

    const handleSave = () => {
        if (!editingCell) return;

        const value = editValue.toUpperCase().trim();
        let type: ShiftType = 'WORK';
        let start: number | undefined;
        let end: number | undefined;

        // Simple parsing (same logic as desktop)
        if (value === '' || value === 'W' || value === '/') {
            type = 'W';
        } else if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(value)) {
            type = value as ShiftType;
        } else if (/^\d+-\d+$/.test(value)) {
            const parts = value.split('-');
            start = parseInt(parts[0]);
            end = parseInt(parts[1]);
            type = 'WORK';
        }

        updateShift(editingCell.empId, editingCell.date, type, start, end);
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    // Calculate monthly hours for employee
    const getMonthlyHours = (emp: typeof schedule.employees[0]) => {
        let total = 0;
        Object.values(emp.shifts).forEach(shift => {
            if (shift.date.startsWith(`${schedule.year}-${String(schedule.month).padStart(2, '0')}`)) {
                total += shift.hours || 0;
            }
        });
        return total;
    };

    return (
        <div className="space-y-4 p-4">
            {/* Header Info */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {format(new Date(schedule.year, schedule.month - 1), 'LLLL yyyy', { locale: pl })}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {schedule.employees.length} pracowników
                </p>
            </div>

            {/* Employee Cards */}
            {schedule.employees
                .filter(emp => emp.name.toLowerCase().includes(''))
                .map(emp => {
                    const monthlyHours = getMonthlyHours(emp);
                    const isExpanded = expandedEmployee === emp.id;

                    return (
                        <div
                            key={emp.id}
                            className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden"
                        >
                            {/* Employee Header */}
                            <div
                                className="p-4 border-b border-gray-200 dark:border-slate-700 cursor-pointer active:bg-gray-50 dark:active:bg-slate-700"
                                onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {emp.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {monthlyHours}h / 160h
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            'text-xs px-2 py-1 rounded',
                                            monthlyHours > 160 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                monthlyHours > 140 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        )}>
                                            {monthlyHours > 160 ? 'Przekroczenie' : monthlyHours > 140 ? 'Blisko limitu' : 'OK'}
                                        </span>
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>
                            </div>

                            {/* Days Scroll (Expanded) */}
                            {isExpanded && (
                                <div className="p-4 relative">
                                    {/* Scroll indicator - subtle fade on right */}
                                    <div className="absolute right-4 top-4 bottom-20 w-8 bg-gradient-to-l from-white dark:from-slate-800 to-transparent pointer-events-none z-10" />

                                    {/* Touch-friendly horizontal scroll - NO visible scrollbar */}
                                    <div
                                        className="overflow-x-auto -mx-4 px-4 pb-4 scrollbar-hide"
                                        style={{
                                            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                                            scrollbarWidth: 'none', // Firefox
                                            msOverflowStyle: 'none' // IE/Edge
                                        }}
                                    >
                                        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                                            {days.map(day => {
                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                const shift = emp.shifts[dateStr];
                                                const dayNum = day.getDate();
                                                const isEditing = editingCell?.empId === emp.id && editingCell?.date === dateStr;

                                                let display = '/';
                                                if (shift) {
                                                    if (shift.type === 'WORK') {
                                                        if (shift.startHour !== undefined && shift.endHour !== undefined) {
                                                            display = `${shift.startHour}-${shift.endHour}`;
                                                        } else {
                                                            display = `${shift.hours || 0}h`;
                                                        }
                                                    } else if (shift.type === 'K') {
                                                        if (shift.startHour !== undefined && shift.endHour !== undefined) {
                                                            display = `K ${shift.startHour}-${shift.endHour}`;
                                                        } else if (shift.contactHours) {
                                                            display = `K ${shift.contactHours}`;
                                                        } else {
                                                            display = 'K';
                                                        }
                                                    } else if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(shift.type)) {
                                                        display = shift.type;
                                                    } else if (shift.type === 'W') {
                                                        display = '/';
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={dateStr}
                                                        className={clsx(
                                                            'flex-shrink-0 w-20 text-center',
                                                            isWeekend(day) && 'bg-red-50/30 dark:bg-red-900/10 rounded'
                                                        )}
                                                    >
                                                        {/* Day Header */}
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                            {format(day, 'EEE', { locale: pl })}
                                                        </div>
                                                        <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                            {dayNum}
                                                        </div>

                                                        {/* Shift Cell */}
                                                        <div
                                                            className="min-h-[60px] rounded border border-gray-200 dark:border-slate-700 cursor-pointer active:border-blue-500 dark:active:border-blue-400 transition-colors p-1"
                                                            onClick={() => handleCellClick(emp.id, dateStr, display === '/' ? '' : display)}
                                                        >
                                                            {isEditing ? (
                                                                <input
                                                                    autoFocus
                                                                    className="w-full h-full text-center text-sm border-2 border-blue-500 rounded outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    onBlur={handleSave}
                                                                    onKeyDown={handleKeyDown}
                                                                />
                                                            ) : (
                                                                <div className="text-sm font-medium py-2">
                                                                    {display}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Employee Stats */}
                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Godziny pracy:</span>
                                            <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                                                {monthlyHours}h
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Dni robocze:</span>
                                            <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                                                {Object.values(emp.shifts).filter(s => s.type !== 'W' && s.date.startsWith(`${schedule.year}-${String(schedule.month).padStart(2, '0')}`)).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

            {/* Help Text */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-4">
                👆 Kliknij firmę aby rozwinąć • 👉 Przesuń palcem aby przewinąć dni • ✏️ Kliknij dzień aby edytować
            </div>
        </div>
    );
};
