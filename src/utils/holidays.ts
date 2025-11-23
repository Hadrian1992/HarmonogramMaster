import { addDays, getDate, getMonth } from 'date-fns';

export interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
    type: 'PUBLIC' | 'OBSERVANCE'; // Public holiday (wolne) or observance (święto, ale pracujące np. Wigilia)
}

function getEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

export function getHolidays(year: number, month: number): Holiday[] {
    const holidays: Holiday[] = [];
    const addHoliday = (d: number, m: number, name: string, type: 'PUBLIC' | 'OBSERVANCE' = 'PUBLIC') => {
        if (m === month) {
            holidays.push({
                date: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                name,
                type
            });
        }
    };

    // Fixed Holidays
    addHoliday(1, 1, 'Nowy Rok');
    addHoliday(6, 1, 'Trzech Króli');
    addHoliday(1, 5, 'Święto Pracy');
    addHoliday(2, 5, 'Dzień Flagi', 'OBSERVANCE');
    addHoliday(3, 5, 'Święto Konstytucji 3 Maja');
    addHoliday(15, 8, 'Wniebowzięcie NMP / Święto Wojska Polskiego');
    addHoliday(1, 11, 'Wszystkich Świętych');
    addHoliday(11, 11, 'Święto Niepodległości');
    addHoliday(24, 12, 'Wigilia', 'OBSERVANCE');
    addHoliday(25, 12, 'Boże Narodzenie (1. dzień)');
    addHoliday(26, 12, 'Boże Narodzenie (2. dzień)');
    addHoliday(31, 12, 'Sylwester', 'OBSERVANCE');

    // Movable Holidays
    const easter = getEaster(year);
    const easterMonday = addDays(easter, 1);
    const corpusChristi = addDays(easter, 60);
    const pentecost = addDays(easter, 49); // Zielone Świątki

    const checkMovable = (date: Date, name: string, type: 'PUBLIC' | 'OBSERVANCE' = 'PUBLIC') => {
        if (getMonth(date) + 1 === month) {
            holidays.push({
                date: `${year}-${String(getMonth(date) + 1).padStart(2, '0')}-${String(getDate(date)).padStart(2, '0')}`,
                name,
                type
            });
        }
    };

    checkMovable(easter, 'Wielkanoc');
    checkMovable(easterMonday, 'Poniedziałek Wielkanocny');
    checkMovable(pentecost, 'Zielone Świątki');
    checkMovable(corpusChristi, 'Boże Ciało');

    return holidays.sort((a, b) => a.date.localeCompare(b.date));
}
