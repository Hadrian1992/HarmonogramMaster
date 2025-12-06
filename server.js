import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import transporter from './mailer.js';
import { generatePdfBuffer } from './pdfGenerator.js';
import { findBestReplacement } from './replacementFinder.js';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');

// Secrets
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',       // Dev lokalny
        'http://localhost:4173',       // Preview lokalny
        'https://bidulgrafik.pl'       // <--- TWOJA DOMENA (bez ukośnika na końcu)
    ],
    credentials: true // Allow cookies
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize db.json if not exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        schedule: null,
        chatSessions: [],
        settings: {}
    }, null, 2));
}

// --- AUTH MIDDLEWARE ---
const authenticateCookie = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// --- ROUTES ---

// 1. AUTH ROUTES
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,          // ZMIEŃ NA TRUE (bo używasz Cloudflare HTTPS)
            sameSite: 'none',      // ZMIEŃ NA NONE (to pozwala na cross-site cookie w HTTPS)
            maxAge: 12 * 60 * 60 * 1000 // 12h
        });

        return res.json({ success: true });
    }
    return res.status(401).json({ error: 'Nieprawidłowe hasło' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,      // <--- ZMIANA NA TRUE
        sameSite: 'none'   // <--- ZMIANA NA NONE
    });
    res.json({ success: true });
});

app.get('/api/me', authenticateCookie, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ user: req.user });
});

// DODAJ TO PONIŻEJ:
app.get('/api/verify', authenticateCookie, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ user: req.user });
});

// 2. AI ROUTES (Protected)
app.get('/api/ai/models', authenticateCookie, async (req, res) => {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        const data = await response.json();

        if (!data.data) throw new Error('Invalid response from OpenRouter');

        const allowedKeywords = ['gpt', 'claude', 'gemini', 'llama', 'deepseek'];

        const models = data.data
            .filter(model => allowedKeywords.some(k => model.id.toLowerCase().includes(k)))
            .sort((a, b) => {
                // Simple heuristic: prefer newer/better models
                const score = (id) => {
                    if (id.includes('claude-3-5')) return 100;
                    if (id.includes('gpt-4o')) return 90;
                    if (id.includes('gemini-2')) return 85;
                    if (id.includes('claude-3')) return 80;
                    if (id.includes('gpt-4')) return 70;
                    return 0;
                };
                return score(b.id) - score(a.id);
            })
            .map(model => ({
                id: model.id,
                name: model.name,
                pricing: model.pricing,
                context_length: model.context_length
            }));

        res.json(models);
    } catch (error) {
        console.error('Error fetching models:', error);
        res.json([]); // Fallback to empty list
    }
});

// --- HELPER FUNCTIONS FOR ANONYMIZATION ---
function anonymize(text, names) {
    const map = {};
    let anonymizedText = text;

    // Create map and replace names
    // Sort names by length (descending) to avoid partial matches issues
    const sortedNames = [...names].sort((a, b) => b.length - a.length);

    sortedNames.forEach((name, index) => {
        const alias = `Pracownik_${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) || ''}`;
        map[alias] = name;
        // Global replace of the name with alias
        // Escape special regex chars in name just in case
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedName, 'g');
        anonymizedText = anonymizedText.replace(regex, alias);
    });

    return { anonymizedText, map };
}

function deanonymize(text, map) {
    let deanonymizedText = text;
    // Iterate over map entries and replace aliases back to real names
    for (const [alias, realName] of Object.entries(map)) {
        // 1. Try exact match
        let regex = new RegExp(alias, 'g');
        deanonymizedText = deanonymizedText.replace(regex, realName);

        // 2. Try match with escaped underscore (common in Markdown from LLMs)
        // Pracownik_A -> Pracownik\_A
        const escapedAlias = alias.replace('_', '\\\\_'); // Double backslash for regex literal
        regex = new RegExp(escapedAlias, 'g');
        deanonymizedText = deanonymizedText.replace(regex, realName);
    }
    return deanonymizedText;
}

