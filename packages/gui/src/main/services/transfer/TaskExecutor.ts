import { RcloneService, RcloneProgress } from '../RcloneService';
import { TransferTask, TransferringFile } from '../../../renderer/types/transfer';
import { RcloneOutputParser } from './RcloneOutputParser';

/**
 * Task execution result
 */
export interface TaskExecutionResult {
    success: boolean;
    bytesTransferred: number;
    errors: number;
    errorMessage?: string;
}

/**
 * Callbacks for task execution events
 */
export interface TaskExecutionCallbacks {
    onProgress?: (taskId: string, progress: TransferTask['progress'], transferringFiles?: TransferringFile[]) => void;
    onStdout?: (taskId: string, line: string) => void;
    onStderr?: (taskId: string, line: string) => void;
    onError?: (taskId: string, error: string) => void;
}

/**
 * TaskExecutor
 *
 * Handles the execution lifecycle of a single transfer task.
 * Encapsulates spawn handling, output parsing, and error management.
 *
 * This class extracts task execution logic from TransferQueueManager
 * to improve testability and reduce complexity.
 */
export class TaskExecutor {
    private rcloneService: RcloneService;
    private parser: RcloneOutputParser;

    constructor(rcloneService: RcloneService) {
        this.rcloneService = rcloneService;
        this.parser = new RcloneOutputParser();
    }

    /**
     * Execute a transfer task
     * @param task The TransferTask to execute
     * @param callbacks Event callbacks for progress, output, errors
     * @returns Execution result with success status and details
     */
    async execute(
        task: TransferTask,
        callbacks?: TaskExecutionCallbacks
    ): Promise<TaskExecutionResult> {
        // Reset parser state for new task
        this.parser.reset();

        // Build source and destination paths
        const sourcePath = this.buildPath(task.source);
        const destPath = this.buildPath(task.destination);

        console.log(`[TaskExecutor] Executing task: ${task.id} (${task.type})`);
        console.log(`[TaskExecutor] Source: ${sourcePath}, Dest: ${destPath}`);

        try {
            // Handle delete operations separately
            if (task.type === 'delete') {
                return await this.executeDelete(task, sourcePath);
            }

            // Prepare rclone transfer options
            const transferOptions = {
                taskId: task.id,
                onProgress: (progress: RcloneProgress) => {
                    this.handleProgress(task, progress, callbacks);
                },
                onError: (error: string) => {
                    callbacks?.onError?.(task.id, error);
                },
                onStdout: (line: string) => {
                    this.handleOutput(task.id, line, 'stdout', callbacks);
                },
                onStderr: (line: string) => {
                    this.handleOutput(task.id, line, 'stderr', callbacks);
                }
            };

            // Check if this is a retry operation
            const isRetry = (task.retryCount || 0) > 0;

            let result;
            if (isRetry) {
                // Use smart retry with --ignore-existing
                console.log(`[TaskExecutor] Using smart retry for task: ${task.id}`);
                result = await this.rcloneService.retryTransfer(
                    task.type as 'copy' | 'move',
                    sourcePath,
                    destPath,
                    transferOptions
                );
            } else {
                // Normal transfer
                if (task.type === 'copy') {
                    result = await this.rcloneService.copy(sourcePath, destPath, transferOptions);
                } else if (task.type === 'move') {
                    result = await this.rcloneService.move(sourcePath, destPath, transferOptions);
                } else {
                    throw new Error(`Unsupported task type: ${task.type}`);
                }
            }

            return {
                success: true,
                bytesTransferred: result?.bytesTransferred || 0,
                errors: result?.errors || 0
            };

        } catch (err) {
            const errorMessage = (err as Error).message;
            console.error(`[TaskExecutor] Task failed: ${task.id}`, errorMessage);

            return {
                success: false,
                bytesTransferred: 0,
                errors: 1,
                errorMessage
            };
        }
    }

    /**
     * Execute a delete operation
     */
    private async executeDelete(
        task: TransferTask,
        sourcePath: string
    ): Promise<TaskExecutionResult> {
        try {
            if (task.source.type === 'local') {
                // Local delete using fs
                const fs = await import('fs');
                if (task.isDirectory) {
                    await fs.promises.rm(sourcePath, { recursive: true, force: true });
                } else {
                    await fs.promises.unlink(sourcePath);
                }
            } else {
                // Remote delete via rclone
                if (task.isDirectory) {
                    await this.rcloneService.purge(sourcePath);
                } else {
                    await this.rcloneService.deleteFile(sourcePath);
                }
            }

            return {
                success: true,
                bytesTransferred: 0,
                errors: 0
            };
        } catch (err) {
            return {
                success: false,
                bytesTransferred: 0,
                errors: 1,
                errorMessage: (err as Error).message
            };
        }
    }

    /**
     * Handle progress updates from rclone
     */
    private handleProgress(
        task: TransferTask,
        rcloneProgress: RcloneProgress,
        callbacks?: TaskExecutionCallbacks
    ): void {
        // Calculate percentage (cap at 99% while running)
        let percentage = 0;
        if (rcloneProgress.totalBytes > 0) {
            percentage = Math.round((rcloneProgress.bytes / rcloneProgress.totalBytes) * 100);
        }
        if (percentage > 99) {
            percentage = 99;
        }

        const progress: TransferTask['progress'] = {
            bytesTransferred: rcloneProgress.bytes || 0,
            percentage,
            speed: rcloneProgress.speed || 0,
            eta: rcloneProgress.eta || 0,
            transfers: rcloneProgress.transfers,
            totalTransfers: rcloneProgress.totalTransfers
        };

        // Extract transferring files for Progress Tab
        let transferringFiles: TransferringFile[] | undefined;
        if (rcloneProgress.transferring && rcloneProgress.transferring.length > 0) {
            transferringFiles = rcloneProgress.transferring.map(item => ({
                name: item.name,
                size: item.size || 0,
                bytes: item.bytes || 0,
                percentage: item.percentage || 0,
                speed: item.speed || 0,
                eta: item.eta || 0,
                taskId: task.id,
                taskName: task.fileName
            }));
        }

        callbacks?.onProgress?.(task.id, progress, transferringFiles);
    }

    /**
     * Handle stdout/stderr output
     */
    private handleOutput(
        taskId: string,
        line: string,
        source: 'stdout' | 'stderr',
        callbacks?: TaskExecutionCallbacks
    ): void {
        if (!line.trim()) return;

        if (source === 'stdout') {
            callbacks?.onStdout?.(taskId, line);
        } else {
            callbacks?.onStderr?.(taskId, line);
        }
    }

    /**
     * Build path string from TransferLocation
     */
    private buildPath(location: TransferTask['source'] | TransferTask['destination']): string {
        if (location.type === 'local') {
            return location.path;
        } else {
            // remote: "remoteName:path"
            return `${location.remoteName}:${location.path}`;
        }
    }

    /**
     * Cancel a running task
     * @param taskId Task ID to cancel
     */
    cancel(taskId: string): void {
        this.rcloneService.cancel(taskId);
    }

    /**
     * Generate rclone command string for debugging/display
     */
    buildCommandString(task: TransferTask): string {
        const sourcePath = this.buildPath(task.source);
        const destPath = this.buildPath(task.destination);

        if (task.type === 'delete') {
            return `rclone delete "${sourcePath}"`;
        }

        return `rclone ${task.type} "${sourcePath}" "${destPath}" --progress`;
    }
}
