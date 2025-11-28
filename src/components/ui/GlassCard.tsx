import React from 'react';
import clsx from 'clsx';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className,
    hoverEffect = false,
    ...props
}) => {
    return (
        <div
            className={clsx(
                'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl',
                'rounded-2xl shadow-xl',
                'border border-white/20 dark:border-slate-700/50',
                'p-6',
                hoverEffect && 'transition-transform duration-300 hover:scale-[1.01] hover:shadow-2xl',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
