import React from 'react';
import { TransferringFile, TransferTask } from '../../types/transfer';
import { useTranslation } from 'react-i18next';
import './ProgressTab.css';

interface ProgressTabProps {
    transferringFiles: TransferringFile[];
    totalSpeed: number;
    tasks: TransferTask[];
}

export const ProgressTab: React.FC<ProgressTabProps> = ({ transferringFiles, tasks }) => {
    const { t } = useTranslation();

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

    // Format location as "remoteName: path"
    const formatLocation = (loc: TransferTask['source'], fileName?: string): string => {
        const remoteName = loc.type === 'remote' && loc.remoteName ? loc.remoteName : 'local';
        const fullPath = fileName ? `${loc.path}/${fileName}` : loc.path;
        return `${remoteName}: ${fullPath}`;
    };

    // Find parent task for a file
    const findTask = (taskId: string): TransferTask | undefined => {
        return tasks.find(t => t.id === taskId);
    };

    return (
        <div className="progress-tab">
            {transferringFiles.length > 0 ? (
                <table className="progress-table">
                    <tbody>
                        {transferringFiles.map((file, index) => {
                            const task = findTask(file.taskId);
                            const sourceStr = task ? formatLocation(task.source, file.name) : `${file.taskName}: ${file.name}`;
                            const destStr = task ? formatLocation(task.destination) : '';
                            const percentage = file.percentage || 0;

                            const pathStr = `${sourceStr} --> ${destStr}`;

                            return (
                                <tr key={`${file.taskId}-${file.name}-${index}`}>
                                    <td className="col-path" title={pathStr}>{pathStr}</td>
                                    <td className="col-eta">{formatEta(file.eta || 0)}</td>
                                    <td className="col-progress">
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${percentage}%` }} />
                                        </div>
                                    </td>
                                    <td className="col-percent">{percentage}%</td>
                                    <td className="col-transfer">{formatSize(file.bytes || 0)} ({formatSpeed(file.speed || 0)})</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <div className="empty-state">
                    <p>{t('progress.noActiveTasks')}</p>
                </div>
            )}
        </div>
    );
};
