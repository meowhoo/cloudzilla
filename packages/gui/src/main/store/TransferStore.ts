import Store from 'electron-store';
import { TransferTask, LogEntry, TransferTaskStore, TransferStatus } from '../../renderer/types/transfer';

/**
 * TransferStore
 *
 * Manages persistent storage for transfer tasks using electron-store.
 * Per Feature003 SPEC:
 * - Only stores COMPLETED/FAILED/CANCELLED tasks (not running/queued - those stay in memory)
 * - Stores max 1000 TransferTask entries (auto-cleanup oldest)
 * - Logs are kept in MEMORY ONLY (max 500 entries) - NOT persisted
 * - Running/queued tasks are managed by TransferQueueManager in memory only
 */
export class TransferStore {
    private taskStore: any; // electron-store instance
    private logs: LogEntry[] = []; // In-memory only (not persisted per spec)

    private readonly MAX_TASKS = 1000;
    private readonly MAX_LOGS = 500; // Per spec: 500 logs in memory only

    constructor() {
        // Initialize task store (persisted)
        this.taskStore = new Store<TransferTaskStore>({
            name: 'transfer-tasks',
            defaults: {
                tasks: []
            },
            // Store in app data directory
            cwd: undefined // Uses default Electron app data path
        });

        // Logs are in-memory only (not persisted per spec)
        this.logs = [];

        console.log('[TransferStore] Initialized');
        console.log('[TransferStore] Task store path:', this.taskStore.path);
        console.log('[TransferStore] Log storage: in-memory only (max 500)');
    }

    // ============================================================================
    // Task Operations
    // ============================================================================

    /**
     * Get all tasks
     */
    getTasks(): TransferTask[] {
        return this.taskStore.get('tasks', []);
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): TransferTask | undefined {
        const tasks = this.getTasks();
        return tasks.find(t => t.id === taskId);
    }

    /**
     * Get tasks by status
     */
    getTasksByStatus(status: TransferStatus): TransferTask[] {
        const tasks = this.getTasks();
        return tasks.filter(t => t.status === status);
    }

    /**
     * Get active (running or queued) tasks
     */
    getActiveTasks(): TransferTask[] {
        const tasks = this.getTasks();
        return tasks.filter(t => t.status === 'running' || t.status === 'queued');
    }

    /**
     * Add a new task
     */
    addTask(task: TransferTask): void {
        const tasks = this.getTasks();
        tasks.push(task);

        // Auto-cleanup if exceeds limit
        this.cleanupTasks(tasks);

        this.taskStore.set('tasks', tasks);
        console.log(`[TransferStore] Added task: ${task.id} (${task.fileName})`);
    }

    /**
     * Update an existing task
     */
    updateTask(taskId: string, updates: Partial<TransferTask>): void {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);

        if (index === -1) {
            console.error(`[TransferStore] Task not found: ${taskId}`);
            return;
        }

        tasks[index] = {
            ...tasks[index],
            ...updates
        };

