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
import { GlassCard } from './ui/GlassCard';

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
            <GlassCard>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Obłożenie Pracowników</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={workloadData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} stroke="#9ca3af" />
                        <YAxis label={{ value: 'Godziny', angle: -90, position: 'insideLeft' }} stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend />
                        <Bar dataKey="hours" fill="#3B82F6" name="Godziny" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="avg" fill="#10B981" name="Średnia" opacity={0.5} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                    Średnia: {Math.round(avgHours)}h | Zielony pasek = średnie obciążenie
                </p>
            </GlassCard>

            {/* Shift Distribution Pie Chart */}
            <GlassCard>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Rozkład Typów Pracy</h3>
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
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value: number) => `${Math.round(value)}h`}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                    Łączne godziny według typu aktywności
                </p>
            </GlassCard>
        </div>
    );
};
