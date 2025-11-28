import React, { useState, useRef, useEffect } from 'react';
import { TransferTask } from '../../types/transfer';
import { useTranslation } from 'react-i18next';
import './TasksTab.css';

type SubTabType = 'queued' | 'failed' | 'successful';

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    task: TransferTask | null;
}

interface TasksTabProps {
    tasks: TransferTask[];
    onCancel: (taskId: string) => void;
    onRetry: (taskId: string) => void;
    onRemove: (taskId: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
    tasks,
    onCancel,
    onRetry,
    onRemove
}) => {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState<SubTabType>('queued');
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        task: null
    });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Group tasks by sub-tab categories
    const groupedTasks = {
        queued: tasks.filter(t => t.status === 'running' || t.status === 'queued'),
        failed: tasks.filter(t => t.status === 'failed' || t.status === 'cancelled'),
        successful: tasks.filter(t => t.status === 'completed')
    };

    const currentTasks = groupedTasks[activeSubTab];

    // Format file size
    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    };

    // Format speed
    const formatSpeed = (bytesPerSecond: number): string => {
        return formatSize(bytesPerSecond) + '/s';
    };

    // Format ETA
    const formatEta = (seconds: number): string => {
        if (seconds <= 0 || !isFinite(seconds)) return '--:--';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Format location
    const formatLocation = (loc: TransferTask['source']): string => {
        const remoteName = loc.type === 'remote' && loc.remoteName ? loc.remoteName : 'local';
        return `${remoteName}: ${loc.path}`;
    };

    // Handle right-click on task
    const handleContextMenu = (e: React.MouseEvent, task: TransferTask) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            task
        });
    };

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };

        if (contextMenu.visible) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [contextMenu.visible]);

    // Context menu actions
    const handleMenuAction = (action: 'cancel' | 'retry' | 'remove') => {
        if (!contextMenu.task) return;

        switch (action) {
            case 'cancel':
                onCancel(contextMenu.task.id);
                break;
            case 'retry':
                onRetry(contextMenu.task.id);
                break;
            case 'remove':
                onRemove(contextMenu.task.id);
                break;
        }

        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    // Render context menu
    const renderContextMenu = () => {
        if (!contextMenu.visible || !contextMenu.task) return null;

        const task = contextMenu.task;
        const menuItems: { label: string; action: 'cancel' | 'retry' | 'remove'; show: boolean }[] = [
            {
                label: t('tasks.cancel'),
                action: 'cancel',
                show: task.status === 'running' || task.status === 'queued'
            },
            {
                label: t('tasks.retry'),
                action: 'retry',
                show: task.status === 'failed' || task.status === 'cancelled'
            },
            {
                label: t('tasks.remove'),
                action: 'remove',
                show: task.status !== 'running'
            }
        ];

        const visibleItems = menuItems.filter(item => item.show);

        return (
            <div
                ref={contextMenuRef}
                className="context-menu"
                style={{ left: contextMenu.x, top: contextMenu.y }}
            >
                {visibleItems.map((item, index) => (
                    <div
                        key={index}
                        className={`context-menu-item ${item.action}`}
                        onClick={() => handleMenuAction(item.action)}
                    >
                        {item.label}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="tasks-tab">
            {/* Task List (scrollable) */}
            <div className="tasks-list">
                {currentTasks.length > 0 ? (
                    <table className="tasks-table">
                        <tbody>
                            {currentTasks.map((task) => {
                                const isRunning = task.status === 'running';
                                const isDelete = task.type === 'delete';
                                // source.path already includes the filename, so don't add it again
                                // Delete tasks only show source, no destination
                                const pathStr = isDelete
                                    ? `[${t('tasks.delete')}] ${formatLocation(task.source)}`
                                    : `${formatLocation(task.source)} --> ${formatLocation(task.destination)}`;
                                const percentage = task.progress?.percentage || 0;

                                return (
                                    <tr
                                        key={task.id}
                                        className={`task-row status-${task.status}`}
                                        onContextMenu={(e) => handleContextMenu(e, task)}
                                    >
                                        <td className="col-path" title={pathStr}>{pathStr}</td>
                                        <td className="col-eta">
                                            {isRunning ? formatEta(task.progress?.eta || 0) : '--:--'}
                                        </td>
                                        <td className="col-progress">
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill"
                                                    style={{ width: `${isRunning ? percentage : 0}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="col-percent">
                                            {isRunning ? `${percentage}%` : '--'}
                                        </td>
                                        <td className="col-info">
                                            {isRunning
                                                ? formatSpeed(task.progress?.speed || 0)
                                                : formatSize(task.fileSize)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <p>{t('tasks.noTasks')}</p>
                    </div>
                )}
            </div>

            {/* Sub-tabs (fixed at bottom) */}
            <div className="sub-tabs">
                <button
                    className={`sub-tab ${activeSubTab === 'queued' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('queued')}
                >
                    {t('tasks.subTab.queued')}
                    {groupedTasks.queued.length > 0 && (
                        <span className="sub-tab-badge">{groupedTasks.queued.length}</span>
                    )}
                </button>
                <button
                    className={`sub-tab ${activeSubTab === 'failed' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('failed')}
                >
                    {t('tasks.subTab.failed')}
                    {groupedTasks.failed.length > 0 && (
                        <span className="sub-tab-badge error">{groupedTasks.failed.length}</span>
                    )}
                </button>
                <button
                    className={`sub-tab ${activeSubTab === 'successful' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('successful')}
                >
                    {t('tasks.subTab.successful')}
                    {groupedTasks.successful.length > 0 && (
                        <span className="sub-tab-badge success">{groupedTasks.successful.length}</span>
                    )}
                </button>
            </div>

            {/* Context Menu */}
            {renderContextMenu()}
        </div>
    );
};