app.post('/api/ai/chat', authenticateCookie, async (req, res) => {
    const { systemPrompt, userMessage, employeeNames, model, conversationHistory, anonymize = true, messages: legacyMessages } = req.body;

    if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'Server missing API Key' });
    }

    try {
        let finalMessages = [];
        let map = {};

        // Handle new format (with optional anonymization)
        if (systemPrompt && userMessage && employeeNames) {
            // Night Shift Rules (always added to system prompt)
            const nightShiftRules = `
        WAŻNE: Obsługa nocnych zmian
        Jeśli godzina końca < godzina startu (np. start: 20:00, koniec: 08:00), oznacza to przeskok przez północ.
        Oblicz godziny jako: (24 - start) + koniec.
        Przykład: 20:00 → 08:00 = (24 - 20) + 8 = 12 godzin.
        `;
            if (anonymize) {
                // ===== MODE: GDPR ANONYMIZATION =====
                console.log('Processing with GDPR Anonymization (anonymize=true)');
                // 1. Anonymize System Prompt
                const { anonymizedText: anonSystem, map: systemMap } = anonymize(systemPrompt, employeeNames);
                map = { ...systemMap };
                const finalSystemPrompt = anonSystem + nightShiftRules;
                // 2. Start with system message
                finalMessages.push({ role: 'system', content: finalSystemPrompt });
                // 3. Add conversation history (anonymized)
                if (conversationHistory && conversationHistory.length > 0) {
                    console.log(`Adding ${conversationHistory.length} messages from conversation history (anonymized)`);
                    conversationHistory.forEach(msg => {
                        // Anonymize each message
                        let anonContent = msg.content;
                        const sortedNames = [...employeeNames].sort((a, b) => b.length - a.length);
                        sortedNames.forEach((name, index) => {
                            const alias = `Pracownik_${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) || ''}`;
                            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(escapedName, 'g');
                            anonContent = anonContent.replace(regex, alias);
                        });
                        finalMessages.push({ role: msg.role, content: anonContent });
                    });
                }
                // 4. Add current user message (anonymized)
                let anonUser = userMessage;
                const sortedNames = [...employeeNames].sort((a, b) => b.length - a.length);
                sortedNames.forEach((name, index) => {
                    const alias = `Pracownik_${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) || ''}`;
                    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedName, 'g');
                    anonUser = anonUser.replace(regex, alias);
                });
                finalMessages.push({ role: 'user', content: anonUser });
                console.log('--- GDPR ANONYMIZATION MODE ---');
                console.log('System Prompt (snippet):', finalSystemPrompt.substring(0, 200) + '...');
                console.log('User Message (anonymized):', anonUser);
                console.log('Total messages:', finalMessages.length);
                console.log('--------------------------------');
            } else {
                // ===== MODE: NO ANONYMIZATION (Privacy by Initials) =====
                console.log('Processing WITHOUT anonymization (anonymize=false)');
                const finalSystemPrompt = systemPrompt + nightShiftRules;
                // 1. Start with system message (NO anonymization)
                finalMessages.push({ role: 'system', content: finalSystemPrompt });
                // 2. Add conversation history (NO anonymization)
                if (conversationHistory && conversationHistory.length > 0) {
                    console.log(`Adding ${conversationHistory.length} messages from conversation history (plain text)`);
                    conversationHistory.forEach(msg => {
                        finalMessages.push({ role: msg.role, content: msg.content });
                    });
                }
                // 3. Add current user message (NO anonymization)
                finalMessages.push({ role: 'user', content: userMessage });
                console.log('--- NO ANONYMIZATION MODE ---');
                console.log('System Prompt (snippet):', finalSystemPrompt.substring(0, 200) + '...');
                console.log('User Message (plain):', userMessage);
                console.log('Total messages:', finalMessages.length);
                console.log('-----------------------------');
            }
        } else if (legacyMessages) {
            // Fallback for old frontend code (if any)
            finalMessages = legacyMessages;
        } else {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'HarmonogramMaster'
            },
            body: JSON.stringify({
                model: model || 'google/gemini-2.0-flash-exp:free',
                messages: finalMessages
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
        }

        const data = await response.json();

        // 4. Deanonymize Response
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const originalContent = data.choices[0].message.content;
            const deanonymizedContent = deanonymize(originalContent, map);
            data.choices[0].message.content = deanonymizedContent;
        }

        res.json(data);
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Failed to communicate with AI' });
    }
});

