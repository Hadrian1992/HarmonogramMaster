import { addDays, subDays, format, isWeekend, differenceInHours, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

const SCORING = {
    BASE: 100,
    PREFERRED: 0, // No bonus, just 100%
    NEUTRAL: 0,
    AVOID: -25, // 75% match
    STRONGLY_AVOID: -50, // 50% match
    CRITICAL_ISSUE: -60, // 40% match (e.g. 11h rest violation if we want to show it)
    ILLEGAL: -10000, // Still filter out completely illegal
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

const checkWeeklyRest = (employee, dateStr, proposedShiftType) => {
    const date = new Date(dateStr);

    // 1. Determine the week (Monday to Sunday)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday

    // 2. Get all days in this week
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // 3. Collect all shifts (existing + proposed)
    const shiftsInWeek = [];

    daysInWeek.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        let shift = null;

        if (dStr === dateStr) {
            // This is the day we are proposing a shift for
            if (proposedShiftType !== 'W') {
                const hours = getShiftHours(proposedShiftType);
                if (hours) {
                    shift = { date: d, start: hours.start, end: hours.end };
                }
            }
        } else {
            // Existing shift
            const existing = employee.shifts[dStr];
            if (existing && existing.type !== 'W') {
                const hours = getShiftHours(existing.type);
                if (hours) {
                    shift = { date: d, start: hours.start, end: hours.end };
                }
            }
        }

        if (shift) {
            // Normalize start/end times relative to week start (in hours)
            // We need absolute hours from week start to calculate gaps correctly
            const dayOffset = differenceInHours(d, weekStart); // 0 for Mon, 24 for Tue, etc.

            let startAbs = dayOffset + shift.start;
            let endAbs = dayOffset + shift.end;

            // Handle night shifts ending next day
            if (shift.end < shift.start) {
                endAbs += 24;
            }

            shiftsInWeek.push({ start: startAbs, end: endAbs });
        }
    });

    // 4. If no shifts in week, rest is 168h (valid)
    if (shiftsInWeek.length === 0) return { valid: true };

    // 5. Sort shifts by start time
    shiftsInWeek.sort((a, b) => a.start - b.start);

    // 6. Calculate gaps
    // Initial gap: from start of week (Mon 00:00) to first shift? 
    // Actually, 35h rest can be ANYWHERE in the week.
    // We check gaps BETWEEN shifts, and also before first and after last.

    let maxGap = 0;

    // Gap before first shift (from Mon 00:00)
    // Note: This assumes previous week ended at Sun 24:00 with work? 
    // To be safe, we usually look for gap strictly WITHIN the week boundaries or between shifts.
    // But strictly speaking, if first shift is Wed 08:00, then Mon 00:00 - Wed 08:00 is > 48h rest.
    maxGap = Math.max(maxGap, shiftsInWeek[0].start);

    // Gaps between shifts
    for (let i = 0; i < shiftsInWeek.length - 1; i++) {
        const currentEnd = shiftsInWeek[i].end;
        const nextStart = shiftsInWeek[i + 1].start;
        const gap = nextStart - currentEnd;
        maxGap = Math.max(maxGap, gap);
    }

    // Gap after last shift (to Sun 24:00)
    const weekEndHour = 7 * 24; // 168h
    const lastEnd = shiftsInWeek[shiftsInWeek.length - 1].end;
    maxGap = Math.max(maxGap, weekEndHour - lastEnd);

    if (maxGap < 35) {
        return {
            valid: false,
            reason: `Brak 35h nieprzerwanego odpoczynku w tygodniu (max przerwa: ${maxGap}h)`
        };
    }

    return { valid: true };
};

const checkWeeklyOvertime = (employee, dateStr, proposedShiftType) => {
    const date = new Date(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    let totalHours = 0;

    daysInWeek.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');

        if (dStr === dateStr) {
            // Proposed shift
            if (proposedShiftType !== 'W') {
                const hours = getShiftHours(proposedShiftType);
                if (hours) {
                    let duration = hours.end - hours.start;
                    if (duration < 0) duration += 24; // Night shift
                    totalHours += duration;
                }
            }
        } else {
            // Existing shift
            const existing = employee.shifts[dStr];
            if (existing && existing.type !== 'W') {
                const hours = getShiftHours(existing.type);
                if (hours) {
                    let duration = hours.end - hours.start;
                    if (duration < 0) duration += 24;
                    totalHours += duration;
                } else if (existing.hours) {
                    // Fallback if getShiftHours fails but hours property exists
                    totalHours += existing.hours;
                }
            }
        }
    });

    if (totalHours > 40) {
        return {
            valid: false,
            reason: `Generuje nadgodziny (Tydzień: ${totalHours}h > 40h)`
        };
    }

    return { valid: true };
};

