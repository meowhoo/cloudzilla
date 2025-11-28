import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TransferQueueManager } from '../services/TransferQueueManager';
import { TransferTask, LogEntry } from '../../renderer/types/transfer';

/**
 * Transfer IPC Handlers
 *
 * Registers IPC handlers for transfer operations.
 * Provides bidirectional communication between renderer and main process.
 */
export class TransferHandlers {
    private queueManager: TransferQueueManager;

    constructor(queueManager: TransferQueueManager) {
        this.queueManager = queueManager;
    }

    /**
     * Register all IPC handlers
     */
    register(): void {
        console.log('[TransferHandlers] Registering IPC handlers...');

        // Task management
        ipcMain.handle('transfer:start', this.handleStart.bind(this));
        ipcMain.handle('transfer:cancel', this.handleCancel.bind(this));
        ipcMain.handle('transfer:retry', this.handleRetry.bind(this));

        // Query operations
        ipcMain.handle('transfer:list', this.handleList.bind(this));
        ipcMain.handle('transfer:get', this.handleGet.bind(this));
        ipcMain.handle('transfer:stats', this.handleStats.bind(this));

        // Cleanup operations
        ipcMain.handle('transfer:clear-completed', this.handleClearCompleted.bind(this));
        ipcMain.handle('transfer:clear-failed', this.handleClearFailed.bind(this));
        ipcMain.handle('transfer:clear-all', this.handleClearAll.bind(this));
        ipcMain.handle('transfer:clear-history', this.handleClearHistory.bind(this));
        ipcMain.handle('transfer:remove', this.handleRemove.bind(this));

        // Queue control operations
        ipcMain.handle('transfer:pause-queue', this.handlePauseQueue.bind(this));
        ipcMain.handle('transfer:resume-queue', this.handleResumeQueue.bind(this));
        ipcMain.handle('transfer:clear-queue', this.handleClearQueue.bind(this));
        ipcMain.handle('transfer:set-max-concurrent', this.handleSetMaxConcurrent.bind(this));

        // Log operations
        ipcMain.handle('transfer:logs', this.handleGetLogs.bind(this));
        ipcMain.handle('transfer:logs-by-task', this.handleGetLogsByTask.bind(this));
        ipcMain.handle('transfer:logs-clear', this.handleClearLogs.bind(this));

        console.log('[TransferHandlers] IPC handlers registered successfully');
    }

    /**
     * Unregister all IPC handlers
     */
    unregister(): void {
        console.log('[TransferHandlers] Unregistering IPC handlers...');

        ipcMain.removeHandler('transfer:start');
        ipcMain.removeHandler('transfer:cancel');
        ipcMain.removeHandler('transfer:retry');
        ipcMain.removeHandler('transfer:list');
        ipcMain.removeHandler('transfer:get');
        ipcMain.removeHandler('transfer:stats');
        ipcMain.removeHandler('transfer:clear-completed');
        ipcMain.removeHandler('transfer:clear-failed');
        ipcMain.removeHandler('transfer:clear-all');
        ipcMain.removeHandler('transfer:clear-history');
        ipcMain.removeHandler('transfer:remove');
        ipcMain.removeHandler('transfer:pause-queue');
        ipcMain.removeHandler('transfer:resume-queue');
        ipcMain.removeHandler('transfer:clear-queue');
        ipcMain.removeHandler('transfer:set-max-concurrent');
        ipcMain.removeHandler('transfer:logs');
        ipcMain.removeHandler('transfer:logs-by-task');
        ipcMain.removeHandler('transfer:logs-clear');

        console.log('[TransferHandlers] IPC handlers unregistered');
    }

    // ============================================================================
    // Task Management Handlers
    // ============================================================================

    /**
     * Start a new transfer task
     * @returns taskId
     */
    private async handleStart(
        event: IpcMainInvokeEvent,
        taskParams: Omit<TransferTask, 'id' | 'status' | 'progress' | 'createdAt'>
    ): Promise<string> {
        try {
            console.log(`[TransferHandlers] Starting transfer: ${taskParams.fileName}`);
            const taskId = await this.queueManager.addTask(taskParams);
            return taskId;
        } catch (err) {
            console.error('[TransferHandlers] Failed to start transfer:', err);
            throw err;
        }
    }

    /**
     * Cancel a task
     */
    private async handleCancel(event: IpcMainInvokeEvent, taskId: string): Promise<void> {
        try {
            console.log(`[TransferHandlers] Cancelling task: ${taskId}`);
            await this.queueManager.cancelTask(taskId);
        } catch (err) {
            console.error('[TransferHandlers] Failed to cancel task:', err);
            throw err;
        }
    }

    /**
     * Retry a failed task
     * @returns new taskId
     */
    private async handleRetry(event: IpcMainInvokeEvent, taskId: string): Promise<string> {
        try {
            console.log(`[TransferHandlers] Retrying task: ${taskId}`);
            const newTaskId = await this.queueManager.retryTask(taskId);
            return newTaskId;
        } catch (err) {
            console.error('[TransferHandlers] Failed to retry task:', err);
            throw err;
        }
    }