// AI Replacement Advisor - combines replacementFinder.js with AI analysis
app.post('/api/ai/replacement-advisor', authenticateCookie, async (req, res) => {
    const { employeeName, date, shiftType, schedule, includeContactHours = false } = req.body;

    if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'Server missing API Key' });
    }

    try {
        // 1. Find employee ID
        const employee = schedule.employees.find(e => e.name === employeeName);
        if (!employee) {
            return res.status(404).json({ error: `Employee "${employeeName}" not found` });
        }

        // 2. Call replacementFinder.js to get candidates with scores
        console.log(`Finding replacement for ${employeeName} on ${date} (${shiftType})`);
        const candidates = await findBestReplacement({
            date,
            shiftType,
            employeeOutId: employee.id,
            schedule,
            includeContactHours
        });

        // 3. Prepare detailed context for AI
        const monthKey = date.substring(0, 7);

        // Get all employees' current hours for AI context
        const employeeHoursSummary = schedule.employees.map(emp => {
            const monthlyHours = Object.values(emp.shifts)
                .filter(s => s.date.startsWith(monthKey))
                .reduce((acc, s) => acc + (s.hours || 0), 0);
            return `- ${emp.name}: ${monthlyHours}h`;
        }).join('\n');

        const candidatesSummary = candidates.slice(0, 10).map((c, idx) => {
            const status = c.score <= 0 ? '❌ ILLEGAL' : c.score < 50 ? '⚠️ Suboptimal' : '✅ Good';
            return `${idx + 1}. **${c.name}** (Score: ${c.score}) ${status}
   - Monthly hours: ${c.details.monthlyHours}h
   - Reasons: ${c.reasons.join(', ') || 'No issues'}`;
        }).join('\n\n');

        const systemPrompt = `Jesteś ekspertem ds. harmonogramów. Pomagasz znaleźć zastępstwo i proponujesz ALTERNATYWNE SCENARIUSZE.

ZADANIE: Znajdź zastępstwo dla **${employeeName}** na **${date}** (zmiana **${shiftType}**)

WYNIKI ALGORYTMU (replacementFinder.js):
${candidatesSummary}

OBECNE GODZINY PRACOWNIKÓW (${monthKey}):
${employeeHoursSummary}

REGUŁY SYSTEMU (KRYTYCZNE):
1. **Maria Pankowska (Lider)**: NIE pracuje w weekendy, NIE pracuje na nockach (20-8), TYLKO zmiany 8:00-20:00
2. **11h Daily Rest**: ILLEGAL jeśli przerwa między zmianami < 11h
3. **2 Nocki → 2 Dni Wolne**: Po 2 nockach pod rząd zalecane 2 dni wolnego
4. **Weekend Fairness**: Sprawdzamy czy pracownik pracował w zeszły weekend
5. **Balansowanie godzin**: Unikamy przypisywania osobom z > średnia +10h
6. **Max godziny**: >160h = przekroczenie normy

TWOJE ZADANIA:
1. **Wyjaśnij wyniki**: Dlaczego niektórzy mają niskie oceny?
2. **Wybierz najlepszego kandydata**: Kto jest najbezpieczniejszy wybór?
3. **ZAPROPONUJ ALTERNATYWY**: 
   - Co jeśli przeniesiemy zmianę X pracownika A na pracownika B?
   - Oblicz nowe godziny (A, B)
   - Sprawdź czy reguły są przestrzegane
   - Zaproponuj, NIE wykonuj (użytkownik decyduje)

PRZYKŁAD ALTERNATYWY:
"Pracownik B ma ocenę -50 bo pracował w zeszły weekend. Alternatywnie:
- Przeniesiemy nockę B z 14.12 (20-8) → Pracownik D
- Pracownik B weźmie zastępstwo za ${employeeName} (${shiftType})
Sprawdzenie:
- D: 130h + 12h = 142h ✅
- B: 155h - 12h + 8h = 151h ✅
- Żadne reguły nie naruszone ✅"

FORMAT ODPOWIEDZI:
- Używaj Markdown
- Bądź konkretny (daty, nazwiska, godziny)
- Lista kandydatów: najlepsi na górze
- Sekcja "🔄 Alternatywne scenariusze" na końcu
`;

        // 4. Call AI
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'HarmonogramMaster-ReplacementAdvisor'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-exp:free',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Przeanalizuj i zaproponuj rozwiązania.` }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const aiAnalysis = data.choices[0]?.message?.content || 'Brak odpowiedzi od AI.';

        // 5. Return combined result
        res.json({
            candidates: candidates.slice(0, 10), // Top 10
            aiAnalysis,
            employeeName,
            date,
            shiftType
        });

    } catch (error) {
        console.error('Replacement Advisor Error:', error);
        res.status(500).json({ error: 'Failed to analyze replacements' });
    }
});

