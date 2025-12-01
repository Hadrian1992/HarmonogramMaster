import type { Schedule, Employee } from '../types';
import type { Message } from '../store/useChatStore';
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
    staffingRules?: StaffingRules,
    conversationHistory?: Message[]
): Promise<AIResponse> {
    // Jeśli podano klucz API, użyj OpenRouter
    if (apiKey) {
        return callOpenRouter(question, schedule, apiKey, model, staffingRules, conversationHistory);
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
        const sorted = [...employees].sort((a, b) => getEmployeeTotalHours(b, schedule.month, schedule.year) - getEmployeeTotalHours(a, schedule.month, schedule.year));
        const top = sorted[0];
        return {
            text: `Najwięcej godzin w tym miesiącu ma ${top.name}: ${getEmployeeTotalHours(top, schedule.month, schedule.year)}h.`
        };
    }

    if (q.includes('najmniej godzin')) {
        const sorted = [...employees].sort((a, b) => getEmployeeTotalHours(a, schedule.month, schedule.year) - getEmployeeTotalHours(b, schedule.month, schedule.year));
        const bottom = sorted[0];
        return {
            text: `Najmniej godzin w tym miesiącu ma ${bottom.name}: ${getEmployeeTotalHours(bottom, schedule.month, schedule.year)}h.`
        };
    }

    // 3. Pytania o konkretnego pracownika
    const foundEmployee = employees.find(e => q.includes(e.name.toLowerCase()));
    if (foundEmployee) {
        const hours = getEmployeeTotalHours(foundEmployee, schedule.month, schedule.year);
        const shifts = Object.values(foundEmployee.shifts).filter(s => s.type === 'WORK' && s.date.startsWith(`${schedule.year}-${String(schedule.month).padStart(2, '0')}`)).length;
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
            vacationCount += Object.values(e.shifts).filter(s => ['UW', 'UŻ', 'USW'].includes(s.type) && s.date.startsWith(`${schedule.year}-${String(schedule.month).padStart(2, '0')}`)).length;
        });
        return {
            text: `W tym miesiącu zaplanowano łącznie ${vacationCount} dni urlopowych dla całego zespołu.`
        };
    }

    // === KEYWORD DEFINITIONS ===
    const planningKeywords = [
        'zaproponuj', 'zaplanuj', 'ułóż', 'układanie', 'plan',
        'harmonogram', 'grafik', 'rozpisz', 'ustal', 'stwórz',
        'generuj', 'zrób grafik', 'kolejny tydzień', 'przyszły tydzień',
        'kto kiedy', 'obsada', 'grafiku'
    ];

    const replacementKeywords = [
        'zastępstw', 'zamiennik', 'kto może', 'replacement',
        'szukam kogoś', 'potrzebuję kogoś', 'nie ma kogoś',
        'wolne', 'kto za', 'czy ktoś może', 'zamiana',
        'dziura', 'brak', 'nie może', 'wypadł', 'chory',
        'urlop', 'zmiennik'
    ];

    // === SCHEDULE PLANNING CHECK ===
    // Check if user is asking to plan upcoming days/weeks
    if (planningKeywords.some(keyword => q.includes(keyword))) {
        // Try to use the specialized schedule helper
        const { parseSchedulePlanningQuery, askScheduleHelper } = await import('./scheduleHelper');
        const planningRequest = parseSchedulePlanningQuery(question, schedule);

        if (planningRequest) {
            // Add staffing rules if available
            if (staffingRules) {
                planningRequest.staffingRules = staffingRules;
            }

            try {
                const result = await askScheduleHelper(planningRequest);
                return { text: result.suggestion };
            } catch (error) {
                console.error('Schedule Helper failed:', error);
                // Fall through to general AI
            }
        }
    }

    // === REPLACEMENT ADVISOR CHECK ===
    // Check if user is asking for replacement
    if (replacementKeywords.some(keyword => q.includes(keyword))) {
        // Try to use the specialized replacement advisor
        const { parseReplacementQuery, askReplacementAdvisor } = await import('./replacementAdvisor');
        const replacementRequest = parseReplacementQuery(question, schedule);

        if (replacementRequest) {
            try {
                const result = await askReplacementAdvisor(replacementRequest);
                return { text: result.aiAnalysis };
            } catch (error) {
                console.error('Replacement Advisor failed:', error);
                // Fall through to general AI
            }
        }
    }

    // === TU BYŁ BŁĄD ===
    // Jeśli kod doszedł tutaj, to znaczy, że pytanie nie pasowało do żadnego "if" powyżej.
    // Zamiast wyświetlać "Nie zrozumiałem", wysyłamy pytanie do prawdziwego AI (OpenRouter).

    console.log('Brak lokalnego dopasowania, przekazuję pytanie do OpenRouter...');

    return await callOpenRouter(
        question,
        schedule,
        apiKey || '',
        model,
        staffingRules,
        conversationHistory
    );
}

