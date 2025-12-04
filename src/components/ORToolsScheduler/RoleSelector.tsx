import type { EmployeeRole } from '../../types/roles';

interface RoleSelectorProps {
    employeeId: string;
    currentRoles: EmployeeRole[];
    onChange: (roles: EmployeeRole[]) => void;
}

const ROLE_CONFIG = {
    LIDER: {
        icon: '👑',
        label: 'Lider',
        color: 'purple',
        description: 'Kierownik zmiany, wymaga wsparcia'
    },
    WYCHOWAWCA: {
        icon: '👤',
        label: 'Wychowawca',
        color: 'blue',
        description: 'Pracownik obsługujący dzieci'
    },
    MEDYK: {
        icon: '⚕️',
        label: 'Medyk',
        color: 'green',
        description: 'Personel medyczny'
    }
} as const;

export default function RoleSelector({ currentRoles, onChange }: RoleSelectorProps) {
    const availableRoles: EmployeeRole[] = ['LIDER', 'WYCHOWAWCA', 'MEDYK'];

    const toggleRole = (role: EmployeeRole) => {
        const updated = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        onChange(updated);
    };

    return (
        <div className="flex flex-wrap gap-2">
            {availableRoles.map(role => {
                const config = ROLE_CONFIG[role];
                const isSelected = currentRoles.includes(role);

                return (
                    <button
                        key={role}
                        onClick={() => toggleRole(role)}
                        title={config.description}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                            transition-all duration-200 transform hover:scale-105
                            ${isSelected
                                ? `bg-${config.color}-600 text-white shadow-md`
                                : `bg-${config.color}-50 dark:bg-${config.color}-900/20 text-${config.color}-700 dark:text-${config.color}-300 hover:bg-${config.color}-100 dark:hover:bg-${config.color}-900/30`
                            }
                        `}
                        style={{
                            // Inline styles for dynamic colors that Tailwind can't compile
                            ...(isSelected
                                ? {
                                    backgroundColor: config.color === 'purple' ? '#9333ea' : config.color === 'blue' ? '#2563eb' : '#16a34a',
                                    color: 'white'
                                }
                                : {
                                    backgroundColor: config.color === 'purple' ? 'rgb(243 232 255)' : config.color === 'blue' ? 'rgb(219 234 254)' : 'rgb(220 252 231)',
                                    color: config.color === 'purple' ? '#6b21a8' : config.color === 'blue' ? '#1e40af' : '#15803d'
                                }
                            )
                        }}
                    >
                        <span className="text-base">{config.icon}</span>
                        <span>{config.label}</span>
                        {isSelected && (
                            <span className="ml-1 text-xs opacity-75">✓</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
