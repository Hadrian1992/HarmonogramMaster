import React from 'react';
import type { Shift } from '../types';
import clsx from 'clsx';

interface ShiftBlockProps {
    shift: Shift | null;
    display: string;
    onClick: (e: React.MouseEvent) => void;
}

export const ShiftBlock: React.FC<ShiftBlockProps> = ({ shift, display, onClick }) => {
    if (!shift || display === '/') {
        return <span className="block w-full h-full py-1 text-xs text-gray-400 dark:text-gray-600 font-light">{display}</span>;
    }

    // Color coding based on shift type with gradients
    const getShiftStyle = (): string => {
        if (shift.type === 'WORK') {
            // Night shift detection (crosses midnight)
            if (shift.startHour !== undefined && shift.endHour !== undefined) {
                if (shift.startHour >= 20 || shift.endHour <= 8) {
                    return 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-indigo-500/30'; // Night shift
                }
            }
            return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/30'; // Regular work
        }

        // Leave types (L4, UW, UZ, etc.)
        if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(shift.type)) {
            if (shift.type === 'L4') return 'bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-orange-500/30';
            if (shift.type === 'UW') return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/30';
            return 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-purple-500/30';
        }

        // Contact hours
        if (shift.type === 'K') {
            return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-orange-500/30';
        }

        // Free day
        if (shift.type === 'W') {
            return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-600';
        }

        return 'bg-gray-400 text-white';
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation(); // Prevent cell click event
                onClick(e);
            }}
            className={clsx(
                'inline-block rounded-md px-2 py-0.5 text-xs font-medium cursor-pointer transition-all duration-200 whitespace-nowrap shadow-sm',
                'hover:scale-105 hover:shadow-md',
                getShiftStyle()
            )}
            title="Kliknij aby edytować"
        >
            {display}
        </div>
    );
};
