import React, { useState } from 'react';
import { FileItem } from '../types/file';
import { Folder, File, FileText, Image, Music, Video, Code, FileJson, Archive, Loader2, HardDrive } from 'lucide-react';
import { FileContextMenu, ContextMenuPosition } from './FileContextMenu';
import { THIS_PC_PATH } from './Layout';
import './FileList.css';
import { useTranslation } from 'react-i18next';

interface FileListProps {
    files: FileItem[];
    currentPath: string;
    selectedIds: string[];
    isLoading?: boolean;
    error?: string | null;
    onNavigate: (path: string) => void;
    onGoUp: () => void;
    onSelect: (id: string, multi: boolean) => void;

    // Context menu props
    panelSide: 'left' | 'right';
    otherPanelConnected: boolean;
    isLocal?: boolean;  // Whether current pane is local (for copy path)
    onCopy?: () => void;
    onMove?: () => void;
    onSync?: () => void;
    onDelete?: () => void;
    onNewFolder?: (folderName: string) => Promise<void>;
    onRefresh?: () => void;
    onRename?: (file: FileItem, newName: string) => Promise<void>;
    onCopyPath?: (file: FileItem) => void;

    // Drag & drop props
    isDragOver?: boolean;
    onDragStart?: (files: FileItem[]) => void;
    onDragEnd?: () => void;
    onDragOverPanel?: (e: React.DragEvent) => void;
    onDragLeavePanel?: () => void;
    onDrop?: () => void;
}

