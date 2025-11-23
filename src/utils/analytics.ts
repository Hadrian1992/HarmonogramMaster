import type { Schedule, Employee } from '../types';

export interface EmployeeStats {
    employee: Employee;
    totalHours: number;
    workShifts: number;
    nightShifts: number;
    contactHours: number;
    dayOffCount: number;
    vacationDays: number;
    consecutiveNightShifts: number;
    uzDaysUsed: number;
    uzDaysAvailable: number;
    uswHoursUsed: number;
    uswHoursAvailable: number;
}

export interface Alert {
    type: 'warning' | 'error' | 'info';
    employeeName: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
}

export interface Suggestion {
    employeeName: string;
    message: string;
    type: 'vacation' | 'hours' | 'shift';
}

export const analyzeSchedule = (schedule: Schedule): {
    employeeStats: EmployeeStats[];
    alerts: Alert[];
    suggestions: Suggestion[];
} => {
    const employeeStats: EmployeeStats[] = [];
    const alerts: Alert[] = [];
    const suggestions: Suggestion[] = [];

    // Calculate stats for each employee
    schedule.employees.forEach(emp => {
        const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;

        // FILTER: Only shifts from current month
        const monthShifts = Object.values(emp.shifts).filter(s => s.date.startsWith(monthKey));

        // Total hours (work + paid leave) - ONLY CURRENT MONTH
        const totalHours = monthShifts.reduce((acc, s) => {
            if (s.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)) {
                return acc + s.hours;
            }
            return acc;
        }, 0);

        // Manual contact hours
        const manualContactHours = emp.monthlyContactHours?.[monthKey] || 0;
        const autoContactHours = monthShifts.reduce((acc, s) =>
            acc + (s.contactHours || (s.type === 'K' ? s.hours : 0)), 0
        );
        const contactHours = autoContactHours + manualContactHours;

        // Work shifts count - ONLY CURRENT MONTH
        const workShifts = monthShifts.filter(s => s.type === 'WORK').length;

        // Night shifts (20-8) - ONLY CURRENT MONTH
        const nightShifts = monthShifts.filter(s =>
            s.type === 'WORK' && s.startHour === 20 && s.endHour === 8
        ).length;

        // Day off count - ONLY CURRENT MONTH
        const dayOffCount = monthShifts.filter(s => s.type === 'W').length;

        // Vacation days - ONLY CURRENT MONTH
        const vacationDays = monthShifts.filter(s =>
            ['UW', 'UŻ', 'UM'].includes(s.type)
        ).length;

        // Consecutive night shifts - ONLY CURRENT MONTH
        let maxConsecutiveNights = 0;
        let currentConsecutive = 0;
        const sortedDates = monthShifts
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(s => s.date);

        sortedDates.forEach(date => {
            const shift = emp.shifts[date];
            if (shift && shift.type === 'WORK' && shift.startHour === 20 && shift.endHour === 8) {
                currentConsecutive++;
                maxConsecutiveNights = Math.max(maxConsecutiveNights, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        });

        // Yearly UŻ and USW usage (WHOLE YEAR - this is correct)
        const uzDaysUsed = Object.values(emp.shifts).filter(s =>
            s.type === 'UŻ' && s.date.startsWith(schedule.year.toString())
        ).length;
        const uzDaysAvailable = 4 - uzDaysUsed;

        const uswHoursUsed = Object.values(emp.shifts).reduce((acc, s) =>
            (s.type === 'USW' && s.date.startsWith(schedule.year.toString())) ? acc + s.hours : acc
            , 0);
        const uswHoursAvailable = 16 - uswHoursUsed;

        employeeStats.push({
            employee: emp,
            totalHours: totalHours + manualContactHours,
            workShifts,
            nightShifts,
            contactHours,
            dayOffCount,
            vacationDays,
            consecutiveNightShifts: maxConsecutiveNights,
            uzDaysUsed,
            uzDaysAvailable,
            uswHoursUsed,
            uswHoursAvailable
        });
    });

    // Generate alerts
    employeeStats.forEach(stat => {
        // Alert: Uneven workload (>30h difference from average)
        const avgHours = employeeStats.reduce((sum, s) => sum + s.totalHours, 0) / employeeStats.length;
        if (Math.abs(stat.totalHours - avgHours) > 30) {
            alerts.push({
                type: stat.totalHours > avgHours ? 'warning' : 'info',
                employeeName: stat.employee.name,
                message: stat.totalHours > avgHours
                    ? `Przekroczenie średniego obciążenia o ${Math.round(stat.totalHours - avgHours)}h`
                    : `Niedociążenie o ${Math.round(avgHours - stat.totalHours)}h`,
                severity: Math.abs(stat.totalHours - avgHours) > 50 ? 'high' : 'medium'
            });
        }

        // Alert: Too many consecutive night shifts
        if (stat.consecutiveNightShifts > 3) {
            alerts.push({
                type: 'warning',
                employeeName: stat.employee.name,
                message: `${stat.consecutiveNightShifts} zmian nocnych z rzędu (max zalecane: 3)`,
                severity: 'high'
            });
        }

        // Alert: UŻ limit exceeded
        if (stat.uzDaysUsed > 4) {
            alerts.push({
                type: 'error',
                employeeName: stat.employee.name,
                message: `Przekroczenie limitu UŻ: ${stat.uzDaysUsed}/4 dni`,
                severity: 'high'
            });
        }

        // Alert: USW limit exceeded
        if (stat.uswHoursUsed > 16) {
            alerts.push({
                type: 'error',
                employeeName: stat.employee.name,
                message: `Przekroczenie limitu USW: ${stat.uswHoursUsed}/16h`,
                severity: 'high'
            });
        }

        // Alert: Excessive hours (>200h)
        if (stat.totalHours > 200) {
            alerts.push({
                type: 'warning',
                employeeName: stat.employee.name,
                message: `Przekroczono 200h w miesiącu (${stat.totalHours}h)`,
                severity: 'medium'
            });
        }

        // Alert: Too few hours (< 140h for full-time)
        if (stat.totalHours < 140) {
            alerts.push({
                type: 'info',
                employeeName: stat.employee.name,
                message: `Tylko ${stat.totalHours}h w miesiącu (zalecane ~160h)`,
                severity: 'low'
            });
        }
    });

    // Check for 35h rest violations
    employeeStats.forEach(stat => {
        const shifts = Object.values(stat.employee.shifts);
        const sortedShifts = shifts.sort((a, b) => a.date.localeCompare(b.date));

        for (let i = 0; i < sortedShifts.length - 1; i++) {
            const current = sortedShifts[i];
            const next = sortedShifts[i + 1];

            // Check if both are working shifts (have start/end hours)
            if (current.endHour !== undefined && next.startHour !== undefined && current.startHour !== undefined) {

                const currentDate = new Date(current.date);
                const nextDate = new Date(next.date);
                const daysDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

                // If shifts are on consecutive days
                if (daysDiff === 1) {
                    const currentIsNight = current.startHour > current.endHour;
                    let restHours = 0;

                    if (currentIsNight) {
                        // Previous shift ended next day morning (on 'next.date')
                        // Gap is simply start - end
                        restHours = next.startHour - current.endHour;
                    } else {
                        // Previous shift ended same day (on 'current.date')
                        // Gap is time until midnight + time from midnight
                        restHours = (24 - current.endHour) + next.startHour;
                    }

                    if (restHours < 11) {
                        alerts.push({
                            type: 'error',
                            employeeName: stat.employee.name,
                            message: `Brak 11h odpoczynku między ${current.date} a ${next.date} (tylko ${restHours}h)`,
                            severity: 'high'
                        });
                    }
                }
            }
        }
    });

    // Check for 35h weekly rest violations (simplified: check for 2 consecutive days off)
    employeeStats.forEach(stat => {
        const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
        const monthShifts = Object.values(stat.employee.shifts)
            .filter(s => s.date.startsWith(monthKey))
            .sort((a, b) => a.date.localeCompare(b.date));

        if (monthShifts.length === 0) return;

        // Get all dates in the month
        const year = schedule.year;
        const month = schedule.month;
        const daysInMonth = new Date(year, month, 0).getDate();
        const allDates: string[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            allDates.push(date);
        }

        // Create map of work days (days with WORK shifts)
        const workDaysSet = new Set(
            monthShifts.filter(s => s.type === 'WORK').map(s => s.date)
        );

        // Check each 7-day sliding window for at least 2 consecutive days off
        for (let i = 0; i <= allDates.length - 7; i++) {
            const windowDates = allDates.slice(i, i + 7);
            const workDaysInWindow = windowDates.filter(d => workDaysSet.has(d));

            // If 6 or 7 work days in this week, check for consecutive days off
            if (workDaysInWindow.length >= 6) {
                // Check if there are at least 2 consecutive days off
                let hasConsecutiveDaysOff = false;

                for (let j = 0; j < windowDates.length - 1; j++) {
                    const day1 = windowDates[j];
                    const day2 = windowDates[j + 1];

                    if (!workDaysSet.has(day1) && !workDaysSet.has(day2)) {
                        hasConsecutiveDaysOff = true;
                        break;
                    }
                }

                if (!hasConsecutiveDaysOff) {
                    alerts.push({
                        type: 'error',
                        employeeName: stat.employee.name,
                        message: `Brak 2 kolejnych dni wolnych w tygodniu ${windowDates[0]} do ${windowDates[6]} (${workDaysInWindow.length} dni pracy z 7)`,
                        severity: 'high'
                    });
                    break; // Only report first violation to avoid spam
                }
            }
        }
    });

    // Generate suggestions
    employeeStats.forEach(stat => {
        // Suggestion: Available UŻ days
        if (stat.uzDaysAvailable > 0) {
            suggestions.push({
                employeeName: stat.employee.name,
                message: `Może jeszcze wziąć ${stat.uzDaysAvailable} dni UŻ w ${schedule.year}r.`,
                type: 'vacation'
            });
        }

        // Suggestion: Available USW hours
        if (stat.uswHoursAvailable > 0 && stat.uswHoursAvailable >= 8) {
            suggestions.push({
                employeeName: stat.employee.name,
                message: `Dostępne ${stat.uswHoursAvailable}h USW w ${schedule.year}r.`,
                type: 'vacation'
            });
        }

        // Suggestion: Missing hours
        const expectedHours = 160;
        if (stat.totalHours < expectedHours - 10) {
            const missing = expectedHours - stat.totalHours;
            suggestions.push({
                employeeName: stat.employee.name,
                message: `Brakuje ~${Math.round(missing)}h do pełnego etatu`,
                type: 'hours'
            });
        }
    });

    return {
        employeeStats: employeeStats.sort((a, b) => b.totalHours - a.totalHours),
        alerts,
        suggestions
    };
};
