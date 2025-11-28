import React, { useState } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { UserPlus, Trash2, X, Edit2, Check, Mail } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export const EmployeeManager: React.FC<Props> = ({ onClose }) => {
    const { schedule, addEmployee, removeEmployee, updateEmployee } = useScheduleStore();
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            addEmployee(newName.trim(), newEmail.trim() || undefined);
            setNewName('');
            setNewEmail('');
        }
    };

    const startEditing = (emp: { id: string, name: string, email?: string }) => {
        setEditingId(emp.id);
        setEditName(emp.name);
        setEditEmail(emp.email || '');
    };

    const saveEdit = () => {
        if (editingId && editName.trim()) {
            updateEmployee(editingId, editName.trim(), editEmail.trim() || undefined);
            setEditingId(null);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-30 p-4">
            <div className="w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl text-gray-900 dark:text-white transition-colors border border-white/20 dark:border-slate-700/50 relative">
                <button
                    className="absolute top-3 right-3 text-gray-400 dark:text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    onClick={onClose}
                    title="Zamknij"
                >
                    <X />
                </button>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <UserPlus size={24} />
                    </div>
                    Zarządzanie Pracownikami
                </h2>

                {/* Add Form */}
                <form
                    className="flex flex-col gap-3 my-6 p-4 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-slate-800 dark:to-indigo-900/20 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"
                    onSubmit={handleAdd}
                >
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dodaj nowego pracownika</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Imię i Nazwisko"
                            className="rounded-lg border border-gray-200 dark:border-slate-600 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none dark:bg-slate-700/50 dark:text-white bg-white text-gray-900 transition-all"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <input
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="Email (opcjonalnie)"
                                type="email"
                                className="flex-1 rounded-lg border border-gray-200 dark:border-slate-600 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none dark:bg-slate-700/50 dark:text-white bg-white text-gray-900 transition-all"
                            />
                            <button
                                type="submit"
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-3 rounded-lg transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center"
                                title="Dodaj pracownika"
                            >
                                <UserPlus size={20} />
                            </button>
                        </div>
                    </div>
                </form>

                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
                    {schedule.employees.map(emp => (
                        <div
                            key={emp.id}
                            className="group flex items-center bg-white dark:bg-slate-800/50 px-4 py-3 rounded-xl justify-between border border-gray-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition-all"
                        >
                            {editingId === emp.id ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 pr-2">
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                saveEdit();
                                            } else if (e.key === 'Escape') {
                                                setEditingId(null);
                                            }
                                        }}
                                        className="px-3 py-2 rounded-lg border-2 border-blue-400 outline-none dark:bg-slate-700 focus:ring-2 focus:ring-blue-500/30"
                                        autoFocus
                                    />
                                    <div className="flex gap-2 items-center">
                                        <input
                                            value={editEmail}
                                            onChange={e => setEditEmail(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    saveEdit();
                                                } else if (e.key === 'Escape') {
                                                    setEditingId(null);
                                                }
                                            }}
                                            placeholder="Email"
                                            type="email"
                                            className="flex-1 px-3 py-2 rounded-lg border-2 border-blue-400 outline-none dark:bg-slate-700 focus:ring-2 focus:ring-blue-500/30"
                                        />
                                        <button onClick={saveEdit} className="text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 p-2 rounded-lg transition-colors">
                                            <Check size={18} />
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <span className="font-medium text-gray-800 dark:text-white">{emp.name}</span>
                                        {emp.email ? (
                                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                                <Mail size={14} className="text-indigo-500" /> {emp.email}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400 dark:text-gray-600 italic">Brak email</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 p-2 rounded-lg transition-colors"
                                            title="Edytuj"
                                            onClick={() => startEditing(emp)}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors"
                                            title="Usuń pracownika"
                                            onClick={() => {
                                                if (confirm(`Czy na pewno chcesz usunąć pracownika ${emp.name}?`)) {
                                                    removeEmployee(emp.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {schedule.employees.length === 0 && (
                        <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50/30 dark:from-slate-800 dark:to-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 text-yellow-800 dark:text-yellow-200 text-center">
                            <p className="font-medium">Brak pracowników. Dodaj kogoś!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
