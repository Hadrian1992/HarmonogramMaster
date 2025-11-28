import type { Schedule, Employee } from '../types';
import { analyzeSchedule } from './analytics';

export interface AIResponse {
    text: string;
    suggestedActions?: string[];
}

export interface StaffingRules {
    minStaffMorning: number;
    minStaffEvening: number;
    minStaffNight: number;
    customRules?: string;
}

/**
 * Simple rule-based AI service to answer questions about the schedule.
 * In a real app, this would call an LLM API (e.g., OpenAI).
 */
export async function askAI(
    question: string,
    schedule: Schedule,
    apiKey?: string,
    model?: string,
    staffingRules?: StaffingRules
): Promise<AIResponse> {
    // Jeśli podano klucz API, użyj OpenRouter
    if (apiKey) {
        return callOpenRouter(question, schedule, apiKey, model, staffingRules);
    }

    // Simulate network delay for local logic
    await new Promise(resolve => setTimeout(resolve, 600));

    const q = question.toLowerCase();
    const analysis = analyzeSchedule(schedule);
    const employees = schedule.employees;

    // 1. Pytania o błędy i alerty
    if (q.includes('błędy') || q.includes('problemy') || q.includes('alert')) {
        if (analysis.alerts.length === 0) {
            return { text: 'W harmonogramie nie wykryto żadnych błędów ani ostrzeżeń! 🎉' };
        }
        const errorCount = analysis.alerts.filter(a => a.type === 'error').length;
        const warningCount = analysis.alerts.filter(a => a.type === 'warning').length;

        let response = `Znaleziono ${errorCount} błędów i ${warningCount} ostrzeżeń.\n`;
        const topAlerts = analysis.alerts.slice(0, 3);
        topAlerts.forEach(alert => {
            response += `- ${alert.employeeName}: ${alert.message}\n`;
        });
        if (analysis.alerts.length > 3) {
            response += `...i ${analysis.alerts.length - 3} więcej.`;
        }
        return { text: response };
    }

    // 2. Pytania o godziny (najwięcej/najmniej)
    if (q.includes('najwięcej godzin') || q.includes('przepracowany')) {
        const sorted = [...employees].sort((a, b) => getEmployeeTotalHours(b) - getEmployeeTotalHours(a));
        const top = sorted[0];
        return {
            text: `Najwięcej godzin w tym miesiącu ma ${top.name}: ${getEmployeeTotalHours(top)}h.`
        };
    }

    if (q.includes('najmniej godzin')) {
        const sorted = [...employees].sort((a, b) => getEmployeeTotalHours(a) - getEmployeeTotalHours(b));
        const bottom = sorted[0];
        return {
            text: `Najmniej godzin w tym miesiącu ma ${bottom.name}: ${getEmployeeTotalHours(bottom)}h.`
        };
    }

    // 3. Pytania o konkretnego pracownika
    const foundEmployee = employees.find(e => q.includes(e.name.toLowerCase()));
    if (foundEmployee) {
        const hours = getEmployeeTotalHours(foundEmployee);
        const shifts = Object.values(foundEmployee.shifts).filter(s => s.type === 'WORK').length;
        return {
            text: `${foundEmployee.name} ma zaplanowane ${hours}h w ${shifts} zmianach.`
        };
    }

    // 4. Pytania o braki / luki (prosta analiza)
    if (q.includes('braki') || q.includes('luki') || q.includes('nieobsadzone')) {
        // To jest uproszczenie - w pełnej wersji sprawdzalibyśmy timeline
        return {
            text: 'Aby sprawdzić dokładne luki w obsadzie, przejdź do widoku "Timeline". Tam zobaczysz godziny, w których brakuje pracowników.'
        };
    }

    // 5. Pytania o urlopy
    if (q.includes('urlop') || q.includes('wolne')) {
        let vacationCount = 0;
        employees.forEach(e => {
            vacationCount += Object.values(e.shifts).filter(s => ['UW', 'UŻ', 'USW'].includes(s.type)).length;
        });
        return {
            text: `W tym miesiącu zaplanowano łącznie ${vacationCount} dni urlopowych dla całego zespołu.`
        };
    }

    // Default response
    return {
        text: 'Przepraszam, nie zrozumiałem pytania. Mogę odpowiedzieć na pytania o:\n- Błędy w grafiku\n- Kto ma najwięcej godzin\n- Statystyki konkretnego pracownika\n- Urlopy',
        suggestedActions: ['Pokaż błędy', 'Kto ma najwięcej godzin?', 'Podsumowanie urlopów']
    };
}

