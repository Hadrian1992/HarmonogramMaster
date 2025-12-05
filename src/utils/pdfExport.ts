import { addCustomFonts } from './customFonts';
import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { Schedule } from '../types';
import { format, getDaysInMonth, setDate, isWeekend, getISOWeek } from 'date-fns';
import { pl } from 'date-fns/locale';

// ===================================================================================
// PUBLICZNE API
// ===================================================================================

export type PDFTemplate = 'standard' | 'weekly';

export const exportToPDF = (schedule: Schedule, template: PDFTemplate = 'standard') => {
    const doc = template === 'weekly' ? generateWeeklyDoc(schedule) : generateStandardDoc(schedule);
    doc.save(`Harmonogram_${schedule.month}_${schedule.year}_${template}.pdf`);
};

export const getMainPdfBlob = (schedule: Schedule, template: PDFTemplate = 'standard'): Blob => {
    const doc = template === 'weekly' ? generateWeeklyDoc(schedule) : generateStandardDoc(schedule);
    return doc.output('blob');
};

export const getEmployeePdfBlob = (schedule: Schedule, employeeIndex: number): Blob => {
    const doc = generateSingleEmployeeDoc(schedule, employeeIndex);
    return doc.output('blob');
};

// ===================================================================================
// POMOCNICZE OBLICZENIA
// ===================================================================================

const PAID_TYPES = ['WORK', 'L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'];

const calculateHours = (shifts: any, days: Date[], includeManualContact: boolean, manualContactValue: number = 0) => {
    let workHours = 0;
    let contactHours = 0;

    days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const shift = shifts[dateStr];
        if (!shift) return;

        if (shift.type === 'WORK' || PAID_TYPES.includes(shift.type)) {
            workHours += (shift.hours || 0);
        }
        contactHours += (shift.contactHours || (shift.type === 'K' ? shift.hours : 0) || 0);
    });

    const total = workHours + contactHours + (includeManualContact ? manualContactValue : 0);
    return { total, workHours, contactHours };
};

// ===================================================================================
// SZABLON 1: STANDARDOWY (A4 LANDSCAPE - INTELIGENTNY PODZIAŁ + PODSUMOWANIE)
// ===================================================================================

