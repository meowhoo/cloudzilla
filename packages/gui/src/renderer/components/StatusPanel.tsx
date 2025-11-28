import React, { useEffect, useRef, useState } from 'react';
import './StatusPanel.css';
import { useTranslation } from 'react-i18next';
import { TransferTask, LogEntry, TransferringFile } from '../types/transfer';
import { TasksTab } from './StatusPanel/TasksTab';
import { ProgressTab } from './StatusPanel/ProgressTab';
import { ConsoleTab } from './StatusPanel/ConsoleTab';
import { Pin, PinOff, Download, Trash2 } from 'lucide-react';

type TabType = 'tasks' | 'progress' | 'console';

export const StatusPanel: React.FC = () => {
    const { t } = useTranslation();
    const panelRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<TabType>('progress');
    const [panelHeight, setPanelHeight] = useState<number>(200);
    const [isResizing, setIsResizing] = useState<boolean>(false);

    // State for tasks, logs, and transferring files
    const [tasks, setTasks] = useState<TransferTask[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    // File-level progress for Progress Tab (from rclone stats.transferring)
    const [transferringFiles, setTransferringFiles] = useState<TransferringFile[]>([]);
    const [totalSpeed, setTotalSpeed] = useState<number>(0);
    // Track speed per task for accurate total calculation
    const taskSpeedsRef = useRef<Map<string, number>>(new Map());

    // Console tab state (lifted up for header controls)
    const [consoleFilter, setConsoleFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error' | 'debug'>('all');
    const [consoleAutoScroll, setConsoleAutoScroll] = useState(true);

    // Load initial data on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Load tasks from backend
                const taskList = await (window as any).electronAPI.transfer.list();
                setTasks(taskList);

                // Load logs from backend
                const logList = await (window as any).electronAPI.transfer.logs();
                setLogs(logList);
            } catch (error) {
                console.error('Failed to load initial data:', error);
            }
        };

        loadInitialData();
    }, []);

    // Set up IPC event listeners for real-time updates
    useEffect(() => {
        // Handler for task updates
        // Note: preload's callback signature is (task) not (event, task)
        const handleTaskUpdate = (task: TransferTask) => {
            if (!task || !task.id) return; // Guard against invalid data
            setTasks(prevTasks => {
                const index = prevTasks.findIndex(t => t.id === task.id);
                if (index >= 0) {
                    // Update existing task
                    const newTasks = [...prevTasks];
                    newTasks[index] = task;
                    return newTasks;
                } else {
                    // Add new task
                    return [...prevTasks, task];
                }
            });

            // Clean up transferring files and speed when task is no longer running
            if (task.status !== 'running') {
                setTransferringFiles(prevFiles => prevFiles.filter(f => f.taskId !== task.id));
                // Remove this task's speed and recalculate total
                taskSpeedsRef.current.delete(task.id);
                const newTotal = Array.from(taskSpeedsRef.current.values()).reduce((sum, s) => sum + s, 0);
                setTotalSpeed(newTotal);
            }
        };

        // Handler for progress updates
        const handleProgressUpdate = (data: { taskId: string; progress: TransferTask['progress']; status: TransferTask['status'] }) => {
            if (!data || !data.taskId) return; // Guard against invalid data
            console.log(`[StatusPanel] Progress update: taskId=${data.taskId}, percentage=${data.progress?.percentage}, speed=${data.progress?.speed}`);
            setTasks(prevTasks => {
                const index = prevTasks.findIndex(t => t.id === data.taskId);
                if (index >= 0) {
                    const newTasks = [...prevTasks];
                    newTasks[index] = {
                        ...newTasks[index],
                        progress: data.progress,
                        status: data.status
                    };
                    return newTasks;
                } else {
                    console.log(`[StatusPanel] Task not found in state: ${data.taskId}`);
                }
                return prevTasks;
            });
        };

        // Handler for log updates
        const handleLogUpdate = (log: LogEntry) => {
            if (!log) return; // Guard against invalid data
            setLogs(prevLogs => [...prevLogs, log]);
        };

        // Handler for transferring files updates (file-level progress for Progress Tab)
        // Merge files by taskId instead of replacing entire array
        const handleTransferringFilesUpdate = (data: { files: TransferringFile[]; totalSpeed: number }) => {
            if (!data) return;

            const incomingFiles = data.files || [];
            const taskSpeed = data.totalSpeed || 0;

            if (incomingFiles.length === 0) {
                // No files in this update - don't change state
                // Task completion cleanup is handled by task status updates
                return;
            }

            // All incoming files have the same taskId (from the same task broadcast)
            const incomingTaskId = incomingFiles[0].taskId;

            // Update this task's speed and recalculate total
            taskSpeedsRef.current.set(incomingTaskId, taskSpeed);
            const newTotalSpeed = Array.from(taskSpeedsRef.current.values()).reduce((sum, s) => sum + s, 0);
            setTotalSpeed(newTotalSpeed);

            setTransferringFiles(prevFiles => {
                // Remove old files for this taskId, add new ones
                const otherTaskFiles = prevFiles.filter(f => f.taskId !== incomingTaskId);
                const merged = [...otherTaskFiles, ...incomingFiles];
                // Sort by taskId first, then by file name (stable order, prevent flickering)
                return merged.sort((a, b) => {
                    const taskCompare = a.taskId.localeCompare(b.taskId);
                    if (taskCompare !== 0) return taskCompare;
                    return a.name.localeCompare(b.name);
                });
            });
        };

        // Register listeners
        (window as any).electronAPI.on.transferTaskUpdate(handleTaskUpdate);
        (window as any).electronAPI.on.transferProgressUpdate(handleProgressUpdate);
        (window as any).electronAPI.on.transferLogUpdate(handleLogUpdate);
        (window as any).electronAPI.on.transferringFilesUpdate(handleTransferringFilesUpdate);

        // Cleanup listeners on unmount
        return () => {
            // Note: electronAPI.on doesn't expose removeListener, so we can't clean up
            // This is acceptable as the component will unmount when app closes
        };
    }, []);

    // Handle resize
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight >= 100 && newHeight <= 600) {
                setPanelHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Callback handlers for TasksTab
    const handleCancel = async (taskId: string) => {
        try {
            await (window as any).electronAPI.transfer.cancel(taskId);
        } catch (error) {
            console.error('Failed to cancel task:', error);
        }
    };

    const handleRetry = async (taskId: string) => {
        try {
            await (window as any).electronAPI.transfer.retry(taskId);
        } catch (error) {
            console.error('Failed to retry task:', error);
        }
    };

    const handleClearCompleted = async () => {
        try {
            await (window as any).electronAPI.transfer.clearCompleted();
            // Update local state
            setTasks(prevTasks => prevTasks.filter(t => t.status !== 'completed'));
        } catch (error) {
            console.error('Failed to clear completed tasks:', error);
        }
    };

    const handleClearFailed = async () => {
        try {
            await (window as any).electronAPI.transfer.clearFailed();
            // Update local state
            setTasks(prevTasks => prevTasks.filter(t => t.status !== 'failed'));
        } catch (error) {
            console.error('Failed to clear failed tasks:', error);
        }
    };

    const handleClearQueue = async () => {
        try {
            await (window as any).electronAPI.transfer.clearQueue();
            // Update local state
            setTasks(prevTasks => prevTasks.filter(t => t.status !== 'queued'));
        } catch (error) {
            console.error('Failed to clear queue:', error);
        }
    };

    const handleClearHistory = async () => {
        try {
            await (window as any).electronAPI.transfer.clearHistory();
            // Update local state
            setTasks(prevTasks => prevTasks.filter(t => t.status === 'running' || t.status === 'queued'));
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    };

    const handleRemove = async (taskId: string) => {
        try {
            await (window as any).electronAPI.transfer.remove(taskId);
            // Update local state
            setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
        } catch (error) {
            console.error('Failed to remove task:', error);
        }
    };

    // Callback handler for ConsoleTab
    const handleClearLogs = async () => {
        try {
            // Clear logs in backend
            await (window as any).electronAPI.transfer.clearLogs();
            // Also clear local state
            setLogs([]);
        } catch (error) {
            console.error('Failed to clear logs:', error);
        }
    };

    // Format speed for display
    const formatSpeed = (bytesPerSecond: number): string => {
        if (bytesPerSecond === 0) return '';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        return (bytesPerSecond / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    };

    // Format timestamp for export
    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour12: false });
    };

    // Export logs to file
    const handleExportLogs = () => {
        const filteredLogs = consoleFilter === 'all'
            ? logs
            : logs.filter(log => log.type === consoleFilter);
        const content = filteredLogs
            .map(log => `[${formatTime(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`)
            .join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transfer-logs-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="status-panel" ref={panelRef} style={{ height: `${panelHeight}px` }}>
            <div
                className="resize-handle"
                onMouseDown={() => setIsResizing(true)}
            />
            <div className="status-header">
                <div className="status-tabs">
                    <button
                        className={`status-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tasks')}
                    >
                        {t('statusPanel.tasks')}
                    </button>
                    <button
                        className={`status-tab ${activeTab === 'progress' ? 'active' : ''}`}
                        onClick={() => setActiveTab('progress')}
                    >
                        {t('statusPanel.progress')}
                    </button>
                    <button
                        className={`status-tab ${activeTab === 'console' ? 'active' : ''}`}
                        onClick={() => setActiveTab('console')}
                    >
                        {t('statusPanel.console')}
                    </button>
                </div>
                <div className="status-header-right">
                    {totalSpeed > 0 && (
                        <div className="status-speed">
                            ↓ {formatSpeed(totalSpeed)}
                        </div>
                    )}
                    {activeTab === 'console' && (
                        <div className="console-controls">
                            <select
                                className="console-filter"
                                value={consoleFilter}
                                onChange={(e) => setConsoleFilter(e.target.value as typeof consoleFilter)}
                            >
                                <option value="all">{t('console.all')} ({logs.length})</option>
                                <option value="info">{t('console.info')} ({logs.filter(l => l.type === 'info').length})</option>
                                <option value="success">{t('console.success')} ({logs.filter(l => l.type === 'success').length})</option>
                                <option value="warning">{t('console.warning')} ({logs.filter(l => l.type === 'warning').length})</option>
                                <option value="error">{t('console.error')} ({logs.filter(l => l.type === 'error').length})</option>
                                <option value="debug">{t('console.debug')} ({logs.filter(l => l.type === 'debug').length})</option>
                            </select>
                            <button
                                className={`console-btn ${consoleAutoScroll ? 'active' : ''}`}
                                onClick={() => setConsoleAutoScroll(!consoleAutoScroll)}
                                title={t('console.autoScroll')}
                            >
                                {consoleAutoScroll ? <Pin size={14} /> : <PinOff size={14} />}
                            </button>
                            <button
                                className="console-btn"
                                onClick={handleExportLogs}
                                title={t('console.export')}
                            >
                                <Download size={14} />
                            </button>
                            <button
                                className="console-btn"
                                onClick={handleClearLogs}
                                title={t('console.clear')}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="status-body">
                {activeTab === 'tasks' && (
                    <TasksTab
                        tasks={tasks}
                        onCancel={handleCancel}
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                    />
                )}

                {activeTab === 'progress' && (
                    <ProgressTab transferringFiles={transferringFiles} totalSpeed={totalSpeed} tasks={tasks} />
                )}

                {activeTab === 'console' && (
                    <ConsoleTab
                        logs={logs}
                        filter={consoleFilter}
                        autoScroll={consoleAutoScroll}
                        onAutoScrollChange={setConsoleAutoScroll}
                    />
                )}
            </div>
        </div>
    );
};
