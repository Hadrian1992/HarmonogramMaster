import type { Schedule } from '../types';

export const exportScheduleData = (schedule: Schedule): void => {
    // Create backup object with timestamp
    const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        schedule: schedule
    };

    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(backupData, null, 2);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `harmonogram_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const importScheduleData = (
    file: File,
    onSuccess: (schedule: Schedule) => void,
    onError: (error: string) => void
): void => {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const backupData = JSON.parse(content);

            // Validate backup data structure
            if (!backupData.schedule) {
                throw new Error('Nieprawidłowy format pliku backup');
            }

            // Validate schedule structure
            const schedule = backupData.schedule as Schedule;
            if (!schedule.id || !schedule.month || !schedule.year || !schedule.employees) {
                throw new Error('Nieprawidłowa struktura danych harmonogramu');
            }

            onSuccess(schedule);
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Błąd podczas importu danych');
        }
    };

    reader.onerror = () => {
        onError('Błąd podczas odczytu pliku');
    };

    reader.readAsText(file);
};
