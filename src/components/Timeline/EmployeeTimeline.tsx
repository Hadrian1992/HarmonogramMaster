import React from 'react';
import clsx from 'clsx';
import type { Employee, Shift } from '../../types';

interface EmployeeTimelineProps {
    employee: Employee;
    shift: Shift;
}

/**
 * Premium horizontal timeline bar for employee shift
 * Shows name + shift hours with color coding
 * Properly handles night shifts that cross midnight
 */
export const EmployeeTimeline: React.FC<EmployeeTimelineProps> = ({ employee, shift }) => {
    const start = shift.startHour || 0;
    const end = shift.endHour || 0;

    // Get shift color
    const getShiftColor = () => {
        if (shift.type === 'WORK') {
            if (start >= 20 || end <= 8) {
                return 'from-purple-500 to-indigo-600'; // Night shift
            }
            return 'from-blue-500 to-cyan-600'; // Day shift
        }
        if (shift.type === 'K') return 'from-teal-500 to-emerald-600';
        if (['L4', 'UW', 'UZ'].includes(shift.type)) return 'from-yellow-500 to-orange-600';
        return 'from-gray-400 to-gray-500';
    };

    const shiftText = start < end
        ? `${start}:00 - ${end}:00`
        : `${start}:00 - ${end}:00 (nocka)`;

    const hours = shift.hours || (start < end ? end - start : 24 - start + end);

    // For night shifts that cross midnight, we need to render two bars
    const isNightShift = start > end;

    return (
        <div className="group">
            <div className="flex items-center gap-4">
                {/* Employee Name */}
                <div className="w-48 flex-shrink-0">
                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {employee.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {shiftText} • {hours}h
                    </div>
                </div>

                {/* Timeline Container */}
                <div className="flex-1 relative h-12 bg-gray-100 dark:bg-slate-900/50 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                    {/* Hour markers (every 4 hours) */}
                    {[0, 4, 8, 12, 16, 20].map(hour => (
                        <div
                            key={hour}
                            className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-slate-700"
                            style={{ left: `${(hour / 24) * 100}%` }}
                        />
                    ))}

                    {/* Shift Bar(s) */}
                    {isNightShift ? (
                        <>
                            {/* First part: start to midnight */}
                            <div
                                className={clsx(
                                    'absolute top-1 bottom-1 rounded-md shadow-lg',
                                    'bg-gradient-to-r transition-all duration-300',
                                    'group-hover:shadow-xl group-hover:scale-105',
                                    'flex items-center justify-center',
                                    getShiftColor()
                                )}
                                style={{
                                    left: `${(start / 24) * 100}%`,
                                    width: `${((24 - start) / 24) * 100}%`
                                }}
                            >
                                <span className="text-white font-bold text-sm px-2 truncate">
                                    {shift.type === 'WORK' ? `${start}-24` : shift.type}
                                </span>
                            </div>

                            {/* Second part: midnight to end */}
                            <div
                                className={clsx(
                                    'absolute top-1 bottom-1 rounded-md shadow-lg',
                                    'bg-gradient-to-r transition-all duration-300',
                                    'group-hover:shadow-xl group-hover:scale-105',
                                    'flex items-center justify-center',
                                    getShiftColor()
                                )}
                                style={{
                                    left: '0%',
                                    width: `${(end / 24) * 100}%`
                                }}
                            >
                                <span className="text-white font-bold text-sm px-2 truncate">
                                    {shift.type === 'WORK' ? `0-${end}` : shift.type}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div
                            className={clsx(
                                'absolute top-1 bottom-1 rounded-md shadow-lg',
                                'bg-gradient-to-r transition-all duration-300',
                                'group-hover:shadow-xl group-hover:scale-105',
                                'flex items-center justify-center',
                                getShiftColor()
                            )}
                            style={{
                                left: `${(start / 24) * 100}%`,
                                width: `${((end - start) / 24) * 100}%`
                            }}
                        >
                            <span className="text-white font-bold text-sm px-2 truncate">
                                {shift.type === 'WORK' ? `${start}-${end}` : shift.type}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