const generateStandardDoc = (schedule: Schedule): jsPDF => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    addCustomFonts(doc);
    doc.setFont('Roboto');

    const monthDate = new Date(schedule.year, schedule.month - 1);
    const daysInMonth = getDaysInMonth(monthDate);
    const allDays = Array.from({ length: daysInMonth }, (_, i) => setDate(monthDate, i + 1));

    // --- INTELIGENTNE CIĘCIE NA STRONY ---
    let splitIndex = 14;
    let foundSplit = false;
    for (let i = 14; i < 22 && i < allDays.length; i++) {
        const day = allDays[i];
        if (day.getDay() === 0) {
            splitIndex = i + 1;
            foundSplit = true;
            break;
        }
    }
    if (!foundSplit) splitIndex = Math.ceil(daysInMonth / 2);

    const chunks = [
        allDays.slice(0, splitIndex),
        allDays.slice(splitIndex)
    ];

    let weekCounter = 1;
    const dayNameMap: Record<string, string> = {
        'poniedziałek': 'Pn', 'wtorek': 'Wt', 'środa': 'Śr', 'czwartek': 'Cz',
        'piątek': 'Pt', 'sobota': 'So', 'niedziela': 'Nd'
    };

    chunks.forEach((chunkDays, pageIndex) => {
        if (chunkDays.length === 0) return;
        if (pageIndex > 0) doc.addPage();

        // Nagłówek
        doc.setFontSize(16);
        doc.text('PLAN PRACY PRACOWNIKÓW PEDAGOGICZNYCH', 148.5, 15, { align: 'center' });
        doc.setFontSize(10);
        const dateRange = `OD ${format(allDays[0], 'dd.MM.yyyy')} DO ${format(allDays[daysInMonth - 1], 'dd.MM.yyyy')}`;
        doc.text(dateRange + ` (Część ${pageIndex + 1}/${chunks.length})`, 148.5, 22, { align: 'center' });

        const headers: any[] = ['IMIĘ I NAZWISKO'];
        const subHeaders: any[] = [''];
        const colIndexToDayMap: Record<number, Date> = {};
        let currentTableColIndex = 1;

        // --- Generowanie kolumn ---
        chunkDays.forEach((day) => {
            headers.push({
                content: format(day, 'd'),
                styles: {
                    halign: 'center', valign: 'middle',
                    fillColor: (isWeekend(day) ? [180, 160, 180] : [100, 160, 220]),
                    textColor: 255, fontSize: 9, fontStyle: 'normal'
                }
            });

            const fullDayName = format(day, 'EEEE', { locale: pl }).toLowerCase();
            const shortDayName = dayNameMap[fullDayName] || fullDayName.substring(0, 2);

            subHeaders.push({
                content: shortDayName,
                styles: {
                    halign: 'center', valign: 'middle',
                    fillColor: (isWeekend(day) ? [230, 210, 230] : [240, 245, 255]),
                    textColor: 0, fontSize: 8
                }
            });

            colIndexToDayMap[currentTableColIndex] = day;
            currentTableColIndex++;

            const isSunday = day.getDay() === 0;
            const isLastDayOfMonth = day.getDate() === daysInMonth;

            if (isSunday || isLastDayOfMonth) {
                headers.push({
                    content: `T${weekCounter}`,
                    styles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 9, fontStyle: 'normal' }
                });
                subHeaders.push({
                    content: 'Suma',
                    styles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 7, fontStyle: 'italic' }
                });
                weekCounter++;
                currentTableColIndex++;
            }
        });

        const isLastPage = pageIndex === chunks.length - 1;
        if (isLastPage) {
            headers.push({ content: 'ZM.', styles: { fillColor: [50, 50, 50], textColor: 255 } });
            subHeaders.push({ content: 'Licz.', styles: { fontSize: 7 } });

            headers.push({ content: 'PENSUM', styles: { fillColor: [50, 50, 50], textColor: 255 } });
            subHeaders.push({ content: 'Etat', styles: { fontSize: 7 } });

            headers.push({ content: 'K.', styles: { fillColor: [50, 50, 50], textColor: 255 } });
            subHeaders.push({ content: 'Godz.', styles: { fontSize: 7 } });

            headers.push({ content: 'SUMA', styles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'normal' } });
            subHeaders.push({ content: 'Mies.', styles: { fontSize: 7, fontStyle: 'normal' } });
        }

        // --- Generowanie wierszy (bodyRows) ---
        const bodyRows: RowInput[] = [];

        schedule.employees.forEach(emp => {
            const row: any[] = [emp.name];

            chunkDays.forEach((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const shift = emp.shifts[dateStr];
                let display = '';

                if (shift) {
                    if (shift.type === 'WORK') {
                        display = `${shift.startHour}-${shift.endHour}`;
                        if (shift.contactHours) display += `\nK${shift.contactHours}`;
                    } else if (shift.type === 'K') {
                        display = `K${shift.contactHours || shift.hours || ''}`;
                    } else if (['UŻ', 'USW', 'UZ'].includes(shift.type)) {
                        display = shift.type;
                    } else if (shift.type !== 'W') {
                        display = shift.type;
                    }
                }
                row.push(display);

                const isSunday = day.getDay() === 0;
                const isLastDayOfMonth = day.getDate() === daysInMonth;

                if (isSunday || isLastDayOfMonth) {
                    const currentWeekNum = getISOWeek(day);
                    const daysInThisWeek = allDays.filter(d => getISOWeek(d) === currentWeekNum);
                    const { total } = calculateHours(emp.shifts, daysInThisWeek, false);

                    row.push({
                        content: total > 0 ? `${total}` : '-',
                        styles: { fontStyle: 'normal', fillColor: [240, 240, 240] }
                    });
                }
            });

            // --- WSTAWIANIE WARTOŚCI PODSUMOWANIA (TYLKO OSTATNIA STRONA) ---
            if (isLastPage) {
                // A. Obliczamy L. Zmian (TYLKO DLA BIEŻĄCEGO MIESIĄCA)
                let shiftCount = 0;

                // Iterujemy po wszystkich dniach TEGO miesiąca
                allDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const s = emp.shifts[dateStr];

                    if (s) {
                        // Sprawdzamy warunek zaliczenia zmiany
                        if (s.type === 'WORK' || (s.type === 'K' && (s.hours || 0) > 0) ||
                            ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)) {
                            shiftCount++;
                        }
                    }
                });

                const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
                const manualContact = emp.monthlyContactHours?.[monthKey] || 0;
                const { total: grandTotal, contactHours: autoContactHours } = calculateHours(emp.shifts, allDays, true, manualContact);
                const finalContactDisplay = autoContactHours + manualContact;
                const pensum = grandTotal - finalContactDisplay;

                row.push({ content: `${shiftCount}`, styles: { halign: 'center' } });
                row.push({ content: `${pensum}`, styles: { halign: 'center' } });
                row.push({ content: `${finalContactDisplay}`, styles: { halign: 'center' } });
                row.push({ content: `${grandTotal}h`, styles: { fontStyle: 'normal', fillColor: [230, 255, 230] } });
            }

            bodyRows.push(row);
        });

        autoTable(doc, {
            startY: 30,
            head: [headers, subHeaders],
            body: bodyRows,
            theme: 'grid',
            styles: {
                font: 'Roboto', fontStyle: 'normal', fontSize: 8, cellPadding: 1.5,
                overflow: 'linebreak', halign: 'center', valign: 'middle',
                lineColor: [180, 180, 180], lineWidth: 0.1
            },
            headStyles: {
                fillColor: [66, 139, 202], textColor: 255, fontStyle: 'normal',
            },
            columnStyles: {
                0: { halign: 'left', cellWidth: 35, fillColor: [250, 250, 250] }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index > 0) {
                    const day = colIndexToDayMap[data.column.index];
                    if (day && isWeekend(day)) {
                        data.cell.styles.fillColor = [250, 235, 250];
                    }
                }
            },
            margin: { top: 25, right: 10, bottom: 10, left: 10 }
        });

        addFooter(doc, (doc as any).lastAutoTable.finalY);
    });

    return doc;
};

