/**
 * OR-Tools Schedule Generator Service
 * API client for generating schedules using constraint programming
 */

export interface ORToolsEmployee {
    id: string;
    name: string;
    allowedShifts: string[];  // e.g., ["8-16", "14-22", "20-8"]
    preferences?: Record<string, any>;
    specialRules?: Record<string, any>;
}

export interface ORToolsConstraint {
    type: 'ABSENCE' | 'PREFERENCE' | 'DEMAND' | 'CUSTOM';
    employeeId?: string;
    date?: string;  // YYYY-MM-DD
    dateRange?: [string, string];  // [start, end]
    value?: any;
    description?: string;
    isHard?: boolean;  // true = MUST, false = PREFER
}

export interface ORToolsRequest {
    dateRange: {
        start: string;  // YYYY-MM-DD
        end: string;    // YYYY-MM-DD
    };
    employees: ORToolsEmployee[];
    constraints: ORToolsConstraint[];
    demand: Record<string, number>;  // date -> min_staff
    existingSchedule: any;  // Current schedule from store
}

export interface ORToolsResponse {
    status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
    schedule: Record<string, Record<string, string>>;  // employeeId -> date -> shiftType
    stats: {
        solve_time: number;
        status: string;
        objective_value?: number;
        num_conflicts?: number;
        num_branches?: number;
    };
    violations?: string[];
    error?: string;
}

export async function generateSchedule(request: ORToolsRequest): Promise<ORToolsResponse> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/api/ortools/generate-schedule`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate schedule');
    }

    return response.json();
}
