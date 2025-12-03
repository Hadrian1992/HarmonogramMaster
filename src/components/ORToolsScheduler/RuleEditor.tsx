import { useState } from 'react';
import type { Employee } from '../../types';
import type { ORToolsConstraint } from '../../utils/ortoolsService';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import CustomDatePicker from '../ui/CustomDatePicker';

interface RuleEditorProps {
    employees: Employee[];
    value: ORToolsConstraint[];
    onChange: (value: ORToolsConstraint[]) => void;
}

export default function RuleEditor({ employees, value, onChange }: RuleEditorProps) {
    const [error, setError] = useState<string | null>(null);
    const [newRule, setNewRule] = useState<Partial<ORToolsConstraint>>({
        type: 'ABSENCE',
        isHard: true,
        dateRange: ['', ''],
        date: '',
        description: ''
    });

    const resetForm = () => {
        setNewRule({
            type: 'ABSENCE',
            isHard: true,
            dateRange: ['', ''],
            description: '',
            employeeId: '',
            date: ''
        });
        setError(null);
    };

    const addRule = () => {
        setError(null);

        if (!newRule.employeeId) {
            setError('Wybierz pracownika z listy.');
            return;
        }

        // Walidacja dla Absencji i Wolnego (zakres dat)
        if (newRule.type === 'ABSENCE' || newRule.type === 'FREE_TIME') {
            if (!newRule.dateRange?.[0] || !newRule.dateRange?.[1]) {
                setError('Wprowadź pełny zakres dat (od - do).');
                return;
            }
            if (newRule.dateRange[0] > newRule.dateRange[1]) {
                setError('Data końcowa nie może być wcześniejsza niż początkowa.');
                return;
            }
        }
        // Walidacja dla Preferencji (pojedyncza data)
        else if (newRule.type === 'PREFERENCE') {
            if (!newRule.date) {
                setError('Wybierz datę dla tej preferencji.');
                return;
            }
            if (!newRule.description) {
                newRule.description = 'Preferowana zmiana';
            }
        }

        onChange([...value, newRule as ORToolsConstraint]);
        resetForm();
    };

    const removeRule = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            {/* Lista istniejących reguł */}
            {value.length > 0 ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                            Aktywne reguły ({value.length})
                        </h3>
                    </div>

                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        {value.map((rule, index) => {
                            const employeeName = employees.find(e => e.id === rule.employeeId)?.name || 'Nieznany pracownik';
                            const isAbsence = rule.type === 'ABSENCE';
                            const isFreeTime = rule.type === 'FREE_TIME';

                            return (
                                <div
                                    key={index}
                                    className={`group flex items-center justify-between p-3 rounded-lg border text-sm transition-all hover:shadow-sm ${isAbsence
                                            ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'
                                            : isFreeTime
                                                ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
                                                : 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isAbsence
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                : isFreeTime
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                            }`}>
                                            {employeeName.substring(0, 2).toUpperCase()}
                                        </div>

                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-white truncate">
                                                    {employeeName}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide ${isAbsence
                                                        ? 'text-red-600 bg-red-100/50 dark:text-red-400'
                                                        : isFreeTime
                                                            ? 'text-amber-600 bg-amber-100/50 dark:text-amber-400'
                                                            : 'text-blue-600 bg-blue-100/50 dark:text-blue-400'
                                                    }`}>
                                                    {isAbsence ? 'Absencja' : isFreeTime ? 'Wolne' : 'Preferencja'}
                                                </span>
                                            </div>

                                            <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5 mt-0.5 truncate">
                                                <span>📅 {rule.dateRange ? `${rule.dateRange[0]} ➝ ${rule.dateRange[1]}` : rule.date}</span>
                                                {rule.description && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="italic truncate max-w-[150px]">{rule.description}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeRule(index)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="Usuń regułę"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Brak zdefiniowanych reguł.</p>
                    <p className="text-xs text-gray-400 mt-1">Dodaj absencje (urlopy, L4) lub preferencje grafikowe poniżej.</p>
                </div>
            )}

            {/* Formularz dodawania nowej reguły */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        <Plus size={16} className="text-purple-600" />
                        Nowa reguła
                    </h3>
                    {error && (
                        <div className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded animate-pulse">
                            <AlertCircle size={12} />
                            {error}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Typ reguły */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Typ reguły</label>
                        <div className="flex flex-col gap-1 rounded-lg bg-gray-100 dark:bg-slate-700 p-1">
                            <button
                                onClick={() => setNewRule({ ...newRule, type: 'ABSENCE', isHard: true })}
                                className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${newRule.type === 'ABSENCE'
                                        ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                Absencja
                            </button>
                            <button
                                onClick={() => setNewRule({ ...newRule, type: 'FREE_TIME', isHard: false })}
                                className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${newRule.type === 'FREE_TIME'
                                        ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                Wolne
                            </button>
                            <button
                                onClick={() => setNewRule({ ...newRule, type: 'PREFERENCE', isHard: false })}
                                className={`text-xs font-medium py-1.5 px-2 rounded-md transition-all ${newRule.type === 'PREFERENCE'
                                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                Preferencja
                            </button>
                        </div>
                    </div>

                    {/* Pracownik */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Pracownik</label>
                        <select
                            value={newRule.employeeId || ''}
                            onChange={(e) => setNewRule({ ...newRule, employeeId: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow"
                        >
                            <option value="">Wybierz pracownika...</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Pola warunkowe */}
                    {newRule.type === 'ABSENCE' || newRule.type === 'FREE_TIME' ? (
                        <div className="md:col-span-6 grid grid-cols-2 gap-3">
                            <CustomDatePicker
                                value={newRule.dateRange?.[0] || ''}
                                onChange={(date) => setNewRule({ ...newRule, dateRange: [date, newRule.dateRange?.[1] || ''] })}
                                label="Data początkowa"
                            />
                            <CustomDatePicker
                                value={newRule.dateRange?.[1] || ''}
                                onChange={(date) => setNewRule({ ...newRule, dateRange: [newRule.dateRange?.[0] || '', date] })}
                                label="Data końcowa"
                            />
                        </div>
                    ) : (
                        <div className="md:col-span-6 grid grid-cols-2 gap-3">
                            <CustomDatePicker
                                value={newRule.date || ''}
                                onChange={(date) => setNewRule({ ...newRule, date })}
                                label="Data preferencji"
                            />
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Szczegóły (opcjonalne)</label>
                                <input
                                    type="text"
                                    placeholder="np. Zmiana poranna, Wolne"
                                    value={newRule.description || ''}
                                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder:text-gray-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* Przyciski akcji */}
                    <div className="md:col-span-12 flex justify-end gap-2 mt-2">
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Wyczyść
                        </button>
                        <button
                            onClick={addRule}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Dodaj regułę
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
