import React, { useState } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { UserPlus, Trash2, X } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export const EmployeeManager: React.FC<Props> = ({ onClose }) => {
    const { schedule, addEmployee, removeEmployee } = useScheduleStore();
    const [newName, setNewName] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            addEmployee(newName.trim());
            setNewName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <UserPlus className="w-6 h-6 text-blue-600" />
                    Zarządzanie Pracownikami
                </h2>

                <form onSubmit={handleAdd} className="mb-6 flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Imię i Nazwisko"
                        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!newName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Dodaj
                    </button>
                </form>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {schedule.employees.map(emp => (
                        <div
                            key={emp.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                        >
                            <span className="font-medium text-gray-700">{emp.name}</span>
                            <button
                                onClick={() => {
                                    if (confirm(`Czy na pewno chcesz usunąć pracownika ${emp.name}?`)) {
                                        removeEmployee(emp.id);
                                    }
                                }}
                                className="text-gray-400 hover:text-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Usuń pracownika"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}

                    {schedule.employees.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                            Brak pracowników. Dodaj kogoś!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
