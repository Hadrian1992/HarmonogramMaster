export type ShiftType =
    | 'WORK'
    | 'L4'   // Chorobowe
    | 'UW'   // Urlop Wypoczynkowy
    | 'UZ'   // Urlop na żądanie (deprecated, use UŻ)
    | 'UŻ'   // Urlop na Żądanie (4 dni/rok, według godzin zmian)
    | 'UM'   // Urlop Macierzyński
    | 'USW'  // Urlop Siła Wyższa (2 dni/rok, 50% płatny, na godziny)
    | 'OP'   // Opieka nad dzieckiem
    | 'W'    // Wolne (Day off)
    | 'NN'   // Nieobecność nieusprawiedliwiona
    | 'UB'   // Urlop bezpłatny
    | 'WYCH' // Urlop wychowawczy
    | 'K';   // Godziny kontaktów

export interface Shift {
    id: string;
    date: string; // ISO date string YYYY-MM-DD
    type: ShiftType;
    startHour?: number; // e.g. 8
    endHour?: number;   // e.g. 20
    hours: number;      // Calculated duration
    contactHours?: number; // Explicit contact hours
}

export interface Employee {
    id: string;
    name: string;
    shifts: Record<string, Shift>; // Key is date YYYY-MM-DD
    monthlyContactHours?: Record<string, number>; // Key is YYYY-MM (month-year), value is manual contact hours
    preferences?: string; // Notes/Preferences for AI Advisor
}

export interface Schedule {
    id: string;
    month: number; // 1-12
    year: number;
    employees: Employee[];
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    employeeId: string;
    date: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
}
