import { addDays, subDays, format, isWeekend, differenceInHours } from 'date-fns';

const SCORING = {
    PREFERRED: 100,
    NEUTRAL: 0,
    AVOID: -50,
    STRONGLY_AVOID: -200,
    ILLEGAL: -10000,
};

const getShiftHours = (type) => {
    if (type === '8-14') return { start: 8, end: 14 }; // 6h
    if (type === '8-15') return { start: 8, end: 15 }; // 7h
    if (type === '8-16') return { start: 8, end: 16 }; // 8h
    if (type === '8-20') return { start: 8, end: 20 }; // 12h
    if (type === '14-20') return { start: 14, end: 20 }; // 6h
    if (type === '20-8') return { start: 20, end: 8 }; // 12h (Night)
    return null;
};

const isNightShift = (type) => type === '20-8';

const checkHardConstraints = (employee, dateStr, proposedShiftType) => {
    const date = new Date(dateStr);
    const prevDateStr = format(subDays(date, 1), 'yyyy-MM-dd');
    const prevShift = employee.shifts[prevDateStr];

    const proposedHours = getShiftHours(proposedShiftType);
    if (!proposedHours) return { valid: true };

    // 1. 11h Daily Rest
    if (prevShift && prevShift.endHour !== undefined && prevShift.startHour !== undefined) {
        let gap = 0;
        const prevEndedNextDay = prevShift.startHour > prevShift.endHour;

        if (prevEndedNextDay) {
            // Previous shift ended TODAY at prevShift.endHour
            gap = proposedHours.start - prevShift.endHour;
        } else {
            // Previous shift ended YESTERDAY at prevShift.endHour
            gap = (24 - prevShift.endHour) + proposedHours.start;
        }

        if (gap < 11) {
            return { valid: false, reason: `Brak 11h odpoczynku (przerwa: ${gap}h)` };
        }
    }

    return { valid: true };
};

const calculateScore = (employee, dateStr, proposedShiftType, allEmployees) => {
    let score = 0;
    const reasons = [];
    const date = new Date(dateStr);

    // 0. Hard Constraints Check
    const legal = checkHardConstraints(employee, dateStr, proposedShiftType);
    if (!legal.valid) {
        return { score: SCORING.ILLEGAL, reasons: [legal.reason] };
    }

    const prevDateStr = format(subDays(date, 1), 'yyyy-MM-dd');
    const prevPrevDateStr = format(subDays(date, 2), 'yyyy-MM-dd');
    const prevShift = employee.shifts[prevDateStr];
    const prevPrevShift = employee.shifts[prevPrevDateStr];

    // 1. Night Shift Recovery (2 Nights -> 2 Days Off)
    if (prevShift && isNightShift(prevShift.type) && prevPrevShift && isNightShift(prevPrevShift.type)) {
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
        if (proposedShiftType !== 'W') {
            score += SCORING.AVOID;
            reasons.push('Po nocce zalecany dzień wolny');
        }
    }

    // 3. Weekend Fairness
    if (isWeekend(date)) {
        const lastSat = subDays(date, 7);
        const lastSun = subDays(date, 6);
        const lastSatShift = employee.shifts[format(lastSat, 'yyyy-MM-dd')];
        const lastSunShift = employee.shifts[format(lastSun, 'yyyy-MM-dd')];

        if (lastSatShift || lastSunShift) {
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
            score += 50;
            reasons.push('Ma mało godzin (wyrównywanie)');
        } else if (myHours > avgHours + 10) {
            score += SCORING.AVOID;
            reasons.push('Ma dużo godzin (wyrównywanie)');
        }
    }

    // 5. Consecutive Days
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

export async function findBestReplacement({ date, shiftType, employeeOutId, schedule }) {
    const candidates = [];
    const allEmployees = schedule.employees;

    for (const emp of allEmployees) {
        // Skip the employee who is out
        if (emp.id === employeeOutId) continue;

        // Skip if employee already has a shift on this day (unless it's 'W' - day off, but even then, we are replacing them, so they must be available)
        // Actually, if they have 'W', they are available. If they have a work shift, they are busy.
        const currentShift = emp.shifts[date];
        if (currentShift && currentShift.type !== 'W') {
            // Employee is busy
            continue;
        }

        // Also check for planned leaves (UW, L4, etc) which might be stored as shift type
        if (currentShift && ['UW', 'L4', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(currentShift.type)) {
            continue;
        }

        const { score, reasons } = calculateScore(emp, date, shiftType, allEmployees);

        // Calculate monthly hours for context
        const monthKey = date.substring(0, 7); // YYYY-MM
        const monthlyHours = Object.values(emp.shifts)
            .filter(s => s.date.startsWith(monthKey))
            .reduce((acc, s) => acc + (s.hours || 0), 0);

        candidates.push({
            id: emp.id,
            name: emp.name,
            score,
            reasons,
            details: {
                monthlyHours,
                canWork: score > SCORING.ILLEGAL
            }
        });
    }

    // Sort by score descending
    return candidates.sort((a, b) => b.score - a.score);
}
