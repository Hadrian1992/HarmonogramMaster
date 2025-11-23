import { useMemo, useState } from 'react';
import { Calendar, Users, Download, AlertTriangle, CheckCircle, BarChart3, Clock, Settings, Save, RefreshCw, AlertCircle as AlertIcon } from 'lucide-react';
import { useScheduleStore } from './store/useScheduleStore';
import { useChatStore } from './store/useChatStore';
import { ScheduleGrid } from './components/ScheduleGrid';
import { Dashboard } from './components/Dashboard';
import { EmployeeManager } from './components/EmployeeManager';
import { WeeklyTimeline } from './components/WeeklyTimeline';
import { EmployeeView } from './components/EmployeeView';
import { MonthComparison } from './components/MonthComparison';
import { ConfigView } from './components/ConfigView';
import { AIAssistant } from './components/AIAssistant';
import { exportToExcel } from './utils/excelExport';
import { analyzeSchedule } from './utils/analytics';
import { getHolidays } from './utils/holidays';

function App() {
  const { schedule, setMonth } = useScheduleStore();
  const { sessions } = useChatStore();
  const [isEmployeeManagerOpen, setIsEmployeeManagerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'schedule' | 'dashboard' | 'timeline' | 'employee' | 'comparison' | 'config'>('schedule');

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const serverUrl = 'http://localhost:3001';

  const handleExport = () => {
    exportToExcel(schedule);
  };

  const handleSyncPush = async () => {
    setSyncStatus('loading');
    setSyncMessage('Zapisywanie...');
    try {
      const data = {
        schedule,
        chatSessions: sessions,
        timestamp: Date.now()
      };

      const response = await fetch(`${serverUrl}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Błąd zapisu na serwerze');

      setSyncStatus('success');
      setSyncMessage('✓ Grafik zapisany na serwerze!');
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
      setSyncMessage('✗ Błąd połączenia z serwerem');
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    }
  };

  const handleSyncPull = async () => {
    setSyncStatus('loading');
    setSyncMessage('Wczytywanie...');
    try {
      const response = await fetch(`${serverUrl}/api/data`);
      if (!response.ok) throw new Error('Błąd pobierania z serwera');

      const data = await response.json();

      // Restore schedule if exists
      if (data.schedule) {
        useScheduleStore.getState().restoreSchedule(data.schedule);
      }

      // Restore chat sessions if exist
      if (data.chatSessions && Array.isArray(data.chatSessions)) {
        useChatStore.getState().restoreSessions(data.chatSessions);
      }

      setSyncStatus('success');
      setSyncMessage('✓ Dane wczytane z serwera!');
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
      setSyncMessage('✗ Błąd połączenia z serwerem');
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    }
  };

  const handlePrevMonth = () => {
    if (schedule.month === 1) {
      setMonth(12, schedule.year - 1);
    } else {
      setMonth(schedule.month - 1, schedule.year);
    }
  };

  const handleNextMonth = () => {
    if (schedule.month === 12) {
      setMonth(1, schedule.year + 1);
    } else {
      setMonth(schedule.month + 1, schedule.year);
    }
  };

  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  // Use analytics alerts for validation (more comprehensive than old validateSchedule)
  const { alerts } = useMemo(() => analyzeSchedule(schedule), [schedule]);
  const validationErrors = useMemo(() => {
    return alerts.map(alert => ({
      employeeId: '',
      employeeName: alert.employeeName,
      date: '',
      message: alert.message,
      severity: 'ERROR' as const,
      type: alert.type  // Preserve type for categorization
    }));
  }, [alerts]);

  const holidays = useMemo(() => {
    return getHolidays(schedule.year, schedule.month);
  }, [schedule.year, schedule.month]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {isEmployeeManagerOpen && (
        <EmployeeManager onClose={() => setIsEmployeeManagerOpen(false)} />
      )}
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-8 h-8 text-blue-600" />
              HarmonogramMaster
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-200 rounded">
                &lt; Poprzedni
              </button>
              <span className="text-xl font-semibold text-gray-700 min-w-[200px] text-center">
                {monthNames[schedule.month - 1]} {schedule.year}
              </span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-gray-200 rounded">
                Następny &gt;
              </button>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setIsEmployeeManagerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 text-gray-700"
            >
              <Users className="w-4 h-4" />
              Pracownicy
            </button>
            <button
              onClick={handleSyncPush}
              disabled={syncStatus === 'loading'}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {syncStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Zapisz Grafik
            </button>
            <button
              onClick={handleSyncPull}
              disabled={syncStatus === 'loading'}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg shadow-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {syncStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Wczytaj Grafik
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Eksportuj do Excela
            </button>
            {/* Removed PDF Report button */}
          </div>

          {/* Sync Status Message */}
          {syncMessage && (
            <div className={`mt-3 px-3 py-2 rounded text-sm flex items-center gap-2 ${syncStatus === 'success' ? 'bg-green-100 text-green-800' :
              syncStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              }`}>
              {syncStatus === 'success' ? <CheckCircle size={16} /> :
                syncStatus === 'error' ? <AlertIcon size={16} /> :
                  <RefreshCw size={16} className="animate-spin" />}
              {syncMessage}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-300 mt-4">
          <button
            onClick={() => setCurrentView('schedule')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${currentView === 'schedule'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Calendar size={18} />
              Grafik
            </div>
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${currentView === 'dashboard'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={18} />
              Statystyki
            </div>
          </button>
          <button
            onClick={() => setCurrentView('timeline')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${currentView === 'timeline'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock size={18} />
              Timeline
            </div>
          </button>
          <button
            onClick={() => setCurrentView('employee')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${currentView === 'employee'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Users size={18} />
              Widok Pracownika
            </div>
          </button>
          <button
            onClick={() => setCurrentView('comparison')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${currentView === 'comparison'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={18} />
              Porównanie
            </div>
          </button>
          <button
            onClick={() => setCurrentView('config')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${currentView === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              Konfiguracja
            </div>
          </button>
        </div>
      </header>

      <main className="space-y-8">
        {currentView === 'schedule' ? (
          <>
            <ScheduleGrid />

            {holidays.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-400">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-yellow-600" />
                  Święta i dni ważne w tym miesiącu:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {holidays.map(h => (
                    <div key={h.date} className={`flex items-center gap-2 p-2 rounded ${h.type === 'PUBLIC' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                      <span className="font-bold">{h.date.split('-')[2]}:</span>
                      <span>{h.name}</span>
                      {h.type === 'PUBLIC' && <span className="text-xs bg-red-200 px-1.5 py-0.5 rounded-full ml-auto">Wolne</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validationErrors.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Brak błędów w harmonogramie!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Errors */}
                {validationErrors.filter(err => err.severity === 'ERROR' || err.type === 'error').length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-red-700 flex items-center gap-1">
                      <AlertTriangle size={14} /> Błędy ({validationErrors.filter(err => err.severity === 'ERROR' || err.type === 'error').length})
                    </h4>
                    {validationErrors
                      .filter(err => err.severity === 'ERROR' || err.type === 'error')
                      .map((err, idx) => {
                        const empName = err.employeeName || schedule.employees.find(e => e.id === err.employeeId)?.name || 'Nieznany';
                        return (
                          <div key={idx} className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">{empName}</span>: {err.message}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Warnings */}
                {validationErrors.filter(err => err.type === 'warning').length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-yellow-700 flex items-center gap-1">
                      <AlertTriangle size={14} /> Ostrzeżenia ({validationErrors.filter(err => err.type === 'warning').length})
                    </h4>
                    {validationErrors
                      .filter(err => err.type === 'warning')
                      .map((err, idx) => {
                        const empName = err.employeeName || schedule.employees.find(e => e.id === err.employeeId)?.name || 'Nieznany';
                        return (
                          <div key={idx} className="flex items-start gap-2 text-yellow-700 text-sm bg-yellow-50 p-2 rounded">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">{empName}</span>: {err.message}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Info */}
                {validationErrors.filter(err => err.type === 'info').length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                      ℹ️ Informacje ({validationErrors.filter(err => err.type === 'info').length})
                    </h4>
                    {validationErrors
                      .filter(err => err.type === 'info')
                      .map((err, idx) => {
                        const empName = err.employeeName || schedule.employees.find(e => e.id === err.employeeId)?.name || 'Nieznany';
                        return (
                          <div key={idx} className="flex items-start gap-2 text-blue-700 text-sm bg-blue-50 p-2 rounded">
                            <span className="mt-0.5">ℹ️</span>
                            <div>
                              <span className="font-medium">{empName}</span>: {err.message}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : currentView === 'dashboard' ? (
          <Dashboard />
        ) : currentView === 'timeline' ? (
          <WeeklyTimeline />
        ) : currentView === 'employee' ? (
          <EmployeeView />
        ) : currentView === 'comparison' ? (
          <MonthComparison />
        ) : (
          <ConfigView />
        )}
      </main>
      <AIAssistant />
    </div>
  );
}

export default App;