// AI Schedule Helper - helps plan upcoming days/weeks
app.post('/api/ai/schedule-helper', authenticateCookie, async (req, res) => {
    const { schedule, startDate, endDate, staffingRules } = req.body;

    if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'Server missing API Key' });
    }

    try {
        // 1. Calculate current hours for each employee (up to startDate)
        const monthKey = startDate.substring(0, 7);
        const employeeHours = schedule.employees.map(emp => {
            const hours = Object.values(emp.shifts)
                .filter(s => s.date.startsWith(monthKey) && s.date < startDate)
                .reduce((acc, s) => acc + (s.hours || 0), 0);

            const contactHours = Object.values(emp.shifts)
                .filter(s => s.date.startsWith(monthKey) && s.date < startDate)
                .reduce((acc, s) => acc + (s.contactHours || (s.type === 'K' ? s.hours : 0) || 0), 0);

            const manualContact = emp.monthlyContactHours?.[monthKey] || 0;
            const totalHours = hours + contactHours + manualContact;

            return { name: emp.name, hours, contactHours, manualContact, totalHours };
        });

        // 2. Get recent schedule (last 14 days before startDate)
        const recentDays = [];
        for (let i = 14; i > 0; i--) {
            const date = new Date(startDate);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            if (dateStr.startsWith(monthKey)) {
                const dayShifts = schedule.employees.map(emp => {
                    const shift = emp.shifts[dateStr];
                    if (!shift || !shift.type || shift.type === 'W') return null;
                    return `${emp.name}: ${shift.type === 'WORK' ? `${shift.startHour}-${shift.endHour}` : shift.type}`;
                }).filter(Boolean);

                if (dayShifts.length > 0) {
                    recentDays.push(`- ${dateStr}: ${dayShifts.join(', ')}`);
                }
            }
        }

        // 3. Get employee preferences
        const employeePreferences = schedule.employees.map(emp => {
            const prefs = [];
            if (emp.preferences) prefs.push(emp.preferences);
            if (emp.notes) prefs.push(`Notes: ${emp.notes}`);
            return prefs.length > 0 ? `- ${emp.name}: ${prefs.join('; ')}` : null;
        }).filter(Boolean);

        // 4. Build comprehensive system prompt
        const systemPrompt = `Jesteś ekspertem ds. układania harmonogramów pracy. Pomagasz zaplanować zmiany na nadchodzące dni.

ZADANIE: Zaproponuj układ zmian na **${startDate}** do **${endDate}**

═══════════════════════════════════════════════════════════
OBECNY STAN GRAFIKU
═══════════════════════════════════════════════════════════

OSTATNIE 14 DNI (kontekst):
${recentDays.length > 0 ? recentDays.join('\n') : 'Brak danych'}

GODZINY PRACOWNIKÓW DO TEJ PORY (${monthKey}):
${employeeHours.map(e => `- ${e.name}: ${e.totalHours}h (${e.hours}h pracy + ${e.contactHours + e.manualContact}h kontakty)`).join('\n')}

${employeePreferences.length > 0 ? `PREFERENCJE PRACOWNIKÓW:\n${employeePreferences.join('\n')}` : ''}

═══════════════════════════════════════════════════════════
REGUŁY SYSTEMU (BEZWZGLĘDNIE OBOWIĄZUJĄCE)
═══════════════════════════════════════════════════════════

**1. KODEKS PRACY (POLSKA):**
- Max 40h/tydzień (średnio)
- Min 11h odpoczynku między zmianami (ILLEGAL jeśli < 11h)
- Praca 24/7 - placówka wychowawcza (musi być pokrycie całą dobę)

**2. MARIA PANKOWSKA (LIDER) - SPECJALNE OGRANICZENIA:**
- NIE pracuje w weekendy (sobota/niedziela)
- Może pracować TYLKO zmiany w przedziale 8:00-20:00
- Przykłady dozwolonych zmian: 8-14, 8-15, 8-16, 8-20, 10-16, 10-20, 12-20
- ZABRONIONE: nocki (20-8), wczesne poranne (<8:00), późne wieczorne (>20:00)

**3. REGUŁY NOCNYCH ZMIAN:**
- Po 2 nockach pod rząd → zalecane 2 dni wolnego
- Po jednej nocce → zalecany dzień wolny
- Nocka to zmiana 20-8 (zaczyna 20:00, kończy 8:00 następnego dnia)

**4. WEEKEND FAIRNESS:**
- Sprawdzaj kto pracował w ostatni weekend
- Unikaj przypisywania tej samej osobie 2 weekendy pod rząd

**5. BALANSOWANIE GODZIN:**
- Średnia: ${(employeeHours.reduce((sum, e) => sum + e.totalHours, 0) / employeeHours.length).toFixed(1)}h
- Preferuj osoby z mniejszą liczbą godzin
- Unikaj przekroczenia 160h/miesiąc (MAX limit)

**6. STRAŻNIK OBSADY:**
${staffingRules ? `
- Minimum RANO (6-14): ${staffingRules.minStaffMorning} osób
- Minimum WIECZÓR (14-22): ${staffingRules.minStaffEvening} osób
- Minimum NOC (22-6): ${staffingRules.minStaffNight} osób
${staffingRules.customRules ? `- Dodatkowe: ${staffingRules.customRules}` : ''}
` : '- Zalecane: minimum 2 osoby w dzień, 1 w nocy'}

═══════════════════════════════════════════════════════════
FORMAT ODPOWIEDZI
═══════════════════════════════════════════════════════════

Dla każdego dnia podaj:

**DD.MM (dzień tygodnia):**
- Pracownik 1: Zmiana (godziny) - uzasadnienie
- Pracownik 2: Zmiana (godziny) - uzasadnienie
- ...

**Podsumowanie:**
- ✅ Pokrycie 24h
- ✅ Wszystkie reguły przestrzegane
- ⚠️ Ewentualne ostrzeżenia

PRZYKŁAD:
**08.12 (Czwartek):**
- Maria Pankowska: 8-16 (8h) - ma najmniej godzin (125h), dzień roboczy OK
- Paulina Rumińska: 8-20 (12h) - wyrównanie godzin
- Agnieszka Olszewska: 20-8 (12h nocka) - ostatnia nocka 5.12, 11h+ rest OK

✅ Pokrycie: 24h (8-8 następnego dnia)
✅ Wszystkie reguły OK
`;

        // 5. Call AI
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'HarmonogramMaster-ScheduleHelper'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-exp:free',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Zaproponuj optymalne rozplanowanie na ${startDate} - ${endDate}.` }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const suggestion = data.choices[0]?.message?.content || 'Brak odpowiedzi od AI.';

        // 6. Return suggestion
        res.json({
            suggestion,
            startDate,
            endDate
        });

    } catch (error) {
        console.error('Schedule Helper Error:', error);
        res.status(500).json({ error: 'Failed to generate schedule suggestion' });
    }
});

