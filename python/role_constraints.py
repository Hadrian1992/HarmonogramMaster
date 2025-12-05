"""
Role-based constraints for OR-Tools scheduler
Phase 2: Replaces hardcoded Maria rules with flexible role system
"""

from typing import Dict, List
from datetime import datetime  # 🔧 Fix: Added missing import
from ortools.sat.python import cp_model
from models import SolverInput, Employee


def add_role_based_shift_restrictions(
    model: cp_model.CpModel,
    shifts: Dict,
    input_data: SolverInput
):
    """
    Apply shift restrictions based on employee roles.
    
    Example:
    - LIDER: No weekends, no shifts before 8:00 or after 20:00
    - WYCHOWAWCA: Flexible, all shifts allowed
    - MEDYK: Custom restrictions if needed
    """
    
    for emp in input_data.employees:
        if emp.id not in shifts:
            continue
        
        # LIDER role restrictions (replaces Maria hardcoded rules)
        if 'LIDER' in emp.roles:
            for date_str in shifts[emp.id]:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')  # 🔧 Fix: use datetime directly
                is_weekend = date_obj.weekday() >= 5
                
                for shift_type in emp.allowed_shifts:
                    shift_var = shifts[emp.id][date_str].get(shift_type.id)
                    if shift_var is None:
                        continue
                    
                    # Rule 1: LIDER nie pracuje w weekendy
                    if is_weekend:
                        model.Add(shift_var == 0)
                    
                    # Rule 2: LIDER nie zaczyna przed 8:00
                    if shift_type.start_hour < 8:
                        model.Add(shift_var == 0)
                    
                    # Rule 3: LIDER nie kończy po 20:00
                    if shift_type.end_hour > 20:
                        model.Add(shift_var == 0)


def get_employees_with_role_on_date(
    employees: List[Employee],
    shifts: Dict,
    date_str: str,
    role: str,
    shift_time_filter=None  # Function(shift_type) -> bool
) -> List:
    """
    Helper: Get list of BoolVars representing employees with specific role working on date.
    
    Args:
        employees: List of employees
        shifts: Shift variables dict
        date_str: Date to check
        role: Role to filter by (e.g., 'LIDER')
        shift_time_filter: Optional function to filter shifts by time
                          e.g., lambda st: st.start_hour < 20 for day shifts
    
    Returns:
        List of BoolVar indicating if each employee with role is working
    """
    from ortools.sat.python import cp_model
    
    working_employees = []
    
    for emp in employees:
        if role not in emp.roles:
            continue
        
        if emp.id not in shifts or date_str not in shifts[emp.id]:
            continue
        
        # Collect shift variables for this employee on this date
        shift_vars = []
        for shift_type in emp.allowed_shifts:
            # Apply time filter if provided
            if shift_time_filter and not shift_time_filter(shift_type):
                continue
            
            shift_var = shifts[emp.id][date_str].get(shift_type.id)
            if shift_var is not None:
                shift_vars.append(shift_var)
        
        if shift_vars:
            # This employee is working if any of their shifts is active
            is_working = cp_model.CpModel().NewBoolVar(f'{emp.id}_{date_str}_role_{role}')
            # Note: We need the model instance, will fix in integration
            working_employees.append((is_working, shift_vars))
    
    return working_employees


