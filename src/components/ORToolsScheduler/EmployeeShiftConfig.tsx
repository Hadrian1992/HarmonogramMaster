import { useEffect, useState } from "react";
import type { Employee } from "../../types";
import type { ORToolsEmployee } from "../../utils/ortoolsService";
import { Plus, X, Clock } from 'lucide-react';
import RoleSelector from './RoleSelector';
import type { EmployeeRole } from '../../types/roles';

interface EmployeeShiftConfigProps {
    employees: Employee[];
    value: ORToolsEmployee[];
    onChange: (value: ORToolsEmployee[]) => void;
}

const DEFAULT_SHIFTS = ['8-16', '8-18', '8-20', '10-20', '14-20', '8-20', '20-8'];
const MARIA_SHIFTS = ['8-14', '8-15', '8-16', '8-20', '10-20'];

export default function EmployeeShiftConfig({ employees, value, onChange }: EmployeeShiftConfigProps) {

    // Stan lokalny do przechowywania wartości w inputach dla każdego pracownika
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    // Initialize & Synchronize
    useEffect(() => {
        // 1. Inicjalizacja: Jeśli w konfiguracji (value) nie ma nikogo, a są pracownicy w systemie
        // Oznacza to pierwsze wejście do modułu.
        if (employees.length > 0 && value.length === 0) {
            const initial = employees.map(emp => ({
                id: emp.id,
                name: emp.name,
                roles: emp.roles || ['WYCHOWAWCA'],  // 🆕 Sync roles from Employee
                allowedShifts: emp.roles?.includes('LIDER') ? [...MARIA_SHIFTS] : [...DEFAULT_SHIFTS],
                preferences: {},
                specialRules: {}
            }));
            onChange(initial);
            return;
        }

        // 2. Synchronizacja: Jeśli liczba pracowników w systemie jest większa niż w konfiguracji
        // (np. dodano nowego pracownika w głównym panelu).
        if (value.length > 0 && employees.length > value.length) {
            const existingIds = new Set(value.map(e => e.id));

            const newEmployees = employees
                .filter(e => !existingIds.has(e.id))
                .map(emp => ({
                    id: emp.id,
                    name: emp.name,
                    roles: emp.roles || ['WYCHOWAWCA'],  // 🆕 Sync roles
                    allowedShifts: [...DEFAULT_SHIFTS],
                    preferences: {},
                    specialRules: {}
                }));

            if (newEmployees.length > 0) {
                // Dodajemy nowych do istniejącej konfiguracji, nie nadpisując starych!
                onChange([...value, ...newEmployees]);
            }
        }

        // 3. Synchronizacja: Jeśli liczba pracowników w systemie jest mniejsza
        // (np. usunięto pracownika), usuwamy go z konfiguracji.
        if (value.length > 0 && employees.length < value.length) {
            const currentEmployeeIds = new Set(employees.map(e => e.id));
            const cleanedConfig = value.filter(emp => currentEmployeeIds.has(emp.id));

            if (cleanedConfig.length !== value.length) {
                onChange(cleanedConfig);
            }
        }

    }, [employees.length, value.length, onChange]); // Zależność tylko od długości tablic

    const updateEmployee = (id: string, shifts: string[]) => {
        const updated = value.map(emp =>
            emp.id === id ? { ...emp, allowedShifts: shifts } : emp
        );
        onChange(updated);
    };

    // 🆕 Phase 2: Update employee roles
    const updateEmployeeRoles = (id: string, roles: EmployeeRole[]) => {
        const updated = value.map(emp =>
            emp.id === id ? { ...emp, roles: roles as string[] } : emp
        );
        onChange(updated);
    };

    const handleInputChange = (id: string, text: string) => {
        setInputs(prev => ({ ...prev, [id]: text }));
        // Resetuj błąd przy pisaniu
        if (errors[id]) {
            setErrors(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleAddShift = (empId: string) => {
        const val = inputs[empId];
        if (!val) return;

        // Walidacja formatu GG-GG lub G-G
        if (!val.match(/^\d{1,2}-\d{1,2}$/)) {
            setErrors(prev => ({ ...prev, [empId]: true }));
            return;
        }

        const emp = value.find(e => e.id === empId);
        if (emp && !emp.allowedShifts.includes(val)) {
            updateEmployee(empId, [...emp.allowedShifts, val]);
            setInputs(prev => ({ ...prev, [empId]: '' })); // Wyczyść input
        }
    };

    const handleRemoveShift = (empId: string, shiftToRemove: string) => {
        const emp = value.find(e => e.id === empId);
        if (emp) {
            const newShifts = emp.allowedShifts.filter(s => s !== shiftToRemove);
            updateEmployee(empId, newShifts);
        }
    };

    return (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {value.map(emp => (
                <div key={emp.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600/50 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-xs">
                                {emp.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {emp.name}
                            </div>
                        </div>
                    </div>

                    {/* 🆕 Phase 2: Role Selector */}
                    <div className="mb-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">Role:</div>
                        <RoleSelector
                            employeeId={emp.id}
                            currentRoles={(emp.roles || []) as EmployeeRole[]}
                            onChange={(roles) => updateEmployeeRoles(emp.id, roles)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                        {emp.allowedShifts.map(shift => (
                            <div key={shift} className="group flex items-center gap-1.5 bg-white dark:bg-slate-800 pl-2.5 pr-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm">
                                <Clock size={10} className="text-slate-400" />
                                {shift}
                                <button
                                    onClick={() => handleRemoveShift(emp.id, shift)}
                                    className="ml-1 p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Usuń zmianę"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add Custom Shift */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-[120px]">
                            <input
                                type="text"
                                placeholder="np. 7-15"
                                value={inputs[emp.id] || ''}
                                onChange={(e) => handleInputChange(emp.id, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddShift(emp.id)}
                                className={`w-full px-2 py-1.5 text-xs border rounded bg-white dark:bg-slate-800 dark:text-white outline-none transition-all ${errors[emp.id]
                                    ? 'border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/30'
                                    : 'border-slate-200 dark:border-slate-600 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/20'
                                    }`}
                            />
                        </div>
                        <button
                            onClick={() => handleAddShift(emp.id)}
                            className="p-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 text-slate-600 dark:text-slate-300 rounded transition-colors"
                            title="Dodaj zmianę"
                        >
                            <Plus size={14} />
                        </button>
                        {errors[emp.id] && (
                            <span className="text-[10px] text-red-500 animate-pulse">
                                Błędny format (użyj GG-GG)
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
