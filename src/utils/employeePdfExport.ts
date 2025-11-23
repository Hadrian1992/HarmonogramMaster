import { addCustomFonts } from './customFonts';
import jsPDF from 'jspdf';
import { format, getDaysInMonth, startOfMonth } from 'date-fns';
import type { Employee, Shift } from '../types';

const MONTH_NAMES = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const DAY_NAMES = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function formatShiftForPDF(shift: Shift): string {
    if (shift.type === 'WORK' && shift.startHour !== undefined && shift.endHour !== undefined) {
        return `${shift.startHour}:00-${shift.endHour}:00`;
    }
    if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(shift.type)) {
        if (shift.startHour !== undefined && shift.endHour !== undefined) {
            return `${shift.type} (${shift.startHour}:00-${shift.endHour}:00)`;
        }
        return shift.type;
    }
    if (shift.type === 'W') {
        return 'Wolne';
    }
    if (shift.type === 'K') {
        if (shift.startHour !== undefined && shift.endHour !== undefined) {
            return `Kontakty (${shift.startHour}:00-${shift.endHour}:00)`;
        }
        return 'Kontakty';
    }
    return shift.type;
}

export function exportEmployeePDF(
    employee: Employee,
    month: number,
    year: number
) {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // Dodaj czcionkę Roboto
    addCustomFonts(doc);
    doc.setFont('Roboto');

    // ===== NAGŁÓWEK =====
    doc.setFontSize(16);
    doc.setFont('Roboto', 'bold');
    doc.text('Harmonogram Pracy', doc.internal.pageSize.getWidth() / 2, 12, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('Roboto', 'normal');
    doc.text(employee.name, doc.internal.pageSize.getWidth() / 2, 18, { align: 'center' });
    doc.text(`${MONTH_NAMES[month - 1]} ${year}`, doc.internal.pageSize.getWidth() / 2, 23, { align: 'center' });

    // ===== PRZYGOTOWANIE DANYCH =====
    const firstDay = startOfMonth(new Date(year, month - 1));
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const shiftsMap = new Map<string, Shift>();
    Object.values(employee.shifts)
        .filter(s => s.date.startsWith(monthKey))
        .forEach(s => {
            shiftsMap.set(s.date, s);
        });

    // ===== RYSOWANIE KALENDARZA =====
    const startY = 30;
    const cellWidth = 38; // Zwiększamy szerokość boxa
    const cellHeight = 25;
    const radius = 3; // Większe zaokrąglenie dla ładniejszego efektu

    // Wyśrodkowanie tabeli na stronie (A4 landscape = 297mm)
    // 7 kolumn * 38mm = 266mm. Margines lewy = (297 - 266) / 2 = 15.5mm
    const startX = 15.5;

    let currentY = startY;
    let col = startDayOfWeek;

    // Nagłówek - nazwy dni
    doc.setFontSize(9);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(255, 255, 255);

    for (let dayCol = 0; dayCol < 7; dayCol++) {
        const x = startX + dayCol * cellWidth;
        doc.setFillColor(100, 160, 220);
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.1); // Cieńsza linia

        // Używamy wbudowanej metody roundedRect
        doc.roundedRect(x, currentY - 6, cellWidth - 1, 6, radius, radius, 'FD');
        doc.text(DAY_NAMES[dayCol], x + (cellWidth - 1) / 2, currentY - 2, { align: 'center' });
    }

    currentY += 7; // Odstęp między nagłówkiem a dniami
    doc.setTextColor(0, 0, 0);

    let dayCounter = 1;
    let rowCount = 0;

    // Rysuj dni
    while (dayCounter <= daysInMonth) {
        col = 0;
        rowCount++;

        // Jeśli pierwszy wiersz, przesunięcie
        if (rowCount === 1) {
            col = startDayOfWeek;
        }

        for (let dayCol = col; dayCol < 7 && dayCounter <= daysInMonth; dayCol++) {
            const x = startX + dayCol * cellWidth;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
            const shift = shiftsMap.get(dateStr);
            const isWeekend = dayCol === 5 || dayCol === 6;

            // Tło boxa
            if (isWeekend) {
                doc.setFillColor(245, 235, 245); // Bardzo jasny fiolet
            } else {
                doc.setFillColor(250, 252, 255); // Bardzo jasny niebieski
            }
            doc.setDrawColor(200, 200, 200); // Jasnoszare obramowanie
            doc.setLineWidth(0.2);

            // Rysuj zaokrąglony box (FD = Fill + Draw stroke)
            doc.roundedRect(x, currentY, cellWidth - 1, cellHeight, radius, radius, 'FD');

            // Numer dnia
            doc.setFont('Roboto', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(60, 120, 200);
            doc.text(String(dayCounter), x + 3, currentY + 5);

            // Zmiana
            doc.setFont('Roboto', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(0, 0, 0);

            if (shift) {
                const shiftText = formatShiftForPDF(shift);
                const hoursText = `${shift.hours}h`;

                // Godziny (Wyśrodkowane)
                doc.setTextColor(0, 0, 0);
                doc.setFont('Roboto', 'bold');
                doc.text(shiftText, x + (cellWidth - 1) / 2, currentY + 12, { align: 'center', maxWidth: cellWidth - 4 });

                // Suma godzin (mała szara na dole)
                doc.setFont('Roboto', 'normal');
                doc.setTextColor(120, 120, 120);
                doc.setFontSize(7);
                doc.text(hoursText, x + (cellWidth - 1) / 2, currentY + 21, { align: 'center' });
            } else {
                // Puste pole
                doc.setTextColor(220, 220, 220);
                doc.text('/', x + (cellWidth - 1) / 2, currentY + 12, { align: 'center' });
            }

            dayCounter++;
        }

        currentY += cellHeight + 2; // Odstęp między wierszami

        // Zatrzymaj gdy miesiąc się nie zmieści na jednej stronie (bezpiecznik)
        if (currentY > 190) {
            break;
        }
    }

    // ===== PODSUMOWANIE =====
    currentY += 3;

    let workHours = 0;
    let contactHours = 0;
    let workDays = 0;
    let vacDays = 0;
    let sickDays = 0;

    shiftsMap.forEach(shift => {
        // Calculate work hours (excluding contact hours type K)
        if (shift.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(shift.type)) {
            workHours += shift.hours;
        }

        // Calculate contact hours separately
        if (shift.contactHours) {
            contactHours += shift.contactHours;
        } else if (shift.type === 'K') {
            contactHours += shift.hours;
        }

        if (shift.type === 'WORK') workDays++;
        if (shift.type === 'UW') vacDays++;
        if (shift.type === 'L4') sickDays++;
    });

    // Add manual contact hours if they exist
    const manualContactHours = employee.monthlyContactHours?.[monthKey] || 0;
    contactHours += manualContactHours;

    const totalHours = workHours + contactHours;

    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    doc.line(startX, currentY, startX + (7 * cellWidth) - 1, currentY);

    currentY += 6;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 100, 180);
    doc.text('Podsumowanie:', startX, currentY);

    currentY += 5;
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    // Główna linia z podsumowaniem
    const summaryText = `Liczba dni roboczych: ${workDays}  |  Dni urlopowe: ${vacDays}  |  Dni chorobowe: ${sickDays}`;
    doc.text(summaryText, startX, currentY);

    // Suma godzin - podobnie jak w UI
    currentY += 4;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.text(`Suma: ${totalHours}h`, startX, currentY);

    // Rozpisanie (praca + kontakty)  
    currentY += 4;
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`(${workHours}h praca + ${contactHours}h kontakty)`, startX, currentY);

    // ===== STOPKA =====
    doc.setFontSize(7);
    doc.setFont('Roboto', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text(
        `Wygenerowano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
    );

    // ===== ZAPISZ =====
    const filename = `harmonogram_${employee.name.replace(/ /g, '_')}_${month}_${year}.pdf`;
    doc.save(filename);
}