    // ============================================================================
    // Query Handlers
    // ============================================================================

    /**
     * Get all tasks
     */
    private async handleList(event: IpcMainInvokeEvent): Promise<TransferTask[]> {
        try {
            const tasks = this.queueManager.getTasks();
            return tasks;
        } catch (err) {
            console.error('[TransferHandlers] Failed to list tasks:', err);
            throw err;
        }
    }

    /**
     * Get a single task by ID
     */
    private async handleGet(event: IpcMainInvokeEvent, taskId: string): Promise<TransferTask | undefined> {
        try {
            const task = this.queueManager.getTask(taskId);
            return task;
        } catch (err) {
            console.error('[TransferHandlers] Failed to get task:', err);
            throw err;
        }
    }

    /**
     * Get statistics
     */
    private async handleStats(event: IpcMainInvokeEvent): Promise<any> {
        try {
            const stats = this.queueManager.getStats();
            return stats;
        } catch (err) {
            console.error('[TransferHandlers] Failed to get stats:', err);
            throw err;
        }
    }

    // ============================================================================
    // Cleanup Handlers
    // ============================================================================

    /**
     * Clear completed tasks
     */
    private async handleClearCompleted(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Clearing completed tasks');
            this.queueManager.clearCompletedTasks();
        } catch (err) {
            console.error('[TransferHandlers] Failed to clear completed tasks:', err);
            throw err;
        }
    }

    /**
     * Clear failed tasks
     */
    private async handleClearFailed(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Clearing failed tasks');
            this.queueManager.clearFailedTasks();
        } catch (err) {
            console.error('[TransferHandlers] Failed to clear failed tasks:', err);
            throw err;
        }
    }

    /**
     * Clear all tasks
     */
    private async handleClearAll(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Clearing all tasks');
            this.queueManager.clearAllTasks();
        } catch (err) {
            console.error('[TransferHandlers] Failed to clear all tasks:', err);
            throw err;
        }
    }

    /**
     * Clear history (completed, failed, cancelled tasks)
     */
    private async handleClearHistory(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Clearing history');
            this.queueManager.clearHistory();
        } catch (err) {
            console.error('[TransferHandlers] Failed to clear history:', err);
            throw err;
        }
    }

    /**
     * Remove a single task
     */
    private async handleRemove(event: IpcMainInvokeEvent, taskId: string): Promise<void> {
        try {
            console.log('[TransferHandlers] Removing task:', taskId);
            this.queueManager.removeTask(taskId);
        } catch (err) {
            console.error('[TransferHandlers] Failed to remove task:', err);
            throw err;
        }
    }

    // ============================================================================
    // Queue Control Handlers
    // ============================================================================

    /**
     * Pause the queue
     */
    private async handlePauseQueue(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Pausing queue');
            this.queueManager.pauseQueue();
        } catch (err) {
            console.error('[TransferHandlers] Failed to pause queue:', err);
            throw err;
        }
    }

    /**
     * Resume the queue
     */
    private async handleResumeQueue(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Resuming queue');
            this.queueManager.resumeQueue();
        } catch (err) {
            console.error('[TransferHandlers] Failed to resume queue:', err);
            throw err;
        }
    }

    /**
     * Clear the queue
     */
    private async handleClearQueue(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Clearing queue');
            this.queueManager.clearQueue();
        } catch (err) {
            console.error('[TransferHandlers] Failed to clear queue:', err);
            throw err;
        }
    }

    /**
     * Set max concurrent transfers
     */
    private async handleSetMaxConcurrent(event: IpcMainInvokeEvent, value: number): Promise<void> {
        try {
            console.log('[TransferHandlers] Setting max concurrent to:', value);
            this.queueManager.setMaxConcurrent(value);
        } catch (err) {
            console.error('[TransferHandlers] Failed to set max concurrent:', err);
            throw err;
        }
    }

    // ============================================================================
    // Log Handlers
    // ============================================================================

    /**
     * Get all logs
     */
    private async handleGetLogs(event: IpcMainInvokeEvent): Promise<LogEntry[]> {
        try {
            const logs = this.queueManager.getLogs();
            return logs;
        } catch (err) {
            console.error('[TransferHandlers] Failed to get logs:', err);
            throw err;
        }
    }

    /**
     * Get logs for a specific task
     */
    private async handleGetLogsByTask(event: IpcMainInvokeEvent, taskId: string): Promise<LogEntry[]> {
        try {
            const logs = this.queueManager.getLogsByTask(taskId);
            return logs;
        } catch (err) {
            console.error('[TransferHandlers] Failed to get logs by task:', err);
            throw err;
        }
    }

    /**
     * Clear all logs
     */
    private async handleClearLogs(event: IpcMainInvokeEvent): Promise<void> {
        try {
            console.log('[TransferHandlers] Clearing all logs');
            this.queueManager.clearAllLogs();
        } catch (err) {
            console.error('[TransferHandlers] Failed to clear logs:', err);
            throw err;
        }
    }
}
