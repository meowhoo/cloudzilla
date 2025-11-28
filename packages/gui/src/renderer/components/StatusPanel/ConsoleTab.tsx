import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../../types/transfer';
import './ConsoleTab.css';

interface ConsoleTabProps {
    logs: LogEntry[];
    filter: 'all' | 'info' | 'success' | 'warning' | 'error' | 'debug';
    autoScroll: boolean;
    onAutoScrollChange: (value: boolean) => void;
}

export const ConsoleTab: React.FC<ConsoleTabProps> = ({
    logs,
    filter,
    autoScroll,
    onAutoScrollChange
}) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    // Detect manual scroll
    const handleScroll = () => {
        if (!containerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        if (isAtBottom !== autoScroll) {
            onAutoScrollChange(isAtBottom);
        }
    };

    // Filter logs
    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(log => log.type === filter);

    // Format timestamp
    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour12: false });
    };

    // Get log icon
    const getLogIcon = (type: LogEntry['type']): string => {
        switch (type) {
            case 'info': return 'ℹ️';
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            case 'debug': return '🔧';
            default: return '📝';
        }
    };

    // Get log class
    const getLogClass = (type: LogEntry['type']): string => {
        return `log-entry log-${type}`;
    };

    return (
        <div className="console-tab">
            {/* Logs Display */}
            <div
                className="console-logs"
                ref={containerRef}
                onScroll={handleScroll}
            >
                {filteredLogs.length > 0 ? (
                    filteredLogs.map(log => (
                        <div key={log.id} className={getLogClass(log.type)}>
                            <span className="log-time">[{formatTime(log.timestamp)}]</span>
                            <span className="log-icon">{getLogIcon(log.type)}</span>
                            <span className="log-type">[{log.type.toUpperCase()}]</span>
                            <span className="log-message">{log.message}</span>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <p>No logs</p>
                    </div>
                )}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
};