// OR-Tools Schedule Generator - Advanced constraint-based scheduling
app.post('/api/ortools/generate-schedule', authenticateCookie, async (req, res) => {
    const {
        dateRange,      // { start: "2026-01-08", end: "2026-01-14" }
        employees,      // [{ id, name, allowedShifts, preferences }]
        constraints,    // [{ type, employeeId, date, value }]
        demand,         // { "2026-01-08": 3, "2026-01-09": 2, ... }
        existingSchedule // Current schedule from DB
    } = req.body;

    console.log('OR-Tools request received:', {
        dateRange,
        numEmployees: employees?.length,
        numConstraints: constraints?.length
    });

    try {
        // 1. Merge existing absences (L4, UW, etc.) into constraints
        const allConstraints = mergeAbsences(existingSchedule, constraints || [], dateRange);
        console.log(`Total constraints (including absences): ${allConstraints.length}`);

        // 2. Prepare input for Python solver
        const solverInput = {
            employees: employees || [],
            constraints: allConstraints,
            dateRange,
            demand: demand || {},
            existingSchedule: existingSchedule || {}
        };

        // 3. Spawn Python process
        const { spawn } = await import('child_process');

        // Determine Python path (Windows vs Linux)
        const isWindows = process.platform === 'win32';
        const pythonPath = process.env.PYTHON_PATH || path.join(
            __dirname,
            'python',
            'venv',
            isWindows ? 'Scripts' : 'bin',
            isWindows ? 'python.exe' : 'python3'
        );
        const scriptPath = path.join(__dirname, 'python', 'scheduler_solver.py');

        console.log(`Spawning Python: ${pythonPath} ${scriptPath}`);

        const python = spawn(pythonPath, [scriptPath], {
            cwd: path.join(__dirname, 'python')
        });

        let output = '';
        let errorOutput = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            const msg = data.toString();
            errorOutput += msg;
            console.log('[Python stderr]:', msg.trim());
        });

        // Send input to Python via stdin
        python.stdin.write(JSON.stringify(solverInput));
        python.stdin.end();

        python.on('close', (code) => {
            if (code !== 0) {
                console.error('Python solver failed with code:', code);
                console.error('Error output:', errorOutput);
                return res.status(500).json({
                    error: 'Solver failed',
                    details: errorOutput,
                    code
                });
            }

            try {
                // Szukamy ostatniej klamry zamykającej
                const jsonEndIndex = output.lastIndexOf('}');

                if (jsonEndIndex !== -1) {
                    // Szukamy klamry otwierającej JSON (zakładamy, że wynik to {"status":...})
                    // Szukamy frazy "status" aby namierzyć właściwy początek
                    const statusIndex = output.indexOf('"status"');

                    // Cofamy się od "status" do najbliższej klamry {
                    let jsonStartIndex = -1;
                    if (statusIndex !== -1) {
                        jsonStartIndex = output.lastIndexOf('{', statusIndex);
                    }

                    // Zabezpieczenie: jeśli nie znaleziono przez "status", bierzemy pierwszą klamrę (jak dawniej)
                    if (jsonStartIndex === -1) {
                        jsonStartIndex = output.indexOf('{');
                    }

                    if (jsonStartIndex !== -1) {
                        const jsonString = output.substring(jsonStartIndex, jsonEndIndex + 1);
                        const result = JSON.parse(jsonString);
                        console.log('Solver result status:', result.status);
                        res.json(result);
                    } else {
                        throw new Error('No JSON start found');
                    }
                } else {
                    throw new Error('No JSON end found');
                }
            } catch (err) {
                console.error('Failed to parse Python output:', err);
                console.error('Raw output (first 500 chars):', output.substring(0, 500));
                res.status(500).json({
                    error: 'Invalid JSON from solver',
                    details: 'Parser error: ' + err.message,
                    rawOutput: output // Zwracamy całość, żebyś widział logi w razie czego
                });
            }
        });

        // Timeout after 2 minutes
        const timeout = setTimeout(() => {
            python.kill();
            if (!res.headersSent) {
                res.status(408).json({ error: 'Solver timeout (2 minutes)' });
            }
        }, 400000);

        python.on('close', () => {
            clearTimeout(timeout);
        });

    } catch (error) {
        console.error('OR-Tools error:', error);
        res.status(500).json({ error: 'Failed to generate schedule', details: error.message });
    }
});

// ============================================================================
// 🆕 ASYNC JOB PATTERN - Solver Jobs Storage
// ============================================================================
const crypto = await import('crypto');
const solverJobs = new Map(); // jobId -> { status, result, error, startTime, progress }

function generateJobId() {
    return crypto.randomUUID();
}

function cleanOldJobs() {
    const MAX_AGE = 1000 * 60 * 60; // 1 hour
    const now = Date.now();
    for (const [jobId, job] of solverJobs.entries()) {
        if (now - job.startTime > MAX_AGE) {
            solverJobs.delete(jobId);
        }
    }
}

// Clean old jobs every 10 minutes
setInterval(cleanOldJobs, 1000 * 60 * 10);

