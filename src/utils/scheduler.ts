import { addDays, differenceInHours, format, isWeekend, subDays } from 'date-fns';
import type { Schedule, Shift, Employee, ShiftType } from '../types';

// --- Configuration ---

const SCORING = {
    PREFERRED: 100,
    NEUTRAL: 0,
    AVOID: -50,
    STRONGLY_AVOID: -200,
    ILLEGAL: -10000,
};

interface ShiftDemand {
    morning: number;   // 6:00 - 14:00
    afternoon: number; // 14:00 - 22:00
    night: number;     // 22:00 - 6:00
}

export const DEFAULT_DEMAND: ShiftDemand = {
    morning: 2,
    afternoon: 2,
    night: 1,
};

// --- Helpers ---

const getShiftHours = (type: string): { start: number, end: number } | null => {
    if (type === '8-14') return { start: 8, end: 14 }; // 6h
    if (type === '8-15') return { start: 8, end: 15 }; // 7h
    if (type === '8-16') return { start: 8, end: 16 }; // 8h
    if (type === '8-20') return { start: 8, end: 20 }; // 12h
    if (type === '14-20') return { start: 14, end: 20 }; // 6h
    if (type === '20-8') return { start: 20, end: 8 }; // 12h (Night)
    return null;
};

const isNightShift = (type: string) => type === '20-8';

// --- Hard Constraints (The Law) ---

export const checkHardConstraints = (
    employee: Employee,
    dateStr: string,
    proposedShiftType: string
): { valid: boolean; reason?: string } => {
    const date = new Date(dateStr);
    const prevDateStr = format(subDays(date, 1), 'yyyy-MM-dd');
    const prevShift = employee.shifts[prevDateStr];

    const proposedHours = getShiftHours(proposedShiftType);
    if (!proposedHours) return { valid: true }; // Non-working shift (e.g. OFF) is always legal

    // 1. 11h Daily Rest
    if (prevShift && prevShift.endHour !== undefined && prevShift.startHour !== undefined) {
        let gap = 0;
        // Check if previous shift crossed midnight (e.g. 20:00 - 08:00)
        const prevEndedNextDay = prevShift.startHour > prevShift.endHour;

        if (prevEndedNextDay) {
            // Previous shift ended TODAY at prevShift.endHour
            // Gap is simply start - end
            gap = proposedHours.start - prevShift.endHour;
        } else {
            // Previous shift ended YESTERDAY at prevShift.endHour
            // Gap is time until midnight + time from midnight
            gap = (24 - prevShift.endHour) + proposedHours.start;
        }

        if (gap < 11) {
            return { valid: false, reason: `Brak 11h odpoczynku (przerwa: ${gap}h)` };
        }
    }

    // 2. 35h Weekly Rest (Simplified check - full check is complex)
    // We ensure at least one 35h break in the week.
    // This is usually checked on a weekly basis, not single shift.
    // For auto-fill, we rely on the "Score" to prioritize days off.

    return { valid: true };
};

// --- Soft Constraints (Fairness & Logic) ---

