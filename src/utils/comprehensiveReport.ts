import jsPDF from 'jspdf';
import { format } from 'date-fns';

import type { Schedule, Employee } from '../types';
import { analyzeSchedule } from './analytics';

const MONTH_NAMES = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

interface EmployeeStats {
    name: string;
    workDays: number;
    totalHours: number;
    vacationDays: number;
    sickDays: number;
    otherAbsences: number;
}

function getEmployeeStats(employee: Employee, schedule: Schedule): EmployeeStats {
    const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
    const shifts = Object.values(employee.shifts).filter(s => s.date.startsWith(monthKey));

    return {
        name: employee.name,
        workDays: shifts.filter(s => s.type === 'WORK').length,
        totalHours: shifts.reduce((sum, s) => sum + s.hours, 0),
        vacationDays: shifts.filter(s => s.type === 'UW').length,
        sickDays: shifts.filter(s => s.type === 'L4').length,
        otherAbsences: shifts.filter(s => ['UZ', 'UŻ', 'UM', 'USW', 'OP', 'UB'].includes(s.type)).length
    };
}

function addTitlePage(doc: jsPDF, schedule: Schedule, type: 'monthly' | 'yearly') {
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(
        type === 'monthly' ? 'RAPORT MIESIĘCZNY' : 'RAPORT ROCZNY',
        105,
        40,
        { align: 'center' }
    );

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    const period = type === 'monthly'
        ? `${MONTH_NAMES[schedule.month - 1]} ${schedule.year}`
        : `Rok ${schedule.year}`;
    doc.text(period, 105, 55, { align: 'center' });

    doc.setFontSize(10);
    doc.text(
        `Wygenerowano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
        105,
        65,
        { align: 'center' }
    );

    // Summary box
    doc.setLineWidth(0.5);
    doc.rect(30, 80, 150, 60);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Podsumowanie Wykonawcze', 105, 90, { align: 'center' });

    const totalHours = schedule.employees.reduce((sum, emp) => {
        const stats = getEmployeeStats(emp, schedule);
        return sum + stats.totalHours;
    }, 0);

    const avgHours = totalHours / schedule.employees.length;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Liczba pracowników: ${schedule.employees.length}`, 40, 105);
    doc.text(`Łączna liczba godzin: ${totalHours}h`, 40, 115);
    doc.text(`Średnia godzin/pracownik: ${avgHours.toFixed(1)}h`, 40, 125);
}

function addTeamStats(doc: jsPDF, schedule: Schedule) {
    doc.addPage();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Statystyki Zespołu', 20, 20);

    const { alerts } = analyzeSchedule(schedule);
    const errors = alerts.filter(a => a.type === 'error');
    const warnings = alerts.filter(a => a.type === 'warning');

    let y = 35;

    // Alerts summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Alerty i Ostrzeżenia', 20, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Błędy krytyczne: ${errors.length}`, 25, y);
    y += 7;
    doc.text(`Ostrzeżenia: ${warnings.length}`, 25, y);
    y += 15;

    // List top 5 alerts
    if (alerts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Najważniejsze alerty:', 25, y);
        y += 7;
        doc.setFont('helvetica', 'normal');

        alerts.slice(0, 5).forEach(alert => {
            const text = `• ${alert.employeeName}: ${alert.message}`;
            const lines = doc.splitTextToSize(text, 160);
            lines.forEach((line: string) => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 30, y);
                y += 6;
            });
            y += 2;
        });
    }
}

