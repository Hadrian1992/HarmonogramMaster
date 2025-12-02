#!/bin/bash
# Test script for OR-Tools solver

echo "Testing OR-Tools Solver..."
echo "=========================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -q -r requirements.txt

# Run solver with test input
echo ""
echo "Running solver with test input..."
echo "=================================="
cat test_input.json | python3 scheduler_solver.py

echo ""
echo "Test complete!"
