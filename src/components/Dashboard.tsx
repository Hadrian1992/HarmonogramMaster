
import { useScheduleStore } from '../store/useScheduleStore';
import { analyzeSchedule } from '../utils/analytics';
import { ChartsSection } from './ChartsSection';
import { AlertTriangle, TrendingUp, Users, Clock, Calendar, CheckCircle, Info, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export const Dashboard: React.FC = () => {
    const { schedule } = useScheduleStore();
    const { employeeStats, alerts, suggestions } = analyzeSchedule(schedule);

    const monthName = format(new Date(schedule.year, schedule.month - 1), 'LLLL yyyy', { locale: pl });

    // Overall stats
    const totalHours = employeeStats.reduce((sum, s) => sum + s.totalHours, 0);
    const avgHours = totalHours / employeeStats.length;

    const totalNightShifts = employeeStats.reduce((sum, s) => sum + s.nightShifts, 0);

    // Top 3 most loaded employees
    const top3 = employeeStats.slice(0, 3);

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'error': return <XCircle className="text-red-500" size={18} />;
            case 'warning': return <AlertTriangle className="text-yellow-500" size={18} />;
            default: return <Info className="text-blue-500" size={18} />;
        }
    };

    const getAlertColor = (type: string) => {
        switch (type) {
            case 'error': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
            case 'warning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
            default: return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
        }
    };

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 md:p-6 text-white shadow-lg">
                <h1 className="text-3xl font-bold mb-2">Dashboard Statystyk</h1>
                <p className="text-blue-100">{monthName}</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pracownicy</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{schedule.employees.length}</p>
                        </div>
                        <Users className="text-blue-500" size={32} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Suma godzin</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(totalHours)}h</p>
                        </div>
                        <Clock className="text-green-500" size={32} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Średnia h/osoba</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(avgHours)}h</p>
                        </div>
                        <TrendingUp className="text-purple-500" size={32} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Zmiany nocne</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalNightShifts}</p>
                        </div>
                        <Calendar className="text-indigo-500" size={32} />
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <AlertTriangle className="text-yellow-500" />
                        Alerty i Ostrzeżenia ({alerts.length})
                    </h2>
                    <div className="space-y-2">
                        {alerts.map((alert, idx) => (
                            <div key={idx} className={`p-3 rounded border flex items-start gap-3 ${getAlertColor(alert.type)}`}>
                                {getAlertIcon(alert.type)}
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{alert.employeeName}</p>
                                    <p className="text-sm text-gray-700">{alert.message}</p>
                                </div>
                                {alert.severity === 'high' && (
                                    <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded">
                                        WYSOKI
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Charts Section */}
            <ChartsSection employeeStats={employeeStats} avgHours={avgHours} />

            {/* Top 3 Most Loaded */}
            <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Top 3 Najbardziej Obciążeni</h2>
                <div className="space-y-3">
                    {top3.map((stat, idx) => (
                        <div key={stat.employee.id} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-600'
                                }`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-gray-900">{stat.employee.name}</span>
                                    <span className="text-lg font-bold text-blue-600">{stat.totalHours}h</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all"
                                        style={{ width: `${(stat.totalHours / 200) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Employee Stats Table */}
            <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Obłożenie Pracowników</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pracownik</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Godziny</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Zmiany</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nocne</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kontakty</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Urlopy</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {employeeStats.map(stat => (
                                <tr key={stat.employee.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {stat.employee.name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <span className={`text-sm font-semibold ${stat.totalHours > avgHours + 20 ? 'text-red-600' :
                                            stat.totalHours < avgHours - 20 ? 'text-blue-600' :
                                                'text-green-600'
                                            }`}>
                                            {stat.totalHours}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                                        {stat.workShifts}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                                        {stat.nightShifts}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                                        {stat.contactHours}h
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                                        {stat.vacationDays}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <CheckCircle className="text-green-500" />
                        Sugestie ({suggestions.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {suggestions.map((suggestion, idx) => (
                            <div key={idx} className="p-4 rounded border border-green-200 bg-green-50">
                                <p className="font-medium text-gray-900 mb-1">{suggestion.employeeName}</p>
                                <p className="text-sm text-gray-700">{suggestion.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
