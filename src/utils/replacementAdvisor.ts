import type { Schedule } from '../types';

/**
 * AI-Powered Replacement Advisor
 * 
 * This module combines strict replacementFinder.js rules with AI's creative problem-solving
 * to suggest replacements and alternative scenarios.
 */

export interface ReplacementRequest {
    employeeName: string;
    date: string;
    shiftType: string;
    schedule: Schedule;
    includeContactHours?: boolean;
}

export interface ReplacementAdvisorResponse {
    candidates: any[];
    aiAnalysis: string;
    alternatives?: string;
}

/**
 * Ask AI to analyze replacement candidates and suggest alternatives
 */
export async function askReplacementAdvisor(request: ReplacementRequest): Promise<ReplacementAdvisorResponse> {
    const { employeeName, date, shiftType, schedule, includeContactHours = false } = request;

    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/replacement-advisor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                employeeName,
                date,
                shiftType,
                schedule,
                includeContactHours
            })
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Replacement Advisor Error:', error);
        throw error;
    }
}

/**
 * Parse user question to extract replacement request parameters
 */
export function parseReplacementQuery(question: string, schedule: Schedule): ReplacementRequest | null {
    const lowerQuestion = question.toLowerCase();

    // Pattern: "znajdź zastępstwo dla [name] na [date] [shift]"
    // Examples: 
    // - "znajdź zastępstwo dla Pauliny na 15 grudnia 14-22"
    // - "kto może zastąpić Marię 2024-12-20 8-16"

    // Check if it's a replacement query
    const isReplacementQuery = /znajdź? zastępstw|kto może zastąpić|replacement for|zamiennik/i.test(question);
    if (!isReplacementQuery) return null;

    // Try to extract employee name
    let employeeName: string | null = null;
    for (const emp of schedule.employees) {
        const namePattern = new RegExp(emp.name.toLowerCase(), 'i');
        if (namePattern.test(lowerQuestion)) {
            employeeName = emp.name;
            break;
        }
    }

    if (!employeeName) {
        // Could not detect employee name
        return null;
    }

    // Try to extract date
    // Patterns: "15 grudnia", "2024-12-15", "15.12", "15-12"
    let dateStr: string | null = null;

    // Pattern 1: YYYY-MM-DD
    const isoDateMatch = question.match(/\d{4}-\d{2}-\d{2}/);
    if (isoDateMatch) {
        dateStr = isoDateMatch[0];
    } else {
        // Pattern 2: DD.MM or DD-MM or just DD
        const simpleDateMatch = question.match(/(\d{1,2})[\.\-]?(\d{1,2})?/);
        if (simpleDateMatch) {
            const day = simpleDateMatch[1].padStart(2, '0');
            const month = simpleDateMatch[2] ? simpleDateMatch[2].padStart(2, '0') : String(schedule.month).padStart(2, '0');
            dateStr = `${schedule.year}-${month}-${day}`;
        }
    }

    if (!dateStr) {
        // Could not detect date
        return null;
    }

    // Try to extract shift type
    // Patterns: "14-22", "8-16", "20-8"
    let shiftType: string | null = null;
    const shiftMatch = question.match(/(\d{1,2})[-\/](\d{1,2})/);
    if (shiftMatch) {
        shiftType = `${shiftMatch[1]}-${shiftMatch[2]}`;
    } else {
        // Default to 8-16 if not specified
        shiftType = '8-16';
    }

    return {
        employeeName,
        date: dateStr,
        shiftType,
        schedule,
        includeContactHours: false
    };
}
