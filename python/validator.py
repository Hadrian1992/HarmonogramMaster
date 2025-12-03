#!/usr/bin/env python3
"""
Schedule Validator
Checks a schedule against defined rules and returns a list of violations.
This is a procedural validator, not a solver. It checks the *current* state.
"""
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# --- Helper Classes ---
class ShiftType:
    def __init__(self, id: str):
        self.id = id
        self.start_hour = 0
        self.end_hour = 0
        self.hours = 0
        self.is_night = False
        self.is_working = False
        
        self._parse()
    
    def _parse(self):
        # Basic parsing logic similar to ShiftType.from_string in models.py
        s = self.id.upper()
        if s in ['W', 'NN', 'WYCH']:
            self.is_working = False
            return
        
        if s in ['L4', 'UW', 'UZ', 'UŻ', 'UM', 'USW', 'UB', 'OP']:
            self.is_working = False # Treated as absence for working rules, but might block other shifts
            return

        if s.startswith('K'):
            self.is_working = False # Contact hours usually don't count as "working shift" for rest rules? 
            # Actually depends on interpretation. Let's assume K is work for now if it has hours?
            # In constraints.py K is often treated separately. Let's assume K is NOT work for 11h rest unless specified.
            # But wait, K 4h is work. Let's treat it as work.
            self.is_working = True
            try:
                parts = s.split()
                if len(parts) > 1:
                    self.hours = int(parts[1])
            except:
                pass
            return

        # Parse "8-16", "20-8"
        if '-' in s:
            try:
                start, end = map(int, s.split('-'))
                self.start_hour = start
                self.end_hour = end
                self.is_working = True
                
                if start > end:
                    self.hours = (24 - start) + end
                    self.is_night = True
                else:
                    self.hours = end - start
                    # Check if it covers night hours (e.g. 22:00-6:00)
                    # Simple heuristic: if it starts >= 19 or ends <= 7 (next day)
                    if start >= 19: self.is_night = True
            except:
                pass

class Employee:
    def __init__(self, id: str, name: str):
        self.id = id
        self.name = name
        self.shifts: Dict[str, ShiftType] = {} # date -> ShiftType

# --- Validation Logic ---