function getEmployeeTotalHours(employee: Employee): number {
    return Object.values(employee.shifts).reduce((sum, s) => {
        if (s.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type)) {
            return sum + s.hours;
        }
        return sum;
    }, 0);
}

// ===== OPENROUTER INTEGRATION =====

async function callOpenRouter(
    question: string,
    schedule: Schedule,
    _apiKey: string, // Kept for signature compatibility, but ignored or used as fallback if needed (though backend handles it)
    model: string = 'google/gemini-2.0-flash-exp:free',
    staffingRules?: StaffingRules
): Promise<AIResponse> {
    const context = generateScheduleContext(schedule);
    const advisorContext = generateAdvisorContext(schedule, staffingRules);

    const systemPrompt = `
Jesteś ZAAWANSOWANYM DORADCĄ I STRAŻNIKIEM harmonogramu (Advanced Scheduler Advisor).
Twoim celem jest nie tylko analiza bieżącego miesiąca, ale dbanie o długofalową sprawiedliwość, przestrzeganie preferencji pracowników i pilnowanie reguł obsady.

Oto PEŁNE DANE harmonogramu (obejmujące poprzedni i aktualny miesiąc):
${context}

DODATKOWY KONTEKST DORADCY (Pamięć Długoterminowa, Preferencje i Reguły):
${advisorContext}

PROTOKÓŁ ANALIZY (Chain of Thought):
1. Zrozum pytanie użytkownika.
2. Przeanalizuj dane w kontekście pytania. Patrz na KAŻDY dzień.
3. Sprawdź zgodność z regułami KODEKSU PRACY (szczególnie ciągłość na przełomie miesięcy).
4. Sprawdź zgodność z PREFERENCJAMI pracowników (czy ktoś nie dostał zmiany, której nie lubi?).
5. Sprawdź SPRAWIEDLIWOŚĆ DŁUGOFALOWĄ (czy ktoś nie ma za dużo weekendów w skali roku?).
6. Sprawdź REGUŁY OBSADY (czy spełnione są minima, czy przestrzegane są reguły użytkownika).
7. Przeprowadź SYMULACJĘ (jeśli pytanie dotyczy "co jeśli"):
   - Wyobraź sobie zmianę.
   - Sprawdź, czy nie naruszy reguł (obsada, kodeks).
   - Oceń skutki.

ZASADY ODPOWIEDZI:
1. Bądź konkretny. Podawaj daty i nazwiska.
2. Jeśli widzisz błędy (kodeks, preferencje, sprawiedliwość, reguły obsady), ZAWSZE o nich wspomnij.
3. Jeśli pytanie dotyczy symulacji ("co jeśli"), opisz skutki BEZ ZMIENIANIA GRAFIKU.
4. Używaj Markdown.
5. Odpowiadaj w języku polskim.
`;

    try {
        // Use backend proxy with GDPR Anonymization support
        const employeeNames = schedule.employees.map(e => e.name);

        const response = await fetch('http://localhost:3001/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Send cookies
            body: JSON.stringify({
                model: model,
                systemPrompt: systemPrompt,
                userMessage: question,
                employeeNames: employeeNames
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || 'Przepraszam, nie otrzymałem odpowiedzi od AI.';

        return { text };
    } catch (error) {
        console.error('AI Error:', error);
        return { text: 'Wystąpił błąd połączenia z asystentem AI. Sprawdź połączenie z serwerem.' };
    }
}

function generateAdvisorContext(schedule: Schedule, staffingRules?: StaffingRules): string {
    let context = `--- PREFERENCJE I NOTATKI ---\n`;

    schedule.employees.forEach(emp => {
        if (emp.preferences) {
            context += `[${emp.name}]: ${emp.preferences}\n`;
        }
    });

    if (context === `--- PREFERENCJE I NOTATKI ---\n`) {
        context += "(Brak notatek o preferencjach)\n";
    }

    // Add Custom Staffing Rules
    if (staffingRules) {
        context += `\n--- REGUŁY OBSADY (STRAŻNIK) ---\n`;
        context += `Min. Rano: ${staffingRules.minStaffMorning}\n`;
        context += `Min. Popołudnie: ${staffingRules.minStaffEvening}\n`;
        context += `Min. Noc: ${staffingRules.minStaffNight}\n`;

        if (staffingRules.customRules) {
            context += `\nDODATKOWE REGUŁY UŻYTKOWNIKA:\n`;
            context += `${staffingRules.customRules}\n`;
            context += `(Powyższe reguły są priorytetowe - jeśli użytkownik prosi o coś specyficznego, przestrzegaj tego).\n`;
        }
    }

    context += `\n--- STATYSTYKI ROCZNE (Symulowane) ---\n`;
    // W prawdziwej aplikacji tutaj pobieralibyśmy dane z bazy.
    // Tutaj symulujemy, że AI ma dostęp do historii, bazując na bieżącym stanie.
    schedule.employees.forEach(emp => {
        // Prostym heurystyka: zakładamy, że obecny miesiąc jest reprezentatywny, 
        // ale AI ma "pamiętać", że np. Pani X miała dużo nocek w poprzednich miesiącach.
        // W pełnej wersji tu byłaby agregacja z useScheduleStore.
        context += `${emp.name}: Historia dostępna w systemie (analizuj bieżące obciążenie jako trend).\n`;
    });

    return context;
}

function generateScheduleContext(schedule: Schedule): string {
    const analysis = analyzeSchedule(schedule);
    let context = '';

    // 1. Statystyki ogólne
    context += `--- PODSUMOWANIE ---\n`;
    context += `Aktualny miesiąc: ${schedule.month}/${schedule.year}\n`;
    context += `Liczba pracowników: ${schedule.employees.length}\n`;
    context += `Błędy walidacji (bieżący msc): ${analysis.alerts.filter(a => a.type === 'error').length}\n`;
    context += `Ostrzeżenia (bieżący msc): ${analysis.alerts.filter(a => a.type === 'warning').length}\n\n`;

    // 2. Błędy (zawsze na początku)
    if (analysis.alerts.length > 0) {
        context += `--- BŁĘDY I OSTRZEŻENIA (BIEŻĄCY MSC) ---\n`;
        analysis.alerts.forEach(a => {
            context += `[${a.type.toUpperCase()}] ${a.employeeName}: ${a.message}\n`;
        });
        context += '\n';
    }

    // 3. PEŁNY GRAFIK (Multi-month Context)
    context += `--- SZCZEGÓŁOWY GRAFIK ---\n`;
    context += `Legenda: 7-15 (godziny pracy), W (wolne), UW (urlop wypoczynkowy), L4 (chorobowe), itd.\n\n`;

    // Oblicz poprzedni miesiąc
    let prevMonth = schedule.month - 1;
    let prevYear = schedule.year;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }

    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const daysInCurrentMonth = new Date(schedule.year, schedule.month, 0).getDate();

    schedule.employees.forEach(emp => {
        const totalHours = getEmployeeTotalHours(emp);
        context += `PRACOWNIK: ${emp.name} (Suma godzin w bieżącym msc: ${totalHours})\n`;

        // Poprzedni miesiąc (ostatnie 7 dni dla kontekstu ciągłości)
        const prevMonthStartDay = Math.max(1, daysInPrevMonth - 6); // Pokaż ostatni tydzień
        let prevScheduleLine = `  [${prevMonth}/${prevYear} - końcówka]: `;

        for (let day = prevMonthStartDay; day <= daysInPrevMonth; day++) {
            const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shift = emp.shifts[dateStr];

            let shiftInfo = 'W';
            if (shift) {
                if (shift.type === 'WORK') {
                    shiftInfo = `${shift.startHour}-${shift.endHour}`;
                } else {
                    shiftInfo = shift.type;
                }
            }
            prevScheduleLine += `${day}=${shiftInfo}, `;
        }
        context += prevScheduleLine.slice(0, -2) + '\n';

        // Bieżący miesiąc
        let currentScheduleLine = `  [${schedule.month}/${schedule.year} - AKTUALNY]: `;
        for (let day = 1; day <= daysInCurrentMonth; day++) {
            const dateStr = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shift = emp.shifts[dateStr];

            let shiftInfo = 'W';
            if (shift) {
                if (shift.type === 'WORK') {
                    shiftInfo = `${shift.startHour}-${shift.endHour}`;
                } else {
                    shiftInfo = shift.type;
                }
            }
            currentScheduleLine += `${day}=${shiftInfo}, `;
        }
        context += currentScheduleLine.slice(0, -2) + '\n\n';
    });

    return context;
}
