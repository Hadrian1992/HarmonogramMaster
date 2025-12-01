import React from 'react';
import { X, UserPlus, Check, Info, AlertTriangle } from 'lucide-react';

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
    includeContactHours?: boolean;
    onToggleContactHours?: (value: boolean) => void;
}

export const ReplacementModal: React.FC<ReplacementModalProps> = ({
    show,
    onClose,
    loading,
    candidates,
    context,
    error,
    onSelectCandidate,
    includeContactHours = false,
    onToggleContactHours
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <UserPlus className="text-purple-500" /> Inteligentny Asystent Zastępstw
                        </h3>
                        {context && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Szukam zastępstwa za: <span className="font-medium text-gray-900 dark:text-white">{context.empName}</span>
                                <span className="mx-2">•</span>
                                Data: <span className="font-medium text-gray-900 dark:text-white">{context.date}</span>
                                <span className="mx-2">•</span>
                                Zmiana: <span className="font-medium text-gray-900 dark:text-white">{context.shiftType}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {onToggleContactHours && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={includeContactHours}
                                        onChange={(e) => onToggleContactHours(e.target.checked)}
                                    />
                                    <div className={`block w-10 h-6 rounded-full transition-colors ${includeContactHours ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeContactHours ? 'transform translate-x-4' : ''}`}></div>
                                </div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                    Godz. kontaktowe
                                </span>
                            </label>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[300px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
                            <p className="text-gray-500 dark:text-gray-400">Analizuję grafik i szukam najlepszych kandydatów...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-red-500">
                            <AlertTriangle size={48} className="mb-2" />
                            <p className="font-medium">Wystąpił błąd</p>
                            <p className="text-sm opacity-80">{error}</p>
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-500">
                            <p>Nie znaleziono dostępnych kandydatów spełniających kryteria.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-800 dark:text-blue-200 mb-4 flex items-start gap-2">
                                <Info size={16} className="mt-0.5 shrink-0" />
                                <p>
                                    💡 Ocena uwzględnia: odpoczynek dobowy (11h), reguły zmian nocnych, sprawiedliwość weekendową,
                                    równomierne obłożenie godzinami oraz ciągłość pracy (max 5 dni).
                                    {includeContactHours && <span className="font-bold ml-1">Uwzględniono godziny kontaktowe.</span>}
                                </p>
                            </div>

                            {candidates.map((candidate, index) => (
                                <div
                                    key={candidate.id}
                                    className={`p-4 rounded-lg border transition-all hover:shadow-md ${index === 0
                                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                                                    {candidate.name}
                                                </h4>
                                                {index === 0 && (
                                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                        <Check size={12} /> Rekomendacja
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-4">
                                                <span>Godziny w tym miesiącu: <strong className="text-gray-700 dark:text-gray-300">{candidate.details.monthlyHours}h</strong></span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${candidate.score >= 80 ? 'bg-green-100 text-green-800' :
                                                    candidate.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                    Dopasowanie: {candidate.score}%
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onSelectCandidate(candidate.id, candidate.name)}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Wybierz
                                        </button>
                                    </div>

                                    {candidate.reasons && candidate.reasons.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {candidate.reasons.map((reason: string, idx: number) => {
                                                const isPositive = reason.includes('Odpoczynek') || reason.includes('sprawiedliwość') || reason.includes('mało godzin');
                                                return (
                                                    <span
                                                        key={idx}
                                                        className={`text-xs px-2 py-1 rounded border ${isPositive
                                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                                                            }`}
                                                    >
                                                        {reason}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
