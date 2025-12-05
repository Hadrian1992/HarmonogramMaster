/**
 * OR-Tools Schedule Generator Service
 * API client for generating schedules using constraint programming
 */

export interface ORToolsEmployee {
    id: string;
    name: string;
    roles: string[];  // 🆕 Phase 2: Employee roles
    allowedShifts: string[];  // e.g., ["8-16", "14-22", "20-8"]
    preferences?: Record<string, any>;
    specialRules?: Record<string, any>;
}

export interface ORToolsConstraint {
    type: 'ABSENCE' | 'PREFERENCE' | 'FREE_TIME' | 'DEMAND' | 'CUSTOM';
    employeeId?: string;
    date?: string;  // YYYY-MM-DD
    dateRange?: [string, string];  // [start, end] (dla ABSENCE, FREE_TIME)
    value?: any;
    description?: string;
    isHard?: boolean;  // true = ABSENCE, false = PREFERENCE/FREE_TIME
}

export interface DemandSpec {
    day: number;   // Shifts starting before 20:00
    night: number; // Shifts starting at or after 20:00
}

export interface ORToolsRequest {
    dateRange: {
        start: string;  // YYYY-MM-DD
        end: string;    // YYYY-MM-DD
    };
    employees: ORToolsEmployee[];
    constraints: ORToolsConstraint[];
    demand: Record<string, DemandSpec>;  // date -> { day, night }
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

// ============================================================================
// 🆕 ASYNC JOB PATTERN - Non-blocking solver execution
// ============================================================================

export interface JobStatus {
    jobId: string;
    status: 'running' | 'completed' | 'failed';
    progress: string;
    elapsed: number;
    completed: boolean;
}

/**
 * Start a solver job (returns immediately with job ID)
 */
export async function startSolverJob(request: ORToolsRequest): Promise<{ jobId: string; status: string }> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/api/ortools/start-job`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start solver job');
    }

    return response.json();
}

/**
 * Poll job status (call every 2 seconds)
 */
export async function pollJobStatus(jobId: string): Promise<JobStatus> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/api/ortools/job-status/${jobId}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get job status');
    }

    return response.json();
}

/**
 * Get job result (when status is 'completed')
 */
export async function getJobResult(jobId: string): Promise<ORToolsResponse> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/api/ortools/job-result/${jobId}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get job result');
    }

    return response.json();
}