const calculateScore = (employee, dateStr, proposedShiftType, allEmployees, includeContactHours = false) => {
    let score = SCORING.BASE; // Start with 100%
    const reasons = [];
    const date = new Date(dateStr);

    // 0. Hard Constraints Check (Backwards)
    const legal = checkHardConstraints(employee, dateStr, proposedShiftType);
    if (!legal.valid) {
        // User requested "40% złamana zasada odpoczynku"
        // If it's an 11h rest violation, we give it a low score but maybe not -10000 if user wants to see it?
        // But usually "Illegal" means "Cannot work".
        // Let's stick to standard logic: Illegal is Illegal.
        // UNLESS user specifically wants to see them. 
        // User said: "40% złamana zasada odpoczynku".
        // So let's try to map "11h rest violation" to 40% score (so -60 penalty).
        if (legal.reason.includes('11h')) {
            score += SCORING.CRITICAL_ISSUE;
            reasons.push(legal.reason);
        } else {
            return { score: SCORING.ILLEGAL, reasons: [legal.reason] };
        }
    }

    // 0.1. Hard Constraints Check (Forward - Today -> Tomorrow)
    const legalForward = checkForwardConstraints(employee, dateStr, proposedShiftType);
    if (!legalForward.valid) {
        if (legalForward.reason.includes('11h')) {
            score += SCORING.CRITICAL_ISSUE;
            reasons.push(legalForward.reason);
        } else {
            return { score: SCORING.ILLEGAL, reasons: [legalForward.reason] };
        }
    }

    // 0.2. 35h Weekly Rest Check
    const weeklyRest = checkWeeklyRest(employee, dateStr, proposedShiftType);
    if (!weeklyRest.valid) {
        return { score: SCORING.ILLEGAL, reasons: [weeklyRest.reason] };
    }

    // 0.3. Weekly Overtime Check (>40h)
    const overtime = checkWeeklyOvertime(employee, dateStr, proposedShiftType);
    if (!overtime.valid) {
        score += SCORING.CRITICAL_ISSUE; // -60 points (Warning)
        reasons.push(overtime.reason);
    }

    // 0.5. Role-based restrictions (LIDER)
    // Replaces hardcoded 'Maria Pankowska' check
    if (employee.roles && employee.roles.includes('LIDER')) {
        // Rule 1: Lider nie pracuje w weekendy
        if (isWeekend(date) && proposedShiftType !== 'W') {
            return { score: SCORING.ILLEGAL, reasons: ['Lider nie pracuje w weekendy'] };
        }

        // Rule 2 & 3: Lider pracuje tylko 8:00-20:00
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
            score += SCORING.STRONGLY_AVOID; // -50 (Result: 50%)
            reasons.push('Po 2 nockach zalecane 2 dni wolnego');
        } else {
            score += SCORING.PREFERRED;
            reasons.push('Odpoczynek po nockach');
        }
    }

    // 2. Rotation Logic (Avoid Night -> Morning)
    if (prevShift && isNightShift(prevShift.type)) {
        if (proposedShiftType !== 'W') {
            score += SCORING.AVOID; // -25 (Result: 75%)
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
                    score += SCORING.STRONGLY_AVOID; // -50 (Result: 50%)
                    reasons.push('Pracował cały zeszły weekend');
                } else {
                    score += SCORING.AVOID; // -25 (Result: 75%)
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
        const deviation = avgHours > 0 ? myHours - avgHours : 0;

        // Granular scoring: +/- 1 point per hour deviation
        // Cap at +/- 20 points
        const hoursScore = Math.max(-20, Math.min(20, Math.round(-deviation)));

        if (hoursScore !== 0) {
            score += hoursScore;
            if (hoursScore > 5) reasons.push(`Ma mniej godzin (${Math.round(deviation)}h poniżej średniej)`);
            if (hoursScore < -5) reasons.push(`Ma więcej godzin (+${Math.round(deviation)}h powyżej średniej)`);
        }
    }

    // 5. Consecutive Days (Strict 5-day rule)
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
        // Zmiana na ILLEGAL (zgodnie z Python constraints)
        return { score: SCORING.ILLEGAL, reasons: [`Pracuje już ${consecutive} dni z rzędu (Max 5)`] };
    }

    // 6. Advanced Preferences (Preferred/Avoid Shifts)
    if (employee.constraints && proposedShiftType !== 'W') {
        // Filter constraints for this specific date
        const dayConstraints = employee.constraints.filter(c => c.date === dateStr && c.type === 'PREFERENCE');

        for (const c of dayConstraints) {
            const weight = c.weight || 60; // Default weight if missing

            // Check Preferred Shifts
            if (c.preferredShifts && c.preferredShifts.includes(proposedShiftType)) {
                const bonus = Math.round(weight / 2);
                score += bonus; // Add bonus (e.g., +30)
                reasons.push(`Preferowana zmiana (Waga: ${weight})`);
            }

            // Check Avoid Shifts
            if (c.avoidShifts && c.avoidShifts.includes(proposedShiftType)) {
                score -= weight; // Subtract penalty (e.g., -60)
                reasons.push(`Unikana zmiana (Waga: ${weight})`);
            }

            // Backward compatibility: "Free Time" preference (if no specific shifts selected)
            if (!c.preferredShifts && !c.avoidShifts) {
                // This is a "Day Off" preference
                score -= weight;
                reasons.push(`Preferuje wolne (Waga: ${weight})`);
            }
        }
    }

    // Cap score at 100 max and 0 min (unless illegal)
    if (score > 100) score = 100;
    if (score < 0 && score > -1000) score = 0;

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
