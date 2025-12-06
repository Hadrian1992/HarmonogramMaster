import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { startOfWeek, addDays, format } from 'date-fns';
import type { Schedule, Shift, ShiftType } from '../types';
import { generateSchedule, DEFAULT_DEMAND } from '../utils/scheduler';
import type { ORToolsEmployee, ORToolsConstraint } from '../utils/ortoolsService';


interface CopiedDay {
    date: string;
    shifts: Record<string, Shift>; // employeeId -> Shift
}

interface WeeklyTemplate {
    id: string;
    name: string;
    type: 'TEAM' | 'SINGLE';
    shifts?: Record<string, Record<number, Shift>>; // TEAM: employeeId -> dayIndex -> Shift
    singleShifts?: Record<number, Shift>; // SINGLE: dayIndex -> Shift
}

export interface ColorSettings {
    [key: string]: string; // shiftType -> color (hex)
}

export interface DemandSpec {
    day: number;   // Shifts starting before 20:00
    night: number; // Shifts starting at or after 20:00
}

// Helper function for backward compatibility
function normalizeDemand(demand: Record<string, number | DemandSpec>): Record<string, DemandSpec> {
    const normalized: Record<string, DemandSpec> = {};

    Object.entries(demand).forEach(([date, value]) => {
        if (typeof value === 'number') {
            // Old format: assign to day, night = 0
            normalized[date] = { day: value, night: 0 };
        } else {
            // New format: keep as is
            normalized[date] = value;
        }
    });

    return normalized;
}

interface ScheduleState {
    schedule: Schedule;
    copiedDay: CopiedDay | null;
    templates: WeeklyTemplate[];
    colorSettings: ColorSettings;
    setMonth: (month: number, year: number) => void;
    addEmployee: (name: string, email?: string) => void;
    updateEmployee: (id: string, name: string, email?: string) => void;
    updateShift: (employeeId: string, date: string, type: ShiftType, start?: number, end?: number, contactHours?: number) => void;
    removeEmployee: (id: string) => void;
    setManualContactHours: (employeeId: string, month: number, year: number, hours: number) => void;
    restoreSchedule: (schedule: Schedule) => void;
    copyDay: (date: string) => void;
    pasteDay: (targetDate: string, overwrite: boolean) => { success: boolean; conflicts: string[] };
    clearCopiedDay: () => void;
    saveTemplate: (name: string, sourceDate: string, employeeId?: string) => void;
    applyTemplate: (templateId: string, targetDate: string, targetEmployeeId?: string) => void;
    deleteTemplate: (templateId: string) => void;
    autoFillSchedule: (startDate: string, endDate: string, demand: typeof DEFAULT_DEMAND) => void;
    setShiftColor: (shiftType: string, color: string) => void;
    resetColors: () => void;
    updateEmployeePreferences: (employeeId: string, preferences: string) => void;
    staffingRules: {
        minStaffMorning: number;
        minStaffEvening: number;
        minStaffNight: number;
        customRules?: string;
    };
    updateStaffingRules: (rules: { minStaffMorning: number; minStaffEvening: number; minStaffNight: number; customRules?: string }) => void;

    ortoolsConfig: {
        employees: ORToolsEmployee[];
        constraints: ORToolsConstraint[];
        demand: Record<string, DemandSpec>;
        dateRange: { start: string; end: string };
    };
    updateORToolsConfig: (config: Partial<ScheduleState['ortoolsConfig']>) => void;
    bulkUpdateShifts: (updates: { employeeId: string, date: string, type: ShiftType, start?: number, end?: number, contactHours?: number }[]) => void;
}




const INITIAL_SCHEDULE: Schedule = {
    id: 'default',
    month: 1,
    year: 2026,
    employees: [
        { id: '1', name: 'Patrycja Górtowska', roles: ['WYCHOWAWCA'], shifts: {}, monthlyContactHours: {} },
        { id: '2', name: 'Maria Pankowska', roles: ['LIDER'], shifts: {}, monthlyContactHours: {} },
        { id: '3', name: 'Aleksandra Kijek', roles: ['WYCHOWAWCA'], shifts: {}, monthlyContactHours: {} },
        { id: '4', name: 'Dorota Mazurek', roles: ['WYCHOWAWCA'], shifts: {}, monthlyContactHours: {} },
        { id: '5', name: 'Paulina Rumińska', roles: ['WYCHOWAWCA'], shifts: {}, monthlyContactHours: {} },
        { id: '6', name: 'Agnieszka Olszewska', roles: ['WYCHOWAWCA'], shifts: {}, monthlyContactHours: {} },
        { id: '7', name: 'Milena Budka', roles: ['WYCHOWAWCA'], shifts: {}, monthlyContactHours: {} },
    ]
};

