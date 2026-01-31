import React, { useState, useEffect } from 'react';
import { ClockIcon } from './Icons';

interface TimerProps {
    initialMinutes: number;
    onTimeout: () => void;
    className?: string;
    isRunning: boolean;
}

const Timer: React.FC<TimerProps> = ({ initialMinutes, onTimeout, className, isRunning }) => {
    const [seconds, setSeconds] = useState(initialMinutes * 60);

    useEffect(() => {
        setSeconds(initialMinutes * 60);
    }, [initialMinutes]);

    useEffect(() => {
        if (!isRunning) return;

        if (seconds <= 0) {
            onTimeout();
            return;
        }

        const interval = setInterval(() => {
            setSeconds(s => s - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [seconds, onTimeout, isRunning]);

    const formatTime = () => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };
    
    const timeColor = seconds < 60 ? 'text-red-500 animate-pulse' : 'text-gray-700 dark:text-gray-300';

    return (
        <div className={`flex items-center gap-2 font-mono text-lg font-semibold ${timeColor} ${className}`}>
            <ClockIcon className="h-5 w-5" />
            <span>{formatTime()}</span>
        </div>
    );
};

export default Timer;