def add_role_coverage_requirements(
    model: cp_model.CpModel,
    shifts: Dict,
    input_data: SolverInput,
    role_requirements: Dict[str, Dict[str, int]]
):
    """
    Enforce role-based coverage requirements.
    
    Example:
    role_requirements = {
        '2025-12-05': {
            'LIDER_DAY': 1,      # Min 1 LIDER on day shifts
            'WYCHOWAWCA_DAY': 1, # Min 1 WYCHOWAWCA on day shifts  
            'WYCHOWAWCA_NIGHT': 1 # Min 1 WYCHOWAWCA on night shifts
        }
    }
    """
    
    for date_str, requirements in role_requirements.items():
        for req_key, min_count in requirements.items():
            if min_count <= 0:
                continue
            
            # Parse requirement key (e.g., 'LIDER_DAY' -> role='LIDER', time='DAY')
            parts = req_key.split('_')
            if len(parts) < 2:
                continue
            
            role = parts[0]
            time_period = parts[1]  # 'DAY' or 'NIGHT'
            
            # Define time filter
            if time_period == 'DAY':
                time_filter = lambda st: st.start_hour < 20
            elif time_period == 'NIGHT':
                time_filter = lambda st: st.start_hour >= 20
            else:
                time_filter = None
            
            # Count employees with this role working in this time period
            working_with_role = []
            
            for emp in input_data.employees:
                if role not in emp.roles:
                    continue
                
                if emp.id not in shifts or date_str not in shifts[emp.id]:
                    continue
                
                # Collect matching shift variables
                matching_shifts = []
                for shift_type in emp.allowed_shifts:
                    if time_filter and not time_filter(shift_type):
                        continue
                    
                    shift_var = shifts[emp.id][date_str].get(shift_type.id)
                    if shift_var is not None:
                        matching_shifts.append(shift_var)
                
                if matching_shifts:
                    is_working = model.NewBoolVar(f'{emp.id}_{date_str}_{req_key}')
                    model.Add(sum(matching_shifts) >= 1).OnlyEnforceIf(is_working)
                    model.Add(sum(matching_shifts) == 0).OnlyEnforceIf(is_working.Not())
                    working_with_role.append(is_working)
            
            # Enforce minimum count
            if working_with_role:
                model.Add(sum(working_with_role) >= min_count)


def add_leader_support_constraint(
    model: cp_model.CpModel,
    shifts: Dict,
    input_data: SolverInput
):
    """
    Ensure LIDER has WYCHOWAWCA support when working.
    
    Rule: When LIDER works a day shift (< 20:00), at least one WYCHOWAWCA 
    must be present on an overlapping or extended shift.
    """
    
    for date_str in input_data.get_date_list():
        # Find if any LIDER is working on day shift
        lider_working_day = []
        
        for emp in input_data.employees:
            if 'LIDER' not in emp.roles:
                continue
            
            if emp.id not in shifts or date_str not in shifts[emp.id]:
                continue
            
            day_shifts = []
            for shift_type in emp.allowed_shifts:
                if shift_type.start_hour < 20:  # Day shift
                    shift_var = shifts[emp.id][date_str].get(shift_type.id)
                    if shift_var is not None:
                        day_shifts.append(shift_var)
            
            if day_shifts:
                lider_working = model.NewBoolVar(f'lider_{emp.id}_{date_str}_working')
                model.Add(sum(day_shifts) >= 1).OnlyEnforceIf(lider_working)
                model.Add(sum(day_shifts) == 0).OnlyEnforceIf(lider_working.Not())
                lider_working_day.append(lider_working)
        
        # If LIDER is working, ensure WYCHOWAWCA support
        if lider_working_day:
            any_lider = model.NewBoolVar(f'any_lider_{date_str}')
            model.AddMaxEquality(any_lider, lider_working_day)
            
            # Count WYCHOWAWCA on support shifts (covering afternoon)
            wychowawca_support = []
            
            for emp in input_data.employees:
                if 'WYCHOWAWCA' not in emp.roles:
                    continue
                
                if emp.id not in shifts or date_str not in shifts[emp.id]:
                    continue
                
                # Support shifts: longer day shifts that extend into afternoon/evening
                support_shifts = []
                for shift_type in emp.allowed_shifts:
                    # Shifts that cover afternoon (e.g., 8-20, 14-20, 10-20)
                    if shift_type.start_hour < 20 and shift_type.end_hour >= 14:
                        shift_var = shifts[emp.id][date_str].get(shift_type.id)
                        if shift_var is not None:
                            support_shifts.append(shift_var)
                
                if support_shifts:
                    is_supporting = model.NewBoolVar(f'wych_{emp.id}_{date_str}_support')
                    model.Add(sum(support_shifts) >= 1).OnlyEnforceIf(is_supporting)
                    model.Add(sum(support_shifts) == 0).OnlyEnforceIf(is_supporting.Not())
                    wychowawca_support.append(is_supporting)
            
            # If LIDER works, at least 1 WYCHOWAWCA must provide support
            if wychowawca_support:
                model.Add(sum(wychowawca_support) >= 1).OnlyEnforceIf(any_lider)
