import React from 'react';
import { useScheduleStore } from '../store/useScheduleStore';
import { analyzeSchedule } from '../utils/analytics';
import { ChartsSection } from './ChartsSection';
import {
    AlertTriangle, TrendingUp, Users, Clock, Calendar, CheckCircle, Info, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { GlassCard } from './ui/GlassCard';
import { PageHeader } from './ui/PageHeader';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
    const { schedule } = useScheduleStore();
    const { employeeStats, alerts, suggestions } = analyzeSchedule(schedule);
    const monthName = format(new Date(schedule.year, schedule.month - 1), 'LLLL yyyy', { locale: pl });

    const totalHours = employeeStats.reduce((sum, s) => sum + s.totalHours, 0);
    const avgHours = employeeStats.length > 0 ? totalHours / employeeStats.length : 0;
    const totalNightShifts = employeeStats.reduce((sum, s) => sum + s.nightShifts, 0);
    const top3 = employeeStats.slice(0, 3);

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'error':
                return <XCircle className="text-red-500" size={20} />;
            case 'warning':
                return <AlertTriangle className="text-yellow-500" size={20} />;
            default:
                return <Info className="text-blue-500" size={20} />;
        }
    };

    const getAlertStyles = (type: string) => {
        switch (type) {
            case 'error':
                return 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50';
            case 'warning':
                return 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/50';
            default:
                return 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50';
        }
    };

    const stats = [
        {
            label: 'Pracownicy',
            value: schedule.employees.length,
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-900/20'
        },
        {
            label: 'Suma godzin',
            value: `${Math.round(totalHours)}h`,
            icon: Clock,
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-900/20'
        },
        {
            label: 'Średnia h/osoba',
            value: `${Math.round(avgHours)}h`,
            icon: TrendingUp,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-900/20'
        },
        {
            label: 'Zmiany nocne',
            value: totalNightShifts,
            icon: Calendar,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50 dark:bg-indigo-900/20'
        }
    ];

    return (
        <div className="p-2 md:p-6 min-h-screen">
            <PageHeader
                title="Dashboard Statystyk"
                description={`Podsumowanie miesiąca: ${monthName}`}
            />

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, idx) => (
                    <GlassCard key={idx} hoverEffect className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                        </div>
                        <div className={clsx("p-3 rounded-xl", stat.bg)}>
                            <stat.icon className={stat.color} size={24} />
                        </div>
                    </GlassCard>
                ))}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="mb-6">
                    <GlassCard className="border-l-4 border-l-yellow-500">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <AlertTriangle className="text-yellow-500" /> Alerty i Ostrzeżenia ({alerts.length})
                        </h2>
                        <div className="space-y-3">
                            {alerts.map((alert, idx) => (
                                <div key={idx} className={clsx("p-4 rounded-xl border flex items-start gap-3 transition-colors", getAlertStyles(alert.type))}>
                                    <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="font-semibold text-gray-900 dark:text-white">{alert.employeeName}</p>
                                            {alert.severity === 'high' && (
                                                <span className="text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                                                    Wysoki Priorytet
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Charts Section */}
            <div className="mb-8">
                <ChartsSection employeeStats={employeeStats} avgHours={avgHours} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Top 3 Most Loaded */}
                <GlassCard className="lg:col-span-1">
                    <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="text-blue-500" /> Top 3 Obciążenie
                    </h2>
                    <div className="space-y-6">
                        {top3.map((stat, idx) => (
                            <div key={stat.employee.id} className="relative">
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-lg",
                                            idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                                                idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                                    'bg-gradient-to-br from-orange-600 to-red-700'
                                        )}>
                                            {idx + 1}
                                        </div>
                                        <span className="font-semibold text-gray-900 dark:text-white">{stat.employee.name}</span>
                                    </div>
                                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{stat.totalHours}h</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min((stat.totalHours / 200) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                {/* Suggestions */}
                <GlassCard className="lg:col-span-2">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                        <CheckCircle className="text-green-500" /> Sugestie Optymalizacji
                    </h2>
                    {suggestions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suggestions.map((suggestion, idx) => (
                                <div key={idx} className="p-4 rounded-xl border border-green-100 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                    <p className="font-semibold text-gray-900 dark:text-green-100 mb-1">{suggestion.employeeName}</p>
                                    <p className="text-sm text-gray-600 dark:text-green-200/80">{suggestion.message}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <CheckCircle className="mx-auto mb-2 opacity-50" size={32} />
                            <p>Brak sugestii. Grafik wygląda świetnie!</p>
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Employee Stats Table */}
            <GlassCard className="overflow-hidden">
                <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Szczegółowe Obciążenie</h2>
                <div className="overflow-x-auto -mx-6">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pracownik</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Godziny</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Zmiany</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Nocne</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontakty</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Urlopy</th>
                            </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-gray-200 dark:divide-gray-700">
                            {employeeStats.map((stat) => (
                                <tr key={stat.employee.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{stat.employee.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={clsx(
                                            "px-2.5 py-0.5 rounded-full text-sm font-bold",
                                            stat.totalHours > avgHours + 20 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                stat.totalHours < avgHours - 20 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        )}>
                                            {stat.totalHours}h
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-300">{stat.workShifts}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-300">{stat.nightShifts}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-300">{stat.contactHours}h</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700 dark:text-gray-300">{stat.vacationDays}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
};
