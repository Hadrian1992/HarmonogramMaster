import React from 'react';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import type { EmployeeStats } from '../utils/analytics';

interface ChartsSectionProps {
    employeeStats: EmployeeStats[];
    avgHours: number;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ employeeStats, avgHours }) => {
    // Prepare data for employee workload bar chart
    const workloadData = employeeStats.map(stat => ({
        name: stat.employee.name.split(' ')[0], // First name only for readability
        hours: stat.totalHours,
        avg: avgHours
    }));

    // Prepare data for shift type distribution pie chart
    const totalWorkHours = employeeStats.reduce((sum, s) => sum + s.totalHours, 0);
    const totalContactHours = employeeStats.reduce((sum, s) => sum + s.contactHours, 0);
    const totalNightShifts = employeeStats.reduce((sum, s) => sum + s.nightShifts, 0);
    const totalVacationDays = employeeStats.reduce((sum, s) => sum + s.vacationDays, 0);

    const distributionData = [
        { name: 'Godziny Pracy', value: totalWorkHours, color: '#3B82F6' },
        { name: 'Godziny Kontaktów', value: totalContactHours, color: '#8B5CF6' },
        { name: 'Zmiany Nocne', value: totalNightShifts * 12, color: '#1E293B' }, // Estimate 12h per night shift
        { name: 'Dni Urlopu', value: totalVacationDays * 8, color: '#10B981' } // Estimate 8h per vacation day
    ].filter(item => item.value > 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employee Workload Bar Chart */}
            <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
                <h3 className="text-lg font-bold mb-4">Obłożenie Pracowników</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={workloadData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis label={{ value: 'Godziny', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="hours" fill="#3B82F6" name="Godziny" />
                        <Bar dataKey="avg" fill="#10B981" name="Średnia" opacity={0.5} />
                    </BarChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-2 text-center">
                    Średnia: {Math.round(avgHours)}h | Zielony pasek = średnie obciążenie
                </p>
            </div>

            {/* Shift Distribution Pie Chart */}
            <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
                <h3 className="text-lg font-bold mb-4">Rozkład Typów Pracy</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {distributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${Math.round(value)}h`} />
                    </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 mt-2 text-center">
                    Łączne godziny według typu aktywności
                </p>
            </div>
        </div>
    );
};
