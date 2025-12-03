"""
Constraint builders for OR-Tools Schedule Solver
Implements all hard and soft constraints from Polish Labor Law and project rules
"""
from ortools.sat.python import cp_model
from models import SolverInput, Employee, ShiftType, Constraint
from typing import Dict, List
from datetime import datetime, timedelta
import calendar
import sys

def add_all_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput, history_shifts: Dict[str, ShiftType]):
    """
    Add all constraints to the model
    """
    # Ta linia jest kluczowa - przekazuje historię dalej
    add_hard_constraints(model, shifts, input_data, history_shifts)
    
    objectives = add_soft_constraints(model, shifts, input_data)
    
    # Minimize total penalty from soft constraints
    if objectives:
        model.Minimize(sum(objectives))

def add_hard_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput, history_shifts: Dict[str, ShiftType]):
    """
    Add all hard constraints (MUST be satisfied)
    """
    print("Adding hard constraints...")
    
    # 1. One shift per day (or day off)
    add_one_shift_per_day(model, shifts, input_data)
    
    # 2. 11h daily rest
    add_11h_rest_constraint(model, shifts, input_data, history_shifts)
    
    # 3. 35h weekly rest (continuous)
    add_35h_weekly_rest(model, shifts, input_data)
    
    # 4. 40h max per week
    #add_40h_weekly_limit(model, shifts, input_data)
    
    # 5. 2 night shifts -> 2 days off
    #add_night_shift_recovery(model, shifts, input_data)
    
    # 6. Max 5 consecutive work days
    add_max_consecutive_days(model, shifts, input_data)
    
    # 7. Maria Pankowska special rules
    add_maria_rules(model, shifts, input_data)
    
    # 8. Absences (L4, UW from existing schedule + user constraints)
    add_absence_constraints(model, shifts, input_data)
    
    # 9. Minimum staffing (demand)
    add_demand_constraints(model, shifts, input_data)

    # 10. Minimum one night shift per day
    add_min_one_night_shift_per_day(model, shifts, input_data)

    # --- 1. NOWOŚĆ: Obsługa walidacji ręcznej (wymuszanie zmian) ---
    add_fixed_shift_constraints(model, shifts, input_data)
    
    # --- 2. NOWOŚĆ: Ciągłość obsady 24h (Rano/Popołudnie/Noc) ---
    add_coverage_constraints(model, shifts, input_data)
    
    # --- 3. NOWOŚĆ: Wsparcie lidera (Lider nie może być sam) ---
    add_leader_support_rule(model, shifts, input_data)
    
    print("Hard constraints added successfully")