export const FileList: React.FC<FileListProps> = ({
    files,
    currentPath,
    selectedIds,
    isLoading = false,
    error = null,
    onNavigate,
    onGoUp,
    onSelect,
    panelSide,
    otherPanelConnected,
    isLocal = false,
    onCopy,
    onMove,
    onSync,
    onDelete,
    onNewFolder,
    onRefresh,
    onRename,
    onCopyPath,
    isDragOver = false,
    onDragStart,
    onDragEnd,
    onDragOverPanel,
    onDragLeavePanel,
    onDrop
}) => {
    const { t } = useTranslation();

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        position: ContextMenuPosition;
    }>({ visible: false, position: { x: 0, y: 0 } });

    // Dragging state for visual feedback
    const [draggingIds, setDraggingIds] = useState<string[]>([]);

    // Inline editing state for rename
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');
    const editInputRef = React.useRef<HTMLInputElement>(null);

    // Creating new folder state
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState<string>('');
    const newFolderInputRef = React.useRef<HTMLInputElement>(null);

    const formatSize = (bytes?: number) => {
        if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        if (i < 0 || i >= sizes.length) return '';
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleString();
        } catch {
            return isoString;
        }
    };

    const getFileIcon = (file: FileItem) => {
        // Show hard drive icon for drives in "This PC" view
        if (currentPath === THIS_PC_PATH && file.type === 'folder') {
            return <HardDrive size={16} className="icon-drive" />;
        }
        if (file.type === 'folder') return <Folder size={16} fill="currentColor" className="icon-folder" />;

        const ext = file.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'svg':
            case 'webp':
                return <Image size={16} />;
            case 'mp3':
            case 'wav':
            case 'flac':
            case 'ogg':
                return <Music size={16} />;
            case 'mp4':
            case 'mov':
            case 'avi':
            case 'mkv':
            case 'webm':
                return <Video size={16} />;
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'css':
            case 'html':
            case 'py':
            case 'java':
            case 'cpp':
            case 'c':
            case 'go':
            case 'rs':
                return <Code size={16} />;
            case 'json':
                return <FileJson size={16} />;
            case 'zip':
            case 'rar':
            case '7z':
            case 'tar':
            case 'gz':
                return <Archive size={16} />;
            case 'txt':
            case 'md':
            case 'doc':
            case 'docx':
            case 'pdf':
                return <FileText size={16} />;
            default:
                return <File size={16} />;
        }
    };

    // Sort files: folders first, then by name
    const sortedFiles = [...files].sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });

    // Check if we can go up (not at root or "This PC")
    const canGoUp = currentPath !== '' && currentPath !== '/' && currentPath !== THIS_PC_PATH;

    // Get selected files
    const selectedFiles = files.filter(f => selectedIds.includes(f.id));
    const hasFolder = selectedFiles.some(f => f.type === 'folder');

    // Handle double click on folder
    const handleDoubleClick = (file: FileItem) => {
        if (file.type === 'folder') {
            // Handle clicking on a drive from "This PC" view
            if (currentPath === THIS_PC_PATH) {
                // file.name is the drive letter (e.g., "C:")
                // Navigate to drive root (e.g., "C:\")
                onNavigate(file.name + '\\');
                return;
            }
            // Use correct separator based on path format (Windows uses \, Unix uses /)
            const separator = currentPath.includes('\\') ? '\\' : '/';
            // Avoid double separator when currentPath already ends with one (e.g., "C:\")
            const basePath = currentPath.endsWith(separator) ? currentPath.slice(0, -1) : currentPath;
            const newPath = basePath ? `${basePath}${separator}${file.name}` : file.name;
            onNavigate(newPath);
        }
    };

    // Handle context menu
    const handleContextMenu = (e: React.MouseEvent, file?: FileItem) => {
        e.preventDefault();
        e.stopPropagation();

        // If right-clicking on a file that's not selected, select it
        if (file && !selectedIds.includes(file.id)) {
            onSelect(file.id, false);
        }

        setContextMenu({
            visible: true,
            position: { x: e.clientX, y: e.clientY }
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, position: { x: 0, y: 0 } });
    };

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, file: FileItem) => {
        // If the file being dragged is not in selection, select only it
        let filesToDrag: FileItem[];
        if (!selectedIds.includes(file.id)) {
            onSelect(file.id, false);
            filesToDrag = [file];
        } else {
            filesToDrag = selectedFiles;
        }

        setDraggingIds(filesToDrag.map(f => f.id));

        // Set drag data
        e.dataTransfer.setData('application/json', JSON.stringify({
            files: filesToDrag,
            sourceSide: panelSide,
            sourcePath: currentPath
        }));
        e.dataTransfer.effectAllowed = 'copy';

        onDragStart?.(filesToDrag);
    };

    const handleDragEnd = () => {
        setDraggingIds([]);
        onDragEnd?.();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = otherPanelConnected ? 'copy' : 'none';
        onDragOverPanel?.(e);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only trigger if leaving the file list container
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            onDragLeavePanel?.();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop?.();
    };

    // Rename handlers
    const startRename = (file: FileItem) => {
        setEditingId(file.id);
        // For files, select just the name without extension
        const name = file.name;
        if (file.type === 'file' && name.includes('.')) {
            const lastDot = name.lastIndexOf('.');
            setEditingName(name.substring(0, lastDot));
        } else {
            setEditingName(name);
        }
        // Focus input after render
        setTimeout(() => {
            if (editInputRef.current) {
                editInputRef.current.focus();
                editInputRef.current.select();
            }
        }, 0);
    };

    const cancelRename = () => {
        setEditingId(null);
        setEditingName('');
    };

    const confirmRename = async () => {
        if (!editingId || !onRename) {
            cancelRename();
            return;
        }

        const file = files.find(f => f.id === editingId);
        if (!file) {
            cancelRename();
            return;
        }

        // Build new name (preserve extension for files)
        let newName = editingName.trim();
        if (!newName) {
            cancelRename();
            return;
        }

        // For files, restore the extension
        if (file.type === 'file' && file.name.includes('.')) {
            const lastDot = file.name.lastIndexOf('.');
            const ext = file.name.substring(lastDot);
            if (!newName.endsWith(ext)) {
                newName = newName + ext;
            }
        }

        // Skip if name unchanged
        if (newName === file.name) {
            cancelRename();
            return;
        }

        try {
            await onRename(file, newName);
        } catch (err) {
            console.error('Rename failed:', err);
            // Could show error toast here
        }
        cancelRename();
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRename();
        }
    };

    // New folder handlers
    const startCreateFolder = () => {
        setIsCreatingFolder(true);
        setNewFolderName(t('contextMenu.newFolder'));
        // Focus input after render
        setTimeout(() => {
            if (newFolderInputRef.current) {
                newFolderInputRef.current.focus();
                newFolderInputRef.current.select();
            }
        }, 0);
    };

    const cancelCreateFolder = () => {
        setIsCreatingFolder(false);
        setNewFolderName('');
    };

    const confirmCreateFolder = async () => {
        if (!onNewFolder) {
            cancelCreateFolder();
            return;
        }

        const name = newFolderName.trim();
        if (!name) {
            cancelCreateFolder();
            return;
        }

        try {
            await onNewFolder(name);
        } catch (err) {
            console.error('Create folder failed:', err);
        }
        cancelCreateFolder();
    };

    const handleNewFolderKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmCreateFolder();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelCreateFolder();
        }
    };

    // F2 keyboard shortcut for rename
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F2 to start rename (only when single file is selected and not already editing)
            if (e.key === 'F2' && selectedIds.length === 1 && !editingId && onRename) {
                e.preventDefault();
                const file = files.find(f => f.id === selectedIds[0]);
                if (file) {
                    startRename(file);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, editingId, files, onRename]);

    // Loading state
    if (isLoading) {
        return (
            <div className="file-list file-list-loading">
                <Loader2 size={32} className="spinner" />
                <span>{t('fileList.loading')}</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="file-list file-list-error">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
            </div>
        );
    }

    return (
        <>
            <div
                className={`file-list ${isDragOver ? 'drag-over' : ''} ${isDragOver && !otherPanelConnected ? 'invalid' : ''}`}
                onContextMenu={(e) => handleContextMenu(e)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="file-list-header">
                    <div className="col-icon"></div>
                    <div className="col-name">{t('fileList.name')}</div>
                    <div className="col-size">{t('fileList.size')}</div>
                    <div className="col-date">{t('fileList.modified')}</div>
                </div>
                {canGoUp && (
                    <div className="file-item" onClick={onGoUp}>
                        <div className="col-icon">
                            <Folder size={16} fill="currentColor" className="icon-folder" />
                        </div>
                        <div className="col-name">..</div>
                        <div className="col-size"></div>
                        <div className="col-date"></div>
                    </div>
                )}
                {isCreatingFolder && (
                    <div className="file-item editing">
                        <div className="col-icon">
                            <Folder size={16} fill="currentColor" className="icon-folder" />
                        </div>
                        <div className="col-name">
                            <input
                                ref={newFolderInputRef}
                                type="text"
                                className="file-name-input"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={handleNewFolderKeyDown}
                                onBlur={confirmCreateFolder}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="col-size"></div>
                        <div className="col-date"></div>
                    </div>
                )}
                {sortedFiles.length === 0 && !canGoUp && !isCreatingFolder && (
                    <div className="file-list-empty">
                        <span>{t('fileList.empty')}</span>
                    </div>
                )}
                {sortedFiles.map((file) => {
                    const isSelected = selectedIds.includes(file.id);
                    const isDragging = draggingIds.includes(file.id);
                    const isEditing = editingId === file.id;
                    return (
                        <div
                            key={file.id}
                            className={`file-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isEditing) {
                                    onSelect(file.id, e.ctrlKey || e.metaKey);
                                }
                            }}
                            onDoubleClick={() => !isEditing && handleDoubleClick(file)}
                            onContextMenu={(e) => !isEditing && handleContextMenu(e, file)}
                            draggable={!isEditing}
                            onDragStart={(e) => !isEditing && handleDragStart(e, file)}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="col-icon" style={{ color: file.type === 'folder' ? 'var(--color-accent)' : 'inherit' }}>
                                {getFileIcon(file)}
                            </div>
                            <div className="col-name">
                                {isEditing ? (
                                    <input
                                        ref={editInputRef}
                                        type="text"
                                        className="file-name-input"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={confirmRename}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    file.name
                                )}
                            </div>
                            <div className="col-size">{file.type === 'file' ? formatSize(file.size) : ''}</div>
                            <div className="col-date">{formatDate(file.modTime)}</div>
                        </div>
                    );
                })}

                {/* Drop indicator */}
                {isDragOver && otherPanelConnected && (
                    <div className="drop-indicator">
                        {t('contextMenu.copyToHere', 'Copy to here')}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            <FileContextMenu
                visible={contextMenu.visible}
                position={contextMenu.position}
                panelSide={panelSide}
                hasSelection={selectedIds.length > 0}
                isSingleSelection={selectedIds.length === 1}
                hasFolder={hasFolder}
                otherPanelConnected={otherPanelConnected}
                isLocal={isLocal}
                onCopy={() => { onCopy?.(); closeContextMenu(); }}
                onMove={() => { onMove?.(); closeContextMenu(); }}
                onSync={() => { onSync?.(); closeContextMenu(); }}
                onDelete={() => { onDelete?.(); closeContextMenu(); }}
                onNewFolder={() => { startCreateFolder(); closeContextMenu(); }}
                onRefresh={() => { onRefresh?.(); closeContextMenu(); }}
                onRename={() => {
                    const file = files.find(f => f.id === selectedIds[0]);
                    if (file) startRename(file);
                    closeContextMenu();
                }}
                onCopyPath={() => {
                    const file = files.find(f => f.id === selectedIds[0]);
                    if (file) onCopyPath?.(file);
                    closeContextMenu();
                }}
                onClose={closeContextMenu}
            />
        </>
    );
};
