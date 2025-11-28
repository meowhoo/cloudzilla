import { BrowserWindow } from 'electron';
import { TransferTask, LogEntry, TransferringFile } from '../../../renderer/types/transfer';

/**
 * IPC Channel names for transfer events
 */
export const TransferChannels = {
    TASK_UPDATE: 'transfer:task-update',
    PROGRESS_UPDATE: 'transfer:progress-update',
    LOG_UPDATE: 'transfer:log-update',
    TRANSFERRING_UPDATE: 'transfer:transferring-update'
} as const;

/**
 * TransferBroadcaster
 *
 * Encapsulates all IPC broadcast logic for transfer events.
 * Provides a semantic API for notifying the renderer process
 * about task updates, progress changes, and log entries.
 *
 * This class extracts the broadcast logic from TransferQueueManager
 * to reduce its complexity and improve testability.
 */
export class TransferBroadcaster {
    private mainWindow: BrowserWindow | null = null;

    constructor() {
        console.log('[TransferBroadcaster] Initialized');
    }

    /**
     * Set the main window for IPC broadcasting
     * @param window BrowserWindow instance
     */
    setMainWindow(window: BrowserWindow | null): void {
        this.mainWindow = window;
        if (window) {
            console.log('[TransferBroadcaster] Main window set');
        } else {
            console.log('[TransferBroadcaster] Main window cleared');
        }
    }

    /**
     * Check if broadcasting is available
     */
    isReady(): boolean {
        return this.mainWindow !== null && !this.mainWindow.isDestroyed();
    }

    /**
     * Send a message to the renderer process
     * @param channel IPC channel name
     * @param data Data to send
     */
    private send(channel: string, data: unknown): void {
        if (!this.isReady()) {
            console.warn(`[TransferBroadcaster] Cannot send to ${channel}: window not ready`);
            return;
        }

        try {
            this.mainWindow!.webContents.send(channel, data);
        } catch (err) {
            console.error(`[TransferBroadcaster] Failed to send to ${channel}:`, err);
        }
    }

    /**
     * Broadcast a task update (status change, completion, etc.)
     * Used when a task's overall state changes.
     *
     * @param task The updated TransferTask
     */
    notifyTaskUpdate(task: TransferTask): void {
        this.send(TransferChannels.TASK_UPDATE, task);
    }

    /**
     * Broadcast a progress update for a running task
     * Used for frequent progress updates during transfer.
     *
     * @param taskId Task ID
     * @param progress Task progress data
     * @param status Current task status
     */
    notifyProgressUpdate(
        taskId: string,
        progress: TransferTask['progress'],
        status: TransferTask['status']
    ): void {
        this.send(TransferChannels.PROGRESS_UPDATE, {
            taskId,
            progress,
            status
        });
    }

    /**
     * Broadcast a log entry
     * Used for console log updates.
     *
     * @param log LogEntry to broadcast
     */
    notifyLogUpdate(log: LogEntry): void {
        this.send(TransferChannels.LOG_UPDATE, log);
    }

    /**
     * Broadcast transferring files update (for Progress Tab)
     * Shows individual file-level progress from rclone stats.transferring
     *
     * @param files Array of currently transferring files
     * @param totalSpeed Combined transfer speed
     */
    notifyTransferringFiles(files: TransferringFile[], totalSpeed: number): void {
        const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);

        this.send(TransferChannels.TRANSFERRING_UPDATE, {
            files,
            totalBytes,
            totalSpeed
        });
    }

    /**
     * Convenience method to broadcast task completed
     * @param task Completed task
     */
    notifyTaskCompleted(task: TransferTask): void {
        this.notifyTaskUpdate(task);
    }

    /**
     * Convenience method to broadcast task failed
     * @param task Failed task
     */
    notifyTaskFailed(task: TransferTask): void {
        this.notifyTaskUpdate(task);
    }

    /**
     * Convenience method to broadcast task cancelled
     * @param task Cancelled task
     */
    notifyTaskCancelled(task: TransferTask): void {
        this.notifyTaskUpdate(task);
    }

    /**
     * Convenience method to broadcast task started
     * @param task Started task
     */
    notifyTaskStarted(task: TransferTask): void {
        this.notifyTaskUpdate(task);
    }

    /**
     * Convenience method to broadcast task queued
     * @param task Queued task
     */
    notifyTaskQueued(task: TransferTask): void {
        this.notifyTaskUpdate(task);
    }

    /**
     * Helper to create and broadcast a log entry
     * @param type Log type (info, success, warning, error, debug)
     * @param message Log message
     * @param taskId Optional associated task ID
     */
    broadcastLog(
        type: LogEntry['type'],
        message: string,
        taskId?: string
    ): LogEntry {
        const log: LogEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            message,
            type,
            taskId
        };

        this.notifyLogUpdate(log);
        return log;
    }
}
