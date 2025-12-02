# Szybki Start - OR-Tools na Windows

## 1. Zainstaluj Python i OR-Tools (5 minut)

```bash
# W Git Bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster/python

# Utwórz wirtualne środowisko
python -m venv venv

# Aktywuj (Git Bash)
source venv/Scripts/activate

# Zainstaluj OR-Tools
pip install ortools python-dateutil
```

## 2. Uruchom aplikację (2 terminale Git Bash)

**Terminal 1 - Backend:**
```bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd c:/Users/Hadrian/Desktop/HarmonogramMaster
npm run dev
```

## 3. Test w przeglądarce

1. Otwórz: `http://localhost:5173`
2. Zaloguj się
3. Kliknij **"Grafik AI"** w menu (fioletowy przycisk)
4. Wybierz zakres: **8-10 stycznia 2026** (3 dni)
5. Sprawdź pracowników (Maria powinna mieć tylko 8-16, 8-20)
6. Ustaw zapotrzebowanie: **1 osoba każdego dnia**
7. Kliknij **"Generuj Grafik"**

### Oczekiwany wynik:
- ✅ Loader przez 1-5 sekund
- ✅ Tabela z grafikiem
- ✅ Statystyki (czas, jakość)
- ✅ Przycisk "Kopiuj do głównego grafiku"

## 4. Jeśli coś nie działa

### Błąd: "Python not found"
```bash
# Sprawdź czy Python jest w PATH
python --version

# Jeśli nie, dodaj do .env:
PYTHON_PATH=C:\Users\Hadrian\Desktop\HarmonogramMaster\python\venv\Scripts\python.exe
```

### Błąd: "ModuleNotFoundError: ortools"
```bash
cd python
source venv/Scripts/activate
pip install ortools
```

### Solver zwraca "INFEASIBLE"
- Zmniejsz zapotrzebowanie (1 osoba zamiast 3)
- Usuń absencje
- Zwiększ zakres dat

## 5. Deployment na LXC (później)

Gdy wszystko działa na Windows, na LXC:
- Python będzie automatycznie wykryty (`bin/python3` zamiast `Scripts/python.exe`)
- `server.js` ma auto-detect: `process.platform === 'win32'`

**Gotowe!** 🚀
