import React from 'react';
import { X, UserPlus, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

interface ReplacementCandidate {
    id: string;
    name: string;
    score: number;
    reasons: string[];
    details: {
        monthlyHours: number;
        canWork: boolean;
    };
}

interface ReplacementModalProps {
    show: boolean;
    onClose: () => void;
    loading: boolean;
    candidates: ReplacementCandidate[];
    context: { date: string; empName: string; shiftType: string } | null;
    error?: string;
    onSelectCandidate: (candidateId: string, candidateName: string) => void;
}

export const ReplacementModal: React.FC<ReplacementModalProps> = ({
    show,
    onClose,
    loading,
    candidates,
    context,
    error,
    onSelectCandidate
}) => {
    if (!show) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 dark:text-green-400';
        if (score >= 60) return 'text-blue-600 dark:text-blue-400';
        if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
        if (score >= 20) return 'text-orange-600 dark:text-orange-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
        if (score >= 60) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        if (score >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
        if (score >= 20) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <UserPlus className="text-indigo-500" size={24} />
                            Inteligentny Asystent Zastępstw
                        </h3>
                        {context && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                                Zastępstwo dla: <strong>{context.empName}</strong> • {formatDate(context.date)} • Zmiana: <strong>{context.shiftType}</strong>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-300">Szukam najlepszych kandydatów...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-red-500 dark:text-red-400">
                            <AlertCircle size={48} className="mb-4" />
                            <p className="text-lg font-bold">Wystąpił błąd</p>
                            <p className="text-sm mt-2">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                                Zamknij
                            </button>
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                            <AlertCircle size={48} className="mb-4 text-gray-400" />
                            <p className="text-lg font-medium">Brak dostępnych kandydatów</p>
                            <p className="text-sm mt-2">Wszystkie osoby są zajęte lub nie spełniają wymagań.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                <CheckCircle size={16} className="text-green-500" />
                                <span>Znaleziono {candidates.length} kandydatów. Sortowanie według oceny (100 = idealny).</span>
                            </div>

                            {candidates.map((candidate, idx) => (
                                <div
                                    key={candidate.id}
                                    className={`border rounded-lg p-4 transition-all hover:shadow-md ${getScoreBg(candidate.score)}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`text-3xl font-bold ${getScoreColor(candidate.score)}`}>
                                                {candidate.score}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                                    {idx === 0 && <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">TOP</span>}
                                                    {candidate.name}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Godziny w tym miesiącu: <strong>{candidate.details.monthlyHours}h</strong>
                                                </p>
                                            </div>
                                        </div>
                                        {candidate.details.canWork && (
                                            <button
                                                onClick={() => onSelectCandidate(candidate.id, candidate.name)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                                            >
                                                <UserPlus size={16} />
                                                Wybierz
                                            </button>
                                        )}
                                    </div>

                                    {candidate.reasons.length > 0 && (
                                        <div className="space-y-1">
                                            {candidate.reasons.map((reason, rIdx) => (
                                                <div key={rIdx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                    {reason.includes('wysokie') || reason.includes('wiele') ? (
                                                        <TrendingDown size={14} className="mt-0.5 text-orange-500 flex-shrink-0" />
                                                    ) : (
                                                        <TrendingUp size={14} className="mt-0.5 text-green-500 flex-shrink-0" />
                                                    )}
                                                    <span>{reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!candidate.details.canWork && (
                                        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                                            <AlertCircle size={16} />
                                            <span className="font-medium">Nie może pracować (naruszenie Kodeksu Pracy)</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-900">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>💡 Ocena uwzględnia: 11h odpoczynek, balans godzin, preferencje, noce, dni z rzędu</span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                        >
                            Zamknij
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
