/**
 * Labor Law Utilities
 * 
 * This file contains utility functions for labor law calculations.
 * Note: Validation logic has been moved to analytics.ts for centralization.
 */

export const WORK_SHIFT_TYPES = ['WORK', 'K'];

/**
 * Calculate hours between start and end time, accounting for midnight crossing
 * @param start - Start hour (0-23)
 * @param end - End hour (0-23)
 * @returns Total hours worked
 */
export function calculateHours(start: number, end: number): number {
    if (start < end) {
        return end - start;
    }
    // Crosses midnight (e.g. 20:00 to 08:00)
    return (24 - start) + end;
}