// ===================================================================================
// SZABLON 2: TYGODNIOWY (A4 LANDSCAPE - PODZIAŁ NA TYGODNIE Z PODSUMOWANIEM)
// ===================================================================================

const generateWeeklyDoc = (schedule: Schedule): jsPDF => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    addCustomFonts(doc);
    doc.setFont('Roboto');

    const monthDate = new Date(schedule.year, schedule.month - 1);
    const daysInMonth = getDaysInMonth(monthDate);
    const allDays = Array.from({ length: daysInMonth }, (_, i) => setDate(monthDate, i + 1));

    // Dzielimy na 2 części po 2 tygodnie (lub 3 jeśli miesiąc ma 5-6 tygodni)
    // Ale standardowo 2 strony powinny wystarczyć dla większości miesięcy.
    // Tniemy po pełnych tygodniach.

    // Znajdź wszystkie poniedziałki
    const mondays = allDays.filter(d => d.getDay() === 1);
    // Jeśli miesiąc nie zaczyna się od poniedziałku, pierwszy dzień to też początek "tygodnia" w sensie wizualnym
    if (allDays[0].getDay() !== 1) mondays.unshift(allDays[0]);

    // Podział na strony: 2 tygodnie na stronę
    // 14 dni + 2 kolumny podsumowań = 16 kolumn danych + 1 kolumna nazwiska

    // Uproszczony podział: Dni 1-14 (lub do drugiej niedzieli) na str 1, reszta na str 2
    let splitIndex = 14;
    // Szukamy niedzieli w zakresie 14-22 (połowa miesiąca)
    for (let i = 14; i < 22 && i < allDays.length; i++) {
        if (allDays[i].getDay() === 0) { // Niedziela
            splitIndex = i + 1; // Tniemy po niedzieli
            break;
        }
    }

    const chunks = [
        allDays.slice(0, splitIndex),
        allDays.slice(splitIndex)
    ];

    const dayNameMap: Record<string, string> = {
        'poniedziałek': 'pn', 'wtorek': 'wt', 'środa': 'śr', 'czwartek': 'czw',
        'piątek': 'pt', 'sobota': 'sb', 'niedziela': 'nd'
    };

    chunks.forEach((chunkDays, pageIndex) => {
        if (chunkDays.length === 0) return;
        if (pageIndex > 0) doc.addPage();

        // Nagłówek
        doc.setFontSize(14);
        doc.text('PLAN PRACY PRACOWNIKÓW PEDAGOGICZNYCH', 148.5, 15, { align: 'center' });
        doc.setFontSize(10);
        const dateRange = `OD ${format(allDays[0], 'dd.MM.yyyy')} DO ${format(allDays[daysInMonth - 1], 'dd.MM.yyyy')}`;
        doc.text(dateRange, 148.5, 20, { align: 'center' });

        const headers: any[] = [{ content: 'IMIĘ I\nNAZWISKO', styles: { halign: 'center', valign: 'middle' } }];
        const subHeaders: any[] = ['']; // Pusty dla nazwiska (scalony wiersz)

        // Budowanie nagłówków
        let currentWeekNum = 0;
        let lastWeekNum = -1;

        chunkDays.forEach(day => {
            const isoWeek = getISOWeek(day);
            if (isoWeek !== lastWeekNum) {
                currentWeekNum++;
                lastWeekNum = isoWeek;
            }

            // Dzień miesiąca
            headers.push({
                content: format(day, 'dd'),
                styles: { halign: 'center', fillColor: isWeekend(day) ? [255, 255, 255] : [255, 255, 255], textColor: 0, fontStyle: 'normal' }
            });

            // Dzień tygodnia
            const dayName = format(day, 'EEEE', { locale: pl }).toLowerCase();
            const shortName = dayNameMap[dayName] || dayName.substring(0, 2);
            subHeaders.push({
                content: shortName,
                styles: { halign: 'center', textColor: isWeekend(day) ? [200, 0, 0] : [0, 0, 0] }
            });

            // Jeśli niedziela lub ostatni dzień chunka -> dodaj kolumnę podsumowania
            if (day.getDay() === 0 || day === chunkDays[chunkDays.length - 1]) {
                // Sprawdź czy to koniec tygodnia (niedziela) lub koniec miesiąca
                if (day.getDay() === 0 || day.getDate() === daysInMonth) {
                    headers.push({
                        content: 'Godz.\nWypracowane',
                        styles: { halign: 'center', valign: 'middle', fontSize: 8 }
                    });
                    subHeaders.push({
                        content: 'w tyg.',
                        styles: { halign: 'center', fontSize: 8 }
                    });
                }
            }
        });

        // Jeśli to ostatnia strona, dodaj nagłówki podsumowania
        const isLastPage = pageIndex === chunks.length - 1;
        if (isLastPage) {
            headers.push({ content: 'PENSUM', styles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8 } });
            subHeaders.push({ content: 'Etat', styles: { fontSize: 7 } });

            headers.push({ content: 'K.', styles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8 } });
            subHeaders.push({ content: 'Godz.', styles: { fontSize: 7 } });

            headers.push({ content: 'SUMA', styles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'normal', fontSize: 8 } });
            subHeaders.push({ content: 'Mies.', styles: { fontSize: 7, fontStyle: 'normal' } });
        }

        // Wiersze
        const bodyRows: RowInput[] = [];
        schedule.employees.forEach(emp => {
            const row: any[] = [{ content: emp.name.replace(' ', '\n'), styles: { minCellHeight: 15, valign: 'middle' } }];

            let weeklyHours = 0;
            let currentWeekDays: Date[] = [];

            chunkDays.forEach((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const shift = emp.shifts[dateStr];
                let cellContent = '/';

                if (shift) {
                    if (shift.type === 'WORK') {
                        cellContent = `${shift.startHour}/${shift.endHour}`;
                        if (shift.contactHours) cellContent += `\nK${shift.contactHours}`;
                    } else if (shift.type === 'W') {
                        cellContent = 'W'; // Wolne
                    } else {
                        cellContent = shift.type; // L4, UW itp.
                    }

                    // Zliczanie godzin do tygodniówki
                    if (shift.type === 'WORK' || PAID_TYPES.includes(shift.type)) {
                        weeklyHours += (shift.hours || 0);
                    }
                }

                row.push({
                    content: cellContent,
                    styles: { halign: 'center', valign: 'middle', fontSize: 9 }
                });

                // Logika podsumowania tygodnia
                currentWeekDays.push(day);
                if (day.getDay() === 0 || day === chunkDays[chunkDays.length - 1]) {
                    if (day.getDay() === 0 || day.getDate() === daysInMonth) {
                        row.push({
                            content: weeklyHours > 0 ? `${weeklyHours}` : '-',
                            styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fillColor: [250, 250, 250] }
                        });
                        weeklyHours = 0; // Reset na nowy tydzień
                        currentWeekDays = [];
                    }
                }
            });

            // --- WSTAWIANIE WARTOŚCI PODSUMOWANIA (TYLKO OSTATNIA STRONA) ---
            if (isLastPage) {
                const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
                const manualContact = emp.monthlyContactHours?.[monthKey] || 0;
                const { total: grandTotal, contactHours: autoContactHours } = calculateHours(emp.shifts, allDays, true, manualContact);
                const finalContactDisplay = autoContactHours + manualContact;
                const pensum = grandTotal - finalContactDisplay;

                // 1. Pensum (Suma - K)
                row.push({
                    content: `${pensum}`,
                    styles: { halign: 'center', valign: 'middle', fontStyle: 'italic' }
                });

                // 2. Kontakty (K)
                row.push({
                    content: `${finalContactDisplay}`,
                    styles: { halign: 'center', valign: 'middle' }
                });

                // 3. Suma Miesięczna
                row.push({
                    content: `${grandTotal}h`,
                    styles: { fontStyle: 'normal', fillColor: [230, 255, 230], halign: 'center', valign: 'middle' }
                });
            }

            bodyRows.push(row);
        });

        autoTable(doc, {
            startY: 25,
            head: [headers, subHeaders],
            body: bodyRows,
            theme: 'grid',
            styles: {
                font: 'Roboto', fontStyle: 'normal', fontSize: 7, // Zmniejszona czcionka
                cellPadding: 1, // Mniejszy padding
                lineColor: [0, 0, 0], lineWidth: 0.1,
                textColor: 0,
                overflow: 'linebreak', // Zawijanie tekstu
                valign: 'middle',
                halign: 'center'
            },
            headStyles: {
                fillColor: [255, 255, 255], textColor: 0, fontStyle: 'normal', valign: 'middle', fontSize: 8 // Nagłówki też nieco mniejsze
            },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' } // Imię i nazwisko
            },
            margin: { top: 25, right: 10, bottom: 10, left: 10 }
        });

        addFooter(doc, (doc as any).lastAutoTable.finalY);
    });

    return doc;
};

