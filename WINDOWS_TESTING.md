# Testowanie OR-Tools na Windows

## Krok 1: Instalacja Python i OR-Tools

### 1.1 Sprawdź czy masz Python 3
```bash
python --version
# lub
python3 --version
```

Jeśli nie masz, pobierz z: https://www.python.org/downloads/ (Python 3.9+)

### 1.2 Utwórz wirtualne środowisko
```bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster/python
python -m venv venv
```

### 1.3 Aktywuj środowisko (Git Bash)
```bash
source venv/Scripts/activate
```

### 1.4 Zainstaluj zależności
```bash
pip install ortools python-dateutil
```

---

## Krok 2: Test Python Solver (Standalone)

### 2.1 Uruchom test
```bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster/python
source venv/Scripts/activate
cat test_input.json | python scheduler_solver.py
```

### 2.2 Oczekiwany wynik
Powinieneś zobaczyć JSON z:
```json
{
  "status": "SUCCESS",
  "schedule": {
    "1": {
      "2026-01-08": "8-16",
      "2026-01-09": "14-22",
      ...
    },
    ...
  },
  "stats": {
    "solve_time": 1.23,
    "status": "OPTIMAL"
  }
}
```

---

## Krok 3: Aktualizacja server.js dla Windows

### 3.1 Zmień ścieżkę Python w server.js

Otwórz `server.js` i znajdź linię ~645:

**PRZED:**
```javascript
const pythonPath = process.env.PYTHON_PATH || path.join(__dirname, 'python', 'venv', 'bin', 'python3');
```

**PO (Windows):**
```javascript
const pythonPath = process.env.PYTHON_PATH || path.join(__dirname, 'python', 'venv', 'Scripts', 'python.exe');
```

**LUB** dodaj do `.env`:
```
PYTHON_PATH=C:\Users\Hadrian\Desktop\HarmonogramMaster\python\venv\Scripts\python.exe
```

---

## Krok 4: Uruchom aplikację

### Terminal 1 (Backend)
```bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster
node server.js
```

### Terminal 2 (Frontend)
```bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster
npm run dev
```

---

## Krok 5: Test w przeglądarce

1. Otwórz: `http://localhost:5173/ortools-scheduler`
2. Wybierz zakres dat (np. 8-14 stycznia 2026)
3. Sprawdź konfigurację pracowników (Maria powinna mieć tylko 8-16, 8-20)
4. Ustaw zapotrzebowanie (np. 2 osoby na dzień)
5. Dodaj regułę (np. "Paulina - Absencja - 10 stycznia")
6. Kliknij **"Generuj Grafik"**

### Oczekiwany wynik:
- Loader przez 1-5 sekund
- Tabela z wygenerowanym grafikiem
- Statystyki (czas rozwiązania, jakość)
- Przycisk "Kopiuj do głównego grafiku"

---

## Troubleshooting

### Błąd: "Python not found"
**Rozwiązanie**: Zaktualizuj `pythonPath` w `server.js` (patrz Krok 3.1)

### Błąd: "ModuleNotFoundError: No module named 'ortools'"
**Rozwiązanie**:
```bash
cd python
source venv/Scripts/activate
pip install ortools
```

### Błąd: "Cannot find module './DateRangePicker'"
**Rozwiązanie**: Zrestartuj `npm run dev` (TypeScript musi przeindeksować nowe pliki)

### Solver zwraca "INFEASIBLE"
**Przyczyna**: Za mało pracowników na zapotrzebowanie

**Rozwiązanie**:
- Zmniejsz zapotrzebowanie (np. 1 osoba zamiast 3)
- Zwiększ zakres dat (więcej elastyczności)
- Usuń niektóre absencje

---

## Szybki Test (Minimalna konfiguracja)

1. **Zakres**: 8-10 stycznia 2026 (3 dni)
2. **Pracownicy**: Wszyscy z domyślnymi zmianami
3. **Zapotrzebowanie**: 1 osoba każdego dnia
4. **Reguły**: Brak
5. **Kliknij**: Generuj

To powinno zadziałać w <2 sekundy i dać wynik OPTIMAL.

---

## Deployment na LXC (później)

Gdy wszystko działa na Windows, na LXC zmień tylko:

**server.js:**
```javascript
const pythonPath = process.env.PYTHON_PATH || path.join(__dirname, 'python', 'venv', 'bin', 'python3');
```

(Zmień `Scripts/python.exe` z powrotem na `bin/python3`)
