"""
Data models for OR-Tools Schedule Solver
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import date, datetime

@dataclass
class ShiftType:
    """Typ zmiany (np. 8-16, 14-22, 20-8)"""
    id: str              # "8-16"
    start_hour: int      # 8
    end_hour: int        # 16
    hours: int           # 8 (or 12 for night shifts crossing midnight)
    is_night: bool = False  # True if 20-8
    
    @staticmethod
    def from_string(shift_str: str) -> 'ShiftType':
        """Parse shift string like '8-16' into ShiftType"""
        parts = shift_str.split('-')
        if len(parts) != 2:
            raise ValueError(f"Invalid shift format: {shift_str}")
        
        start = int(parts[0])
        end = int(parts[1])
        
        # Calculate hours (handle midnight crossing)
        if start < end:
            hours = end - start
        else:
            hours = (24 - start) + end
        
        is_night = (start >= 20 or end <= 8)
        
        return ShiftType(
            id=shift_str,
            start_hour=start,
            end_hour=end,
            hours=hours,
            is_night=is_night
        )

@dataclass
class Employee:
    """Pracownik"""
    id: str
    name: str
    allowed_shifts: List[ShiftType] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)
    special_rules: Dict[str, Any] = field(default_factory=dict)
    
    def is_maria_pankowska(self) -> bool:
        """Check if this is the leader (Maria Pankowska)"""
        return "Maria Pankowska" in self.name

@dataclass
class Constraint:
    """Ograniczenie (absencja, preferencja)"""
    type: str            # "ABSENCE", "PREFERENCE", "DEMAND", "CUSTOM"
    employee_id: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    date_range: Optional[tuple] = None  # (start, end) for multi-day constraints
    value: Any = None    # Depends on type
    description: str = ""
    is_hard: bool = True  # Hard constraint (MUST) or soft (PREFER)

@dataclass
class SolverInput:
    """Input do solvera"""
    employees: List[Employee]
    constraints: List[Constraint]
    date_range: tuple  # (start_date_str, end_date_str)
    demand: Dict[str, int]  # date -> min_staff
    # Zakładamy strukturę existing_schedule zgodną z TypeScript: 
    # { employees: [ {id: '1', shifts: {'2026-01-01': {type: '8-16'}}} ] }
    existing_schedule: Dict[str, Any] = field(default_factory=dict)
    
    def get_date_list(self) -> List[str]:
        """Get list of dates in range as YYYY-MM-DD strings"""
        from datetime import datetime, timedelta
        start = datetime.strptime(self.date_range[0], '%Y-%m-%d')
        end = datetime.strptime(self.date_range[1], '%Y-%m-%d')
        
        dates = []
        current = start
        while current <= end:
            dates.append(current.strftime('%Y-%m-%d'))
            current += timedelta(days=1)
        return dates

    def get_history_shifts(self) -> Dict[str, ShiftType]:
        """
        Pobiera zmiany z dnia PRZED rozpoczęciem grafiku.
        Zwraca słownik: {employee_id: ShiftType object}
        """
        from datetime import datetime, timedelta
        
        # Oblicz datę "wczorajszą" względem startu generowania
        start_date = datetime.strptime(self.date_range[0], "%Y-%m-%d")
        prev_day_str = (start_date - timedelta(days=1)).strftime("%Y-%m-%d")
        
        history = {}
        
        # Sprawdź czy mamy dane o pracownikach w existing_schedule
        employees_data = self.existing_schedule.get('employees', [])
        
        for emp_data in employees_data:
            emp_id = emp_data.get('id')
            shifts = emp_data.get('shifts', {})
            
            # Jeśli pracownik miał zmianę tego dnia
            if prev_day_str in shifts:
                shift_info = shifts[prev_day_str]
                
                # shift_info może być obiektem (Shift) lub stringiem, zależnie od formatu w JSON
                shift_type_str = None
                
                if isinstance(shift_info, dict):
                    # Format: { type: "WORK", startHour: 14, endHour: 22 } 
                    # lub { type: "14-22" } jeśli type przechowuje godziny
                    # Ale Twój system ma type='WORK' i osobne start/end
                    
                    if shift_info.get('type') == 'WORK':
                        start = shift_info.get('startHour')
                        end = shift_info.get('endHour')
                        if start is not None and end is not None:
                            shift_type_str = f"{start}-{end}"
                    # Obsługa innych typów (L4, urlopy) jeśli są istotne dla historii
                    elif shift_info.get('type') in ['L4', 'UW', 'W']:
                        pass # Ignorujemy urlopy w historii zmian roboczych (chyba że wpływają na zmęczenie)
                        
                elif isinstance(shift_info, str):
                    # Prosty format "14-22"
                    shift_type_str = shift_info

                if shift_type_str:
                    try:
                        # Konwertuj string na obiekt ShiftType
                        shift_type = ShiftType.from_string(shift_type_str)
                        history[emp_id] = shift_type
                    except ValueError:
                        pass # Ignoruj błędne formaty

        return history

@dataclass
class SolverOutput:
    """Output z solvera"""
    status: str  # "SUCCESS", "FAILED", "TIMEOUT"
    schedule: Dict[str, Dict[str, str]] = field(default_factory=dict)  # employee_id -> date -> shift_type
    stats: Dict[str, Any] = field(default_factory=dict)
    violations: List[str] = field(default_factory=list)
    error: Optional[str] = None
