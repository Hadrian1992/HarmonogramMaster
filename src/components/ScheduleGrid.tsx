import React, { useState, useRef } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { getDaysInMonth, format, setDate, isWeekend, startOfWeek, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { ShiftType } from '../types';
import clsx from 'clsx';
import { FileDown, Download, Upload, Copy, ClipboardPaste, LayoutTemplate, Plus, Trash2, Play, Wand2, X, Palette } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';
import { exportScheduleData, importScheduleData } from '../utils/dataBackup';

export const ScheduleGrid: React.FC = () => {
    const { schedule, updateShift, setManualContactHours, restoreSchedule, copyDay, pasteDay, copiedDay, templates: weeklyTemplates, saveTemplate, applyTemplate: applyWeeklyTemplate, deleteTemplate, autoFillSchedule, colorSettings, setShiftColor, resetColors } = useScheduleStore();
    const [editingCell, setEditingCell] = useState<{ empId: string, date: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editingContactHours, setEditingContactHours] = useState<string | null>(null);
    const [contactHoursValue, setContactHoursValue] = useState('0');
    const [showTemplates, setShowTemplates] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [showColorSettings, setShowColorSettings] = useState(false);
    const [generatorDemand, setGeneratorDemand] = useState({ morning: 2, afternoon: 2, night: 1 });
    const [generatorDateRange, setGeneratorDateRange] = useState({ start: '', end: '' });
    const [newTemplateName, setNewTemplateName] = useState('');
    const [templateSourceDate, setTemplateSourceDate] = useState('');
    const [templateTargetDate, setTemplateTargetDate] = useState('');
    const [selectedSourceEmployee, setSelectedSourceEmployee] = useState<string>('all');
    const [selectedTargetEmployee, setSelectedTargetEmployee] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!confirm('Czy na pewno chcesz zaimportować dane? To zastąpi obecny harmonogram.')) {
            event.target.value = '';
            return;
        }

        importScheduleData(
            file,
            (importedSchedule) => {
                restoreSchedule(importedSchedule);
                alert('Dane zostały pomyślnie zaimportowane!');
                event.target.value = '';
            },
            (error) => {
                alert(`Błąd importu: ${error}`);
                event.target.value = '';
            }
        );
    };

    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        return setDate(new Date(schedule.year, schedule.month - 1), i + 1);
    });

    // Helper: Calculate weeks in month
    const getWeeksInMonth = () => {
        const weeks: { start: number; end: number; weekIndex: number }[] = [];
        let currentDay = 1;
        let weekIndex = 1;

        while (currentDay <= daysInMonth) {
            const date = new Date(schedule.year, schedule.month - 1, currentDay);
            const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday
            const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            const weekStart = currentDay - mondayOffset;
            const weekEnd = weekStart + 6;

            weeks.push({
                start: Math.max(1, weekStart),
                end: Math.min(daysInMonth, weekEnd),
                weekIndex
            });

            currentDay = weekEnd + 1;
            weekIndex++;
        }

        return weeks;
    };

    const weeksInMonth = getWeeksInMonth();

    // Helper: Calculate weekly hours for employee
    const getWeeklyHours = (emp: typeof schedule.employees[0], weekStart: number, weekEnd: number) => {
        let workHours = 0;
        let contactHours = 0;

        for (let day = weekStart; day <= weekEnd; day++) {
            const dateStr = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shift = emp.shifts[dateStr];

            if (!shift) continue;

            if (shift.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(shift.type)) {
                workHours += shift.hours;
            }

            contactHours += (shift.contactHours || (shift.type === 'K' ? shift.hours : 0));
        }

        return { workHours, contactHours, total: workHours + contactHours };
    };


    const handleCellClick = (empId: string, date: string, currentVal: string) => {
        setEditingCell({ empId, date });
        setEditValue(currentVal);
    };

    const saveShift = (val: string) => {
        if (!editingCell) return;

        const value = val.toUpperCase().trim();
        let type: ShiftType = 'WORK';
        let start: number | undefined;
        let end: number | undefined;
        let contactHours: number | undefined;

        // Get existing shift to potentially inherit hours
        const existingShift = schedule.employees
            .find(e => e.id === editingCell.empId)
            ?.shifts[editingCell.date];

        if (/^K\s*\d+[-/]\d+$/.test(value)) {
            type = 'K';
            const timePart = value.substring(1).trim();
            const parts = timePart.split(/[-/]/);
            if (parts.length === 2) {
                start = parseInt(parts[0]);
                end = parseInt(parts[1]);
                if (!isNaN(start) && !isNaN(end)) {
                    contactHours = (start < end ? end - start : (24 - start) + end);
                }
            }
        } else {
            const kMatch = value.match(/K\s*(\d+)/);
            let cleanVal = value;

            if (kMatch) {
                contactHours = parseInt(kMatch[1]);
                cleanVal = value.replace(kMatch[0], '').trim();
            }

            if (cleanVal === '') {
                if (contactHours !== undefined) {
                    type = 'K';
                } else if (value === 'K') {
                    type = 'K';
                } else {
                    type = 'W';
                }
            } else if (['L4', 'UW', 'UZ', 'OP', 'W', 'NN', 'UB', 'WYCH', 'UŻ', 'UM', 'USW'].includes(cleanVal)) {
                type = cleanVal as ShiftType;

                // Auto-assign hours for absence types
                if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(type)) {
                    if (type === 'UW') {
                        // UW (vacation) always gets 8-16
                        start = 8;
                        end = 16;
                    } else {
                        // Other absences: inherit from existing shift or default to 8-16
                        if (existingShift?.startHour !== undefined && existingShift?.endHour !== undefined) {
                            start = existingShift.startHour;
                            end = existingShift.endHour;
                        } else {
                            start = 8;
                            end = 16;
                        }
                    }
                }
            } else {
                const parts = cleanVal.split(/[-/]/);
                if (parts.length === 2) {
                    start = parseInt(parts[0]);
                    end = parseInt(parts[1]);
                    if (isNaN(start) || isNaN(end)) {
                        type = 'W';
                    } else {
                        type = 'WORK';
                    }
                } else {
                    type = 'W';
                }
            }
        }

        updateShift(editingCell.empId, editingCell.date, type, start, end, contactHours);
        setEditingCell(null);
    };

    const handleSave = () => {
        saveShift(editValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const applyTemplate = (val: string) => {
        if (!editingCell) return;
        saveShift(val);
    };

    const templates = [
        { label: '8-14', value: '8-14', color: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700', tooltip: 'Zmiana 8-14' },
        { label: '8-15', value: '8-15', color: 'bg-teal-50 hover:bg-teal-100 text-teal-700', tooltip: 'Zmiana 8-15' },
        { label: '8-16', value: '8-16', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700', tooltip: 'Zmiana 8-16' },
        { label: 'D (8-20)', value: '8-20', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800', tooltip: 'Dzień (8-20)' },
        { label: '14-20', value: '14-20', color: 'bg-sky-50 hover:bg-sky-100 text-sky-700', tooltip: 'Zmiana 14-20' },
        { label: 'N (20-8)', value: '20-8', color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800', tooltip: 'Noc (20-8)' },
        { label: 'K 4h', value: 'K 4', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800', tooltip: 'Godziny kontaktów (4h)' },
        { label: 'Wolne', value: 'W', color: 'bg-gray-100 hover:bg-gray-200 text-gray-800', tooltip: 'Dzień wolny' },
        { label: 'UW', value: 'UW', color: 'bg-green-100 hover:bg-green-200 text-green-800', tooltip: 'Urlop Wypoczynkowy' },
        { label: 'UŻ', value: 'UŻ', color: 'bg-teal-100 hover:bg-teal-200 text-teal-800', tooltip: 'Urlop na Żądanie (4 dni/rok)' },
        { label: 'UM', value: 'UM', color: 'bg-pink-100 hover:bg-pink-200 text-pink-800', tooltip: 'Urlop Macierzyński' },
        { label: 'USW', value: 'USW', color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800', tooltip: 'Urlop Siła Wyższa (16h/rok, 50% płatny)' },
        { label: 'UB', value: 'UB', color: 'bg-slate-100 hover:bg-slate-200 text-slate-800', tooltip: 'Urlop Bezpłatny' },
        { label: 'L4', value: 'L4', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800', tooltip: 'Zwolnienie lekarskie (L4)' },
    ];

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2 items-center p-3 bg-white rounded-lg border shadow-sm">
                <input
                    type="text"
                    placeholder="🔍 Szukaj pracownika..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1"
                        title="Wyczyść wyszukiwanie"
                    >
                        <X size={16} />
                        Wyczyść
                    </button>
                )}
                {searchQuery && (
                    <span className="text-xs text-gray-500">
                        {schedule.employees.filter(emp =>
                            emp.name.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length} wyników
                    </span>
                )}
            </div>

            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border">
                <span className="text-sm font-medium text-gray-500 self-center mr-2">Szybkie wstawianie:</span>
                {templates.map(t => (
                    <button
                        key={t.label}
                        title={t.tooltip}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            if (editingCell) {
                                applyTemplate(t.value);
                            } else {
                                alert('Najpierw kliknij komórkę w tabeli, którą chcesz edytować.');
                            }
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${t.color}`}
                    >
                        {t.label}
                    </button>
                ))}
                <div className="flex-1"></div>
                <button
                    onClick={() => exportScheduleData(schedule)}
                    className="px-4 py-1.5 text-xs font-medium rounded border transition-colors bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300 flex items-center gap-2"
                    title="Eksportuj wszystkie dane do pliku JSON (backup)"
                >
                    <Download size={14} />
                    Eksportuj Dane
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-1.5 text-xs font-medium rounded border transition-colors bg-green-100 hover:bg-green-200 text-green-800 border-green-300 flex items-center gap-2"
                    title="Importuj dane z pliku JSON (przywróć backup)"
                >
                    <Upload size={14} />
                    Importuj Dane
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImport}
                />
                <button
                    onClick={() => exportToPDF(schedule)}
                    className="px-4 py-1.5 text-xs font-medium rounded border transition-colors bg-red-100 hover:bg-red-200 text-red-800 border-red-300 flex items-center gap-2"
                    title="Eksportuj harmonogram do PDF"
                >
                    <FileDown size={14} />
                    Eksportuj PDF
                </button>
                <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className={clsx(
                        "px-4 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-2",
                        showTemplates ? "bg-purple-200 text-purple-900 border-purple-400" : "bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300"
                    )}
                    title="Zarządzaj szablonami tygodniowymi"
                >
                    <LayoutTemplate size={14} />
                    Szablony
                </button>
                <button
                    onClick={() => {
                        // Default range: current week
                        const start = startOfWeek(new Date(schedule.year, schedule.month - 1, 1), { weekStartsOn: 1 });
                        const end = addDays(start, 6);
                        setGeneratorDateRange({
                            start: format(start, 'yyyy-MM-dd'),
                            end: format(end, 'yyyy-MM-dd')
                        });
                        setShowGenerator(true);
                    }}
                    className="hidden px-4 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300"
                    title="Inteligentny Asystent (Auto-Wypełnianie)"
                >
                    <Wand2 size={14} />
                    Asystent AI
                </button>
                <button
                    onClick={() => setShowColorSettings(true)}
                    className={clsx(
                        "px-4 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-2",
                        showColorSettings ? "bg-pink-200 text-pink-900 border-pink-400" : "bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-300"
                    )}
                    title="Personalizacja kolorów zmian"
                >
                    <Palette size={14} />
                    Kolory
                </button>
            </div>

            {/* Color Settings Modal */}
            {showColorSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-pink-800 flex items-center gap-2">
                                <Palette size={20} />
                                Personalizacja Kolorów
                            </h3>
                            <button onClick={() => setShowColorSettings(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            Dostosuj kolory dla różnych typów zmian. Kolory są zapisywane automatycznie.
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {[
                                { type: '8-14', label: 'Zmiana 8-14' },
                                { type: '8-15', label: 'Zmiana 8-15' },
                                { type: '8-16', label: 'Zmiana 8-16' },
                                { type: '8-20', label: 'Dzień (8-20)' },
                                { type: '14-20', label: 'Zmiana 14-20' },
                                { type: '20-8', label: 'Noc (20-8)' },
                                { type: 'L4', label: 'L4 (Chorobowe)' },
                                { type: 'UW', label: 'Urlop Wypoczynkowy' },
                                { type: 'UŻ', label: 'Urlop na Żądanie' },
                                { type: 'USW', label: 'Urlop Siła Wyższa' },
                                { type: 'K', label: 'Kontakty' },
                                { type: 'W', label: 'Wolne' },
                            ].map(shift => (
                                <div key={shift.type} className="flex items-center gap-3 p-2 border rounded">
                                    <input
                                        type="color"
                                        value={colorSettings[shift.type] || '#ffffff'}
                                        onChange={(e) => setShiftColor(shift.type, e.target.value)}
                                        className="w-12 h-8 border rounded cursor-pointer"
                                    />
                                    <div>
                                        <div className="font-medium text-sm">{shift.label}</div>
                                        <div className="text-xs text-gray-500">{shift.type}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                if (confirm('Czy na pewno chcesz przywrócić domyślne kolory?')) {
                                    resetColors();
                                }
                            }}
                            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                        >
                            Przywróć domyślne kolory
                        </button>
                    </div>
                </div>
            )}

            {/* Generator Modal */}
            {showGenerator && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
                                <Wand2 size={20} />
                                Asystent AI
                            </h3>
                            <button onClick={() => setShowGenerator(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 bg-indigo-50 rounded text-sm text-indigo-700">
                                Asystent wypełni <strong>puste pola</strong> w wybranym zakresie, dbając o prawo pracy i sprawiedliwość.
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Od dnia</label>
                                    <input
                                        type="date"
                                        value={generatorDateRange.start}
                                        onChange={(e) => setGeneratorDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Do dnia</label>
                                    <input
                                        type="date"
                                        value={generatorDateRange.end}
                                        onChange={(e) => setGeneratorDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm border rounded"
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Zapotrzebowanie na zmiany:</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Rano (8-16)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={generatorDemand.morning}
                                            onChange={(e) => setGeneratorDemand(prev => ({ ...prev, morning: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Popołudnie (14-20)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={generatorDemand.afternoon}
                                            onChange={(e) => setGeneratorDemand(prev => ({ ...prev, afternoon: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Noc (20-8)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={generatorDemand.night}
                                            onChange={(e) => setGeneratorDemand(prev => ({ ...prev, night: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (confirm('Czy na pewno chcesz wygenerować grafik? Asystent wypełni tylko puste pola.')) {
                                        autoFillSchedule(generatorDateRange.start, generatorDateRange.end, generatorDemand);
                                        setShowGenerator(false);
                                        alert('Grafik wygenerowany! Sprawdź sugestie asystenta.');
                                    }
                                }}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Wand2 size={16} />
                                Generuj Grafik
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Templates Panel */}
            {showTemplates && (
                <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Save New Template */}
                        <div className="flex-1 space-y-3 border-r pr-6">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <Plus size={16} />
                                Utwórz nowy szablon
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa szablonu</label>
                                    <input
                                        type="text"
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        placeholder="np. Tydzień A"
                                        className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Tydzień źródłowy (wybierz dowolny dzień)</label>
                                    <input
                                        type="date"
                                        value={templateSourceDate}
                                        onChange={(e) => setTemplateSourceDate(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Źródło (Cały zespół lub pracownik)</label>
                                    <select
                                        value={selectedSourceEmployee}
                                        onChange={(e) => setSelectedSourceEmployee(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                                    >
                                        <option value="all">Cały zespół</option>
                                        {schedule.employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={() => {
                                        if (!newTemplateName || !templateSourceDate) {
                                            alert('Podaj nazwę i datę!');
                                            return;
                                        }
                                        saveTemplate(newTemplateName, templateSourceDate, selectedSourceEmployee === 'all' ? undefined : selectedSourceEmployee);
                                        setNewTemplateName('');
                                        alert('Szablon zapisany!');
                                    }}
                                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors"
                                >
                                    Zapisz Szablon
                                </button>
                            </div>
                        </div>

                        {/* Apply Templates */}
                        <div className="flex-[2] space-y-3">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <LayoutTemplate size={16} />
                                Dostępne szablony
                            </h3>

                            <div className="flex items-center gap-3 mb-4 bg-gray-50 p-2 rounded border">
                                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Wklej do tygodnia od:</label>
                                <input
                                    type="date"
                                    value={templateTargetDate}
                                    onChange={(e) => setTemplateTargetDate(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <span className="text-xs text-gray-400">(Wybierz poniedziałek docelowego tygodnia)</span>
                            </div>

                            {weeklyTemplates.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">Brak zapisanych szablonów.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {weeklyTemplates.map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:border-purple-300 transition-colors">
                                            <span className="font-medium text-gray-700 flex flex-col">
                                                {t.name}
                                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                                    {t.type === 'SINGLE' ? 'Pojedynczy' : 'Zespół'}
                                                </span>
                                            </span>
                                            <div className="flex gap-2 items-center">
                                                {t.type === 'SINGLE' && (
                                                    <select
                                                        value={selectedTargetEmployee}
                                                        onChange={(e) => setSelectedTargetEmployee(e.target.value)}
                                                        className="w-32 px-1 py-1 text-xs border rounded focus:ring-1 focus:ring-purple-500 outline-none"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <option value="">Wybierz...</option>
                                                        {schedule.employees.map(emp => (
                                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (!templateTargetDate) {
                                                            alert('Wybierz datę docelową!');
                                                            return;
                                                        }
                                                        if (t.type === 'SINGLE' && !selectedTargetEmployee) {
                                                            alert('Wybierz pracownika docelowego!');
                                                            return;
                                                        }
                                                        if (confirm(`Czy na pewno chcesz zastosować szablon "${t.name}"? To nadpisze istniejące zmiany.`)) {
                                                            applyWeeklyTemplate(t.id, templateTargetDate, t.type === 'SINGLE' ? selectedTargetEmployee : undefined);
                                                        }
                                                    }}
                                                    className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                                    title="Zastosuj szablon"
                                                >
                                                    <Play size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Czy usunąć ten szablon?')) {
                                                            deleteTemplate(t.id);
                                                        }
                                                    }}
                                                    className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                                    title="Usuń szablon"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto border rounded-lg shadow bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">
                                Pracownik
                            </th>
                            {days.map((day, dayIndex) => {
                                const dayNum = dayIndex + 1;
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isCopied = copiedDay?.date === dateStr;
                                const canPaste = !!copiedDay && copiedDay.date !== dateStr;
                                const isLastDayOfWeek = weeksInMonth.find(w => w.end === dayNum);

                                return (
                                    <React.Fragment key={day.toString()}>
                                        <th className={clsx(
                                            "px-1 py-2 text-center text-xs font-medium text-gray-500 border-r min-w-[40px] group relative",
                                            isWeekend(day) && "bg-red-50",
                                            isCopied && "bg-blue-100 ring-2 ring-blue-500 ring-inset"
                                        )}>
                                            <div>{format(day, 'dd')}</div>
                                            <div>{format(day, 'EE', { locale: pl })}</div>

                                            {/* Copy/Paste Actions */}
                                            <div className="flex justify-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => copyDay(dateStr)}
                                                    className="p-0.5 hover:bg-blue-200 rounded text-blue-600"
                                                    title="Kopiuj dzień"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                                {canPaste && (
                                                    <button
                                                        onClick={() => {
                                                            const { success, conflicts } = pasteDay(dateStr, false);
                                                            if (!success && conflicts.length > 0) {
                                                                if (confirm(`Konflikt zmian dla pracowników:\\n${conflicts.join(', ')}\\n\\nCzy chcesz nadpisać istniejące zmiany?`)) {
                                                                    pasteDay(dateStr, true);
                                                                }
                                                            }
                                                        }}
                                                        className="p-0.5 hover:bg-green-200 rounded text-green-600"
                                                        title={`Wklej zmiany z dnia ${copiedDay.date}`}
                                                    >
                                                        <ClipboardPaste size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                        {isLastDayOfWeek && (
                                            <th className="px-2 py-2 text-center text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 border-l-2 border-r-2 border-blue-300">
                                                T{isLastDayOfWeek.weekIndex}
                                            </th>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 border-l">
                                L. Zmian
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 border-l">
                                Godz. K.
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 border-l">
                                Suma
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {schedule.employees
                            .filter(emp => {
                                if (!searchQuery) return true;
                                return emp.name.toLowerCase().includes(searchQuery.toLowerCase());
                            })
                            .map(emp => {
                                // FILTER: Only shifts from current month
                                const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
                                const monthShifts = Object.values(emp.shifts).filter(s => s.date.startsWith(monthKey));

                                const totalHours = monthShifts.reduce((acc, s) => {
                                    if (s.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)) {
                                        return acc + s.hours;
                                    }
                                    return acc;
                                }, 0);

                                // Automatic contact hours from shifts - ONLY CURRENT MONTH
                                const autoContactHours = monthShifts.reduce((acc, s) =>
                                    acc + (s.contactHours || (s.type === 'K' ? s.hours : 0)), 0
                                );

                                // Manual contact hours for this month
                                const manualContactHours = emp.monthlyContactHours?.[monthKey] || 0;

                                // Total contact hours (automatic + manual)
                                const contactHours = autoContactHours + manualContactHours;

                                // Shift count - ONLY CURRENT MONTH
                                const shiftCount = monthShifts.filter(s => s.type === 'WORK').length;

                                // Total hours including manual contact hours
                                const totalWithContact = totalHours + manualContactHours;

                                return (
                                    <tr
                                        key={emp.id}
                                        className={clsx(
                                            searchQuery && "ring-2 ring-blue-400 bg-blue-50/50"
                                        )}
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white z-10 border-r">
                                            {emp.name}
                                        </td>
                                        {days.map((day, dayIndex) => {
                                            const dayNum = dayIndex + 1;
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const shift = emp.shifts[dateStr];
                                            const isEditing = editingCell?.empId === emp.id && editingCell?.date === dateStr;
                                            const isLastDayOfWeek = weeksInMonth.find(w => w.end === dayNum);

                                            let display = '/';
                                            if (shift) {
                                                if (shift.type === 'WORK') {
                                                    display = `${shift.startHour}/${shift.endHour}`;
                                                    if (shift.contactHours) {
                                                        display += ` K${shift.contactHours}`;
                                                    }
                                                } else if (shift.type === 'K') {
                                                    if (shift.startHour !== undefined && shift.endHour !== undefined) {
                                                        display = `K ${shift.startHour}-${shift.endHour}`;
                                                    } else if (shift.contactHours) {
                                                        display = `K ${shift.contactHours}`;
                                                    } else {
                                                        display = 'K';
                                                    }
                                                } else if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(shift.type)) {
                                                    // Show shift hours for absence types
                                                    if (shift.startHour !== undefined && shift.endHour !== undefined) {
                                                        display = `${shift.type} (${shift.startHour}-${shift.endHour})`;
                                                    } else {
                                                        display = shift.type;
                                                    }
                                                } else if (shift.type === 'W') {
                                                    display = '/';
                                                } else {
                                                    display = shift.type;
                                                }
                                            }

                                            return (
                                                <React.Fragment key={dateStr}>
                                                    <td
                                                        className={clsx(
                                                            "px-1 py-1 text-center border-r cursor-pointer hover:bg-blue-50",
                                                            isWeekend(day) && "bg-red-50/30",
                                                            !colorSettings[shift?.type || ''] && shift?.type === 'L4' && "bg-orange-100",
                                                            !colorSettings[shift?.type || ''] && shift?.type === 'UW' && "bg-green-100",
                                                            !colorSettings[shift?.type || ''] && shift?.type === 'K' && "bg-purple-100",
                                                            isEditing && "p-0"
                                                        )}
                                                        style={{
                                                            backgroundColor: shift?.type && colorSettings[shift.type]
                                                                ? colorSettings[shift.type]
                                                                : undefined
                                                        }}
                                                        onClick={() => {
                                                            if (!isEditing) {
                                                                handleCellClick(emp.id, dateStr, display === '/' ? '' : display);
                                                            }
                                                        }}
                                                    >
                                                        {isEditing ? (
                                                            <input
                                                                autoFocus
                                                                className="w-full h-full text-center border-2 border-blue-500 outline-none"
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                onBlur={handleSave}
                                                                onKeyDown={handleKeyDown}
                                                            />
                                                        ) : (
                                                            <span className="block w-full h-full py-1 text-xs">{display}</span>
                                                        )}
                                                    </td>
                                                    {isLastDayOfWeek && (() => {
                                                        const weekHours = getWeeklyHours(emp, isLastDayOfWeek.start, isLastDayOfWeek.end);
                                                        return (
                                                            <td className="px-2 py-2 text-center text-xs font-bold bg-blue-50 border-l-2 border-r-2 border-blue-300">
                                                                <div className="text-blue-900">{weekHours.total}h</div>
                                                                <div className="text-[10px] text-gray-600">({weekHours.workHours}+{weekHours.contactHours})</div>
                                                            </td>
                                                        );
                                                    })()}
                                                </React.Fragment>
                                            );
                                        })}
                                        <td className="px-3 py-2 whitespace-nowrap text-center font-medium text-blue-600 sticky right-0 bg-white z-10 border-l">
                                            {shiftCount}
                                        </td>
                                        <td
                                            className="px-3 py-2 whitespace-nowrap text-center font-medium text-purple-700 sticky right-0 bg-white z-10 border-l cursor-pointer hover:bg-purple-50"
                                            onClick={() => {
                                                setEditingContactHours(emp.id);
                                                setContactHoursValue(String(manualContactHours));
                                            }}
                                            title={`Automatyczne: ${autoContactHours}h | Ręczne: ${manualContactHours}h | Kliknij aby edytować ręczne godziny`}
                                        >
                                            {editingContactHours === emp.id ? (
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    min="0"
                                                    className="w-20 text-center border-2 border-purple-500 outline-none rounded px-1"
                                                    value={contactHoursValue}
                                                    onChange={e => setContactHoursValue(e.target.value)}
                                                    onBlur={() => {
                                                        const hours = parseFloat(contactHoursValue) || 0;
                                                        setManualContactHours(emp.id, schedule.month, schedule.year, hours);
                                                        setEditingContactHours(null);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            const hours = parseFloat(contactHoursValue) || 0;
                                                            setManualContactHours(emp.id, schedule.month, schedule.year, hours);
                                                            setEditingContactHours(null);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingContactHours(null);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <span>{contactHours}h</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-center font-bold sticky right-0 bg-white z-10 border-l">
                                            {totalWithContact}h
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {/* Leave Usage Summary */}
            {
                schedule.employees.some(emp => {
                    const hasUz = Object.values(emp.shifts).some(s => s.type === 'UŻ' && s.date.startsWith(schedule.year.toString()));
                    const hasUsw = Object.values(emp.shifts).some(s => s.type === 'USW' && s.date.startsWith(schedule.year.toString()));
                    return hasUz || hasUsw;
                }) && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                        <h3 className="font-bold text-amber-900 mb-3">Wykorzystanie urlopów specjalnych w {schedule.year} roku:</h3>
                        <div className="space-y-2">
                            {schedule.employees.map(emp => {
                                const uzDays = Object.values(emp.shifts).filter(s =>
                                    s.type === 'UŻ' && s.date.startsWith(schedule.year.toString())
                                ).length;
                                const uswHours = Object.values(emp.shifts).reduce((acc, s) =>
                                    (s.type === 'USW' && s.date.startsWith(schedule.year.toString())) ? acc + s.hours : acc
                                    , 0);

                                if (uzDays === 0 && uswHours === 0) return null;

                                return (
                                    <div key={emp.id} className="flex items-center gap-4 text-sm">
                                        <span className="font-medium text-gray-700 min-w-[200px]">{emp.name}:</span>
                                        {uzDays > 0 && (
                                            <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded">
                                                UŻ: {uzDays}/4 dni
                                            </span>
                                        )}
                                        {uswHours > 0 && (
                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                                USW: {uswHours}/16h
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 text-xs text-amber-800">
                            <p>• UŻ (Urlop na Żądanie): 4 dni w roku kalendarzowym, liczony według godzin zmian</p>
                            <p>• USW (Urlop Siła Wyższa): 16h w roku kalendarzowym (2 dni), 50% płatny</p>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
