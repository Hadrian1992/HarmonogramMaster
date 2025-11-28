import { useMemo, useState } from 'react';
import { Calendar, Users, AlertTriangle, CheckCircle, BarChart3, Clock, Settings, Save, RefreshCw, AlertCircle as AlertIcon, User, Sun, Moon, LogOut, TrendingUp } from 'lucide-react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Login } from './components/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import clsx from 'clsx';
import { useThemeStore } from './store/useThemeStore';
import { useEffect } from 'react';
import { useScheduleStore } from './store/useScheduleStore';
import { useChatStore } from './store/useChatStore';
import { ScheduleGrid } from './components/ScheduleGrid';
import { Dashboard } from './components/Dashboard';
import { EmployeeManager } from './components/EmployeeManager';
import { WeeklyTimeline } from './components/WeeklyTimeline';
import { TimelineView } from './components/Timeline/TimelineView';
import { MonthlyView } from './components/Monthly/MonthlyView';
import { EmployeeView } from './components/EmployeeView';
import { MonthComparison } from './components/MonthComparison';
import { ConfigView } from './components/ConfigView';
import { AIAssistant } from './components/AIAssistant';
// import { exportToExcel } from './utils/excelExport'; // Removed as per user request
import { analyzeSchedule } from './utils/analytics';
import { getHolidays } from './utils/holidays';

function MainLayout() {
  const { schedule, setMonth } = useScheduleStore();
  const { sessions } = useChatStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const [isEmployeeManagerOpen, setIsEmployeeManagerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'schedule' | 'dashboard' | 'timeline' | 'coverage' | 'monthly' | 'employee' | 'comparison' | 'config'>('schedule');
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showLoadConfirmation, setShowLoadConfirmation] = useState(false);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const serverUrl = 'http://localhost:3001';

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/logout', {
        method: 'POST',
        credentials: 'include' // CRITICAL: Required to allow the server to clear the cookie
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login'); // Force redirect anyway
    }
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

  const executeSyncPull = async () => {
    setShowLoadConfirmation(false);
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

  const handleSyncPull = () => {
    setShowLoadConfirmation(true);
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
    <div className="min-h-screen flex flex-col transition-colors duration-200">
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

      {/* Load Confirmation Modal */}
      {showLoadConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Potwierdzenie wczytania</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Czy na pewno chcesz wczytać grafik z serwera?
              <br /><br />
              <strong className="text-gray-900 dark:text-white">Ta operacja nadpisze Twoją obecną pracę!</strong>
              <br />
              Upewnij się, że zapisałeś wszystkie zmiany przed wczytaniem danych z serwera.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLoadConfirmation(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={executeSyncPull}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Tak, wczytaj
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmployeeManagerOpen && (
        <EmployeeManager onClose={() => setIsEmployeeManagerOpen(false)} />
      )}
      {/* Header */}
      <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg shadow-sm z-20 relative transition-colors duration-200 border-b border-white/20 dark:border-slate-800">
        <div className="max-w-[1920px] mx-auto px-4 py-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">Harmonogram Master</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">System zarządzania czasem pracy</p>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 self-start md:self-center">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-300 shadow-sm hover:shadow"
                title="Poprzedni miesiąc"
              >
                &lt;
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
                {monthNames[schedule.month - 1]} {schedule.year}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-300 shadow-sm hover:shadow"
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
                  "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 shadow-green-900/20"
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
                  "bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 shadow-slate-900/20"
                )}
                title="Wczytaj grafik z serwera"
              >
                <RefreshCw size={16} className={clsx(syncStatus === 'loading' && "animate-spin")} />
                <span className="hidden sm:inline">Wczytaj Grafik</span>
              </button>

              <button
                onClick={() => setIsEmployeeManagerOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700"
              >
                <Users size={16} />
                <span className="hidden sm:inline">Pracownicy</span>
              </button>

              {/* Dark Mode Toggle - TailAdmin Style */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700"
                title={isDark ? 'Tryb jasny' : 'Tryb ciemny'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Wyloguj</span>
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
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
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
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
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
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Clock size={16} />
              Oś czasu
            </button>
            <button
              onClick={() => setCurrentView('coverage')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'coverage'
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Clock size={16} />
              Pokrycie Godz
            </button>
            <button
              onClick={() => setCurrentView('monthly')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'monthly'
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <TrendingUp size={16} />
              Pokrycie Miesięczne
            </button>
            <button
              onClick={() => setCurrentView('employee')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                currentView === 'employee'
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
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
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
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
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
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
        ) : currentView === 'coverage' ? (
          <TimelineView />
        ) : currentView === 'monthly' ? (
          <MonthlyView />
        ) : currentView === 'employee' ? (
          <EmployeeView />
        ) : currentView === 'comparison' ? (
          <MonthComparison />
        ) : (
          <ConfigView />
        )}
      </main>
      <footer className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-t border-white/20 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          Administratorem danych osobowych jest Harmonogram Master. Dane przetwarzane są wyłącznie w celu zarządzania harmonogramem pracy.
          <br />
          Zgodnie z RODO masz prawo dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania.
        </p>
      </footer>
      <AIAssistant />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
