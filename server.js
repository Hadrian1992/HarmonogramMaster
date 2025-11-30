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
    const { systemPrompt, userMessage, employeeNames, model, messages: legacyMessages } = req.body;

    if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'Server missing API Key' });
    }

    try {
        let finalMessages = [];
        let map = {};

        // Handle new format (with anonymization)
        if (systemPrompt && userMessage && employeeNames) {
            console.log('Processing with GDPR Anonymization...');

            // 1. Anonymize System Prompt
            const { anonymizedText: anonSystem, map: systemMap } = anonymize(systemPrompt, employeeNames);
            map = { ...systemMap };

            // 2. Anonymize User Message
            // We reuse the map from system prompt to ensure consistency (Pracownik_A is always the same person)
            // But we need to apply the replacements using the EXISTING map
            let anonUser = userMessage;
            const sortedNames = [...employeeNames].sort((a, b) => b.length - a.length);
            sortedNames.forEach((name, index) => {
                const alias = `Pracownik_${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) || ''}`;
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedName, 'g');
                anonUser = anonUser.replace(regex, alias);
            });

            // 3. Inject Night Shift Logic
            const nightShiftRules = `
WAŻNE: Obsługa nocnych zmian
Jeśli godzina końca < godzina startu (np. start: 20:00, koniec: 08:00), oznacza to przeskok przez północ.
Oblicz godziny jako: (24 - start) + koniec.
Przykład: 20:00 → 08:00 = (24 - 20) + 8 = 12 godzin.
`;
            const finalSystemPrompt = anonSystem + nightShiftRules;

            finalMessages = [
                { role: 'system', content: finalSystemPrompt },
                { role: 'user', content: anonUser }
            ];

            // Log for verification (don't log real names in production, but for this task verification)
            console.log('--- GDPR CHECK ---');
            console.log('Sending to AI (Snippet):', finalSystemPrompt.substring(0, 200) + '...');
            console.log('User Message:', anonUser);
            console.log('------------------');

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

// 3. DATA ROUTES (Protected)
app.get('/api/data', authenticateCookie, (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
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
                    text: `Witaj ${emp.name},\n\nW załączniku przesyłamy harmonogram pracy na miesiąc ${monthName}.\n\nPozdrawiamy,\nZespół`,
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
                    subject: 'Nowy Grafik Pracy',
                    text: 'W załączniku przesyłamy grafik.',
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
