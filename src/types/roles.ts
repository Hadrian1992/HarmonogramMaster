/**
 * Employee roles for scheduling
 */
export type EmployeeRole = 'LIDER' | 'WYCHOWAWCA' | 'MEDYK';

/**
 * Requirement for a specific role on a shift
 */
export interface RoleRequirement {
    role: EmployeeRole;
    minCount: number;        // Minimum number of people with this role
    shiftTypes?: string[];   // Optional: only for specific shifts (e.g., ["8-16"])
}

/**
 * Extended demand specification with role requirements
 */
export interface DemandWithRoles {
    minStaff: number;                    // General minimum (as before)
    roleRequirements?: RoleRequirement[]; // Additional role-based requirements
}