def validate_schedule(input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    violations = []
    
    employees_data = input_data.get('employees', [])
    constraints = input_data.get('constraints', [])
    date_range = input_data.get('dateRange', {})
    
    # 1. Build Employee Objects and Map Shifts
    employees: Dict[str, Employee] = {}
    for emp_d in employees_data:
        emp = Employee(emp_d['id'], emp_d['name'])
        employees[emp.id] = emp
    
    # Map constraints (shifts) to employees
    # We assume 'constraints' contains the current schedule as SHIFT constraints
    for c in constraints:
        if c.get('type') == 'SHIFT' and c.get('isHard'):
            emp_id = c.get('employeeId')
            date = c.get('date')
            val = c.get('value')
            
            if emp_id in employees and date and val:
                shift = ShiftType(val)
                employees[emp_id].shifts[date] = shift

    # Helper: Get sorted dates
    if not date_range or not date_range.get('start'):
        # Infer from shifts if not provided
        all_dates = set()
        for emp in employees.values():
            all_dates.update(emp.shifts.keys())
        if not all_dates:
            return []
        sorted_dates = sorted(list(all_dates))
    else:
        start = datetime.strptime(date_range['start'], '%Y-%m-%d')
        end = datetime.strptime(date_range['end'], '%Y-%m-%d')
        sorted_dates = []
        curr = start
        while curr <= end:
            sorted_dates.append(curr.strftime('%Y-%m-%d'))
            curr += timedelta(days=1)

    # --- RULE CHECKS ---

    # 1. 11h Daily Rest
    for emp in employees.values():
        for i in range(len(sorted_dates) - 1):
            today = sorted_dates[i]
            tomorrow = sorted_dates[i+1]
            
            s1 = emp.shifts.get(today)
            s2 = emp.shifts.get(tomorrow)
            
            if s1 and s2 and s1.is_working and s2.is_working:
                gap = 0
                if s1.start_hour > s1.end_hour: # Night shift
                    gap = s2.start_hour - s1.end_hour
                else:
                    gap = (24 - s1.end_hour) + s2.start_hour
                
                if gap < 11:
                    violations.append({
                        "rule": "11h Rest",
                        "employee": emp.name,
                        "date": tomorrow,
                        "message": f"Brak 11h odpoczynku! Koniec {today} o {s1.end_hour}:00, start {tomorrow} o {s2.start_hour}:00 (Przerwa: {gap}h)."
                    })

    # 2. Coverage (24h)
    for date in sorted_dates:
        morning_staff = 0
        afternoon_staff = 0
        night_staff = 0
        
        for emp in employees.values():
            shift = emp.shifts.get(date)
            if shift and shift.is_working:
                start = shift.start_hour
                end = shift.end_hour
                
                # RANO (6-14)
                if 6 <= start < 14:
                    morning_staff += 1
                
                # POPOŁUDNIE (12-20 or covers afternoon)
                if (12 <= start < 20) or (start < 14 and end > 16):
                    afternoon_staff += 1
                
                # NOC (start >= 19 or is_night)
                if shift.is_night or start >= 19:
                    night_staff += 1
        
        if morning_staff == 0:
            violations.append({
                "rule": "Coverage",
                "date": date,
                "message": f"Brak obsady RANO (6:00-14:00) w dniu {date}."
            })
        if afternoon_staff == 0:
            violations.append({
                "rule": "Coverage",
                "date": date,
                "message": f"Brak obsady POPOŁUDNIE (14:00-20:00) w dniu {date}."
            })
        if night_staff == 0:
            violations.append({
                "rule": "Coverage",
                "date": date,
                "message": f"Brak obsady NOC (20:00-8:00) w dniu {date}."
            })

    # 3. Leader Support (Maria Pankowska)
    leader = next((e for e in employees.values() if "Maria" in e.name or "Pankowska" in e.name), None)
    if leader:
        for date in sorted_dates:
            leader_shift = leader.shifts.get(date)
            if leader_shift and leader_shift.is_working:
                # Check if anyone else is working
                support_count = 0
                for emp in employees.values():
                    if emp.id == leader.id: continue
                    s = emp.shifts.get(date)
                    if s and s.is_working:
                        support_count += 1
                
                if support_count == 0:
                    violations.append({
                        "rule": "Leader Support",
                        "date": date,
                        "message": f"Lider (Maria) pracuje sama w dniu {date}! Wymagana pomoc."
                    })

    # 4. Max 5 consecutive days
    for emp in employees.values():
        consecutive = 0
        start_run = None
        for date in sorted_dates:
            shift = emp.shifts.get(date)
            if shift and shift.is_working:
                if consecutive == 0: start_run = date
                consecutive += 1
            else:
                consecutive = 0
            
            if consecutive > 5:
                violations.append({
                    "rule": "Max Consecutive Days",
                    "employee": emp.name,
                    "date": date,
                    "message": f"Przekroczono 5 dni pracy z rzędu (od {start_run})."
                })
                # Reset to avoid spamming for 6, 7, 8...
                consecutive = 0 

    # 5. Maria Rules (No Weekends, 8-20 only)
    if leader:
        for date in sorted_dates:
            shift = leader.shifts.get(date)
            if not shift or not shift.is_working: continue
            
            dt = datetime.strptime(date, '%Y-%m-%d')
            if dt.weekday() >= 5: # Weekend
                violations.append({
                    "rule": "Leader Rules",
                    "employee": leader.name,
                    "date": date,
                    "message": "Lider nie może pracować w weekendy."
                })
            
            if shift.start_hour < 8 or shift.end_hour > 20 or shift.is_night:
                 violations.append({
                    "rule": "Leader Rules",
                    "employee": leader.name,
                    "date": date,
                    "message": f"Lider może pracować tylko 8:00-20:00. Zmiana {shift.id} jest niedozwolona."
                })

    return violations

def main():
    try:
        input_json = json.load(sys.stdin)
        violations = validate_schedule(input_json)
        
        print(json.dumps({
            "status": "OK" if not violations else "VIOLATIONS",
            "violations": violations
        }, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "status": "ERROR",
            "error": str(e)
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
