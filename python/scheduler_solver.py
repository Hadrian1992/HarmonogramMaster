#!/usr/bin/env python3
"""
OR-Tools Schedule Solver
Main solver for generating optimal work schedules
"""
import sys
import json
from ortools.sat.python import cp_model
from models import SolverInput, SolverOutput, Employee, ShiftType, Constraint
from constraints import add_all_constraints
from datetime import datetime, timedelta
from typing import Dict, List

# ============================================================================
# 🎯 EARLY STOP CONFIGURATION - Dostosuj te wartości!
# ============================================================================
EARLY_STOP_ENABLED = True          # True = włączone, False = wyłączone
EARLY_STOP_SCORE_THRESHOLD = 800   # Zatrzymaj gdy score < 600
EARLY_STOP_MIN_SOLUTIONS = 10       # Znajdź minimum 5 rozwiązań przed early stop
EARLY_STOP_NO_IMPROVEMENT_SEC = 600  # Zatrzymaj jeśli brak poprawy przez 5 minut

# Proponowane wartości dla różnych okresów:
# 7-14 dni:  THRESHOLD = 500,  MIN_SOLUTIONS = 3
# 14-21 dni: THRESHOLD = 700,  MIN_SOLUTIONS = 4  
# 21-28 dni: THRESHOLD = 800,  MIN_SOLUTIONS = 5
# 28+ dni:   THRESHOLD = 1000, MIN_SOLUTIONS = 6
# ============================================================================

def parse_input(input_json: dict) -> SolverInput:
    """Parse JSON input into SolverInput object"""
    # Parse employees
    employees = []
    for emp_data in input_json.get('employees', []):
        # Parse allowed shifts
        allowed_shifts = []
        for shift_str in emp_data.get('allowedShifts', []):
            try:
                shift = ShiftType.from_string(shift_str)
                allowed_shifts.append(shift)
            except ValueError as e:
                print(f"Warning: Invalid shift format '{shift_str}': {e}", file=sys.stderr)
        
        employee = Employee(
            id=emp_data['id'],
            name=emp_data['name'],
            roles=emp_data.get('roles', []),  # 🆕 Phase 2: Parse roles from frontend
            allowed_shifts=allowed_shifts,
            preferences=emp_data.get('preferences', {}),
            special_rules=emp_data.get('specialRules', {})
        )
        employees.append(employee)
    
    # Parse constraints
    constraints = []
    for const_data in input_json.get('constraints', []):
        constraint = Constraint(
            type=const_data['type'],
            employee_id=const_data.get('employeeId'),
            date=const_data.get('date'),
            date_range=tuple(const_data['dateRange']) if const_data.get('dateRange') else None,
            value=const_data.get('value'),
            description=const_data.get('description', ''),
            is_hard=const_data.get('isHard', True)
        )
        constraints.append(constraint)
    
    # Parse date range
    date_range = (
        input_json['dateRange']['start'],
        input_json['dateRange']['end']
    )
    
    # Parse demand
    demand = input_json.get('demand', {})
    
    # Parse existing schedule
    existing_schedule = input_json.get('existingSchedule', {})
    
    return SolverInput(
        employees=employees,
        constraints=constraints,
        date_range=date_range,
        demand=demand,
        existing_schedule=existing_schedule
    )

def create_shift_variables(model: cp_model.CpModel, input_data: SolverInput) -> Dict:
    """
    Create decision variables for the model
    shifts[employee_id][date][shift_type_id] = BoolVar
    """
    shifts = {}
    
    for emp in input_data.employees:
        shifts[emp.id] = {}
        for date_str in input_data.get_date_list():
            shifts[emp.id][date_str] = {}
            for shift_type in emp.allowed_shifts:
                var_name = f"{emp.id}_{date_str}_{shift_type.id}"
                shifts[emp.id][date_str][shift_type.id] = model.NewBoolVar(var_name)
    
    return shifts

def extract_schedule(solver: cp_model.CpSolver, shifts: Dict, employees: List[Employee]) -> Dict[str, Dict[str, str]]:
    """Extract the solution from the solver"""
    schedule = {}
    
    for emp in employees:
        schedule[emp.id] = {}
        if emp.id not in shifts:
            continue
        
        for date_str, date_shifts in shifts[emp.id].items():
            for shift_type_id, shift_var in date_shifts.items():
                if solver.Value(shift_var) == 1:
                    schedule[emp.id][date_str] = shift_type_id
                    break  # Only one shift per day
    
    return schedule