// ===================================================================================
// WSPÓLNA STOPKA
// ===================================================================================

const addFooter = (doc: jsPDF, startY: number) => {
    // 1. LEGENDA
    const legendY = startY + 8;
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text('Legenda:', 15, legendY);
    doc.setFontSize(7); // Mniejsza czcionka legendy
    doc.text('/ - Wolne | UW - Urlop wypoczynkowy | UŻ - Urlop na żądanie | L4 - Zwolnienie lekarskie', 15, legendY + 4);
    doc.text('K - Godziny kontaktowe | USW - Urlop siła wyższa | UM - Urlop macierzyński | UB - Urlop bezpłatny', 15, legendY + 8);

    // 2. KLAUZULA RODO (Na samym dole)
    const rodoY = 195;
    doc.setFontSize(6); // Bardzo mała czcionka dla RODO
    doc.setTextColor(120);
    const rodoText = 'Administratorem danych osobowych jest Harmonogram Master. Dane przetwarzane są wyłącznie w celu zarządzania harmonogramem pracy.\nZgodnie z RODO masz prawo dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania.';
    doc.text(rodoText, 148.5, rodoY, { align: 'center', maxWidth: 250 });
};

// ===================================================================================
// INDYWIDUALNA KARTA (BEZ ZMIAN)
// ===================================================================================

