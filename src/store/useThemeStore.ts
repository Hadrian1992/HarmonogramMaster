import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
    isDark: boolean;
    toggleTheme: () => void;
    setTheme: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            isDark: false,
            toggleTheme: () => set((state) => {
                const newIsDark = !state.isDark;
                // Update HTML class
                if (newIsDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                return { isDark: newIsDark };
            }),
            setTheme: (isDark) => set(() => {
                // Update HTML class
                if (isDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                return { isDark };
            }),
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                // Apply theme on page load
                if (state?.isDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            },
        }
    )
);

// Listen for storage changes from other tabs
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme-storage' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                const isDark = data.state?.isDark || false;

                // Update HTML class
                if (isDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                // Update store state
                useThemeStore.setState({ isDark });
            } catch (error) {
                console.error('Failed to sync theme:', error);
            }
        }
    });
}
