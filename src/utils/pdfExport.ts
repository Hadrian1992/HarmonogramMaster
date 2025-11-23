import { addCustomFonts } from './customFonts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Schedule } from '../types';
import { format, getDaysInMonth, setDate, isWeekend } from 'date-fns';
import { pl } from 'date-fns/locale';

export const exportToPDF = (schedule: Schedule) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3'
    });

    // Dodaj i ustaw czcionkę Roboto z polskimi znakami
    addCustomFonts(doc);
    doc.setFont('Roboto');

    const monthName = format(new Date(schedule.year, schedule.month - 1), 'LLLL yyyy', { locale: pl });
    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));

    // ===== NAGŁÓWEK =====
    doc.setFontSize(20);
    doc.setFont('Roboto', 'bold');
    doc.text('HARMONOGRAM PRACY', 210, 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('Roboto', 'normal');
    doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), 210, 23, { align: 'center' });
    doc.text('Placówka Opiekuńczo-Wychowawcza', 210, 30, { align: 'center' });

    // ===== LEGENDA =====
    doc.setFontSize(9);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(60, 60, 60);
    const legendaText = 'Legenda: K - Kontakt | UŻ - Urlop | USW - Urlop bez wynagr. | L4 - Zwolnienie | OP - Opieka | UW - Urlop wychowawczy | / - Wolne';
    doc.text(legendaText, 15, 38);
    doc.setTextColor(0, 0, 0);

    // ===== PRZYGOTOWANIE DANYCH =====
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        return setDate(new Date(schedule.year, schedule.month - 1), i + 1);
    });

    const dayNameMap: Record<string, string> = {
        'poniedziałek': 'Pn',
        'wtorek': 'Wt',
        'środa': 'Śr',
        'czwartek': 'Cz',
        'piątek': 'Pt',
        'sobota': 'So',
        'niedziela': 'Nd'
    };

    // Nagłówek - numery dni
    const dayHeaders = days.map(day => ({
        content: format(day, 'd'),
        styles: {
            halign: 'center' as const,
            valign: 'middle' as const,
            fillColor: (isWeekend(day) ? [180, 140, 180] : [100, 160, 220]) as [number, number, number],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold' as const,
            cellPadding: 1,
            lineWidth: 0.1,
            lineColor: [80, 80, 80] as [number, number, number]
        }
    }));

    // Nagłówek - dni tygodnia
    const dayOfWeekRow = days.map(day => {
        const fullDayName = format(day, 'EEEE', { locale: pl }).toLowerCase();
        const shortDayName = dayNameMap[fullDayName] || fullDayName.substring(0, 2);

        return {
            content: shortDayName,
            styles: {
                halign: 'center' as const,
                valign: 'middle' as const,
                fillColor: (isWeekend(day) ? [200, 160, 200] : [130, 190, 240]) as [number, number, number],
                textColor: (isWeekend(day) ? 255 : 0) as number,
                fontSize: 8,
                fontStyle: 'bold' as const,
                cellPadding: 0.5,
                lineWidth: 0.1,
                lineColor: [80, 80, 80] as [number, number, number]
            }
        };
    });

    // ===== WIERSZE PRACOWNIKÓW =====
    const employeeRows = schedule.employees.map(emp => {
        const row = [emp.name];

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const shift = emp.shifts[dateStr];

            let display = '/';
            if (shift) {
                if (shift.type === 'WORK') {
                    display = `${shift.startHour}-${shift.endHour}`;
                    if (shift.contactHours) {
                        display += `\nK${shift.contactHours}`;
                    }
                } else if (shift.type === 'K') {
                    if (shift.startHour !== undefined && shift.endHour !== undefined) {
                        display = `K${shift.startHour}-${shift.endHour}`;
                    } else {
                        display = `K${shift.hours}`;
                    }
                } else if (['UŻ', 'USW', 'UZ'].includes(shift.type)) {
                    if (shift.startHour !== undefined && shift.endHour !== undefined) {
                        display = `${shift.type}\n${shift.startHour}-${shift.endHour}`;
                    } else {
                        display = shift.type;
                    }
                } else if (shift.type !== 'W') {
                    display = shift.type;
                }
            }
            row.push(display);
        });

        // Obliczenia
        const totalHours = Object.values(emp.shifts).reduce((acc, s) => {
            if (s.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)) {
                return acc + s.hours;
            }
            return acc;
        }, 0);

        const autoContactHours = Object.values(emp.shifts).reduce((acc, s) =>
            acc + (s.contactHours || (s.type === 'K' ? s.hours : 0)), 0
        );

        const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
        const manualContactHours = emp.monthlyContactHours?.[monthKey] || 0;
        const contactHours = autoContactHours + manualContactHours;
        const shiftCount = Object.values(emp.shifts).filter(s => s.type === 'WORK').length;

        row.push(String(shiftCount));
        row.push(String(contactHours));
        row.push(String(totalHours + manualContactHours));

        return row;
    });

    // ===== TABELA =====
    autoTable(doc, {
        startY: 42,
        head: [
            ['Pracownik', ...dayHeaders],
            ['', ...dayOfWeekRow]
        ],
        body: employeeRows,
        foot: [
            ['', ...Array(daysInMonth).fill(''), 'Zmiany', 'K.', 'Suma']
        ],
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 1.5,
            overflow: 'linebreak',
            halign: 'center' as const,
            valign: 'middle' as const,
            lineColor: [150, 150, 150] as [number, number, number],
            lineWidth: 0.1,
            font: 'Roboto'
        },
        headStyles: {
            fillColor: [66, 139, 202] as [number, number, number],
            textColor: 255,
            fontStyle: 'bold' as const,
            halign: 'center' as const,
            valign: 'middle' as const
        },
        footStyles: {
            fillColor: [220, 220, 220] as [number, number, number],
            textColor: 0,
            fontStyle: 'bold' as const,
            halign: 'center' as const
        },
        columnStyles: {
            0: {
                halign: 'left' as const,
                cellWidth: 35,
                fontStyle: 'bold' as const,
                fillColor: [250, 250, 250] as [number, number, number]
            },
            ...Object.fromEntries(
                Array.from({ length: daysInMonth }, (_, i) => [
                    i + 1,
                    { cellWidth: 11 }
                ])
            ),
            [daysInMonth + 1]: { cellWidth: 12, fillColor: [230, 240, 255] as [number, number, number] },
            [daysInMonth + 2]: { cellWidth: 12, fillColor: [240, 230, 255] as [number, number, number] },
            [daysInMonth + 3]: { cellWidth: 14, fillColor: [255, 250, 220] as [number, number, number], fontStyle: 'bold' as const }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0 && data.column.index <= daysInMonth) {
                const dayIndex = data.column.index - 1;
                if (isWeekend(days[dayIndex])) {
                    data.cell.styles.fillColor = [240, 220, 240];
                }
            }
            if (data.section === 'body' && data.row.index % 2 === 1) {
                const currentColor = data.cell.styles.fillColor;
                if (!currentColor || (Array.isArray(currentColor) && currentColor.toString() === [255, 255, 255].toString())) {
                    data.cell.styles.fillColor = [252, 252, 252];
                }
            }
        }
    });

    // ===== PODPISY =====
    const finalY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');

    doc.text('Podpis pracownika:', 20, finalY);
    doc.line(55, finalY, 120, finalY);
    doc.setFontSize(7);
    doc.text('Data:', 20, finalY + 5);
    doc.line(30, finalY + 5, 60, finalY + 5);

    doc.text('Podpis kierownika:', 280, finalY);
    doc.line(315, finalY, 380, finalY);
    doc.setFontSize(7);
    doc.text('Data:', 280, finalY + 5);
    doc.line(290, finalY + 5, 320, finalY + 5);

    // Stopka
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(`Wygenerowano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 210, 290, { align: 'center' });

    // Zapisz plik
    const fileName = `Harmonogram_${monthName.replace(' ', '_')}.pdf`;
    doc.save(fileName);
};
