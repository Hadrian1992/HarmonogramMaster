import { useMemo, useState } from 'react';
import { Calendar, Users, Download, AlertTriangle, CheckCircle, BarChart3, Clock, Settings, Save, RefreshCw, AlertCircle as AlertIcon, User } from 'lucide-react';
import clsx from 'clsx';
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
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const serverUrl = 'http://localhost:3001';

  const handleExport = () => {
    exportToExcel(schedule);
  };

  const executeSyncPush = async () => {
    setShowSaveConfirmation(false);
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

  const handleSyncPush = () => {
    setShowSaveConfirmation(true);
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

      // Restore settings to localStorage
      if (data.settings) {
        if (data.settings.apiKey) {
          localStorage.setItem('openai_api_key', data.settings.apiKey);
        }
        if (data.settings.model) {
          localStorage.setItem('openai_model', data.settings.model);
        }
        // Staffing rules are handled by ConfigView or store, but we can update store if needed
        // For now, let's assume staffing rules are part of schedule store or loaded by ConfigView
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Save Confirmation Modal */}
      {showSaveConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-bold text-gray-900">Potwierdzenie zapisu</h3>
            </div>

            <p className="text-gray-600 mb-6">
              Czy na pewno chcesz zapisać grafik na serwerze?
              <br /><br />
              <strong className="text-gray-900">Ta operacja nadpisze obecne dane na serwerze.</strong>
              <br />
              Upewnij się, że nie nadpisujesz pracy innych osób pustym grafikiem.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveConfirmation(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={executeSyncPush}
                className="px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save size={18} />
                Tak, zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmployeeManagerOpen && (
        <EmployeeManager onClose={() => setIsEmployeeManagerOpen(false)} />
      )}
      {/* Header */}
      <header className="bg-white shadow-sm z-20 relative">
        <div className="max-w-[1920px] mx-auto px-4 py-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Harmonogram Master</h1>
                <p className="text-xs text-gray-500 font-medium">System zarządzania czasem pracy</p>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 self-start md:self-center">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                title="Poprzedni miesiąc"
              >
                &lt;
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
                {monthNames[schedule.month - 1]} {schedule.year}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                title="Następny miesiąc"
              >
                &gt;
              </button>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              {/* Sync Status Indicator */}
              {syncMessage && (
                <div className={clsx(
                  "text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-fade-in",
                  syncStatus === 'success' ? "bg-green-100 text-green-700" :
                    syncStatus === 'error' ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                )}>
                  {syncStatus === 'loading' && <RefreshCw size={10} className="animate-spin" />}
                  {syncStatus === 'success' && <CheckCircle size={10} />}
                  {syncStatus === 'error' && <AlertIcon size={10} />}
                  {syncMessage}
                </div>
              )}

              <button
                onClick={handleSyncPush}
                disabled={syncStatus === 'loading'}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shadow-sm",
                  "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                )}
                title="Zapisz zmiany na serwerze"
              >
                {syncStatus === 'loading' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span className="hidden sm:inline">Zapisz Grafik</span>
              </button>

              <button
                onClick={handleSyncPull}
                disabled={syncStatus === 'loading'}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shadow-sm",
                  "bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50"
                )}
                title="Wczytaj grafik z serwera"
              >
                <RefreshCw size={16} className={clsx(syncStatus === 'loading' && "animate-spin")} />
                <span className="hidden sm:inline">Wczytaj Grafik</span>
              </button>

              <button
                onClick={() => setIsEmployeeManagerOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Users size={16} />
                <span className="hidden sm:inline">Pracownicy</span>
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Eksportuj do Excela</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs - Scrollable on mobile */}
          <div className="mt-6 flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scrollbar-hide gap-2">
            <button
              onClick={() => setCurrentView('schedule')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'schedule'
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Calendar size={16} />
              Grafik
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'dashboard'
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <BarChart3 size={16} />
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('timeline')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'timeline'
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Clock size={16} />
              Oś czasu
            </button>
            <button
              onClick={() => setCurrentView('employee')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'employee'
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <User size={16} />
              Widok pracownika
            </button>
            <button
              onClick={() => setCurrentView('comparison')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'comparison'
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Users size={16} />
              Porównanie
            </button>
            <button
              onClick={() => setCurrentView('config')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'config'
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Settings size={16} />
              Konfiguracja
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto px-2 md:px-6 py-4 md:py-6 overflow-hidden flex flex-col">
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