def solve_schedule(input_data: SolverInput) -> SolverOutput:
    """
    Main solver function
    """
    print(f"Solving schedule for {len(input_data.employees)} employees", file=sys.stderr)
    print(f"Date range: {input_data.date_range[0]} to {input_data.date_range[1]}", file=sys.stderr)
    
    # Create model
    model = cp_model.CpModel()
    
    # Create variables
    print("Creating variables...", file=sys.stderr)
    shifts = create_shift_variables(model, input_data)
    
    # --- ZMIANA: POBIERANIE HISTORII ---
    # Próbujemy pobrać historię zmian z poprzedniego dnia
    try:
        history_shifts = input_data.get_history_shifts()
        print(f"Loaded history for {len(history_shifts)} employees", file=sys.stderr)
    except Exception as e:
        print(f"Warning: Failed to load history shifts: {e}", file=sys.stderr)
        history_shifts = {}
    # -----------------------------------

    # Add constraints
    print("Adding constraints...", file=sys.stderr)
    add_all_constraints(model, shifts, input_data, history_shifts)
    # ------------------------------------
    
    # ========================================================================
    # 🎯 EARLY STOP CALLBACK
    # ========================================================================
    class SolutionCallback(cp_model.CpSolverSolutionCallback):
        """Callback to monitor solutions and stop early if conditions are met"""
        def __init__(self):
            cp_model.CpSolverSolutionCallback.__init__(self)
            self.solution_count = 0
            self.best_score = float('inf')
            self.last_improvement_time = 0
            self.start_time = None
            
        def on_solution_callback(self):
            if self.start_time is None:
                self.start_time = self.WallTime()
                
            self.solution_count += 1
            current_score = self.ObjectiveValue()
            current_time = self.WallTime()
            
            # Log progress
            print(f"Solution #{self.solution_count}: score={current_score}, time={current_time:.1f}s", file=sys.stderr)
            
            if not EARLY_STOP_ENABLED:
                self.best_score = current_score
                return
            
            # Check if score improved
            if current_score < self.best_score:
                self.best_score = current_score
                self.last_improvement_time = current_time
            
            # EARLY STOP CONDITION 1: Score threshold reached
            if current_score < EARLY_STOP_SCORE_THRESHOLD and self.solution_count >= EARLY_STOP_MIN_SOLUTIONS:
                print(f"🎯 Early stop! Score {current_score} < {EARLY_STOP_SCORE_THRESHOLD} (after {self.solution_count} solutions)", file=sys.stderr)
                self.StopSearch()
                return
            
            # EARLY STOP CONDITION 2: No improvement for X seconds
            time_since_improvement = current_time - self.last_improvement_time
            if time_since_improvement > EARLY_STOP_NO_IMPROVEMENT_SEC and self.solution_count >= EARLY_STOP_MIN_SOLUTIONS:
                print(f"⏱️ Early stop! No improvement for {time_since_improvement:.0f}s (best: {self.best_score})", file=sys.stderr)
                self.StopSearch()
                return
    
    # ========================================================================
    
    # Solve
    print("Solving...", file=sys.stderr)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 1800.0  # 30 minutes timeout
    solver.parameters.log_search_progress = False
    
    # Use callback if early stop enabled
    if EARLY_STOP_ENABLED:
        callback = SolutionCallback()
        print(f"Early stop: ENABLED (threshold={EARLY_STOP_SCORE_THRESHOLD}, min_solutions={EARLY_STOP_MIN_SOLUTIONS})", file=sys.stderr)
        status = solver.Solve(model, callback)
    else:
        print("Early stop: DISABLED", file=sys.stderr)
        status = solver.Solve(model)

    
    # Extract solution
    if status == cp_model.OPTIMAL:
        print("✓ Optimal solution found!", file=sys.stderr)
        schedule = extract_schedule(solver, shifts, input_data.employees)
        return SolverOutput(
            status="SUCCESS",
            schedule=schedule,
            stats={
                "solve_time": solver.WallTime(),
                "status": "OPTIMAL",
                "objective_value": solver.ObjectiveValue() if solver.ObjectiveValue() else 0,
                "num_conflicts": solver.NumConflicts(),
                "num_branches": solver.NumBranches()
            }
        )
    elif status == cp_model.FEASIBLE:
        print("✓ Feasible solution found (not optimal)", file=sys.stderr)
        schedule = extract_schedule(solver, shifts, input_data.employees)
        return SolverOutput(
            status="SUCCESS",
            schedule=schedule,
            stats={
                "solve_time": solver.WallTime(),
                "status": "FEASIBLE",
                "objective_value": solver.ObjectiveValue() if solver.ObjectiveValue() else 0,
                "num_conflicts": solver.NumConflicts(),
                "num_branches": solver.NumBranches()
            },
            violations=["Solution is feasible but not optimal"]
        )
    elif status == cp_model.INFEASIBLE:
        print("✗ No solution found (INFEASIBLE)", file=sys.stderr)
        return SolverOutput(
            status="FAILED",
            error="No feasible solution exists. Constraints are too restrictive.",
            stats={
                "solve_time": solver.WallTime(),
                "status": "INFEASIBLE"
            }
        )
    else:
        print(f"✗ Solver failed with status: {solver.StatusName(status)}", file=sys.stderr)
        return SolverOutput(
            status="FAILED",
            error=f"Solver failed: {solver.StatusName(status)}",
            stats={
                "solve_time": solver.WallTime(),
                "status": solver.StatusName(status)
            }
        )

def main():
    """Main entry point"""
    try:
        # Read JSON from stdin
        print("Reading input from stdin...", file=sys.stderr)
        input_json = json.load(sys.stdin)
        
        # Parse input
        print("Parsing input...", file=sys.stderr)
        input_data = parse_input(input_json)
        
        # Solve
        result = solve_schedule(input_data)
        
        # Convert to dict for JSON serialization
        output = {
            "status": result.status,
            "schedule": result.schedule,
            "stats": result.stats,
            "violations": result.violations,
            "error": result.error
        }
        
        # Output JSON to stdout
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        # Output error as JSON
        error_output = {
            "status": "FAILED",
            "error": str(e),
            "schedule": {},
            "stats": {},
            "violations": []
        }
        print(json.dumps(error_output, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