// ============================================================================
// 🆕 ASYNC ENDPOINT 1: Start Solver Job
// ============================================================================
app.post('/api/ortools/start-job', authenticateCookie, async (req, res) => {
    const jobId = generateJobId();
    const {
        dateRange,
        employees,
        constraints,
        demand,
        existingSchedule
    } = req.body;

    console.log(`🚀 Starting solver job: ${jobId}`);
    console.log(`   Date range: ${dateRange.start} to ${dateRange.end}`);
    console.log(`   Employees: ${employees?.length}, Constraints: ${constraints?.length}`);

    // Initialize job status
    solverJobs.set(jobId, {
        status: 'running',
        result: null,
        error: null,
        startTime: Date.now(),
        progress: 'Initializing solver...'
    });

    // Return job ID immediately
    res.json({ jobId, status: 'started' });

    // Run solver in background (async, no await!)
    (async () => {
        try {
            // Merge absences
            const allConstraints = mergeAbsences(existingSchedule, constraints || [], dateRange);

            const solverInput = {
                employees: employees || [],
                constraints: allConstraints,
                dateRange,
                demand: demand || {},
                existingSchedule: existingSchedule || {}
            };

            // Update progress
            solverJobs.get(jobId).progress = 'Spawning Python solver...';

            const { spawn } = await import('child_process');
            const isWindows = process.platform === 'win32';
            const pythonPath = process.env.PYTHON_PATH || path.join(
                __dirname,
                'python',
                'venv',
                isWindows ? 'Scripts' : 'bin',
                isWindows ? 'python.exe' : 'python3'
            );
            const scriptPath = path.join(__dirname, 'python', 'scheduler_solver.py');

            const python = spawn(pythonPath, [scriptPath], {
                cwd: path.join(__dirname, 'python')
            });

            let output = '';
            let errorOutput = '';

            python.stdout.on('data', (data) => {
                output += data.toString();
            });

            python.stderr.on('data', (data) => {
                const msg = data.toString();
                errorOutput += msg;

                // Update progress from stderr logs
                if (msg.includes('Solving...')) {
                    solverJobs.get(jobId).progress = 'Searching for optimal solution...';
                } else if (msg.includes('Adding constraints')) {
                    solverJobs.get(jobId).progress = 'Adding constraints...';
                } else if (msg.includes('Solution #')) {
                    // 🆕 Parse solution progress: "Solution #5: score=780, time=142.8s"
                    const match = msg.match(/Solution #(\d+): score=(\d+), time=([\d.]+)s/);
                    if (match) {
                        const [_, solutionNum, score, time] = match;
                        solverJobs.get(jobId).progress = `🔍 Solution #${solutionNum} found | Score: ${score} | Time: ${time}s`;
                    }
                } else if (msg.includes('Early stop!')) {
                    // 🆕 Parse early stop message
                    if (msg.includes('Score')) {
                        const match = msg.match(/score.*?(\d+)/i);
                        if (match) {
                            solverJobs.get(jobId).progress = `🎯 Early stop! Final score: ${match[1]}`;
                        }
                    } else {
                        solverJobs.get(jobId).progress = '⏱️ Early stop (no improvement)';
                    }
                }
            });

            python.stdin.write(JSON.stringify(solverInput));
            python.stdin.end();

            python.on('close', (code) => {
                const job = solverJobs.get(jobId);
                if (!job) return; // Job was cleaned up

                if (code !== 0) {
                    job.status = 'failed';
                    job.error = errorOutput || 'Solver failed';
                    job.progress = 'Failed';
                    console.error(`❌ Job ${jobId} failed with code ${code}`);
                    return;
                }

                try {
                    const jsonEndIndex = output.lastIndexOf('}');
                    const statusIndex = output.indexOf('"status"');
                    let jsonStartIndex = -1;

                    if (statusIndex !== -1) {
                        jsonStartIndex = output.lastIndexOf('{', statusIndex);
                    }

                    if (jsonStartIndex === -1) {
                        jsonStartIndex = output.indexOf('{');
                    }

                    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                        const jsonString = output.substring(jsonStartIndex, jsonEndIndex + 1);
                        const result = JSON.parse(jsonString);

                        job.status = 'completed';
                        job.result = result;
                        job.progress = 'Complete';
                        console.log(`✅ Job ${jobId} completed: ${result.status}`);
                    } else {
                        throw new Error('No valid JSON found');
                    }
                } catch (err) {
                    job.status = 'failed';
                    job.error = 'Invalid JSON from solver: ' + err.message;
                    job.progress = 'Failed to parse result';
                    console.error(`❌ Job ${jobId} parse error:`, err);
                }
            });

        } catch (error) {
            const job = solverJobs.get(jobId);
            if (job) {
                job.status = 'failed';
                job.error = error.message;
                job.progress = 'Error: ' + error.message;
                console.error(`❌ Job ${jobId} error:`, error);
            }
        }
    })();
});

// ============================================================================
// 🆕 ASYNC ENDPOINT 2: Check Job Status
// ============================================================================
app.get('/api/ortools/job-status/:jobId', authenticateCookie, (req, res) => {
    const { jobId } = req.params;
    const job = solverJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    const elapsed = Math.floor((Date.now() - job.startTime) / 1000);

    res.json({
        jobId,
        status: job.status,
        progress: job.progress,
        elapsed,
        completed: job.status === 'completed' || job.status === 'failed'
    });
});

// ============================================================================
// 🆕 ASYNC ENDPOINT 3: Get Job Result
// ============================================================================
app.get('/api/ortools/job-result/:jobId', authenticateCookie, (req, res) => {
    const { jobId } = req.params;
    const job = solverJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'running') {
        return res.status(202).json({
            message: 'Job still running',
            progress: job.progress
        });
    }

    if (job.status === 'failed') {
        return res.status(500).json({
            error: job.error,
            status: 'FAILED'
        });
    }

    // Status === 'completed'
    res.json(job.result);

    // Optionally clean up job after retrieval
    // solverJobs.delete(jobId);
});

// ============================================================================

