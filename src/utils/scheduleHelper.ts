import type { Schedule } from '../types';
import type { StaffingRules } from './aiService';

/**
 * AI Schedule Helper
 * 
 * Helps plan upcoming days/weeks by analyzing existing schedule
 * and suggesting optimal shift assignments based on all rules.
 */

export interface SchedulePlanningRequest {
    schedule: Schedule;
    startDate: string;  // YYYY-MM-DD
    endDate: string;    // YYYY-MM-DD
    staffingRules?: StaffingRules;
}

export interface SchedulePlanningResponse {
    suggestion: string;  // AI's suggested schedule in markdown
    startDate: string;
    endDate: string;
}

/**
 * Ask AI to suggest schedule for upcoming days
 */
export async function askScheduleHelper(request: SchedulePlanningRequest): Promise<SchedulePlanningResponse> {
    const { schedule, startDate, endDate, staffingRules } = request;

    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/schedule-helper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                schedule,
                startDate,
                endDate,
                staffingRules
            })
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const data = await response.json();
        return {
            suggestion: data.suggestion,
            startDate,
            endDate
        };
    } catch (error) {
        console.error('Schedule Helper Error:', error);
        throw error;
    }
}

/**
 * Parse user question to extract date range for planning
 * Examples:
 * - "Zaproponuj układ na 8-10 grudnia"
 * - "Zaplanuj kolejny tydzień"
 * - "Pomóż ułożyć 15-20.12"
 */
export function parseSchedulePlanningQuery(question: string, schedule: Schedule): SchedulePlanningRequest | null {
    // Check if it's a planning query
    const isPlanningQuery = /zaproponuj|zaplanuj|ułóż|schedule|plan|układanie/i.test(question);
    if (!isPlanningQuery) return null;

    // Try to extract date range
    let startDate: string | null = null;
    let endDate: string | null = null;

    // Pattern 1: "8-10 grudnia" or "8-10.12"
    const rangeMatch = question.match(/(\d{1,2})[-\s]+(\d{1,2})\s*(?:grudnia|\.12|12)/i);
    if (rangeMatch) {
        const day1 = rangeMatch[1].padStart(2, '0');
        const day2 = rangeMatch[2].padStart(2, '0');
        const month = String(schedule.month).padStart(2, '0');
        startDate = `${schedule.year}-${month}-${day1}`;
        endDate = `${schedule.year}-${month}-${day2}`;
    }

    // Pattern 2: "kolejny tydzień" - find next 7 days after last scheduled day
    if (!startDate && /kolejny tydzień|następny tydzień|next week/i.test(question)) {
        // Find last day with any shifts
        let lastDay = 0;
        schedule.employees.forEach(emp => {
            Object.keys(emp.shifts).forEach(dateStr => {
                if (dateStr.startsWith(`${schedule.year}-${String(schedule.month).padStart(2, '0')}`)) {
                    const day = parseInt(dateStr.split('-')[2]);
                    if (day > lastDay) lastDay = day;
                }
            });
        });

        if (lastDay > 0) {
            const nextDay = lastDay + 1;
            const weekEnd = Math.min(lastDay + 7, new Date(schedule.year, schedule.month, 0).getDate());
            startDate = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
            endDate = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(weekEnd).padStart(2, '0')}`;
        }
    }

    // Pattern 3: Single day "na 8 grudnia"
    const singleDayMatch = question.match(/na\s+(\d{1,2})\s*(?:grudnia|\.12|12)/i);
    if (!startDate && singleDayMatch) {
        const day = singleDayMatch[1].padStart(2, '0');
        const month = String(schedule.month).padStart(2, '0');
        startDate = `${schedule.year}-${month}-${day}`;
        endDate = startDate; // Same day
    }

    if (!startDate || !endDate) {
        return null; // Could not parse date range
    }

    return {
        schedule,
        startDate,
        endDate
    };
}
