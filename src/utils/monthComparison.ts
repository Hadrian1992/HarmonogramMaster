import type { Schedule } from '../types';

export interface MonthData {
    month: number;
    year: number;
}

export interface EmployeeComparison {
    id: string;
    name: string;

    // Godziny
    month1Hours: number;
    month2Hours: number;
    difference: number;
    percentChange: number;

    // Ilość zmian
    month1Shifts: number;
    month2Shifts: number;

    // Urlopy
    month1Vacation: number;
    month2Vacation: number;

    // NOWE: Nocki
    month1NightShifts: number;
    month2NightShifts: number;

    // NOWE: Kontakty
    month1ContactHours: number;
    month2ContactHours: number;
}

export interface MonthComparisonData {
    month1: MonthData;
    month2: MonthData;
    employees: EmployeeComparison[];
    teamTotal1: number;
    teamTotal2: number;
    teamDifference: number;
    teamPercentChange: number;
}

/**
 * Zlicza godziny (Praca + Kontakty + Inne płatne)
 */
function getMonthHours(schedule: Schedule, employeeId: string, month: number, year: number): number {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const employee = schedule.employees.find(e => e.id === employeeId);
    if (!employee) return 0;

    const shiftSum = Object.values(employee.shifts)
        .filter(s => s.date.startsWith(monthKey))
        .reduce((sum, s) => {
            if (
                s.type === 'WORK' ||
                s.type === 'K' ||
                ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)
            ) {
                if (s.type === 'K') {
                    const contactHours = typeof s.contactHours === 'number'
                        ? s.contactHours
                        : typeof s.hours === 'number'
                            ? s.hours
                            : (s.startHour !== undefined && s.endHour !== undefined
                                ? s.endHour - s.startHour
                                : 0);
                    return sum + contactHours;
                }

                const shiftHours = typeof s.hours === 'number'
                    ? s.hours
                    : (s.startHour !== undefined && s.endHour !== undefined
                        ? s.endHour - s.startHour
                        : 0);
                return sum + shiftHours;
            }
            return sum;
        }, 0);

    const monthlyContact = (employee as any).monthlyContactHours?.[monthKey] ?? 0;
    return shiftSum + monthlyContact;
}

/** Liczba zmian pracujących (WORK) */
function getMonthShifts(schedule: Schedule, employeeId: string, month: number, year: number): number {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const employee = schedule.employees.find(e => e.id === employeeId);
    if (!employee) return 0;

    return Object.values(employee.shifts)
        .filter(s => s.date.startsWith(monthKey) && s.type === 'WORK')
        .length;
}

/** Liczba dni urlopu (UW) */
function getMonthVacationDays(schedule: Schedule, employeeId: string, month: number, year: number): number {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const employee = schedule.employees.find(e => e.id === employeeId);
    if (!employee) return 0;

    return Object.values(employee.shifts)
        .filter(s => s.date.startsWith(monthKey) && s.type === 'UW')
        .length;
}

/** NOWE: Zlicza nocki (WORK gdzie isNight=true lub start>=20) */
function getMonthNightShifts(schedule: Schedule, employeeId: string, month: number, year: number): number {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const employee = schedule.employees.find(e => e.id === employeeId);
    if (!employee) return 0;

    return Object.values(employee.shifts)
        .filter(s => {
            if (!s.date.startsWith(monthKey)) return false;
            if (s.type !== 'WORK') return false;
            return (s as any).isNight === true || (s.startHour !== undefined && s.startHour >= 20);
        })
        .length;
}

/** NOWE: Zlicza godziny kontaktów (zmiany K + monthlyContactHours) */
function getMonthContacts(schedule: Schedule, employeeId: string, month: number, year: number): number {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const employee = schedule.employees.find(e => e.id === employeeId);
    if (!employee) return 0;

    const shiftContactSum = Object.values(employee.shifts)
        .filter(s => s.date.startsWith(monthKey) && s.type === 'K')
        .reduce((sum, s) => {
            const h = typeof s.contactHours === 'number'
                ? s.contactHours
                : typeof s.hours === 'number'
                    ? s.hours
                    : (s.startHour !== undefined && s.endHour !== undefined ? s.endHour - s.startHour : 0);
            return sum + h;
        }, 0);

    const monthlyAggregated = (employee as any).monthlyContactHours?.[monthKey] ?? 0;
    return shiftContactSum + monthlyAggregated;
}

export function calculateMonthComparison(
    schedule: Schedule,
    month1: MonthData,
    month2: MonthData
): MonthComparisonData {
    const employees: EmployeeComparison[] = schedule.employees.map(emp => {
        const month1Hours = getMonthHours(schedule, emp.id, month1.month, month1.year);
        const month2Hours = getMonthHours(schedule, emp.id, month2.month, month2.year);
        const difference = month2Hours - month1Hours;
        const percentChange = month1Hours > 0 ? (difference / month1Hours) * 100 : 0;

        return {
            id: emp.id,
            name: emp.name,
            month1Hours,
            month2Hours,
            difference,
            percentChange,
            month1Shifts: getMonthShifts(schedule, emp.id, month1.month, month1.year),
            month2Shifts: getMonthShifts(schedule, emp.id, month2.month, month2.year),
            month1Vacation: getMonthVacationDays(schedule, emp.id, month1.month, month1.year),
            month2Vacation: getMonthVacationDays(schedule, emp.id, month2.month, month2.year),

            // Dodane nowe pola
            month1NightShifts: getMonthNightShifts(schedule, emp.id, month1.month, month1.year),
            month2NightShifts: getMonthNightShifts(schedule, emp.id, month2.month, month2.year),
            month1ContactHours: getMonthContacts(schedule, emp.id, month1.month, month1.year),
            month2ContactHours: getMonthContacts(schedule, emp.id, month2.month, month2.year),
        };
    });

    const teamTotal1 = employees.reduce((sum, e) => sum + e.month1Hours, 0);
    const teamTotal2 = employees.reduce((sum, e) => sum + e.month2Hours, 0);
    const teamDifference = teamTotal2 - teamTotal1;
    const teamPercentChange = teamTotal1 > 0 ? (teamDifference / teamTotal1) * 100 : 0;

    return {
        month1,
        month2,
        employees: employees.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
        teamTotal1,
        teamTotal2,
        teamDifference,
        teamPercentChange
    };
}