// OR-Tools Schedule Validator - Checks specific rules and returns violations
app.post('/api/ortools/validate', authenticateCookie, async (req, res) => {
    console.log('🔍 VALIDATOR ENDPOINT CALLED'); // Debug log
    const inputData = req.body;

    try {
        const { spawn } = await import('child_process');
        const isWindows = process.platform === 'win32';
        const pythonPath = process.env.PYTHON_PATH || path.join(
            __dirname,
            'python',
            'venv',
            isWindows ? 'Scripts' : 'bin',
            isWindows ? 'python.exe' : 'python3'
        );
        const scriptPath = path.join(__dirname, 'python', 'validator.py');

        const python = spawn(pythonPath, [scriptPath], {
            cwd: path.join(__dirname, 'python')
        });

        let output = '';
        let errorOutput = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        python.stdin.write(JSON.stringify(inputData));
        python.stdin.end();

        // Timeout after 2 minutes
        const timeout = setTimeout(() => {
            python.kill();
            if (!res.headersSent) {
                res.status(408).json({ error: 'Validator timeout (2 minutes)' });
            }
        }, 120000);

        python.on('close', (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
                console.error('Validator failed:', errorOutput);
                return res.status(500).json({ error: 'Validator script failed', details: errorOutput });
            }
            try {
                const result = JSON.parse(output);
                res.json(result);
            } catch (e) {
                console.error('Validator JSON parse error:', e);
                res.status(500).json({ error: 'Invalid response from validator' });
            }
        });

    } catch (error) {
        console.error('Validator error:', error);
        res.status(500).json({ error: 'Failed to validate schedule' });
    }
});

/**
 * Merge absences from existing schedule into constraints
 */
function mergeAbsences(existingSchedule, userConstraints, dateRange) {
    const absences = [];
    const { start, end } = dateRange;

    if (!existingSchedule || !existingSchedule.employees) {
        return userConstraints;
    }

    // Extract L4, UW, etc. from existing schedule
    for (const emp of existingSchedule.employees) {
        if (!emp.shifts) continue;

        for (const [date, shift] of Object.entries(emp.shifts)) {
            if (date >= start && date <= end) {
                // Check if it's an absence type
                const absenceTypes = ['L4', 'UW', 'UZ', 'UŻ', 'OP', 'UM', 'USW', 'UB', 'WYCH', 'NN'];
                if (absenceTypes.includes(shift.type)) {
                    absences.push({
                        type: 'ABSENCE',
                        employeeId: emp.id,
                        date,
                        description: `${shift.type} (z głównego grafiku)`,
                        isHard: true
                    });
                }
            }
        }
    }

    console.log(`Found ${absences.length} absences from existing schedule`);
    return [...absences, ...userConstraints];
}


