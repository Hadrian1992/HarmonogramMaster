import { addDays, format, startOfWeek } from 'date-fns';
import type { Schedule } from '../types';

export interface EmployeeAtHour {
    id: string;
    name: string;
    shiftType: string;
}

export interface HourCoverage {
    hour: number; // 0-23
    employees: EmployeeAtHour[];
    hasGap: boolean; // true if too few people
    requiredCount: number;
}

export interface DayCoverage {
    date: string;
    dayName: string;
    hours: HourCoverage[];
}

/**
 * Get required staff count for a given hour
 */
function getRequiredCount(hour: number): number {
    // Day shift (8-20): need at least 2 people
    if (hour >= 8 && hour < 20) {
        return 2;
    }
    // Night shift (20-8): need at least 1 person
    if (hour >= 20 || hour < 8) {
        return 1;
    }
    return 0;
}

/**
 * Find all employees working at a specific hour on a specific date
 */
function findEmployeesWorkingAt(
    schedule: Schedule,
    date: string,
    hour: number
): EmployeeAtHour[] {
    return schedule.employees
        .filter(emp => {
            const shift = emp.shifts[date];
            if (!shift || shift.type === 'W' || !shift.startHour || !shift.endHour) {
                return false;
            }

            // Check if hour is within shift range
            if (shift.startHour <= shift.endHour) {
                // Regular shift (e.g., 8-16)
                return hour >= shift.startHour && hour < shift.endHour;
            } else {
                // Night shift crossing midnight (e.g., 20-8)
                return hour >= shift.startHour || hour < shift.endHour;
            }
        })
        .map(emp => ({
            id: emp.id,
            name: emp.name,
            shiftType: emp.shifts[date].type
        }));
}

/**
 * Calculate coverage for each hour of each day in a week
 */
export function calculateWeeklyCoverage(
    schedule: Schedule,
    weekStartDate: Date
): DayCoverage[] {
    const days: DayCoverage[] = [];

    for (let i = 0; i < 7; i++) {
        const date = addDays(weekStartDate, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayName = format(date, 'EEE');

        const hours: HourCoverage[] = [];

        // Check coverage from 8am to 10pm (main working hours)
        for (let hour = 8; hour <= 22; hour++) {
            const employees = findEmployeesWorkingAt(schedule, dateStr, hour);
            const requiredCount = getRequiredCount(hour);

            hours.push({
                hour,
                employees,
                hasGap: employees.length < requiredCount,
                requiredCount
            });
        }

        days.push({
            date: dateStr,
            dayName,
            hours
        });
    }

    return days;
}

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
    return startOfWeek(date, { weekStartsOn: 1 }); // 1 = Monday
}