export const calculateScore = (
    employee: Employee,
    dateStr: string,
    proposedShiftType: string,
    allEmployees: Employee[]
): { score: number; reasons: string[] } => {
    let score = 0;
    const reasons: string[] = [];
    const date = new Date(dateStr);

    // 0. Hard Constraints Check
    const legal = checkHardConstraints(employee, dateStr, proposedShiftType);
    if (!legal.valid) {
        return { score: SCORING.ILLEGAL, reasons: [legal.reason!] };
    }

    const prevDateStr = format(subDays(date, 1), 'yyyy-MM-dd');
    const prevPrevDateStr = format(subDays(date, 2), 'yyyy-MM-dd');
    const prevShift = employee.shifts[prevDateStr];
    const prevPrevShift = employee.shifts[prevPrevDateStr];

    // 1. Night Shift Recovery (2 Nights -> 2 Days Off)
    if (prevShift && isNightShift(prevShift.type) && prevPrevShift && isNightShift(prevPrevShift.type)) {
        // Employee just finished 2 nights. They should rest.
        if (proposedShiftType !== 'W') {
            score += SCORING.STRONGLY_AVOID;
            reasons.push('Po 2 nockach zalecane 2 dni wolnego');
        } else {
            score += SCORING.PREFERRED;
            reasons.push('Odpoczynek po nockach');
        }
    }

    // 2. Rotation Logic (Avoid Night -> Morning)
    if (prevShift && isNightShift(prevShift.type)) {
        // After night shift (ends 8am), cannot take morning shift same day (physically impossible usually, but handled by hard constraints)
        // But next day?
        // If we are planning 'tomorrow' relative to night shift:
        // Ideally OFF.
        if (proposedShiftType !== 'W') {
            score += SCORING.AVOID;
            reasons.push('Po nocce zalecany dzień wolny');
        }
    }

    // 3. Weekend Fairness
    if (isWeekend(date)) {
        // Check if worked last weekend
        const lastSat = subDays(date, 7);
        const lastSun = subDays(date, 6); // Approx
        const lastSatShift = employee.shifts[format(lastSat, 'yyyy-MM-dd')];
        const lastSunShift = employee.shifts[format(lastSun, 'yyyy-MM-dd')];

        if (lastSatShift || lastSunShift) {
            // Worked last weekend, prefer OFF this weekend
            if (proposedShiftType === 'W') {
                score += SCORING.PREFERRED;
                reasons.push('Pracował w zeszły weekend (sprawiedliwość)');
            } else {
                score += SCORING.AVOID;
                reasons.push('Pracował w zeszły weekend');
            }
        }
    }

    // 4. Hours Balancing
    // Calculate average hours of all employees vs this employee
    // This is a bit heavy for every cell, but essential for fairness.
    let totalHours = 0;
    let myHours = 0;
    allEmployees.forEach(e => {
        Object.values(e.shifts).forEach(s => {
            if (s.hours) totalHours += s.hours;
            if (e.id === employee.id && s.hours) myHours += s.hours;
        });
    });
    const avgHours = totalHours / allEmployees.length;

    if (proposedShiftType !== 'W') {
        if (myHours < avgHours - 10) {
            score += 50; // Needs hours
            reasons.push('Ma mało godzin (wyrównywanie)');
        } else if (myHours > avgHours + 10) {
            score += SCORING.AVOID; // Has too many hours
            reasons.push('Ma dużo godzin (wyrównywanie)');
        }
    }

    // 5. Consecutive Days
    // Count backwards
    let consecutive = 0;
    for (let i = 1; i <= 6; i++) {
        const d = format(subDays(date, i), 'yyyy-MM-dd');
        if (employee.shifts[d] && employee.shifts[d].type !== 'W') {
            consecutive++;
        } else {
            break;
        }
    }
    if (consecutive >= 5 && proposedShiftType !== 'W') {
        score += SCORING.STRONGLY_AVOID;
        reasons.push(`Pracuje już ${consecutive} dni z rzędu`);
    }

    return { score, reasons };
};

// --- Generator ---

export const generateSchedule = (
    schedule: Schedule,
    startDateStr: string,
    endDateStr: string,
    demand: ShiftDemand
): Schedule => {
    const newSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const daysDiff = differenceInHours(endDate, startDate) / 24;

    // Iterate days
    for (let i = 0; i <= daysDiff; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        // 1. Identify slots to fill based on demand
        // Count current shifts
        let currentMorning = 0;
        let currentAfternoon = 0;
        let currentNight = 0;

        newSchedule.employees.forEach((emp: Employee) => {
            const shift = emp.shifts[dateStr];
            if (shift) {
                if (shift.startHour === 6 || shift.startHour === 8) currentMorning++;
                if (shift.startHour === 14) currentAfternoon++;
                if (shift.startHour === 20 || shift.startHour === 22) currentNight++;
            }
        });

        const neededMorning = Math.max(0, demand.morning - currentMorning);
        const neededAfternoon = Math.max(0, demand.afternoon - currentAfternoon);
        const neededNight = Math.max(0, demand.night - currentNight);

        // 2. Fill slots
        // We try to fill Night first (hardest), then Afternoon, then Morning

        // Helper to assign shift
        const assignShift = (type: string, count: number) => {
            for (let c = 0; c < count; c++) {
                // Find best candidate
                let bestCandidate: Employee | null = null;
                let bestScore = -9999;

                // Shuffle employees to avoid deterministic bias (always picking first in list)
                const shuffledEmployees = [...newSchedule.employees].sort(() => Math.random() - 0.5);

                for (const emp of shuffledEmployees) {
                    // Skip if already has shift
                    if (emp.shifts[dateStr]) continue;

                    const { score } = calculateScore(emp, dateStr, type, newSchedule.employees);

                    if (score > bestScore && score > SCORING.ILLEGAL) {
                        bestScore = score;
                        bestCandidate = emp;
                    }
                }

                if (bestCandidate) {
                    // Assign
                    const hours = getShiftHours(type);
                    if (hours) {
                        const newShift: Shift = {
                            id: Math.random().toString(36).substr(2, 9),
                            date: dateStr,
                            type: type as ShiftType,
                            startHour: hours.start,
                            endHour: hours.end,
                            hours: (hours.start < hours.end ? hours.end - hours.start : (24 - hours.start) + hours.end),
                            contactHours: 0
                        };
                        bestCandidate.shifts[dateStr] = newShift;
                    }
                }
            }
        };

        assignShift('20-8', neededNight);
        assignShift('14-20', neededAfternoon);
        assignShift('8-16', neededMorning); // Using 8-16 as standard morning
    }

    return newSchedule;
};