def add_one_shift_per_day(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """Each employee works at most one shift per day"""
    for emp in input_data.employees:
        for date_str in input_data.get_date_list():
            if emp.id in shifts and date_str in shifts[emp.id]:
                day_shifts = list(shifts[emp.id][date_str].values())
                if day_shifts:
                    model.Add(sum(day_shifts) <= 1)

def add_11h_rest_constraint(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput, history_shifts: Dict[str, ShiftType]):
    """Twoja funkcja z obsługą historii."""
    dates = input_data.get_date_list()
    if not dates: return
    
    first_date = dates[0]
    for emp in input_data.employees:
        if emp.id in history_shifts:
            shift_before = history_shifts[emp.id]
            for shift_now in emp.allowed_shifts:
                gap = calculate_rest_gap(shift_before, shift_now)
                if gap < 11:
                    if shift_now.id in shifts[emp.id][first_date]:
                        # print(f"DEBUG: Blocking {shift_now.id} for {emp.name} on {first_date}", file=sys.stderr)
                        model.Add(shifts[emp.id][first_date][shift_now.id] == 0)

    for i in range(len(dates) - 1):
        today = dates[i]
        tomorrow = dates[i + 1]
        for emp in input_data.employees:
            if emp.id not in shifts or today not in shifts[emp.id] or tomorrow not in shifts[emp.id]: continue
            
            for s1 in emp.allowed_shifts:
                for s2 in emp.allowed_shifts:
                    gap = calculate_rest_gap(s1, s2)
                    if gap < 11:
                        if s1.id in shifts[emp.id][today] and s2.id in shifts[emp.id][tomorrow]:
                            v1 = shifts[emp.id][today][s1.id]
                            v2 = shifts[emp.id][tomorrow][s2.id]
                            model.AddImplication(v1, v2.Not())

def calculate_rest_gap(shift1: ShiftType, shift2: ShiftType) -> int:
    """Oblicza przerwę w godzinach (NAPRAWIONA)."""
    if shift1.start_hour > shift1.end_hour: # Nocka
        return shift2.start_hour - shift1.end_hour
    else:
        return (24 - shift1.end_hour) + shift2.start_hour

def add_35h_weekly_rest(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    35h continuous weekly rest
    This means at least 35 consecutive hours off per week
    Simplified: ensure at least 1 full day off per week
    """
    dates = input_data.get_date_list()
    
    for emp in input_data.employees:
        # Group dates by week
        weeks = group_by_week(dates)
        
        for week_dates in weeks:
            if emp.id not in shifts:
                continue
            
            # At least one day must be completely free
            days_off = []
            for date_str in week_dates:
                if date_str in shifts[emp.id]:
                    # Sum of all shifts on this day
                    day_shifts = list(shifts[emp.id][date_str].values())
                    if day_shifts:
                        # Create a variable: is_day_off = (sum of shifts == 0)
                        is_working = model.NewBoolVar(f'{emp.id}_{date_str}_working')
                        model.Add(sum(day_shifts) >= 1).OnlyEnforceIf(is_working)
                        model.Add(sum(day_shifts) == 0).OnlyEnforceIf(is_working.Not())
                        days_off.append(is_working.Not())
            
            # At least one day off per week
            if days_off:
                model.Add(sum(days_off) >= 1)

def add_40h_weekly_limit(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """Max 40 hours per week"""
    dates = input_data.get_date_list()
    
    for emp in input_data.employees:
        weeks = group_by_week(dates)
        
        for week_dates in weeks:
            if emp.id not in shifts:
                continue
            
            weekly_hours = []
            for date_str in week_dates:
                if date_str in shifts[emp.id]:
                    for shift_type in emp.allowed_shifts:
                        shift_var = shifts[emp.id][date_str].get(shift_type.id)
                        if shift_var is not None:
                            # If this shift is worked, add its hours
                            weekly_hours.append(shift_var * shift_type.hours)
            
            if weekly_hours:
                model.Add(sum(weekly_hours) <= 40)

def add_night_shift_recovery(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    After 2 consecutive night shifts, employee must have 2 days off
    """
    dates = input_data.get_date_list()
    
    for emp in input_data.employees:
        # Find night shifts
        night_shifts = [s for s in emp.allowed_shifts if s.is_night]
        if not night_shifts or emp.id not in shifts:
            continue
        
        for i in range(len(dates) - 3):  # Need 4 days: 2 nights + 2 off
            day1, day2, day3, day4 = dates[i:i+4]
            
            # Check if day1 and day2 are both night shifts
            for night_shift in night_shifts:
                night1 = shifts[emp.id].get(day1, {}).get(night_shift.id)
                night2 = shifts[emp.id].get(day2, {}).get(night_shift.id)
                
                if night1 and night2:
                    # If both nights worked, day3 and day4 must be off
                    both_nights = model.NewBoolVar(f'{emp.id}_nights_{day1}_{day2}')
                    model.AddMultiplicationEquality(both_nights, [night1, night2])
                    
                    # Day 3 must be off
                    if day3 in shifts[emp.id]:
                        day3_shifts = list(shifts[emp.id][day3].values())
                        if day3_shifts:
                            model.Add(sum(day3_shifts) == 0).OnlyEnforceIf(both_nights)
                    
                    # Day 4 must be off
                    if day4 in shifts[emp.id]:
                        day4_shifts = list(shifts[emp.id][day4].values())
                        if day4_shifts:
                            model.Add(sum(day4_shifts) == 0).OnlyEnforceIf(both_nights)

def add_max_consecutive_days(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """Max 5 consecutive work days"""
    dates = input_data.get_date_list()
    
    for emp in input_data.employees:
        if emp.id not in shifts:
            continue
        
        for i in range(len(dates) - 5):  # Check 6-day windows
            window = dates[i:i+6]
            
            # At least one day in this 6-day window must be off
            days_working = []
            for date_str in window:
                if date_str in shifts[emp.id]:
                    day_shifts = list(shifts[emp.id][date_str].values())
                    if day_shifts:
                        is_working = model.NewBoolVar(f'{emp.id}_{date_str}_work_check')
                        model.Add(sum(day_shifts) >= 1).OnlyEnforceIf(is_working)
                        model.Add(sum(day_shifts) == 0).OnlyEnforceIf(is_working.Not())
                        days_working.append(is_working)
            
            # At least one day off in 6-day window
            if days_working:
                model.Add(sum(days_working) <= 5)

def add_maria_rules(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Special rules for Maria Pankowska (leader):
    - NO weekends
    - NO before 8:00
    - NO after 20:00
    - NO night shifts
    """
    maria = next((e for e in input_data.employees if e.is_maria_pankowska()), None)
    if not maria or maria.id not in shifts:
        return
    
    for date_str in input_data.get_date_list():
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        is_weekend = date_obj.weekday() >= 5  # Saturday=5, Sunday=6
        
        if date_str not in shifts[maria.id]:
            continue
        
        for shift_type in maria.allowed_shifts:
            shift_var = shifts[maria.id][date_str].get(shift_type.id)
            if shift_var is None:
                continue
            
            # NO weekends
            if is_weekend:
                model.Add(shift_var == 0)
            
            # NO before 8:00
            if shift_type.start_hour < 8:
                model.Add(shift_var == 0)
            
            # NO after 20:00
            if shift_type.end_hour > 20 or shift_type.is_night:
                model.Add(shift_var == 0)

def add_absence_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Handle absences (L4, UW, etc.) from existing schedule and user constraints
    """
    for constraint in input_data.constraints:
        if constraint.type != "ABSENCE":
            continue
        
        emp_id = constraint.employee_id
        if not emp_id or emp_id not in shifts:
            continue
        
        # Single day absence
        if constraint.date:
            date_str = constraint.date
            if date_str in shifts[emp_id]:
                # All shifts must be 0 on this day
                day_shifts = list(shifts[emp_id][date_str].values())
                if day_shifts:
                    model.Add(sum(day_shifts) == 0)
        
        # Date range absence
        if constraint.date_range:
            start_str, end_str = constraint.date_range
            start = datetime.strptime(start_str, '%Y-%m-%d')
            end = datetime.strptime(end_str, '%Y-%m-%d')
            
            current = start
            while current <= end:
                date_str = current.strftime('%Y-%m-%d')
                if date_str in shifts[emp_id]:
                    day_shifts = list(shifts[emp_id][date_str].values())
                    if day_shifts:
                        model.Add(sum(day_shifts) == 0)
                current += timedelta(days=1)

def add_demand_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Minimum staffing requirements per day
    """
    for date_str, min_staff in input_data.demand.items():
        if min_staff <= 0:
            continue
        
        # Count total employees working on this day
        employees_working = []
        for emp in input_data.employees:
            if emp.id not in shifts or date_str not in shifts[emp.id]:
                continue
            
            day_shifts = list(shifts[emp.id][date_str].values())
            if day_shifts:
                is_working = model.NewBoolVar(f'{emp.id}_{date_str}_demand_check')
                model.Add(sum(day_shifts) >= 1).OnlyEnforceIf(is_working)
                model.Add(sum(day_shifts) == 0).OnlyEnforceIf(is_working.Not())
                employees_working.append(is_working)
        
        # At least min_staff employees must work
        if employees_working:
            model.Add(sum(employees_working) >= min_staff)

def add_soft_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput) -> List:
    """
    Add soft constraints as weighted objectives
    Returns list of penalty terms
    """
    objectives = []
    
    # 1. Hour balancing (prefer equal hours among employees)
    balance_penalty = add_hour_balancing_objective(model, shifts, input_data)
    if balance_penalty is not None:
        objectives.append(balance_penalty * 10)  # Weight: 10
    
    # 2. Weekend fairness
    weekend_penalty = add_weekend_fairness_objective(model, shifts, input_data)
    if weekend_penalty is not None:
        objectives.append(weekend_penalty * 5)  # Weight: 5
    
    # 3. Employee preferences
    preference_penalty = add_preference_objective(model, shifts, input_data)
    if preference_penalty is not None:
        objectives.append(preference_penalty * 3)  # Weight: 3
    
    # 3.5 FREE_TIME (soft absence) ← DODAJ TO
    free_time_penalty = add_free_time_objective(model, shifts, input_data)
    if free_time_penalty is not None:
        objectives.append(free_time_penalty * 20)  # Weight: 20 (wyżej niż PREFERENCE)

   # --- NOWE SOFT RULES ---

    # 4. Soft 40h limit (Weight: 50 per hour over 40)
    # Przenosimy z HARD do SOFT
    overtime_penalty = add_soft_40h_limit(model, shifts, input_data)
    if overtime_penalty is not None:
        objectives.append(overtime_penalty * 50) # 50 pkt kary za każdą nadgodzinę

    # 5. Soft Night Shift Recovery (Weight: 100 per violation)
    # Przenosimy z HARD do SOFT
    recovery_penalty = add_soft_night_recovery(model, shifts, input_data)
    if recovery_penalty is not None:
        objectives.append(recovery_penalty * 100) # 100 pkt kary za brak regeneracji po nocce 

    return objectives

def add_hour_balancing_objective(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """Minimize difference in total hours between employees"""
    # Calculate total hours for each employee
    employee_hours = []
    for emp in input_data.employees:
        if emp.id not in shifts:
            continue
        
        total_hours = []
        for date_str in input_data.get_date_list():
            if date_str in shifts[emp.id]:
                for shift_type in emp.allowed_shifts:
                    shift_var = shifts[emp.id][date_str].get(shift_type.id)
                    if shift_var is not None:
                        total_hours.append(shift_var * shift_type.hours)
        
        if total_hours:
            emp_total = model.NewIntVar(0, 1000, f'{emp.id}_total_hours')
            model.Add(emp_total == sum(total_hours))
            employee_hours.append(emp_total)
    
    if len(employee_hours) < 2:
        return None
    
    # Minimize max - min
    max_hours = model.NewIntVar(0, 1000, 'max_hours')
    min_hours = model.NewIntVar(0, 1000, 'min_hours')
    model.AddMaxEquality(max_hours, employee_hours)
    model.AddMinEquality(min_hours, employee_hours)
    
    diff = model.NewIntVar(0, 1000, 'hours_diff')
    model.Add(diff == max_hours - min_hours)
    
    return diff

def add_weekend_fairness_objective(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """Prefer equal weekend work distribution"""
    weekend_counts = []
    
    for emp in input_data.employees:
        if emp.id not in shifts:
            continue
        
        weekend_shifts = []
        for date_str in input_data.get_date_list():
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            if date_obj.weekday() >= 5:  # Weekend
                if date_str in shifts[emp.id]:
                    day_shifts = list(shifts[emp.id][date_str].values())
                    if day_shifts:
                        is_working = model.NewBoolVar(f'{emp.id}_{date_str}_weekend')
                        model.Add(sum(day_shifts) >= 1).OnlyEnforceIf(is_working)
                        weekend_shifts.append(is_working)
        
        if weekend_shifts:
            emp_weekends = model.NewIntVar(0, 100, f'{emp.id}_weekends')
            model.Add(emp_weekends == sum(weekend_shifts))
            weekend_counts.append(emp_weekends)
    
    if len(weekend_counts) < 2:
        return None
    
    # Minimize difference
    max_weekends = model.NewIntVar(0, 100, 'max_weekends')
    min_weekends = model.NewIntVar(0, 100, 'min_weekends')
    model.AddMaxEquality(max_weekends, weekend_counts)
    model.AddMinEquality(min_weekends, weekend_counts)
    
    diff = model.NewIntVar(0, 100, 'weekend_diff')
    model.Add(diff == max_weekends - min_weekends)
    
    return diff

def add_preference_objective(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """Handle soft employee preferences"""
    penalties = []
    
    for constraint in input_data.constraints:
        if constraint.type != "PREFERENCE" or constraint.is_hard:
            continue
        
        emp_id = constraint.employee_id
        if not emp_id or emp_id not in shifts:
            continue
        
        # Example: "prefer_nights" preference
        # This is simplified - you can extend based on constraint.value
        
    return sum(penalties) if penalties else None

def group_by_week(dates: List[str]) -> List[List[str]]:
    """Group dates by ISO week"""
    weeks = {}
    for date_str in dates:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        week_key = date_obj.isocalendar()[:2]  # (year, week)
        if week_key not in weeks:
            weeks[week_key] = []
        weeks[week_key].append(date_str)
    
    return list(weeks.values())

def add_min_one_night_shift_per_day(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Ensures that there is always at least one person working the night shift (e.g. 20-8).
    This guarantees 24/7 coverage if day shifts cover the rest.
    """
    dates = input_data.get_date_list()
    
    for date_str in dates:
        night_vars = []
        for emp in input_data.employees:
            if emp.id not in shifts or date_str not in shifts[emp.id]:
                continue
            
            # Find night shift variables for this employee on this day
            for shift in emp.allowed_shifts:
                # Sprawdzamy czy to nocka (is_night = True)
                if shift.is_night: 
                    var = shifts[emp.id][date_str].get(shift.id)
                    if var is not None:
                        night_vars.append(var)
        
        if night_vars:
            # Suma osób na nocce >= 1
            model.Add(sum(night_vars) >= 1)

def add_soft_40h_limit(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Soft constraint: Try to keep weekly hours <= 40.
    If > 40, penalty is proportional to excess.
    Hard limit is 48h (legal max with overtime).
    """
    dates = input_data.get_date_list()
    penalties = []
    
    for emp in input_data.employees:
        weeks = group_by_week(dates)
        for week_dates in weeks:
            if emp.id not in shifts: continue
            
            weekly_hours = []
            for date_str in week_dates:
                if date_str in shifts[emp.id]:
                    for shift_type in emp.allowed_shifts:
                        shift_var = shifts[emp.id][date_str].get(shift_type.id)
                        if shift_var is not None:
                            weekly_hours.append(shift_var * shift_type.hours)
            
            if weekly_hours:
                total_week_hours = model.NewIntVar(0, 168, f'week_hours_{emp.id}_{week_dates[0]}')
                model.Add(total_week_hours == sum(weekly_hours))
                
                # HARD LIMIT: Max 48h (Kodeks Pracy z nadgodzinami)
                model.Add(total_week_hours <= 48)
                
                # SOFT TARGET: Max 40h
                # excess = max(0, total - 40)
                excess = model.NewIntVar(0, 48, f'excess_{emp.id}_{week_dates[0]}')
                # Logic: excess >= total - 40
                model.Add(excess >= total_week_hours - 40)
                penalties.append(excess)
                
    return sum(penalties) if penalties else None


def add_soft_night_recovery(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Soft constraint: Prefer 2 days off after 2 consecutive night shifts.
    Violation penalty is applied if they work on day 3 or 4.
    """
    dates = input_data.get_date_list()
    penalties = []
    
    for emp in input_data.employees:
        night_shifts = [s for s in emp.allowed_shifts if s.is_night]
        if not night_shifts or emp.id not in shifts: continue
        
        for i in range(len(dates) - 3):
            day1, day2, day3, day4 = dates[i:i+4]
            
            # Sprawdź czy 2 noce z rzędu
            # Uproszczenie: Sumujemy zmienne nocne. Jeśli suma = 2, to są 2 noce.
            night_vars = []
            for d in [day1, day2]:
                for ns in night_shifts:
                    v = shifts[emp.id].get(d, {}).get(ns.id)
                    if v is not None: night_vars.append(v)
            
            if len(night_vars) < 2: continue # Nie ma opcji na 2 noce
            
            two_nights = model.NewBoolVar(f'{emp.id}_2nights_{day1}')
            # Jeśli suma nocnych zmian w day1 i day2 == 2, to two_nights = 1
            model.Add(sum(night_vars) == 2).OnlyEnforceIf(two_nights)
            model.Add(sum(night_vars) < 2).OnlyEnforceIf(two_nights.Not())
            
            # Sprawdź czy pracuje w day3
            day3_work_vars = list(shifts[emp.id][day3].values())
            if day3_work_vars:
                works_day3 = model.NewBoolVar(f'{emp.id}_works_{day3}')
                model.Add(sum(day3_work_vars) >= 1).OnlyEnforceIf(works_day3)
                model.Add(sum(day3_work_vars) == 0).OnlyEnforceIf(works_day3.Not())
                
                # Penalty: Jeśli (2 noce) ORAZ (pracuje w day3)
                violation3 = model.NewBoolVar(f'viol_recov3_{emp.id}_{day1}')
                model.AddBoolAnd([two_nights, works_day3]).OnlyEnforceIf(violation3)
                penalties.append(violation3)

            # Analogicznie dla day4 (opcjonalnie, można odpuścić dla uproszczenia)
            
    return sum(penalties) if penalties else None

def add_fixed_shift_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Pozwala walidatorowi wymuszać konkretne zmiany z GUI.
    Obsługuje typy constraints: 'SHIFT', 'FIXED', 'FIXED_SHIFT'.
    """
    for constraint in input_data.constraints:
        if constraint.type not in ["SHIFT", "FIXED", "FIXED_SHIFT"]:
            continue
        
        emp_id = constraint.employee_id
        if not emp_id or emp_id not in shifts:
            continue
            
        date_str = constraint.date
        target_shift_id = constraint.value
        
        # Sprawdzamy czy taka zmiana jest dostępna w modelu (w allowedShifts)
        if date_str in shifts[emp_id] and target_shift_id in shifts[emp_id][date_str]:
            shift_var = shifts[emp_id][date_str][target_shift_id]
            
            # Jeśli is_hard=True (domyślnie), wymuszamy tę zmianę
            if constraint.is_hard:
                model.Add(shift_var == 1)
        else:
            # Ostrzeżenie w logach, jeśli GUI wysłało zmianę, której model nie zna
            print(f"Warning: Forced shift '{target_shift_id}' not found for {emp_id} on {date_str}", file=sys.stderr)

def add_coverage_constraints(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Gwarantuje ciągłość pracy 24/7 poprzez podział doby na strefy.
    Wymaga minimum 1 osoby w każdej strefie:
    - RANO (start 6:00-14:00)
    - POPOŁUDNIE (start 14:00-22:00 lub pokrycie popołudnia)
    - NOC (start >19:00 lub is_night)
    """
    for date_str in input_data.get_date_list():
        morning_staff = []
        afternoon_staff = []
        night_staff = []

        for emp in input_data.employees:
            if emp.id not in shifts or date_str not in shifts[emp.id]:
                continue
                
            for shift_type in emp.allowed_shifts:
                if shift_type.id in shifts[emp.id][date_str]:
                    var = shifts[emp.id][date_str][shift_type.id]
                    
                    # Definicja stref (możesz dostosować godziny)
                    start = shift_type.start_hour
                    end = shift_type.end_hour
                    
                    # RANO (np. 8-14, 8-16)
                    if 6 <= start < 14:
                        morning_staff.append(var)
                    
                    # POPOŁUDNIE (np. 14-20, ale też 8-20, 12-20)
                    # Warunek: startuje po południu LUB trwa przez popołudnie (startuje rano i kończy wieczorem)
                    if (12 <= start < 20) or (start < 14 and end > 16):
                        afternoon_staff.append(var)
                    
                    # NOC (np. 20-8, 19-7)
                    if shift_type.is_night or start >= 19:
                        night_staff.append(var)

        # Twarde reguły: minimum 1 osoba w każdej strefie
        # (Jeśli brakuje ludzi w allowed_shifts na daną porę, solver zgłosi INFEASIBLE)
        if morning_staff: model.Add(sum(morning_staff) >= 1)
        if afternoon_staff: model.Add(sum(afternoon_staff) >= 1)
        if night_staff: model.Add(sum(night_staff) >= 1)

def add_leader_support_rule(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Jeśli pracuje Lider (Maria), musi pracować też ktoś inny (pomoc).
    Szukamy pracownika, który ma 'Maria' lub 'Pankowska' w nazwie, lub ma specjalną flagę.
    """
    # Próba znalezienia lidera po nazwisku lub roli (dostosuj do swoich danych)
    leader = next((e for e in input_data.employees if "Maria" in e.name or "Pankowska" in e.name), None)
    
    if not leader: 
        return

    for date_str in input_data.get_date_list():
        if leader.id not in shifts or date_str not in shifts[leader.id]:
            continue
            
        # Zmienna pomocnicza: czy lider pracuje w ten dzień?
        leader_working = model.NewBoolVar(f'leader_working_{date_str}')
        leader_shifts_vars = list(shifts[leader.id][date_str].values())
        
        if not leader_shifts_vars:
            continue
            
        # Powiązanie zmiennej bool z faktycznymi zmianami
        model.Add(sum(leader_shifts_vars) == 1).OnlyEnforceIf(leader_working)
        model.Add(sum(leader_shifts_vars) == 0).OnlyEnforceIf(leader_working.Not())
        
        # Zbieramy resztę zespołu w tym dniu
        support_staff = []
        for emp in input_data.employees:
            if emp.id == leader.id: continue # Pomijamy lidera
            if emp.id in shifts and date_str in shifts[emp.id]:
                support_staff.extend(shifts[emp.id][date_str].values())
        
        # Jeśli lider pracuje => suma reszty zespołu >= 1
        if support_staff:
            model.Add(sum(support_staff) >= 1).OnlyEnforceIf(leader_working)

def add_free_time_objective(model: cp_model.CpModel, shifts: Dict, input_data: SolverInput):
    """
    Handle FREE_TIME constraints (soft absence with date range).
    User wants time off but solver can override if necessary.
    Penalty is applied for each day worked during the requested period.
    """
    penalties = []
    
    for constraint in input_data.constraints:
        # Tylko FREE_TIME i musi być soft (isHard=False)
        if constraint.type != "FREE_TIME" or constraint.is_hard:
            continue
        
        emp_id = constraint.employee_id
        if not emp_id or emp_id not in shifts:
            continue
        
        # FREE_TIME wymaga dateRange
        if not constraint.date_range:
            print(f"Warning: FREE_TIME constraint for {emp_id} missing date_range", file=sys.stderr)
            continue
        
        start_str, end_str = constraint.date_range
        start = datetime.strptime(start_str, '%Y-%m-%d')
        end = datetime.strptime(end_str, '%Y-%m-%d')
        
        # Iteruj po każdym dniu w zakresie
        current = start
        while current <= end:
            date_str = current.strftime('%Y-%m-%d')
            
            if date_str in shifts[emp_id]:
                day_shifts = list(shifts[emp_id][date_str].values())
                if day_shifts:
                    # Utwórz zmienną: czy pracownik pracuje w tym dniu?
                    is_working = model.NewBoolVar(f'free_time_violation_{emp_id}_{date_str}')
                    model.Add(sum(day_shifts) >= 1).OnlyEnforceIf(is_working)
                    model.Add(sum(day_shifts) == 0).OnlyEnforceIf(is_working.Not())
                    
                    # Kara za pracę w dniu wolnym
                    penalties.append(is_working)
            
            current += timedelta(days=1)
    
    return sum(penalties) if penalties else None
