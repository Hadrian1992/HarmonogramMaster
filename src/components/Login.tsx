import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Calendar, Clock, ShieldCheck } from 'lucide-react';

export const Login = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
                credentials: 'include' // Important for cookies
            });

            const data = await response.json();

            if (response.ok && data.success) {
                navigate('/');
            } else {
                setError(data.error || 'Błąd logowania');
            }
        } catch (err) {
            setError('Wystąpił błąd połączenia');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-900 font-sans overflow-hidden relative">
            {/* Background Elements (Abstract Shapes) */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

            {/* Left Column - Branding & Info (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-16 z-10">
                {/* Logo Area */}
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                        <Calendar className="text-white w-6 h-6" />
                    </div>
                    <span className="text-2xl font-bold text-white tracking-tight">Harmonogram Master</span>
                </div>

                {/* Main Content */}
                <div className="max-w-2xl">
                    <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
                        Nowoczesny System <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                            Zarządzania Czasem
                        </span>
                    </h1>
                    <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                        Kompleksowe narzędzie do planowania grafików, monitorowania czasu pracy i zarządzania zespołem.
                        Zoptymalizuj procesy w swojej firmie dzięki automatyzacji i inteligentnym analizom.
                    </p>

                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                            <Clock className="w-5 h-5 text-blue-400" />
                            <span className="text-slate-300 text-sm">Oszczędność Czasu</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                            <ShieldCheck className="w-5 h-5 text-purple-400" />
                            <span className="text-slate-300 text-sm">Bezpieczeństwo</span>
                        </div>
                    </div>
                </div>

                {/* Footer / Copyright */}
                <div className="text-slate-500 text-sm">
                    &copy; {new Date().getFullYear()} Harmonogram Master. Wszelkie prawa zastrzeżone.
                </div>
            </div>

            {/* Right Column - Login Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center p-6 relative z-10">
                {/* Mobile Background Overlay */}
                <div className="absolute inset-0 bg-slate-900/90 lg:hidden z-0" />

                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 relative">
                    <div className="p-8 md:p-10">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Panel Logowania</h2>
                            <p className="text-gray-500 text-sm">Wprowadź hasło administratora, aby uzyskać dostęp.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                    Hasło Dostępu
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 animate-shake">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Logowanie...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Zaloguj się</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 flex items-center gap-4">
                            <div className="h-px flex-1 bg-gray-100" />
                            <span className="text-xs text-gray-400 font-medium">LUB</span>
                            <div className="h-px flex-1 bg-gray-100" />
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-xs text-gray-400">
                                Problemy z logowaniem? Skontaktuj się z administratorem systemu.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
