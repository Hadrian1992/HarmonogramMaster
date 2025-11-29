import { addCustomFonts } from './customFonts';
import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { Schedule } from '../types';
import { format, getDaysInMonth, setDate, isWeekend, getISOWeek } from 'date-fns';
import { pl } from 'date-fns/locale';

// ===================================================================================
// PUBLICZNE API
// ===================================================================================

export const exportToPDF = (schedule: Schedule) => {
    const doc = generateScheduleDocSplit(schedule);
    doc.save(`Harmonogram_${schedule.month}_${schedule.year}.pdf`);
};

export const getMainPdfBlob = (schedule: Schedule): Blob => {
    const doc = generateScheduleDocSplit(schedule);
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
// GŁÓWNA FUNKCJA GENERUJĄCA (A4 LANDSCAPE - INTELIGENTNY PODZIAŁ + PODSUMOWANIE)
// ===================================================================================

const generateScheduleDocSplit = (schedule: Schedule): jsPDF => {
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

                row.push({ content: `${shiftCount}`, styles: { halign: 'center' } });
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

        // --- LEGENDA I PODPISY (NA KAŻDEJ STRONIE) ---
        const tableEndY = (doc as any).lastAutoTable.finalY;
        const legendY = tableEndY + 15;
        doc.setFontSize(12);
        doc.setTextColor(60);

        doc.text('Legenda:', 15, legendY);
        doc.setFontSize(10);
        doc.text('/ - Wolne | UW - Urlop wypoczynkowy | UŻ - Urlop na żądanie | L4 - Zwolnienie lekarskie', 15, legendY + 6);
        doc.text('K - Godziny kontaktowe | USW - Urlop siła wyższa | UM - Urlop macierzyński | UB - Urlop bezpłatny', 15, legendY + 12);

        const signaturesY = 170;
        const safeSignaturesY = Math.max(signaturesY, legendY + 25);

        doc.setFontSize(13);
        doc.setTextColor(0);

        // Lewa strona - Sporządził
        doc.text('Sporządził:', 30, safeSignaturesY);
        doc.setLineWidth(0.5);
        doc.line(30, safeSignaturesY + 10, 100, safeSignaturesY + 10); // Linia

        // DODANE: Automatyczny podpis pod linią
        doc.setFontSize(12);
        doc.setFont('Roboto', 'italic'); // Jeśli masz wariant italic, jak nie to normal
        doc.text('Maria Pankowska', 40, safeSignaturesY + 9);
        doc.setFont('Roboto', 'normal'); // Powrót do normalnego

        // Powrót do ustawień dla prawej strony
        doc.setFontSize(13);

        // Prawa strona - Zatwierdził
        doc.text('Zatwierdził:', 200, safeSignaturesY);
        doc.line(200, safeSignaturesY + 10, 270, safeSignaturesY + 10);

        // --- KLAUZULA RODO (NA KAŻDEJ STRONIE) ---
        const rodoY = 195; // Blisko dolnej krawędzi A4 Landscape (210mm)
        doc.setFontSize(7); // Mała, dyskretna czcionka
        doc.setTextColor(120); // Jasnoszary kolor

        const rodoText = 'Administratorem danych osobowych jest Harmonogram Master. Dane przetwarzane są wyłącznie w celu zarządzania harmonogramem pracy.\nZgodnie z RODO masz prawo dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania.';

        doc.text(rodoText, 148.5, rodoY, { align: 'center', maxWidth: 250 });

    });

    return doc;
};

// --- INDYWIDUALNA KARTA (BEZ ZMIAN) ---
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
