import { addDays, subDays, format, isWeekend, differenceInHours } from 'date-fns';

const SCORING = {
    PREFERRED: 100,
    NEUTRAL: 0,
    AVOID: -50,
    STRONGLY_AVOID: -200,
    ILLEGAL: -10000,
};

const getShiftHours = (type) => {
    // Jeśli to specjalny typ (W, L4, etc.), zwróć null
    if (!type || type.length < 3) return null;

    // Parsuj format "X-Y" lub "X/Y"
    const match = type.match(/^(\d{1,2})[-/](\d{1,2})$/);
    if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        return { start, end };
    }

    // Jeśli nie pasuje do wzorca, zwróć null
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

const checkForwardConstraints = (employee, dateStr, proposedShiftType) => {
    const date = new Date(dateStr);
    const nextDateStr = format(addDays(date, 1), 'yyyy-MM-dd');
    const nextShift = employee.shifts[nextDateStr];

    // Jeśli jutro nie ma zmiany lub jest wolne, nie ma konfliktu
    if (!nextShift || !nextShift.type || nextShift.type === 'W') {
        return { valid: true };
    }

    const proposedHours = getShiftHours(proposedShiftType);
    const nextHours = getShiftHours(nextShift.type);

    if (!proposedHours || !nextHours) return { valid: true };

    // 1. 11h Daily Rest Check (Today -> Tomorrow)
    let gap = 0;
    const proposedEndedNextDay = proposedHours.start > proposedHours.end;

    if (proposedEndedNextDay) {
        // Zmiana dzisiaj kończy się JUTRO (np. 20-8 kończy się o 8:00 rano jutro)
        // Jeśli jutrzejsza zmiana zaczyna się np. o 14:00, to gap = 14 - 8 = 6h (ZA MAŁO)
        gap = nextHours.start - proposedHours.end;
    } else {
        // Zmiana dzisiaj kończy się DZISIAJ (np. 14-22)
        // Jutrzejsza zaczyna się o np. 6:00
        // Gap = (24 - 22) + 6 = 2 + 6 = 8h (ZA MAŁO)
        gap = (24 - proposedHours.end) + nextHours.start;
    }

    if (gap < 11) {
        return {
            valid: false,
            reason: `Naruszenie 11h odpoczynku przed jutrzejszą zmianą (przerwa: ${gap}h)`
        };
    }

    return { valid: true };
};

const calculateScore = (employee, dateStr, proposedShiftType, allEmployees, includeContactHours = false) => {
    let score = 0;
    const reasons = [];
    const date = new Date(dateStr);

    // 0. Hard Constraints Check (Backwards)
    const legal = checkHardConstraints(employee, dateStr, proposedShiftType);
    if (!legal.valid) {
        return { score: SCORING.ILLEGAL, reasons: [legal.reason] };
    }

    // 0.1. Hard Constraints Check (Forward - Today -> Tomorrow)
    const legalForward = checkForwardConstraints(employee, dateStr, proposedShiftType);
    if (!legalForward.valid) {
        return { score: SCORING.ILLEGAL, reasons: [legalForward.reason] };
    }

    // 0.5. Specjalne ograniczenia dla lidera (Maria Pankowska)
    if (employee.name === 'Maria Pankowska') {
        // Maria nie pracuje w weekendy
        if (isWeekend(date) && proposedShiftType !== 'W') {
            return { score: SCORING.ILLEGAL, reasons: ['Lider nie pracuje w weekendy'] };
        }

        // Maria może pracować tylko w zakresie 8:00-20:00
        const shiftHours = getShiftHours(proposedShiftType);
        if (shiftHours) {
            const { start, end } = shiftHours;

            // Sprawdź czy zmiana zaczyna się przed 8 lub kończy po 20
            if (start < 8) {
                return { score: SCORING.ILLEGAL, reasons: ['Lider nie pracuje przed 8:00'] };
            }

            // Dla zmian nocnych (start > end) lub kończących się po 20
            if (start > end) {
                // To nocka (np. 20-8)
                return { score: SCORING.ILLEGAL, reasons: ['Lider nie pracuje na zmianach nocnych'] };
            }

            if (end > 20) {
                return { score: SCORING.ILLEGAL, reasons: ['Lider nie pracuje po 20:00'] };
            }
        }
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

        // Sprawdź czy FAKTYCZNIE pracował (nie wolne i nie puste pole)
        const workedLastSat = lastSatShift && lastSatShift.type && lastSatShift.type !== 'W';
        const workedLastSun = lastSunShift && lastSunShift.type && lastSunShift.type !== 'W';

        if (workedLastSat || workedLastSun) {
            if (proposedShiftType === 'W') {
                score += SCORING.PREFERRED;
                if (workedLastSat && workedLastSun) {
                    reasons.push('Pracował cały zeszły weekend (sprawiedliwość)');
                } else {
                    reasons.push('Pracował w zeszły weekend (sprawiedliwość)');
                }
            } else {
                // Większa kara za cały weekend niż za jeden dzień
                if (workedLastSat && workedLastSun) {
                    score += SCORING.AVOID * 1.5; // -75 zamiast -50
                    reasons.push('Pracował cały zeszły weekend');
                } else {
                    score += SCORING.AVOID * 0.5; // -25 zamiast -50
                    reasons.push('Pracował w zeszły weekend (1 dzień)');
                }
            }
        }
    }

    // 4. Hours Balancing
    let totalHours = 0;
    let myHours = 0;

    // Determine month key for manual contact hours
    const monthKey = dateStr.substring(0, 7);

    allEmployees.forEach(e => {
        let empTotal = 0;

        // Sum shift hours
        Object.values(e.shifts).forEach(s => {
            if (s.date.startsWith(monthKey)) {
                empTotal += (s.hours || 0);
                if (includeContactHours) {
                    empTotal += (s.contactHours || (s.type === 'K' ? s.hours : 0) || 0);
                }
            }
        });

        // Add manual contact hours
        if (includeContactHours) {
            empTotal += (e.monthlyContactHours?.[monthKey] || 0);
        }

        totalHours += empTotal;
        if (e.id === employee.id) myHours = empTotal;
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

export async function findBestReplacement({ date, shiftType, employeeOutId, schedule, includeContactHours = false }) {
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

        const { score, reasons } = calculateScore(emp, date, shiftType, allEmployees, includeContactHours);

        // Calculate monthly hours for context
        const monthKey = date.substring(0, 7); // YYYY-MM

        let monthlyHours = 0;

        // 1. Sum shift hours
        monthlyHours = Object.values(emp.shifts)
            .filter(s => s.date.startsWith(monthKey))
            .reduce((acc, s) => {
                let h = (s.hours || 0);
                if (includeContactHours) {
                    // Add contact hours from shift
                    h += (s.contactHours || (s.type === 'K' ? s.hours : 0) || 0);
                }
                return acc + h;
            }, 0);

        // 2. Add manual contact hours if requested
        if (includeContactHours) {
            const manual = emp.monthlyContactHours?.[monthKey] || 0;
            monthlyHours += manual;
        }

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