// 3. DATA ROUTES (Protected)
app.get('/api/data', authenticateCookie, async (req, res) => {
    try {
        console.log("📡 [SQL] Pobieranie danych z bazy PostgreSQL...");

        // 1. Pobieramy pracowników
        const employeesDB = await prisma.employees.findMany({
            include: {
                shifts: {
                    orderBy: {
                        date: 'asc' // <--- SORTOWANIE (Naprawia błędy z kolejnością zmian)
                    }
                },
                preferences: true,
                monthly_contact_hours: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        // 2. Pobieramy ustawienia
        let settingsObject = {};
        try {
            const settingsDB = await prisma.settings.findMany();
            settingsDB.forEach(s => settingsObject[s.key] = s.value);
        } catch (e) {
            console.warn("⚠️ Brak ustawień w bazie.");
        }

        // 3. Konwersja na format dla Frontendu
        const formattedEmployees = employeesDB.map(emp => {
            const shiftsObject = {};
            emp.shifts.forEach(shift => {
                // Bezpieczne formatowanie daty (bez przesunięcia strefy czasowej)
                const dateKey = shift.date.toLocaleDateString('en-CA'); 

                shiftsObject[dateKey] = {
                    id: shift.id,
                    date: dateKey,
                    type: shift.type,
                    // KLUCZOWE: Rzutowanie na Number (naprawia błędy walidatora)
                    startHour: shift.start_hour !== null ? Number(shift.start_hour) : null,
                    endHour: shift.end_hour !== null ? Number(shift.end_hour) : null,
                    hours: Number(shift.hours),
                    contactHours: Number(shift.contact_hours)
                };
            });

            const contactsObject = {};
            emp.monthly_contact_hours.forEach(contact => {
                contactsObject[contact.month_key] = contact.hours;
            });

            return {
                id: emp.id,
                name: emp.name,
                email: emp.email || "",
                roles: emp.roles || [],
                preferences: emp.preferences[0]?.content || "",
                shifts: shiftsObject,
                monthlyContactHours: contactsObject
            };
        });

        // 4. Wysyłamy odpowiedź
        res.json({
            schedule: {
                id: 'sql-schedule',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                employees: formattedEmployees
            },
            settings: settingsObject
        });

    } catch (error) {
        console.error('❌ Błąd SQL w GET /api/data:', error);
        res.status(500).json({ error: 'Failed to read data from SQL' });
    }
});

app.post('/api/data', authenticateCookie, (req, res) => {
    try {
        const newData = req.body;
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
        console.log('Data saved successfully at', new Date().toISOString());
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.post('/api/send-schedules', authenticateCookie, async (req, res) => {
    const { sendMain, sendIndividual } = req.body;

    try {
        // 1. Read Schedule Data
        // Sprawdzamy czy frontend przysłał grafik w req.body (priorytet)
        let schedule = req.body.schedule;

        // Jeśli nie przysłał, to czytamy z pliku (fallback)
        if (!schedule) {
            console.log('Using schedule from file (fallback)');
            try {
                const fileData = fs.readFileSync(DATA_FILE, 'utf8');
                const db = JSON.parse(fileData);
                schedule = db.schedule;
            } catch (err) {
                console.error('Error reading schedule file:', err);
            }
        }

        if (!schedule) {
            return res.status(404).json({ error: 'No schedule found (neither in body nor file)' });
        }

        const monthName = new Date(schedule.year, schedule.month - 1).toLocaleString('pl-PL', { month: 'long', year: 'numeric' });

        // 2. Prepare Data for Main PDF
        const mainPdfData = schedule.employees.map(emp => {
            // Calculate total hours
            let totalHours = 0;
            Object.values(emp.shifts).forEach(shift => {
                totalHours += shift.hours;
            });
            return {
                name: emp.name,
                hours: totalHours,
                date: '-' // Placeholder if needed
            };
        });

        let mainPdfBuffer = null;
        if (sendMain) {
            mainPdfBuffer = await generatePdfBuffer(mainPdfData, 'main');
        }

        // 3. Loop and Send
        let sentCount = 0;
        const errors = [];

        for (const emp of schedule.employees) {
            if (!emp.email) continue;

            const attachments = [];

            // Add Main PDF
            if (mainPdfBuffer) {
                attachments.push({
                    filename: `Harmonogram_Zbiorczy_${schedule.month}_${schedule.year}.pdf`,
                    content: mainPdfBuffer
                });
            }

            // Add Individual PDF
            if (sendIndividual) {
                const individualData = {
                    worker: {
                        name: emp.name,
                        month: monthName,
                        shifts: Object.values(emp.shifts).sort((a, b) => a.date.localeCompare(b.date))
                    }
                };
                const individualPdf = await generatePdfBuffer(individualData, 'individual');
                attachments.push({
                    filename: `Harmonogram_${emp.name.replace(/ /g, '_')}.pdf`,
                    content: individualPdf
                });
            }

            if (attachments.length === 0) continue;

            try {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: emp.email,
                    subject: `Harmonogram Pracy - ${monthName}`,
                    text: `Witaj ${emp.name},\n\nW załączniku przesyłamy harmonogram pracy na miesiąc ${monthName}.\n\nPozdrawiam`,
                    attachments
                });
                sentCount++;
            } catch (err) {
                console.error(`Failed to send email to ${emp.name}:`, err);
                errors.push({ name: emp.name, error: err.message });
            }
        }

        res.json({ success: true, sent: sentCount, errors });

    } catch (error) {
        console.error('Send Schedules Error:', error);
        res.status(500).json({ error: 'Failed to process sending' });
    }
});

// 4. REPLACEMENT ROUTE (Phase 7)
app.post('/api/replacement/find', authenticateCookie, async (req, res) => {
    const { date, shiftType, employeeOutId, includeContactHours } = req.body;

    let schedule = req.body.schedule;

    if (!schedule) {
        try {
            const dbData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            schedule = dbData.schedule;
        } catch (err) {
            return res.status(500).json({ error: 'Failed to load schedule from DB' });
        }
    }

    if (!schedule || !date || !shiftType || !employeeOutId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const candidates = await findBestReplacement({ date, shiftType, employeeOutId, schedule, includeContactHours });
        res.json({ candidates });
    } catch (error) {
        console.error('Replacement search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data file location: ${DATA_FILE}`);
});


const upload = multer(); // Przechowuje pliki w pamięci RAM (nie zapisuje na dysk - idealne dla nas)

app.post('/api/send-schedules-files', authenticateCookie, upload.any(), async (req, res) => {
    try {
        const sendMain = req.body.sendMain === 'true';
        const sendIndividual = req.body.sendIndividual === 'true';
        const monthName = req.body.monthName || 'Harmonogram';
        const employees = JSON.parse(req.body.employeesData); // Lista pracowników z emailami
        const files = req.files; // Tu są nasze PDFy

        // Znajdź plik główny (jeśli jest)
        const mainPdfFile = files.find(f => f.fieldname === 'mainPdf');

        let sentCount = 0;
        const errors = [];

        for (const emp of employees) {
            if (!emp.email) continue;

            const attachments = [];

            // 1. Dodaj główny PDF
            if (sendMain && mainPdfFile) {
                attachments.push({
                    filename: `Harmonogram_Zbiorczy.pdf`,
                    content: mainPdfFile.buffer
                });
            }

            // 2. Dodaj indywidualny PDF
            if (sendIndividual) {
                // Szukamy pliku, który nazwaliśmy individual_ID.pdf
                const empFile = files.find(f => f.originalname === `individual_${emp.id}.pdf`);
                if (empFile) {
                    attachments.push({
                        filename: `Twój_Grafik_${emp.name}.pdf`,
                        content: empFile.buffer
                    });
                }
            }

            if (attachments.length === 0) continue;

            // 3. Wyślij maila
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: emp.email,
                    subject: `Nowy Grafik Pracy ${monthName}`,
                    text: `Witaj ${emp.name},\n\nW załączniku przesyłamy harmonogram pracy na miesiąc ${monthName}.\n\nPozdrawiam`,
                    attachments: attachments
                });
                sentCount++;
            } catch (err) {
                console.error(`Mail error for ${emp.name}:`, err);
                errors.push({ name: emp.name, error: err.message });
            }
        }

        res.json({ success: true, sent: sentCount, errors });

    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: 'Server error processing files' });
    }
});
