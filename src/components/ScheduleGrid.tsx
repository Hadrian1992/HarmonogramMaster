import React, { useState, useRef } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { getDaysInMonth, format, setDate, isWeekend } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { ShiftType } from '../types';
import clsx from 'clsx';
import { FileDown, Download, Upload, Copy, ClipboardPaste, LayoutTemplate, Plus, Trash2, Play, X, Palette, Mail, CheckCircle, AlertCircle, UserPlus, Search } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';
import { exportScheduleData, importScheduleData } from '../utils/dataBackup';
import { ShiftBlock } from './ShiftBlock';
import { ReplacementModal } from './ReplacementModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { ScheduleGridMobile } from './ScheduleGridMobile';
import { GlassCard } from './ui/GlassCard';
import { PageHeader } from './ui/PageHeader';
import { GlassButton } from './ui/GlassButton';

export const ScheduleGrid: React.FC = () => {
    const { schedule, updateShift, setManualContactHours, restoreSchedule, copyDay, pasteDay, copiedDay, templates: weeklyTemplates, saveTemplate, applyTemplate: applyWeeklyTemplate, deleteTemplate, colorSettings } = useScheduleStore();
    const [editingCell, setEditingCell] = useState<{ empId: string, date: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editingContactHours, setEditingContactHours] = useState<string | null>(null);
    const [contactHoursValue, setContactHoursValue] = useState('0');
    const [showTemplates, setShowTemplates] = useState(false);
    const [, setShowColorSettings] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [templateSourceDate, setTemplateSourceDate] = useState('');
    const [templateTargetDate, setTemplateTargetDate] = useState('');
    const [selectedSourceEmployee, setSelectedSourceEmployee] = useState<string>('all');
    const [selectedTargetEmployee, setSelectedTargetEmployee] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendMain, setSendMain] = useState(true);
    const [sendIndividual, setSendIndividual] = useState(true);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ sent: number, errors: any[] } | null>(null);

    // Replacement Modal State
    const [showReplacementModal, setShowReplacementModal] = useState(false);
    const [replacementCandidates, setReplacementCandidates] = useState<any[]>([]);
    const [loadingReplacement, setLoadingReplacement] = useState(false);
    const [replacementContext, setReplacementContext] = useState<{ date: string; empName: string; shiftType: string } | null>(null);
    const [replacementError, setReplacementError] = useState<string | undefined>(undefined);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mobile responsiveness
    const isMobile = useMediaQuery('(max-width: 768px)');

    // Early return for mobile view
    if (isMobile) {
        return <ScheduleGridMobile />;
    }

    const handleSendSchedules = async () => {
        setSending(true);
        setSendResult(null);
        try {
            const response = await fetch('/api/send-schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sendMain, sendIndividual })
            });
            const data = await response.json();
            if (data.success) {
                setSendResult({ sent: data.sent, errors: data.errors || [] });
                if (data.errors && data.errors.length === 0) {
                    setTimeout(() => setShowSendModal(false), 2000);
                }
            } else {
                alert('Błąd wysyłania: ' + data.error);
            }
        } catch (error) {
            console.error('Send error:', error);
            alert('Wystąpił błąd podczas wysyłania.');
        } finally {
            setSending(false);
        }
    };

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

    const findReplacement = async (date: string, shiftType: string, employeeOutId: string, empName: string) => {
        setLoadingReplacement(true);
        setReplacementContext({ date, empName, shiftType });
        setShowReplacementModal(true);
        setReplacementCandidates([]);
        setReplacementError(undefined);

        try {
            const response = await fetch('/api/replacement/find', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, shiftType, employeeOutId, schedule })
            });

            if (!response.ok) {
                throw new Error(`Błąd serwera: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            setReplacementCandidates(data.candidates || []);
        } catch (error: any) {
            console.error('Replacement error:', error);
            setReplacementError(error.message || 'Wystąpił błąd podczas wyszukiwania.');
        } finally {
            setLoadingReplacement(false);
        }
    };

    const handleSelectReplacement = (candidateId: string, candidateName: string) => {
        if (!replacementContext) return;

        // Simple assignment for now - user can edit details later
        // Try to parse shift hours if possible, otherwise just set WORK
        let start, end;
        const parts = replacementContext.shiftType.split('-');
        if (parts.length === 2) {
            const s = parseInt(parts[0]);
            const e = parseInt(parts[1]);
            if (!isNaN(s) && !isNaN(e)) {
                start = s;
                end = e;
            }
        } else if (replacementContext.shiftType === '20-8') {
            start = 20;
            end = 8;
        }

        updateShift(candidateId, replacementContext.date, 'WORK', start, end);
        setShowReplacementModal(false);
        alert(`Przypisano zastępstwo: ${candidateName}`);
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
                        // Other absences: inherit from existing shift ONLY if hours are valid numbers
                        if (existingShift
                            && existingShift.startHour !== undefined
                            && existingShift.endHour !== undefined
                            && !isNaN(existingShift.startHour)
                            && !isNaN(existingShift.endHour)) {
                            start = existingShift.startHour;
                            end = existingShift.endHour;
                        } else {
                            // Default to 8-16 if no valid existing hours
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
        { label: '8-14', value: '8-14', color: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700', darkColor: 'dark:bg-cyan-900/20 dark:hover:bg-cyan-900/40 dark:text-cyan-200', tooltip: 'Zmiana 8-14' },
        { label: '8-15', value: '8-15', color: 'bg-teal-50 hover:bg-teal-100 text-teal-700', darkColor: 'dark:bg-teal-900/20 dark:hover:bg-teal-900/40 dark:text-teal-200', tooltip: 'Zmiana 8-15' },
        { label: '8-16', value: '8-16', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700', darkColor: 'dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-200', tooltip: 'Zmiana 8-16' },
        { label: 'D (8-20)', value: '8-20', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800', darkColor: 'dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-100', tooltip: 'Dzień (8-20)' },
        { label: '14-20', value: '14-20', color: 'bg-sky-50 hover:bg-sky-100 text-sky-700', darkColor: 'dark:bg-sky-900/20 dark:hover:bg-sky-900/40 dark:text-sky-200', tooltip: 'Zmiana 14-20' },
        { label: 'N (20-8)', value: '20-8', color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800', darkColor: 'dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-100', tooltip: 'Noc (20-8)' },
        { label: 'K 4h', value: 'K 4', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800', darkColor: 'dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-100', tooltip: 'Godziny kontaktów (4h)' },
        { label: 'Wolne', value: 'W', color: 'bg-gray-100 hover:bg-gray-200 text-gray-800', darkColor: 'dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200', tooltip: 'Dzień wolny' },
        { label: 'UW', value: 'UW', color: 'bg-green-100 hover:bg-green-200 text-green-800', darkColor: 'dark:bg-green-900/30 dark:hover:bg-green-900/40 dark:text-green-200', tooltip: 'Urlop Wypoczynkowy' },
        { label: 'UŻ', value: 'UŻ', color: 'bg-teal-100 hover:bg-teal-200 text-teal-800', darkColor: 'dark:bg-teal-900/30 dark:hover:bg-teal-900/50 dark:text-teal-200', tooltip: 'Urlop na Żądanie (4 dni/rok)' },
        { label: 'UM', value: 'UM', color: 'bg-pink-100 hover:bg-pink-200 text-pink-800', darkColor: 'dark:bg-pink-900/30 dark:hover:bg-pink-900/50 dark:text-pink-200', tooltip: 'Urlop Macierzyński' },
        { label: 'USW', value: 'USW', color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800', darkColor: 'dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-200', tooltip: 'Urlop Siła Wyższa (16h/rok, 50% płatny)' },
        { label: 'UB', value: 'UB', color: 'bg-slate-100 hover:bg-slate-200 text-slate-800', darkColor: 'dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200', tooltip: 'Urlop Bezpłatny' },
        { label: 'L4', value: 'L4', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800', darkColor: 'dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-100', tooltip: 'Zwolnienie lekarskie (L4)' },
    ];


    return (
        <div className="p-4 md:p-6 max-w-[100vw] overflow-x-hidden min-h-screen">
            <PageHeader
                title="Grafik Pracy"
                description={`Edycja harmonogramu: ${format(new Date(schedule.year, schedule.month - 1), 'LLLL yyyy', { locale: pl })}`}
            />

            <GlassCard className="w-full overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-gray-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Szukaj pracownika..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                        <GlassButton
                            onClick={() => exportScheduleData(schedule)}
                            icon={Download}
                            variant="secondary"
                            size="sm"
                        >
                            Backup
                        </GlassButton>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                ref={fileInputRef}
                            />
                            <GlassButton
                                icon={Upload}
                                variant="secondary"
                                size="sm"
                            >
                                Import
                            </GlassButton>
                        </div>
                        <GlassButton
                            onClick={() => exportToPDF(schedule)}
                            icon={FileDown}
                            variant="primary"
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white border-none"
                        >
                            PDF
                        </GlassButton>
                        <GlassButton
                            onClick={() => setShowSendModal(true)}
                            icon={Mail}
                            variant="secondary"
                            size="sm"
                        >
                            Wyślij
                        </GlassButton>
                        <GlassButton
                            onClick={() => setShowTemplates(!showTemplates)}
                            icon={LayoutTemplate}
                            variant={showTemplates ? "primary" : "secondary"}
                            size="sm"
                        >
                            Szablony
                        </GlassButton>
                        <GlassButton
                            onClick={() => setShowColorSettings(true)}
                            icon={Palette}
                            variant="secondary"
                            size="sm"
                        >
                            Kolory
                        </GlassButton>
                    </div>
                </div>

                {/* Templates Section */}
                {showTemplates && (
                    <div className="mb-6 p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm animate-fade-in">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Create Template */}
                            <div className="flex-1 space-y-3 border-r border-slate-200 dark:border-slate-700 pr-6">
                                <h3 className="font-bold text-gray-700 dark:text-gray-100 flex items-center gap-2">
                                    <Plus size={16} />
                                    Utwórz nowy szablon
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nazwa szablonu</label>
                                        <input
                                            type="text"
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                            placeholder="np. Tydzień A"
                                            className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tydzień źródłowy (wybierz dowolny dzień)</label>
                                        <input
                                            type="date"
                                            value={templateSourceDate}
                                            onChange={(e) => setTemplateSourceDate(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Źródło (Cały zespół lub pracownik)</label>
                                        <select
                                            value={selectedSourceEmployee}
                                            onChange={(e) => setSelectedSourceEmployee(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        >
                                            <option value="all">Cały zespół</option>
                                            {schedule.employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <GlassButton
                                        onClick={() => {
                                            if (!newTemplateName || !templateSourceDate) {
                                                alert('Podaj nazwę i datę!');
                                                return;
                                            }
                                            saveTemplate(newTemplateName, templateSourceDate, selectedSourceEmployee === 'all' ? undefined : selectedSourceEmployee);
                                            setNewTemplateName('');
                                            alert('Szablon zapisany!');
                                        }}
                                        variant="primary"
                                        size="sm"
                                        className="w-full justify-center"
                                    >
                                        Zapisz Szablon
                                    </GlassButton>
                                </div>
                            </div>

                            {/* Apply Templates */}
                            <div className="flex-[2] space-y-3">
                                <h3 className="font-bold text-gray-700 dark:text-gray-100 flex items-center gap-2">
                                    <LayoutTemplate size={16} />
                                    Dostępne szablony
                                </h3>
                                <div className="flex items-center gap-3 mb-4 bg-gray-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">Wklej do tygodnia od:</label>
                                    <input
                                        type="date"
                                        value={templateTargetDate}
                                        onChange={(e) => setTemplateTargetDate(e.target.value)}
                                        className="px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                    <span className="text-xs text-gray-400 dark:text-gray-500">(Wybierz poniedziałek docelowego tygodnia)</span>
                                </div>

                                {weeklyTemplates.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">Brak zapisanych szablonów.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                        {weeklyTemplates.map(t => (
                                            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500 transition-colors">
                                                <span className="font-medium text-gray-700 dark:text-gray-200 flex flex-col">
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
                                                            className="w-24 px-1 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded focus:ring-1 focus:ring-purple-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
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
                                                        className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
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
                                                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
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

                {/* Quick Insert Templates */}
                <div className="mb-6 p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {templates.map(t => (
                            <button
                                key={t.value}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur event on input
                                    applyTemplate(t.value);
                                }}
                                className={clsx(
                                    "px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 shadow-sm border border-transparent hover:shadow-md hover:scale-105",
                                    t.color,
                                    t.darkColor
                                )}
                                title={t.tooltip}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Table */}
                <div className="max-w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-xl">
                    <table className="w-full border-collapse">
                        <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-slate-800 z-30 border-r border-gray-200 dark:border-slate-700 min-w-[150px]">
                                    Pracownik
                                </th>
                                {days.map((day, dayIndex) => {
                                    const dayNum = dayIndex + 1;
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const isCopied = copiedDay?.date === dateStr;
                                    const canPaste = !!copiedDay && copiedDay.date !== dateStr;
                                    const isLastDayOfWeek = weeksInMonth.find(w => w.end === dayNum);
                                    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

                                    return (
                                        <React.Fragment key={day.toString()}>
                                            <th className={clsx(
                                                "px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[60px] group relative",
                                                isWeekend(day) && "bg-red-50 dark:bg-red-900/20",
                                                isToday && "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400 ring-inset",
                                                isCopied && "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-inset"
                                            )}>
                                                <div>{format(day, 'dd')}</div>
                                                <div>{format(day, 'EE', { locale: pl })}</div>

                                                {/* Copy/Paste Actions */}
                                                <div className="flex justify-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-50">
                                                    <button
                                                        onClick={() => copyDay(dateStr)}
                                                        className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400"
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
                                                            className="p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded text-green-600 dark:text-green-400"
                                                            title={`Wklej zmiany z dnia ${copiedDay.date}`}
                                                        >
                                                            <ClipboardPaste size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                            {isLastDayOfWeek && (
                                                <th className="px-4 py-3 text-center text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20">
                                                    T{isLastDayOfWeek.weekIndex}
                                                </th>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-2 dark:bg-meta-4">
                                    L. Zmian
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-2 dark:bg-meta-4">
                                    Godz. K.
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-2 dark:bg-meta-4 z-10 border-l-2 border-gray-300 dark:border-strokedark">
                                    Suma
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
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
                                    const autoContactHours = monthShifts.reduce((acc, s) => {
                                        return acc + (s.contactHours || (s.type === 'K' ? s.hours : 0));
                                    }, 0);

                                    // Manual contact hours
                                    const manualContactHours = emp.monthlyContactHours?.[monthKey] || 0;
                                    const contactHours = autoContactHours + manualContactHours;
                                    const totalWithContact = totalHours + contactHours;

                                    // Count shifts (days worked)
                                    const shiftCount = monthShifts.filter(s =>
                                        s.type === 'WORK' ||
                                        (s.type === 'K' && s.hours > 0) ||
                                        ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)
                                    ).length;

                                    return (
                                        <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-gray-200 dark:border-gray-700">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-900 dark:text-white">{emp.name}</span>
                                                    <span className={clsx(
                                                        "text-xs px-2 py-0.5 rounded font-semibold",
                                                        totalWithContact > 152
                                                            ? "bg-red-500 text-white"
                                                            : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                                                    )}>
                                                        {totalWithContact}h
                                                    </span>
                                                </div>
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
                                                                "px-4 py-3 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 relative",
                                                                isWeekend(day) && "bg-red-50/30 dark:bg-red-900/10",
                                                                !colorSettings[shift?.type || ''] && shift?.type === 'L4' && "bg-orange-100 dark:bg-orange-900/30",
                                                                !colorSettings[shift?.type || ''] && shift?.type === 'UW' && "bg-green-100 dark:bg-green-900/30",
                                                                !colorSettings[shift?.type || ''] && shift?.type === 'K' && "bg-purple-100 dark:bg-purple-900/30",
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
                                                                <>
                                                                    <input
                                                                        autoFocus
                                                                        className="w-full h-full text-center border-2 border-blue-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                                                        value={editValue}
                                                                        onChange={e => setEditValue(e.target.value)}
                                                                        onBlur={handleSave}
                                                                        onKeyDown={handleKeyDown}
                                                                    />
                                                                    {/* Replacement Button (Phase 7) */}
                                                                    {editingCell.empId === emp.id && editingCell.date === dateStr && (
                                                                        <button
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault(); // Prevent blur
                                                                                findReplacement(dateStr, editValue || '8-16', emp.id, emp.name);
                                                                            }}
                                                                            className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded shadow-lg hover:bg-indigo-700 whitespace-nowrap z-50 flex items-center gap-1"
                                                                            title="Znajdź zastępstwo (AI)"
                                                                        >
                                                                            <UserPlus size={12} />
                                                                            Zastępstwo
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <ShiftBlock
                                                                    shift={shift}
                                                                    display={display}
                                                                    onClick={() => {
                                                                        handleCellClick(emp.id, dateStr, display === '/' ? '' : display);
                                                                    }}
                                                                />
                                                            )}
                                                        </td>
                                                        {isLastDayOfWeek && (() => {
                                                            const weekHours = getWeeklyHours(emp, isLastDayOfWeek.start, isLastDayOfWeek.end);
                                                            return (
                                                                <td className="px-4 py-3 text-center text-xs font-bold bg-blue-50 dark:bg-blue-900/20">
                                                                    <div className="text-blue-900 dark:text-blue-100">{weekHours.total}h</div>
                                                                    <div className="text-[10px] text-gray-600 dark:text-gray-400">({weekHours.workHours}+{weekHours.contactHours})</div>
                                                                </td>
                                                            );
                                                        })()}
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className="px-4 py-3 whitespace-nowrap text-center font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900">
                                                {shiftCount}
                                            </td>
                                            <td
                                                className="px-4 py-3 whitespace-nowrap text-center font-medium text-purple-700 dark:text-purple-400 bg-white dark:bg-slate-900 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20"
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
                                                        className="w-20 text-center border-2 border-purple-500 outline-none rounded px-1 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
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
                                            <td className="px-4 py-3 whitespace-nowrap text-center font-bold sticky right-0 bg-white dark:bg-slate-900 z-10 border-l-2 border-gray-300 dark:border-strokedark text-gray-900 dark:text-white">
                                                {totalWithContact}h
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div >

                {/* Leave Usage Summary */}
                {
                    schedule.employees.some(emp => {
                        const hasUz = Object.values(emp.shifts).some(s => s.type === 'UŻ' && s.date.startsWith(schedule.year.toString()));
                        const hasUsw = Object.values(emp.shifts).some(s => s.type === 'USW' && s.date.startsWith(schedule.year.toString()));
                        return hasUz || hasUsw;
                    }) && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 p-4 rounded">
                            <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-3">Wykorzystanie urlopów specjalnych w {schedule.year} roku:</h3>
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
                                            <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[200px]">{emp.name}:</span>
                                            {uzDays > 0 && (
                                                <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 px-2 py-1 rounded">
                                                    UŻ: {uzDays}/4 dni
                                                </span>
                                            )}
                                            {uswHours > 0 && (
                                                <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                                                    USW: {uswHours}/16h
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                                <p>• UŻ (Urlop na Żądanie): 4 dni w roku kalendarzowym, liczony według godzin zmian</p>
                                <p>• USW (Urlop Siła Wyższa): 16h w roku kalendarzowym (2 dni), 50% płatny</p>
                            </div>
                        </div>
                    )
                }
            </GlassCard>

            {/* Send Schedules Modal */}
            {
                showSendModal && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Mail className="text-indigo-500" /> Wyślij Harmonogramy
                                </h3>
                                <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <X size={24} />
                                </button>
                            </div>

                            {!sendResult ? (
                                <>
                                    <div className="space-y-4 mb-6">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Wybierz jakie dokumenty chcesz wysłać do pracowników posiadających adres email.
                                        </p>

                                        <label className="flex items-center gap-3 p-3 rounded border border-slate-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={sendMain}
                                                onChange={e => setSendMain(e.target.checked)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white">Harmonogram Zbiorczy</span>
                                                <span className="text-xs text-gray-500">Jeden plik PDF ze wszystkimi pracownikami</span>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 p-3 rounded border border-slate-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={sendIndividual}
                                                onChange={e => setSendIndividual(e.target.checked)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white">Harmonogram Indywidualny</span>
                                                <span className="text-xs text-gray-500">Osobny plik PDF tylko z grafikiem danego pracownika</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowSendModal(false)}
                                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                                        >
                                            Anuluj
                                        </button>
                                        <button
                                            onClick={handleSendSchedules}
                                            disabled={sending || (!sendMain && !sendIndividual)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {sending ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                    Wysyłanie...
                                                </>
                                            ) : (
                                                <>
                                                    <Mail size={18} /> Wyślij
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="mb-4 flex justify-center">
                                        {sendResult.errors.length === 0 ? (
                                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                                <CheckCircle size={32} />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center">
                                                <AlertCircle size={32} />
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                        Wysłano do {sendResult.sent} pracowników
                                    </h4>
                                    {sendResult.errors.length > 0 && (
                                        <div className="mt-4 text-left bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                                            <p className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">Błędy ({sendResult.errors.length}):</p>
                                            <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                                                {sendResult.errors.map((err, idx) => (
                                                    <li key={idx}>• {err.name}: {err.error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowSendModal(false)}
                                        className="mt-6 px-6 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded hover:opacity-90 transition-opacity"
                                    >
                                        Zamknij
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Replacement Modal (Phase 7) */}
            <ReplacementModal
                show={showReplacementModal}
                onClose={() => setShowReplacementModal(false)}
                loading={loadingReplacement}
                candidates={replacementCandidates}
                context={replacementContext}
                error={replacementError}
                onSelectCandidate={handleSelectReplacement}
            />
        </div >
    );
};
