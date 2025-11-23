import * as XLSX from 'xlsx';
import type { Schedule } from '../types';
import { getDaysInMonth, setDate, format, isWeekend } from 'date-fns';

export function exportToExcel(schedule: Schedule) {
    const wb = XLSX.utils.book_new();

    // Przygotowanie danych
    const daysInMonth = getDaysInMonth(new Date(schedule.year, schedule.month - 1));
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        return setDate(new Date(schedule.year, schedule.month - 1), i + 1);
    });

    // Dane dla Excela
    const data: any[] = [];

    // Wiersz 1: Tytuł
    data.push(['HARMONOGRAM PRACY']);
    data.push([`${format(new Date(schedule.year, schedule.month - 1), 'LLLL yyyy')}`]);
    data.push([]); // Pusty wiersz

    // Wiersz z numerami dni
    const dayNumbersRow = ['Pracownik', ...days.map(d => format(d, 'd')), 'Suma godzin'];
    data.push(dayNumbersRow);

    // Wiersz z nazwami dni tygodnia
    const dayNameMap: Record<string, string> = {
        'poniedziałek': 'Pn',
        'wtorek': 'Wt',
        'środa': 'Śr',
        'czwartek': 'Cz',
        'piątek': 'Pt',
        'sobota': 'So',
        'niedziela': 'Nd'
    };

    const dayNamesRow = ['', ...days.map(d => {
        const fullName = format(d, 'EEEE', { locale: { name: 'pl' } as any }).toLowerCase();
        return dayNameMap[fullName] || fullName.substring(0, 2);
    }), ''];
    data.push(dayNamesRow);

    // Dane pracowników
    schedule.employees.forEach(emp => {
        const row: any[] = [emp.name];
        let totalHours = 0;

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const shift = emp.shifts[dateStr];

            if (shift) {
                totalHours += shift.hours;
                if (shift.type === 'WORK') {
                    row.push(`${shift.startHour}-${shift.endHour}\n${shift.hours}h`);
                } else if (shift.type === 'W') {
                    row.push('/');
                } else if (shift.type === 'K') {
                    row.push(`K${shift.hours}h`);
                } else if (['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(shift.type)) {
                    row.push(`${shift.type}`);
                } else {
                    row.push(shift.type);
                }
            } else {
                row.push('/');
            }
        });

        row.push(`${totalHours}h`);
        data.push(row);
    });

    // Tworzenie arkusza
    const ws = XLSX.utils.aoa_to_sheet(data);

    // ===== FORMATOWANIE =====
    // Ustawienie szerokości kolumn
    const wscols = [{ wch: 25 }]; // Kolumna pracownika
    for (let i = 0; i < daysInMonth; i++) wscols.push({ wch: 12 }); // Dni
    wscols.push({ wch: 12 }); // Suma
    ws['!cols'] = wscols;

    // Ustawienie wysokości wierszy
    ws['!rows'] = [
        { hpx: 25 }, // Wiersz tytułu
        { hpx: 20 }, // Wiersz miesiąca
        { hpx: 5 },  // Pusty wiersz
        { hpx: 20 }, // Nagłówek (numery dni)
        { hpx: 18 }, // Nazwy dni
    ];

    // Formatowanie komórek
    const defaultBorder = {
        top: { style: 'thin', color: { rgb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        left: { style: 'thin', color: { rgb: 'CCCCCC' } },
        right: { style: 'thin', color: { rgb: 'CCCCCC' } }
    };

    const headerBorder = {
        top: { style: 'medium', color: { rgb: '6BA3E5' } },
        bottom: { style: 'medium', color: { rgb: '6BA3E5' } },
        left: { style: 'thin', color: { rgb: '6BA3E5' } },
        right: { style: 'thin', color: { rgb: '6BA3E5' } }
    };

    // Formatowanie wiersza 1 (Tytuł)
    for (let col = 0; col < daysInMonth + 2; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].v = col === 0 ? 'HARMONOGRAM PRACY' : '';
        ws[cellRef].s = {
            font: { bold: true, size: 14, color: { rgb: '2D5AA0' } },
            fill: { fgColor: { rgb: 'E8F0F8' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: defaultBorder
        };
    }

    // Formatowanie wiersza 2 (Miesiąc)
    for (let col = 0; col < daysInMonth + 2; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 1, c: col });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].s = {
            font: { size: 11, color: { rgb: '666666' } },
            fill: { fgColor: { rgb: 'F5F5F5' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: defaultBorder
        };
    }

    // Formatowanie nagłówka (wiersz 4 - numery dni)
    for (let col = 0; col < daysInMonth + 2; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c: col });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].s = {
            font: { bold: true, size: 10, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '64A0DC' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: headerBorder
        };
    }

    // Formatowanie dni tygodnia (wiersz 5)
    for (let col = 0; col < daysInMonth + 2; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 4, c: col });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].s = {
            font: { bold: true, size: 9, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '9CBCE0' }, patternType: 'solid' },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: headerBorder
        };
    }

    // Formatowanie danych pracowników (wiersze 6+)
    for (let row = 5; row < data.length; row++) {
        for (let col = 0; col < daysInMonth + 2; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (!ws[cellRef]) ws[cellRef] = {};

            const isWeekendDay = col > 0 && col <= daysInMonth && isWeekend(days[col - 1]);
            const isNameColumn = col === 0;
            const isSumColumn = col === daysInMonth + 1;

            ws[cellRef].s = {
                font: { size: 10, color: { rgb: isNameColumn ? '1F2121' : '000000' } },
                fill: {
                    fgColor: { rgb: isNameColumn ? 'F5F5F5' : isWeekendDay ? 'F5E8F5' : 'FFFFFF' },
                    patternType: 'solid'
                },
                alignment: {
                    horizontal: isNameColumn ? 'left' : 'center',
                    vertical: 'center',
                    wrapText: true
                },
                border: defaultBorder
            };

            // Pogrubienie dla kolumny summy
            if (isSumColumn) {
                ws[cellRef].s.font = { bold: true, size: 10, color: { rgb: '2D5AA0' } };
                ws[cellRef].s.fill = {
                    fgColor: { rgb: 'E8F0F8' },
                    patternType: 'solid'
                };
            }
        }
    }

    // Wysokość wierszy danych
    for (let row = 5; row < data.length; row++) {
        if (!ws['!rows']) ws['!rows'] = [];
        ws['!rows'][row] = { hpx: 30 };
    }

    // Ustawienie print options
    ws['!print'] = {
        orientation: 'landscape',
        paperSize: 9, // A4
        scale: 100,
        fitToPage: true,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 }
    };

    XLSX.utils.book_append_sheet(wb, ws, `Grafik ${schedule.month}.${schedule.year}`);
    XLSX.writeFile(wb, `Grafik_${schedule.month}_${schedule.year}.xlsx`);
}
