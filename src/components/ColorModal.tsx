import React, { useState } from 'react';
import { X, Plus, Trash2, Palette } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';

interface ColorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_SHIFTS = [
    { label: '8-14', value: '8-14' },
    { label: '8-15', value: '8-15' },
    { label: '8-16', value: '8-16' },
    { label: 'D (8-20)', value: '8-20' },
    { label: '14-20', value: '14-20' },
    { label: 'N (20-8)', value: '20-8' },
    { label: 'K 4h', value: 'K' },
    { label: 'Wolne', value: 'W' },
    { label: 'UW', value: 'UW' },
    { label: 'UŻ', value: 'UŻ' },
    { label: 'UM', value: 'UM' },
    { label: 'USW', value: 'USW' },
    { label: 'UB', value: 'UB' },
    { label: 'L4', value: 'L4' },
];

const DEFAULT_COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#f97316', // orange
    '#64748b', // slate
    '#6b7280', // gray
];

export const ColorModal: React.FC<ColorModalProps> = ({ isOpen, onClose }) => {
    const { colorSettings, setShiftColor, resetColors } = useScheduleStore();
    const [customShiftLabel, setCustomShiftLabel] = useState('');
    const [customShiftValue, setCustomShiftValue] = useState('');

    if (!isOpen) return null;

    const handleAddCustomShift = () => {
        if (!customShiftValue.trim()) return;
        // Set a default color for new shift
        setShiftColor(customShiftValue, DEFAULT_COLORS[0]);
        setCustomShiftLabel('');
        setCustomShiftValue('');
    };

    const handleRemoveShift = (shiftType: string) => {
        const { [shiftType]: removed, ...rest } = colorSettings;
        // This is a bit hacky - we need to reset and then re-add all except the removed one
        resetColors();
        Object.entries(rest).forEach(([type, color]) => {
            setShiftColor(type, color);
        });
    };

    const allShifts = [
        ...DEFAULT_SHIFTS,
        ...Object.keys(colorSettings)
            .filter(key => !DEFAULT_SHIFTS.some(s => s.value === key))
            .map(key => ({ label: key, value: key }))
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Palette className="text-purple-600" size={24} />
                        <h2 className="text-2xl font-bold dark:text-white">Ustawienia Kolorów</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={20} className="dark:text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Ustaw kolory dla różnych typów zmian. Kliknij na kolor aby go zmienić.
                    </p>

                    {/* Shifts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {allShifts.map(shift => {
                            const currentColor = colorSettings[shift.value] || '#3b82f6';
                            const isCustom = !DEFAULT_SHIFTS.some(s => s.value === shift.value);

                            return (
                                <div
                                    key={shift.value}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                                >
                                    <input
                                        type="color"
                                        value={currentColor}
                                        onChange={(e) => setShiftColor(shift.value, e.target.value)}
                                        className="w-12 h-12 rounded cursor-pointer border-2 border-gray-300 dark:border-slate-600"
                                        title={`Wybierz kolor dla ${shift.label}`}
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium dark:text-white">{shift.label}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{currentColor}</div>
                                    </div>
                                    {isCustom && (
                                        <button
                                            onClick={() => handleRemoveShift(shift.value)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Usuń"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Add Custom Shift */}
                    <div className="border-t dark:border-slate-700 pt-6">
                        <h3 className="font-semibold mb-3 dark:text-white flex items-center gap-2">
                            <Plus size={18} />
                            Dodaj Własną Zmianę
                        </h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Nazwa (np. 6-14)"
                                value={customShiftLabel}
                                onChange={(e) => setCustomShiftLabel(e.target.value)}
                                className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                            />
                            <input
                                type="text"
                                placeholder="Wartość (np. 6-14)"
                                value={customShiftValue}
                                onChange={(e) => setCustomShiftValue(e.target.value)}
                                className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                            />
                            <button
                                onClick={handleAddCustomShift}
                                disabled={!customShiftValue.trim()}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Dodaj
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Po dodaniu zmiana pojawi się w quick select pod grafikiem
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-700 flex justify-between">
                    <button
                        onClick={() => {
                            if (confirm('Czy na pewno chcesz przywrócić domyślne kolory?')) {
                                resetColors();
                            }
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Przywróć domyślne
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Gotowe
                    </button>
                </div>
            </div>
        </div>
    );
};