const generateSingleEmployeeDoc = (schedule: Schedule, employeeIndex: number): jsPDF => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addCustomFonts(doc);
    doc.setFont('Roboto');

    const emp = schedule.employees[employeeIndex];
    const monthDate = new Date(schedule.year, schedule.month - 1);
    const monthName = format(monthDate, 'LLLL yyyy', { locale: pl });
    const daysInMonth = getDaysInMonth(monthDate);
    const allDays = Array.from({ length: daysInMonth }, (_, i) => setDate(monthDate, i + 1));

    doc.setFontSize(14);
    doc.text('INDYWIDUALNA KARTA PRACY', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${emp.name} - ${monthName}`, 105, 22, { align: 'center' });

    const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
    const manualContact = emp.monthlyContactHours?.[monthKey] || 0;
    const { total, workHours, contactHours } = calculateHours(emp.shifts, allDays, true, manualContact);

    const bodyRows = allDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const shift = emp.shifts[dateStr];
        let info = '-';
        if (shift) {
            if (shift.type === 'WORK') info = `${shift.startHour}-${shift.endHour}` + (shift.contactHours ? ` (+K${shift.contactHours})` : '');
            else if (shift.type === 'K') info = `K${shift.contactHours || shift.hours}`;
            else info = shift.type;
        }
        return [format(day, 'dd.MM'), format(day, 'EEEE', { locale: pl }), info];
    });

    autoTable(doc, {
        startY: 30,
        head: [['Data', 'Dzień', 'Zmiana']],
        body: bodyRows,
        foot: [['PODSUMOWANIE', '', `Suma: ${total}h (Praca: ${workHours}h, Kontakt: ${contactHours}h)`]],
        theme: 'grid',
        styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9, cellPadding: 2, halign: 'center' },
        footStyles: { fillColor: [50, 50, 50], textColor: 255 },
        didParseCell: (data) => {
            if (data.section === 'body' && isWeekend(allDays[data.row.index])) {
                data.cell.styles.fillColor = [245, 235, 245];
            }
        }
    });

    return doc;
};