function addEmployeeDetails(doc: jsPDF, schedule: Schedule) {
    doc.addPage();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Szczegóły Pracowników', 20, 20);

    // Table header
    let y = 35;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Nazwisko', 20, y);
    doc.text('Dni rob.', 80, y);
    doc.text('Godziny', 110, y);
    doc.text('Urlopy', 140, y);
    doc.text('L4', 165, y);
    doc.text('Inne', 185, y);

    doc.setLineWidth(0.3);
    doc.line(20, y + 2, 190, y + 2);
    y += 8;

    doc.setFont('helvetica', 'normal');

    schedule.employees.forEach((emp, idx) => {
        if (y > 270) {
            doc.addPage();
            y = 20;

            // Repeat header
            doc.setFont('helvetica', 'bold');
            doc.text('Nazwisko', 20, y);
            doc.text('Dni rob.', 80, y);
            doc.text('Godziny', 110, y);
            doc.text('Urlopy', 140, y);
            doc.text('L4', 165, y);
            doc.text('Inne', 185, y);
            doc.line(20, y + 2, 190, y + 2);
            y += 8;
            doc.setFont('helvetica', 'normal');
        }

        const stats = getEmployeeStats(emp, schedule);

        // Alternate row coloring
        if (idx % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(20, y - 5, 170, 7, 'F');
        }

        doc.text(stats.name, 20, y);
        doc.text(String(stats.workDays), 85, y, { align: 'right' });
        doc.text(`${stats.totalHours}h`, 125, y, { align: 'right' });
        doc.text(String(stats.vacationDays), 150, y, { align: 'right' });
        doc.text(String(stats.sickDays), 170, y, { align: 'right' });
        doc.text(String(stats.otherAbsences), 190, y, { align: 'right' });

        y += 7;
    });
}

function addVacationSummary(doc: jsPDF, schedule: Schedule) {
    doc.addPage();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Zestawienie Urlopów i Nieobecności', 20, 20);

    let y = 35;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Vacation limits info
    doc.setFont('helvetica', 'bold');
    doc.text('Limity:', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('• UŻ (Opieka nad dzieckiem): 4 dni/rok', 25, y);
    y += 7;
    doc.text('• USW (Siła wyższa): 16 godzin/rok', 25, y);
    y += 7;
    doc.text('• UW (Urlop wypoczynkowy): według umowy', 25, y);
    y += 15;

    // Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Pracownik', 20, y);
    doc.text('UW', 100, y);
    doc.text('L4', 120, y);
    doc.text('UŻ', 140, y);
    doc.text('USW (h)', 160, y);
    doc.text('Inne', 185, y);

    doc.setLineWidth(0.3);
    doc.line(20, y + 2, 190, y + 2);
    y += 8;

    doc.setFont('helvetica', 'normal');

    schedule.employees.forEach((emp, idx) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        const monthKey = `${schedule.year}-${String(schedule.month).padStart(2, '0')}`;
        const shifts = Object.values(emp.shifts).filter(s => s.date.startsWith(monthKey));

        const uw = shifts.filter(s => s.type === 'UW').length;
        const l4 = shifts.filter(s => s.type === 'L4').length;
        const uz = shifts.filter(s => s.type === 'UŻ').length;
        const uswHours = shifts
            .filter(s => s.type === 'USW')
            .reduce((sum, s) => sum + s.hours, 0);
        const other = shifts.filter(s => ['UZ', 'UM', 'OP', 'UB'].includes(s.type)).length;

        if (idx % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(20, y - 5, 170, 7, 'F');
        }

        doc.text(emp.name, 20, y);
        doc.text(String(uw), 105, y, { align: 'right' });
        doc.text(String(l4), 125, y, { align: 'right' });
        doc.text(`${uz}/4`, 145, y, { align: 'right' });
        doc.text(`${uswHours}/16`, 175, y, { align: 'right' });
        doc.text(String(other), 190, y, { align: 'right' });

        y += 7;
    });
}

export function generateComprehensiveReport(
    schedule: Schedule,
    type: 'monthly' | 'yearly' = 'monthly'
) {
    const doc = new jsPDF();

    // Page 1: Title
    addTitlePage(doc, schedule, type);

    // Page 2: Team stats
    addTeamStats(doc, schedule);

    // Page 3: Employee details
    addEmployeeDetails(doc, schedule);

    // Page 4: Vacation summary
    addVacationSummary(doc, schedule);

    // Save
    const filename = type === 'monthly'
        ? `raport_${MONTH_NAMES[schedule.month - 1]}_${schedule.year}.pdf`
        : `raport_roczny_${schedule.year}.pdf`;

    doc.save(filename);
}