function getEmployeeTotalHours(employee: Employee, month: number, year: number): number {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    return Object.values(employee.shifts).reduce((sum, s) => {
        if (s.date.startsWith(monthKey) && (s.type === 'WORK' || ['L4', 'UW', 'UZ', 'OP', 'UŻ', 'UM', 'USW', 'UB'].includes(s.type))) {
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
    model: string = 'google/gemini-3-pro-preview',
    staffingRules?: StaffingRules,
    conversationHistory?: Message[]
): Promise<AIResponse> {
    const context = generateScheduleContext(schedule);
    const advisorContext = generateAdvisorContext(schedule, staffingRules);

    const systemPrompt = `
Jesteś AI Asystentem systemu **Harmonogram Master** - inteligentnym pomocnikiem do zarządzania grafikami pracy.

═══════════════════════════════════════════════════════════
TWOJE PODSTAWOWE ROLE
═══════════════════════════════════════════════════════════

🎯 **GŁÓWNA SPECJALIZACJA**: Doradzanie w sprawach harmonogramu pracy
   - Analiza grafików i wykrywanie błędów
   - Sprawdzanie zgodności z Kodeksem Pracy
   - Sugerowanie optymalizacji
   - Szukanie zastępstw (w rozwoju)

💬 **ROLA POMOCNIKA**: Odpowiadanie na pytania ogólne użytkownika
   - Jeśli użytkownik pyta o coś niezwiązanego z grafikiem (np. "jesteś dostępny?", "pomożesz mi?"), odpowiedz naturalnie i przyjaźnie
   - Nie odmawiaj odpowiedzi na pytania wykraczające poza harmonogram
   - Zachowaj przyjazny i pomocny ton

═══════════════════════════════════════════════════════════
DANE HARMONOGRAMU (jeśli pytanie dotyczy grafiku)
═══════════════════════════════════════════════════════════

${context}

DODATKOWY KONTEKST:
${advisorContext}

═══════════════════════════════════════════════════════════
JAK ANALIZOWAĆ HARMONOGRAM (gdy pytanie o grafik)
═══════════════════════════════════════════════════════════

1. **Zrozum pytanie** - czy dotyczy grafiku, konkretnej osoby, czy jest ogólne?
2. **Przeanalizuj dane** - sprawdź każdy dzień w kontekście pytania
3. **Sprawdź Kodeks Pracy**:
   - Min. 11h odpoczynku między zmianami
   - Max. 40h tygodniowo (średnio)
   - Zakaz pracy 2 nocki pod rząd bez 24h przerwy
4. **Sprawdź preferencje** pracowników (jeśli dostępne)
5. **Oceń sprawiedliwość** - czy obciążenie jest równomierne?
6. **Sprawdź reguły obsady** (minimalne liczby pracowników)

═══════════════════════════════════════════════════════════
ZASADY ODPOWIEDZI
═══════════════════════════════════════════════════════════

✅ **Bądź konkretny**: Podawaj daty, nazwiska, konkretne godziny
✅ **Bądź pomocny**: Jeśli widzisz błąd, zaproponuj rozwiązanie
✅ **Używaj Markdown**: Formatuj odpowiedzi czytelnie
✅ **Język polski**: Zawsze odpowiadaj po polsku
✅ **Elastyczność**: Jeśli pytanie nie dotyczy grafiku, po prostu pomóż w czym możesz

⚠️ **Nie zmieniaj grafiku** - tylko doradzaj i wskazuj problemy
`;

    try {
        // Use backend proxy with GDPR Anonymization support
        const employeeNames = schedule.employees.map(e => e.name);

        // Build conversation history for API (last 10 messages to save tokens)
        const messagesForAPI: { role: 'user' | 'assistant', content: string }[] = [];
        if (conversationHistory && conversationHistory.length > 1) {
            // Skip the welcome message and take last 10 messages
            const recentMessages = conversationHistory
                .filter(msg => msg.id !== 'welcome')
                .slice(-10);

            recentMessages.forEach(msg => {
                if (msg.sender === 'user') {
                    messagesForAPI.push({ role: 'user', content: msg.text });
                } else if (msg.sender === 'ai') {
                    messagesForAPI.push({ role: 'assistant', content: msg.text });
                }
            });
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Send cookies
            body: JSON.stringify({
                model: model,
                systemPrompt: systemPrompt,
                userMessage: question,
                employeeNames: employeeNames,
                conversationHistory: messagesForAPI,
                anonymize: false  // ← DODAJ ten parametr usuń przy audycie
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
        const totalHours = getEmployeeTotalHours(emp, schedule.month, schedule.year);
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