        this.taskStore.set('tasks', tasks);
        // console.log(`[TransferStore] Updated task: ${taskId}`); // Too verbose for progress updates
    }

    /**
     * Update task progress
     */
    updateTaskProgress(taskId: string, progress: Partial<TransferTask['progress']>): void {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);

        if (index === -1) {
            console.error(`[TransferStore] Task not found: ${taskId}`);
            return;
        }

        tasks[index].progress = {
            ...tasks[index].progress,
            ...progress
        };

        this.taskStore.set('tasks', tasks);
    }

    /**
     * Update task status
     */
    updateTaskStatus(taskId: string, status: TransferStatus, error?: string): void {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);

        if (index === -1) {
            console.error(`[TransferStore] Task not found: ${taskId}`);
            return;
        }

        tasks[index].status = status;

        if (status === 'running' && !tasks[index].startedAt) {
            tasks[index].startedAt = Date.now();
        }

        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            tasks[index].completedAt = Date.now();
        }

        if (error) {
            tasks[index].error = error;
        }

        this.taskStore.set('tasks', tasks);
        console.log(`[TransferStore] Task ${taskId} status: ${status}`);
    }

    /**
     * Delete a task
     */
    deleteTask(taskId: string): void {
        const tasks = this.getTasks();
        const filtered = tasks.filter(t => t.id !== taskId);

        this.taskStore.set('tasks', filtered);
        console.log(`[TransferStore] Deleted task: ${taskId}`);
    }

    /**
     * Clear completed tasks
     */
    clearCompletedTasks(): void {
        const tasks = this.getTasks();
        const filtered = tasks.filter(t => t.status !== 'completed');

        this.taskStore.set('tasks', filtered);
        console.log(`[TransferStore] Cleared completed tasks`);
    }

    /**
     * Clear failed tasks
     */
    clearFailedTasks(): void {
        const tasks = this.getTasks();
        const filtered = tasks.filter(t => t.status !== 'failed');

        this.taskStore.set('tasks', filtered);
        console.log(`[TransferStore] Cleared failed tasks`);
    }

    /**
     * Clear all tasks
     */
    clearAllTasks(): void {
        this.taskStore.set('tasks', []);
        console.log(`[TransferStore] Cleared all tasks`);
    }

    /**
     * Auto-cleanup tasks when exceeding MAX_TASKS limit
     * Strategy: Keep running/queued tasks, remove oldest completed/failed/cancelled
     */
    private cleanupTasks(tasks: TransferTask[]): void {
        if (tasks.length <= this.MAX_TASKS) {
            return;
        }

        // Separate active and inactive tasks
        const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'queued');
        const inactiveTasks = tasks.filter(t => t.status !== 'running' && t.status !== 'queued');

        // Sort inactive by completion time (oldest first)
        inactiveTasks.sort((a, b) => (a.completedAt || a.createdAt) - (b.completedAt || b.createdAt));

        // Keep newest inactive tasks
        const maxInactive = this.MAX_TASKS - activeTasks.length;
        const keptInactive = inactiveTasks.slice(-maxInactive);

        // Merge active + kept inactive
        tasks.length = 0;
        tasks.push(...activeTasks, ...keptInactive);

        console.log(`[TransferStore] Auto-cleanup: kept ${activeTasks.length} active + ${keptInactive.length} inactive tasks`);
    }

    // ============================================================================
    // Log Operations (IN-MEMORY ONLY per spec)
    // ============================================================================

    /**
     * Get all logs (from memory)
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    /**
     * Get logs by task ID
     */
    getLogsByTask(taskId: string): LogEntry[] {
        return this.logs.filter(log => log.taskId === taskId);
    }

    /**
     * Get logs by type
     */
    getLogsByType(type: LogEntry['type']): LogEntry[] {
        return this.logs.filter(log => log.type === type);
    }

    /**
     * Add a new log entry (in-memory only)
     */
    addLog(log: LogEntry): void {
        this.logs.push(log);

        // Auto-cleanup if exceeds limit
        this.cleanupLogs();
    }

    /**
     * Add multiple log entries (bulk operation, in-memory only)
     */
    addLogs(newLogs: LogEntry[]): void {
        this.logs.push(...newLogs);

        // Auto-cleanup if exceeds limit
        this.cleanupLogs();

        console.log(`[TransferStore] Added ${newLogs.length} logs (in-memory)`);
    }

    /**
     * Clear all logs (in-memory)
     */
    clearAllLogs(): void {
        this.logs = [];
        console.log(`[TransferStore] Cleared all logs (in-memory)`);
    }

    /**
     * Clear logs by task ID
     */
    clearLogsByTask(taskId: string): void {
        this.logs = this.logs.filter(log => log.taskId !== taskId);
        console.log(`[TransferStore] Cleared logs for task: ${taskId}`);
    }

    /**
     * Auto-cleanup logs when exceeding MAX_LOGS limit
     * Strategy: Remove oldest logs (FIFO)
     */
    private cleanupLogs(): void {
        if (this.logs.length <= this.MAX_LOGS) {
            return;
        }

        // Keep only newest MAX_LOGS entries
        const removeCount = this.logs.length - this.MAX_LOGS;
        this.logs.splice(0, removeCount);

        console.log(`[TransferStore] Auto-cleanup: removed ${removeCount} oldest logs`);
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Get store statistics
     */
    getStats(): {
        tasks: {
            total: number;
            queued: number;
            running: number;
            completed: number;
            failed: number;
            cancelled: number;
        };
        logs: {
            total: number;
            info: number;
            success: number;
            warning: number;
            error: number;
            debug: number;
        };
    } {
        const tasks = this.getTasks();
        const logs = this.getLogs();

        return {
            tasks: {
                total: tasks.length,
                queued: tasks.filter(t => t.status === 'queued').length,
                running: tasks.filter(t => t.status === 'running').length,
                completed: tasks.filter(t => t.status === 'completed').length,
                failed: tasks.filter(t => t.status === 'failed').length,
                cancelled: tasks.filter(t => t.status === 'cancelled').length
            },
            logs: {
                total: logs.length,
                info: logs.filter(l => l.type === 'info').length,
                success: logs.filter(l => l.type === 'success').length,
                warning: logs.filter(l => l.type === 'warning').length,
                error: logs.filter(l => l.type === 'error').length,
                debug: logs.filter(l => l.type === 'debug').length
            }
        };
    }

    /**
     * Reset all stores (for testing/debugging)
     */
    resetAll(): void {
        this.clearAllTasks();
        this.clearAllLogs();
        console.log('[TransferStore] Reset all stores');
    }
}