export const useScheduleStore = create<ScheduleState>()(
    persist(
        (set, get) => ({
            schedule: INITIAL_SCHEDULE,
            copiedDay: null,
            templates: [],
            colorSettings: {}, // Empty by default, user can customize
            staffingRules: {
                minStaffMorning: 2,
                minStaffEvening: 1,
                minStaffNight: 1,
                customRules: '',
            },
            ortoolsConfig: {
                employees: [],
                constraints: [],
                demand: {},
                dateRange: { start: '', end: '' }
            },

            setMonth: (month, year) => set((state) => ({
                schedule: { ...state.schedule, month, year }
            })),

            addEmployee: (name, email) => set((state) => ({
                schedule: {
                    ...state.schedule,
                    employees: [
                        ...state.schedule.employees,
                        {
                            id: Math.random().toString(36).substr(2, 9),
                            name,
                            email,
                            roles: ['WYCHOWAWCA'],  // 🆕 Default role for new employees
                            shifts: {},
                            monthlyContactHours: {}
                        }
                    ]
                }
            })),

            updateEmployee: (id, name, email) => set((state) => ({
                schedule: {
                    ...state.schedule,
                    employees: state.schedule.employees.map(emp =>
                        emp.id === id ? { ...emp, name, email } : emp
                    )
                }
            })),

            removeEmployee: (id) => set((state) => ({
                schedule: {
                    ...state.schedule,
                    employees: state.schedule.employees.filter(e => e.id !== id)
                }
            })),

            updateShift: (employeeId, date, type, start, end, contactHours) => set((state) => {
                const employees = state.schedule.employees.map(emp => {
                    if (emp.id !== employeeId) return emp;

                    // Calculate hours based on type
                    let hours = 0;
                    if (start !== undefined && end !== undefined) {
                        // Work shifts with time range
                        hours = (start < end ? end - start : (24 - start) + end);
                    } else if (['L4', 'UW', 'UZ', 'OP', 'UM', 'UB'].includes(type)) {
                        // Standard absence types default to 8 hours
                        hours = 8;
                    } else if (type === 'UŻ') {
                        // UŻ: If has time range, use it. Otherwise default to 8h
                        // User will typically enter shift time when taking UŻ
                        hours = (start !== undefined && end !== undefined)
                            ? (start < end ? end - start : (24 - start) + end)
                            : 8;
                    } else if (type === 'USW') {
                        // USW: Can be partial hours, default to 8 if not specified
                        hours = (start !== undefined && end !== undefined)
                            ? (start < end ? end - start : (24 - start) + end)
                            : 8;
                    }

                    const newShift: Shift = {
                        id: Math.random().toString(36).substr(2, 9),
                        date,
                        type,
                        startHour: start,
                        endHour: end,
                        hours,
                        contactHours
                    };

                    return {
                        ...emp,
                        shifts: {
                            ...emp.shifts,
                            [date]: newShift
                        }
                    };
                });

                return {
                    schedule: {
                        ...state.schedule,
                        employees
                    }
                };
            }),

            setManualContactHours: (employeeId, month, year, hours) => set((state) => {
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                const employees = state.schedule.employees.map(emp => {
                    if (emp.id !== employeeId) return emp;

                    return {
                        ...emp,
                        monthlyContactHours: {
                            ...(emp.monthlyContactHours || {}),
                            [monthKey]: hours
                        }
                    };
                });

                return {
                    schedule: {
                        ...state.schedule,
                        employees
                    }
                };
            }),

            restoreSchedule: (schedule) => set(() => ({
                schedule
            })),

            copyDay: (date) => {
                const state = get();
                const shifts: Record<string, Shift> = {};

                state.schedule.employees.forEach(emp => {
                    if (emp.shifts[date]) {
                        shifts[emp.id] = { ...emp.shifts[date] };
                    }
                });

                set({ copiedDay: { date, shifts } });
            },

            pasteDay: (targetDate, overwrite) => {
                const state = get();
                const copiedDay = state.copiedDay;

                if (!copiedDay) return { success: false, conflicts: [] };

                const conflicts: string[] = [];
                const employeesToUpdate: { empId: string, shift: Shift }[] = [];

                // Check for conflicts first
                state.schedule.employees.forEach(emp => {
                    const sourceShift = copiedDay.shifts[emp.id];
                    if (sourceShift) {
                        const targetShift = emp.shifts[targetDate];
                        if (targetShift && !overwrite) {
                            conflicts.push(emp.name);
                        } else {
                            employeesToUpdate.push({
                                empId: emp.id,
                                shift: { ...sourceShift, date: targetDate, id: Math.random().toString(36).substr(2, 9) }
                            });
                        }
                    }
                });

                if (conflicts.length > 0 && !overwrite) {
                    return { success: false, conflicts };
                }

                // Apply updates
                set((currentState) => {
                    const newEmployees = currentState.schedule.employees.map(emp => {
                        const update = employeesToUpdate.find(u => u.empId === emp.id);
                        if (update) {
                            return {
                                ...emp,
                                shifts: {
                                    ...emp.shifts,
                                    [targetDate]: update.shift
                                }
                            };
                        }
                        return emp;
                    });

                    return {
                        schedule: {
                            ...currentState.schedule,
                            employees: newEmployees
                        }
                    };
                });

                return { success: true, conflicts: [] };
            },

            clearCopiedDay: () => set({ copiedDay: null }),

            saveTemplate: (name, sourceDate, employeeId) => {
                const state = get();
                const start = startOfWeek(new Date(sourceDate), { weekStartsOn: 1 });

                let newTemplate: WeeklyTemplate;

                if (employeeId) {
                    // SINGLE EMPLOYEE TEMPLATE
                    const emp = state.schedule.employees.find(e => e.id === employeeId);
                    if (!emp) return;

                    const singleShifts: Record<number, Shift> = {};
                    for (let i = 0; i < 7; i++) {
                        const dateStr = format(addDays(start, i), 'yyyy-MM-dd');
                        if (emp.shifts[dateStr]) {
                            singleShifts[i] = { ...emp.shifts[dateStr] };
                        }
                    }

                    newTemplate = {
                        id: Math.random().toString(36).substr(2, 9),
                        name,
                        type: 'SINGLE',
                        singleShifts
                    };
                } else {
                    // TEAM TEMPLATE
                    const templateShifts: Record<string, Record<number, Shift>> = {};
                    state.schedule.employees.forEach(emp => {
                        templateShifts[emp.id] = {};
                        for (let i = 0; i < 7; i++) {
                            const dateStr = format(addDays(start, i), 'yyyy-MM-dd');
                            if (emp.shifts[dateStr]) {
                                templateShifts[emp.id][i] = { ...emp.shifts[dateStr] };
                            }
                        }
                    });

                    newTemplate = {
                        id: Math.random().toString(36).substr(2, 9),
                        name,
                        type: 'TEAM',
                        shifts: templateShifts
                    };
                }

                set({ templates: [...state.templates, newTemplate] });
            },

            applyTemplate: (templateId, targetDate, targetEmployeeId) => {
                const state = get();
                const template = state.templates.find(t => t.id === templateId);
                if (!template) return;

                const start = startOfWeek(new Date(targetDate), { weekStartsOn: 1 });
                const employeesToUpdate: { empId: string, shifts: Shift[] }[] = [];

                if (template.type === 'SINGLE') {
                    // Apply SINGLE template to TARGET employee
                    if (!targetEmployeeId || !template.singleShifts) return;

                    const empShifts: Shift[] = [];
                    for (let i = 0; i < 7; i++) {
                        if (template.singleShifts[i]) {
                            const targetDayStr = format(addDays(start, i), 'yyyy-MM-dd');
                            empShifts.push({
                                ...template.singleShifts[i],
                                date: targetDayStr,
                                id: Math.random().toString(36).substr(2, 9)
                            });
                        }
                    }
                    if (empShifts.length > 0) {
                        employeesToUpdate.push({ empId: targetEmployeeId, shifts: empShifts });
                    }

                } else {
                    // Apply TEAM template (match by ID)
                    if (!template.shifts) return;

                    state.schedule.employees.forEach(emp => {
                        const empShifts: Shift[] = [];
                        const templateEmpShifts = template.shifts![emp.id];

                        if (templateEmpShifts) {
                            for (let i = 0; i < 7; i++) {
                                if (templateEmpShifts[i]) {
                                    const targetDayStr = format(addDays(start, i), 'yyyy-MM-dd');
                                    empShifts.push({
                                        ...templateEmpShifts[i],
                                        date: targetDayStr,
                                        id: Math.random().toString(36).substr(2, 9)
                                    });
                                }
                            }
                        }
                        if (empShifts.length > 0) {
                            employeesToUpdate.push({ empId: emp.id, shifts: empShifts });
                        }
                    });
                }

                set(currentState => {
                    const newEmployees = currentState.schedule.employees.map(emp => {
                        const update = employeesToUpdate.find(u => u.empId === emp.id);
                        if (update) {
                            const newShifts = { ...emp.shifts };
                            update.shifts.forEach(s => {
                                newShifts[s.date] = s;
                            });
                            return { ...emp, shifts: newShifts };
                        }
                        return emp;
                    });
                    return { schedule: { ...currentState.schedule, employees: newEmployees } };
                });
            },

            deleteTemplate: (id) => set(state => ({
                templates: state.templates.filter(t => t.id !== id)
            })),

            autoFillSchedule: (startDate, endDate, demand) => set(state => ({
                schedule: generateSchedule(state.schedule, startDate, endDate, demand)
            })),

            setShiftColor: (shiftType, color) => set(state => ({
                colorSettings: {
                    ...state.colorSettings,
                    [shiftType]: color
                }
            })),

            updateStaffingRules: (rules) => set({ staffingRules: rules }),

            resetColors: () => set({ colorSettings: {} }),

            updateEmployeePreferences: (employeeId, preferences) => set((state) => ({
                schedule: {
                    ...state.schedule,
                    employees: state.schedule.employees.map(emp =>
                        emp.id === employeeId ? { ...emp, preferences } : emp
                    )
                }
            })), // <-- Tu zamykamy updateEmployeePreferences i dajemy przecinek

            // Teraz nowa funkcja jako kolejne pole obiektu głównego store'a
            updateORToolsConfig: (newConfig) => set((state) => ({
                ortoolsConfig: {
                    ...state.ortoolsConfig,
                    ...newConfig
                }
            })),

            bulkUpdateShifts: (updates) => set((state) => {
                const newEmployees = state.schedule.employees.map(emp => {
                    // Find all updates for this employee
                    const empUpdates = updates.filter(u => u.employeeId === emp.id);
                    if (empUpdates.length === 0) return emp;

                    const newShifts = { ...emp.shifts };

                    empUpdates.forEach(update => {
                        const { date, type, start, end, contactHours } = update;

                        // Calculate hours logic (duplicated from updateShift - could be extracted)
                        let hours = 0;
                        if (start !== undefined && end !== undefined) {
                            hours = (start < end ? end - start : (24 - start) + end);
                        } else if (['L4', 'UW', 'UZ', 'OP', 'UM', 'UB'].includes(type)) {
                            hours = 8;
                        } else if (type === 'UŻ' || type === 'USW') {
                            hours = (start !== undefined && end !== undefined)
                                ? (start < end ? end - start : (24 - start) + end)
                                : 8;
                        }

                        newShifts[date] = {
                            id: Math.random().toString(36).substr(2, 9),
                            date,
                            type,
                            startHour: start,
                            endHour: end,
                            hours,
                            contactHours
                        };
                    });

                    return { ...emp, shifts: newShifts };
                });

                return {
                    schedule: {
                        ...state.schedule,
                        employees: newEmployees
                    }
                };
            })
        }),
        {
            name: 'harmonogram-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                // Migrate old demand format to new format
                if (state?.ortoolsConfig?.demand) {
                    state.ortoolsConfig.demand = normalizeDemand(state.ortoolsConfig.demand);
                }

                // 🆕 Phase 2: Auto-assign roles to employees without them
                if (state?.schedule?.employees) {
                    state.schedule.employees = state.schedule.employees.map(emp => {
                        if (!emp.roles || emp.roles.length === 0) {
                            // Auto-detect Maria Pankowska and assign LIDER
                            if (emp.name?.includes('Maria') && emp.name?.includes('Pankowska')) {
                                return { ...emp, roles: ['LIDER'] };
                            }
                            // All others get WYCHOWAWCA
                            return { ...emp, roles: ['WYCHOWAWCA'] };
                        }
                        return emp;
                    });
                }
            },
        }
    )
);
