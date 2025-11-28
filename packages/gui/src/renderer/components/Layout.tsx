import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './TitleBar';
import { FileList } from './FileList';
import { Breadcrumb } from './Breadcrumb';
import { FileItem, rcloneToFileItem } from '../types/file';
import { SiteManagerModal } from './SiteManager/SiteManagerModal';
import { SiteSelector } from './SiteSelector';
import { StatusPanel } from './StatusPanel';
import { SettingsModal } from './SettingsModal/SettingsModal';
import { TransferTask } from '../types/transfer';
import { Cloudy, PanelBottom, Sun, Moon, Settings } from 'lucide-react'; // Sun, Moon kept for DEBUG theme toggle
import { showConfirm, showToast } from '../utils/alert';
import './Layout.css';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';

// Connection status type
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

// Special path for "This PC" view (shows drives on Windows)
export const THIS_PC_PATH = 'this-pc';

// Pane state interface
interface PaneState {
    siteId: string | null;
    siteName: string;
    remoteName: string;
    currentPath: string;
    files: FileItem[];
    selectedIds: string[];
    isLoading: boolean;
    error: string | null;
    connectionStatus: ConnectionStatus;
}

const initialPaneState: PaneState = {
    siteId: null,
    siteName: '',
    remoteName: '',
    currentPath: '',
    files: [],
    selectedIds: [],
    isLoading: false,
    error: null,
    connectionStatus: 'idle'
};

export const Layout: React.FC = () => {
    const { t } = useTranslation();
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [language, setLanguage] = useState<string>('en-US');
    const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);
    const [localHomePath, setLocalHomePath] = useState<string>('');

    // Initialize theme and language from config
    useEffect(() => {
        const initializeSettings = async () => {
            try {
                const savedTheme = await (window as any).electronAPI.theme.get();
                const osTheme = await (window as any).electronAPI.theme.getOS();
                let actualTheme: 'light' | 'dark' = 'dark';
                if (savedTheme === 'system') {
                    actualTheme = osTheme.actualTheme;
                } else {
                    actualTheme = savedTheme;
                }
                setTheme(actualTheme);

                const config = await (window as any).electronAPI.config.load();
                const savedLanguage = config.language || 'en-US';
                setLanguage(savedLanguage);
                await i18n.changeLanguage(savedLanguage);
                setShowHiddenFiles(config.showHiddenFiles || false);
            } catch (err) {
                console.error('[Layout] Failed to load initial settings:', err);
            }
        };
        initializeSettings();
    }, []);

    // Apply theme to DOM
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Setup broadcast listeners
    useEffect(() => {
        (window as any).electronAPI.on.themeChanged((newTheme: 'light' | 'dark') => {
            setTheme(newTheme);
        });
        (window as any).electronAPI.on.languageChanged(async (newLanguage: string) => {
            setLanguage(newLanguage);
            await i18n.changeLanguage(newLanguage);
        });
        (window as any).electronAPI.on.showHiddenFilesChanged((show: boolean) => {
            console.log('[Layout] showHiddenFiles changed to:', show);
            setShowHiddenFiles(show);
        });
    }, []);

    // Pane states
    const [leftPane, setLeftPane] = useState<PaneState>(initialPaneState);
    const [rightPane, setRightPane] = useState<PaneState>(initialPaneState);

    // Modal states
    const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isStatusPanelOpen, setIsStatusPanelOpen] = useState(true);

    // Drag & drop states
    const [leftDragOver, setLeftDragOver] = useState(false);
    const [rightDragOver, setRightDragOver] = useState(false);
    const [dragSourceSide, setDragSourceSide] = useState<'left' | 'right' | null>(null);
    const dragDataRef = useRef<{ files: FileItem[]; sourceSide: 'left' | 'right'; sourcePath: string } | null>(null);

    // Sites list
    const [sites, setSites] = useState<any[]>([]);

    // Load sites on mount
    useEffect(() => {
        loadSites();
    }, []);

    // Initialize both panes to local file system on mount
    // TODO: Future enhancement - persist and restore last connected sites
    useEffect(() => {
        const initializeLocalPanes = async () => {
            try {
                const homePath = await (window as any).electronAPI.local.getHome();
                setLocalHomePath(homePath); // Save home path for Breadcrumb
                const items = await (window as any).electronAPI.local.list(homePath);
                const files = items.map(rcloneToFileItem);

                // Sort files: folders first, then files, both alphabetically (case-insensitive)
                files.sort((a: FileItem, b: FileItem) => {
                    if (a.type === 'folder' && b.type !== 'folder') return -1;
                    if (a.type !== 'folder' && b.type === 'folder') return 1;
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                });

                // Set both panes to local
                const localPaneState = {
                    siteId: 'local',
                    siteName: t('siteManager.local'),
                    remoteName: '',
                    currentPath: homePath,
                    files,
                    selectedIds: [],
                    isLoading: false,
                    error: null,
                    connectionStatus: 'connected' as ConnectionStatus
                };

                setLeftPane(localPaneState);
                setRightPane({ ...localPaneState }); // Clone to avoid shared reference
                console.log('[Layout] Initialized both panes to local:', homePath);
            } catch (err) {
                console.error('[Layout] Failed to initialize local panes:', err);
            }
        };

        initializeLocalPanes();
    }, [t]);

    // Reload sites when Site Manager is opened/closed
    useEffect(() => {
        if (isSiteManagerOpen) {
            loadSites();
        }
    }, [isSiteManagerOpen]);

    const loadSites = async () => {
        try {
            const loadedSites = await (window as any).electronAPI.rclone.listRemotes();
            setSites(loadedSites.map((name: string) => ({ id: name, name })));
        } catch (err) {
            console.error('[Layout] Failed to load sites:', err);
            setSites([]);
        }
    };

    // Use refs to access current pane states in callbacks
    const leftPaneRef = useRef(leftPane);
    const rightPaneRef = useRef(rightPane);
    useEffect(() => { leftPaneRef.current = leftPane; }, [leftPane]);
    useEffect(() => { rightPaneRef.current = rightPane; }, [rightPane]);

    // Auto-refresh panes when transfer completes + show Toast notifications
    useEffect(() => {
        const handleTaskUpdate = (task: TransferTask) => {
            if (!task) return;

            // Show Toast for task completion or failure
            if (task.status === 'completed') {
                if (task.type === 'delete') {
                    showToast('success', t('alerts.toast.deleteSuccess', { count: 1 }));
                } else {
                    showToast('success', t('alerts.toast.transferSuccess', { name: task.fileName }));
                }
            } else if (task.status === 'failed') {
                if (task.type === 'delete') {
                    showToast('error', t('alerts.toast.deleteFailed', { error: task.error || 'Unknown error' }));
                } else {
                    showToast('error', t('alerts.toast.transferFailed', { error: task.error || 'Unknown error' }));
                }
            }

            // Only auto-refresh on completion
            if (task.status !== 'completed') return;

            console.log('[Layout] Transfer completed, checking for auto-refresh:', task.fileName);

            const left = leftPaneRef.current;
            const right = rightPaneRef.current;

            // Helper to check if a pane matches a location
            const paneMatchesLocation = (pane: PaneState, location: TransferTask['source'] | TransferTask['destination']): boolean => {
                if (!pane.siteId) return false;

                if (location.type === 'local') {
                    return pane.siteId === 'local';
                } else {
                    return pane.remoteName === location.remoteName;
                }
            };

            // Determine which panes to refresh based on transfer type
            // copy: refresh destination only
            // move/sync/delete: refresh source (delete only has source)
            const refreshSource = task.type === 'move' || task.type === 'sync' || task.type === 'delete';
            const refreshDest = task.type !== 'delete'; // Delete has no destination

            // Check and refresh left pane
            let leftNeedsRefresh = false;
            if (refreshSource && paneMatchesLocation(left, task.source)) {
                leftNeedsRefresh = true;
            }
            if (refreshDest && paneMatchesLocation(left, task.destination)) {
                leftNeedsRefresh = true;
            }

            // Check and refresh right pane
            let rightNeedsRefresh = false;
            if (refreshSource && paneMatchesLocation(right, task.source)) {
                rightNeedsRefresh = true;
            }
            if (refreshDest && paneMatchesLocation(right, task.destination)) {
                rightNeedsRefresh = true;
            }

            // Helper to refresh a pane
            const refreshPane = async (pane: PaneState, setPane: React.Dispatch<React.SetStateAction<PaneState>>, paneName: string) => {
                if (!pane.siteId) return;
                console.log(`[Layout] Auto-refreshing ${paneName} pane`);

                try {
                    const isLocal = pane.siteId === 'local';
                    let items;
                    if (isLocal) {
                        items = await (window as any).electronAPI.local.list(pane.currentPath);
                    } else {
                        items = await (window as any).electronAPI.rclone.list(`${pane.remoteName}:`, pane.currentPath);
                    }
                    setPane(prev => ({ ...prev, files: items.map(rcloneToFileItem) }));
                } catch (err) {
                    console.error(`[Layout] Auto-refresh ${paneName} failed:`, err);
                }
            };

            // Trigger refreshes
            if (leftNeedsRefresh) {
                refreshPane(left, setLeftPane, 'left');
            }
            if (rightNeedsRefresh) {
                refreshPane(right, setRightPane, 'right');
            }
        };

        (window as any).electronAPI.on.transferTaskUpdate(handleTaskUpdate);
    }, []);

    // Load files from remote or local
    const loadFiles = useCallback(async (
        remoteName: string,
        path: string,
        setPane: React.Dispatch<React.SetStateAction<PaneState>>,
        isLocal: boolean = false
    ) => {
        setPane(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            let items;
            if (isLocal) {
                // Check if we're at "This PC" level (show drives)
                if (path === THIS_PC_PATH) {
                    const drives = await (window as any).electronAPI.local.getDrives();
                    // Convert drives to FileItem format
                    items = drives.map((drive: string) => ({
                        Path: drive,
                        Name: drive,
                        Size: 0,
                        ModTime: new Date().toISOString(),
                        IsDir: true
                    }));
                } else {
                    // Local file system
                    items = await (window as any).electronAPI.local.list(path);
                }
            } else {
                // Remote via rclone
                const remote = `${remoteName}:`;
                items = await (window as any).electronAPI.rclone.list(remote, path);
            }
            const files = items.map(rcloneToFileItem);

            // Sort files: folders first, then files, both alphabetically (case-insensitive)
            files.sort((a: FileItem, b: FileItem) => {
                // Folders before files
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                // Alphabetical order (case-insensitive)
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });

            setPane(prev => ({
                ...prev,
                files,
                isLoading: false,
                error: null
            }));
        } catch (err) {
            console.error('[Layout] Failed to load files:', err);
            setPane(prev => ({
                ...prev,
                files: [],
                isLoading: false,
                error: (err as Error).message
            }));
        }
    }, []);

    // Check if site is local
    const isLocalSite = (siteId: string | null): boolean => siteId === 'local';

    // Handle site selection
    const handleSiteSelect = async (side: 'left' | 'right', siteId: string) => {
        const setPane = side === 'left' ? setLeftPane : setRightPane;
        const siteName = siteId === 'local' ? t('siteManager.local') : siteId;
        const isLocal = isLocalSite(siteId);

        // Get initial path for local (home directory)
        let initialPath = '';
        if (isLocal) {
            try {
                initialPath = await (window as any).electronAPI.local.getHome();
            } catch (err) {
                console.error('[Layout] Failed to get home directory:', err);
            }
        }

        setPane(prev => ({
            ...prev,
            siteId,
            siteName,
            remoteName: isLocal ? '' : siteId,
            currentPath: initialPath,
            files: [],
            selectedIds: [],
            connectionStatus: 'connecting',
            isLoading: true,
            error: null
        }));

        try {
            // Load files
            await loadFiles(siteId, initialPath, setPane, isLocal);

            setPane(prev => ({
                ...prev,
                connectionStatus: 'connected'
            }));
            showToast('success', t('alerts.toast.connected', { name: siteName }));
        } catch (err) {
            setPane(prev => ({
                ...prev,
                connectionStatus: 'failed',
                error: (err as Error).message
            }));
            showToast('error', t('alerts.toast.connectionFailed', { error: (err as Error).message }));
        }
    };

    // Navigate to folder
    const handleNavigate = (side: 'left' | 'right', newPath: string) => {
        const pane = side === 'left' ? leftPane : rightPane;
        const setPane = side === 'left' ? setLeftPane : setRightPane;
        const isLocal = isLocalSite(pane.siteId);

        if (!isLocal && !pane.remoteName) return;

        // newPath is already the full path (built by FileList)
        // Just use it directly for both local and remote
        const fullPath = newPath;

        setPane(prev => ({
            ...prev,
            currentPath: fullPath,
            selectedIds: []
        }));

        loadFiles(pane.remoteName, fullPath, setPane, isLocal);
    };

    // Go up one directory
    const handleGoUp = (side: 'left' | 'right') => {
        const pane = side === 'left' ? leftPane : rightPane;
        const setPane = side === 'left' ? setLeftPane : setRightPane;
        const isLocal = isLocalSite(pane.siteId);

        if (!isLocal && !pane.remoteName) return;
        // Can't go up from "This PC" level
        if (pane.currentPath === THIS_PC_PATH) return;
        if (!pane.currentPath) return;

        // Get parent path
        let parentPath: string;
        if (isLocal) {
            // Handle Windows and Unix paths
            // Detect Windows by checking if path contains backslashes (process.platform not available in renderer)
            const separator = pane.currentPath.includes('\\') ? '\\' : '/';
            const parts = pane.currentPath.split(separator).filter(p => p);

            // Check if we're at drive root (e.g., "C:\")
            const isDriveRoot = separator === '\\' && parts.length === 1 && parts[0].endsWith(':');
            if (isDriveRoot) {
                // Go to "This PC"
                parentPath = THIS_PC_PATH;
            } else {
                parts.pop();
                if (separator === '\\') {
                    // Windows: keep drive letter
                    parentPath = parts.length > 0 ? parts.join('\\') : parts[0] + '\\';
                    if (parts.length === 1 && parts[0].endsWith(':')) {
                        parentPath = parts[0] + '\\';
                    }
                } else {
                    parentPath = '/' + parts.join('/');
                }
            }
        } else {
            const parts = pane.currentPath.split('/').filter(p => p);
            parts.pop();
            parentPath = parts.join('/');
        }

        setPane(prev => ({
            ...prev,
            currentPath: parentPath,
            selectedIds: []
        }));

        loadFiles(pane.remoteName, parentPath, setPane, isLocal);
    };

    // Handle file selection
    const handleFileSelect = (side: 'left' | 'right', fileId: string, multi: boolean) => {
        const setPane = side === 'left' ? setLeftPane : setRightPane;

        setPane(prev => {
            if (multi) {
                const newSelected = prev.selectedIds.includes(fileId)
                    ? prev.selectedIds.filter(id => id !== fileId)
                    : [...prev.selectedIds, fileId];
                return { ...prev, selectedIds: newSelected };
            } else {
                return { ...prev, selectedIds: [fileId] };
            }
        });
    };

    // Refresh current directory
    const handleRefresh = (side: 'left' | 'right') => {
        const pane = side === 'left' ? leftPane : rightPane;
        const setPane = side === 'left' ? setLeftPane : setRightPane;
        const isLocal = isLocalSite(pane.siteId);

        if (!isLocal && !pane.remoteName) return;
        if (!pane.siteId) return;

        loadFiles(pane.remoteName, pane.currentPath, setPane, isLocal);
    };

    // Get selected files from a pane
    const getSelectedFiles = (pane: PaneState): FileItem[] => {
        return pane.files.filter(f => pane.selectedIds.includes(f.id));
    };

    // Calculate total size of selected files
    const calculateTotalSize = (files: FileItem[]): number => {
        return files.reduce((sum, f) => sum + (f.size || 0), 0);
    };

    // Start transfer operation
    const startTransfer = async (
        type: 'copy' | 'move' | 'sync',
        sourcePane: PaneState,
        destPane: PaneState
    ) => {
        const selectedFiles = getSelectedFiles(sourcePane);
        const isSourceLocal = isLocalSite(sourcePane.siteId);
        const isDestLocal = isLocalSite(destPane.siteId);

        if (selectedFiles.length === 0) {
            console.warn('[Layout] No files selected for transfer');
            return;
        }

        if (!destPane.siteId) {
            console.warn('[Layout] No destination selected');
            return;
        }

        // Show toast for transfer started (batch notification)
        if (selectedFiles.length === 1) {
            showToast('info', t('alerts.toast.transferStarted', { name: selectedFiles[0].name }));
        } else {
            showToast('info', t('alerts.toast.transferStarted', { name: `${selectedFiles.length} items` }));
        }

        for (const file of selectedFiles) {
            // Build source path
            let sourcePath: string;
            if (isSourceLocal) {
                const separator = sourcePane.currentPath.includes('\\') ? '\\' : '/';
                sourcePath = sourcePane.currentPath + separator + file.name;
            } else {
                sourcePath = sourcePane.currentPath
                    ? `${sourcePane.currentPath}/${file.name}`
                    : file.name;
            }

            // Build destination path - should be the DIRECTORY path only
            // rclone copy expects: rclone copy source:file.txt dest:directory/
            // If we include the filename in dest, rclone treats it as a directory and creates file.txt/file.txt
            // e.g., copying "A.pdf" to google: root -> destination should be "" (empty = root)
            // e.g., copying "A.pdf" to google:backup -> destination should be "backup"
            let destPath: string;
            if (isDestLocal) {
                // For local, we still use the current directory path
                destPath = destPane.currentPath || '';
            } else {
                // For remote, use the current directory path (without file name)
                destPath = destPane.currentPath || '';
            }

            // Create transfer task
            const taskParams = {
                type,
                fileName: file.name,
                fileSize: file.size || 0,
                isDirectory: file.type === 'folder',
                source: {
                    type: isSourceLocal ? 'local' as const : 'remote' as const,
                    path: sourcePath,
                    remoteName: isSourceLocal ? undefined : sourcePane.remoteName
                },
                destination: {
                    type: isDestLocal ? 'local' as const : 'remote' as const,
                    path: destPath,
                    remoteName: isDestLocal ? undefined : destPane.remoteName
                }
            };

            try {
                console.log('[Layout] Starting transfer:', taskParams);
                await (window as any).electronAPI.transfer.start(taskParams);
            } catch (err) {
                console.error('[Layout] Failed to start transfer:', err);
            }
        }

        // Clear selection after starting transfers
        if (sourcePane === leftPane) {
            setLeftPane(prev => ({ ...prev, selectedIds: [] }));
        } else {
            setRightPane(prev => ({ ...prev, selectedIds: [] }));
        }
    };

    // Copy selected files from left to right
    const handleCopyLeftToRight = () => {
        startTransfer('copy', leftPane, rightPane);
    };

    // Copy selected files from right to left
    const handleCopyRightToLeft = () => {
        startTransfer('copy', rightPane, leftPane);
    };

    // Move selected files from left to right
    const handleMoveLeftToRight = () => {
        startTransfer('move', leftPane, rightPane);
    };

    // Move selected files from right to left
    const handleMoveRightToLeft = () => {
        startTransfer('move', rightPane, leftPane);
    };

    // Sync selected folders
    const handleSyncLeftToRight = () => {
        startTransfer('sync', leftPane, rightPane);
    };

    const handleSyncRightToLeft = () => {
        startTransfer('sync', rightPane, leftPane);
    };

    // Delete selected files (via TransferQueueManager for task tracking)
    const handleDelete = async (side: 'left' | 'right') => {
        const pane = side === 'left' ? leftPane : rightPane;
        const setPane = side === 'left' ? setLeftPane : setRightPane;
        const selectedFiles = getSelectedFiles(pane);
        const isLocal = isLocalSite(pane.siteId);

        if (selectedFiles.length === 0) return;

        // Show delete confirmation dialog
        const confirmed = await showConfirm({
            title: t('alerts.confirm.deleteTitle'),
            text: t('alerts.confirm.delete', { count: selectedFiles.length }),
            confirmText: t('alerts.confirm.deleteConfirm'),
            cancelText: t('alerts.confirm.cancel'),
            icon: 'warning',
            isDanger: true,
        });
        if (!confirmed) return;

        // Show toast for delete started
        showToast('info', t('alerts.toast.deleteStarted', { count: selectedFiles.length }));

        for (const file of selectedFiles) {
            // Build source path (should NOT include remoteName: prefix - that's added by TransferQueueManager.buildPath)
            let sourcePath: string;
            if (isLocal) {
                const separator = pane.currentPath.includes('\\') ? '\\' : '/';
                sourcePath = pane.currentPath + separator + file.name;
            } else {
                // For remote, just use path + filename (same as startTransfer)
                sourcePath = pane.currentPath
                    ? `${pane.currentPath}/${file.name}`
                    : file.name;
            }

            // Create delete task via TransferQueueManager
            const taskParams = {
                type: 'delete' as const,
                fileName: file.name,
                fileSize: file.size || 0,
                isDirectory: file.type === 'folder',
                source: {
                    type: isLocal ? 'local' as const : 'remote' as const,
                    path: sourcePath,
                    remoteName: isLocal ? undefined : pane.remoteName
                },
                // Delete doesn't have a destination, but the interface requires it
                destination: {
                    type: isLocal ? 'local' as const : 'remote' as const,
                    path: '',
                    remoteName: undefined
                }
            };

            try {
                console.log('[Layout] Starting delete task:', taskParams);
                await (window as any).electronAPI.transfer.start(taskParams);
            } catch (err) {
                console.error('[Layout] Failed to start delete task:', err);
            }
        }

        // Clear selection (refresh happens automatically via task completion listener)
        setPane(prev => ({ ...prev, selectedIds: [] }));
    };

    // Create new folder
    const handleNewFolder = async (side: 'left' | 'right', folderName: string) => {
        const pane = side === 'left' ? leftPane : rightPane;
        const isLocal = isLocalSite(pane.siteId);

        let folderPath: string;
        if (isLocal) {
            const separator = pane.currentPath.includes('\\') ? '\\' : '/';
            folderPath = pane.currentPath + separator + folderName;
        } else {
            folderPath = pane.currentPath
                ? `${pane.currentPath}/${folderName}`
                : folderName;
        }

        try {
            if (isLocal) {
                await (window as any).electronAPI.local.mkdir(folderPath);
            } else {
                const fullPath = `${pane.remoteName}:${folderPath}`;
                await (window as any).electronAPI.rclone.mkdir(fullPath);
            }
            showToast('success', t('alerts.toast.folderCreated', { name: folderName }));
            handleRefresh(side);
        } catch (err) {
            console.error('[Layout] Create folder failed:', err);
            showToast('error', t('alerts.toast.folderCreateFailed', { error: (err as Error).message }));
            throw err;
        }
    };

    // Rename file or folder
    const handleRename = async (side: 'left' | 'right', file: FileItem, newName: string) => {
        const pane = side === 'left' ? leftPane : rightPane;
        const isLocal = isLocalSite(pane.siteId);

        // Build source and destination paths
        let sourcePath: string;
        let destPath: string;

        if (isLocal) {
            const separator = pane.currentPath.includes('\\') ? '\\' : '/';
            sourcePath = pane.currentPath + separator + file.name;
            destPath = pane.currentPath + separator + newName;
        } else {
            sourcePath = pane.currentPath
                ? `${pane.remoteName}:${pane.currentPath}/${file.name}`
                : `${pane.remoteName}:${file.name}`;
            destPath = pane.currentPath
                ? `${pane.remoteName}:${pane.currentPath}/${newName}`
                : `${pane.remoteName}:${newName}`;
        }

        try {
            if (isLocal) {
                await (window as any).electronAPI.local.rename(sourcePath, destPath);
            } else {
                await (window as any).electronAPI.rclone.rename(sourcePath, destPath);
            }
            showToast('success', t('alerts.toast.renamed', { name: newName }));
            handleRefresh(side);
        } catch (err) {
            console.error('[Layout] Rename failed:', err);
            showToast('error', t('alerts.toast.renameFailed', { error: (err as Error).message }));
            throw err;
        }
    };

    // Handle breadcrumb navigation
    const handleBreadcrumbNavigate = (side: 'left' | 'right', newPath: string) => {
        const pane = side === 'left' ? leftPane : rightPane;
        const setPane = side === 'left' ? setLeftPane : setRightPane;
        const isLocal = isLocalSite(pane.siteId);

        // For remote, remove leading slash
        let targetPath = newPath;
        if (!isLocal && targetPath.startsWith('/')) {
            targetPath = targetPath.substring(1);
        }

        // For local on Windows, convert Breadcrumb's Unix-style path back to Windows format
        // Breadcrumb converts "C:\Users\meowh" to "/C:/Users/meowh", need to convert back
        if (isLocal && pane.currentPath.includes('\\')) {
            // If path is just "/" it means root - stay at current drive root
            if (targetPath === '/') {
                const parts = pane.currentPath.split('\\');
                if (parts.length > 0 && parts[0].endsWith(':')) {
                    targetPath = parts[0] + '\\';
                }
            } else {
                // Convert "/C:/Users/path" to "C:\Users\path"
                // Remove leading slash if present
                if (targetPath.startsWith('/')) {
                    targetPath = targetPath.substring(1);
                }
                // Replace forward slashes with backslashes
                targetPath = targetPath.replace(/\//g, '\\');
            }
        }

        setPane(prev => ({
            ...prev,
            currentPath: targetPath,
            selectedIds: []
        }));

        loadFiles(pane.remoteName, targetPath, setPane, isLocal);
    };

    // Copy file path to clipboard (local files only)
    const handleCopyPath = async (side: 'left' | 'right', file: FileItem) => {
        const pane = side === 'left' ? leftPane : rightPane;
        const isLocal = isLocalSite(pane.siteId);

        if (!isLocal) return;

        // Build full path
        const separator = pane.currentPath.includes('\\') ? '\\' : '/';
        const fullPath = pane.currentPath + separator + file.name;

        try {
            await navigator.clipboard.writeText(fullPath);
            showToast('success', t('alerts.toast.pathCopied'));
        } catch (err) {
            console.error('[Layout] Failed to copy path:', err);
        }
    };

    // Drag & drop handlers
    const handleDragStart = (side: 'left' | 'right', files: FileItem[]) => {
        const pane = side === 'left' ? leftPane : rightPane;
        setDragSourceSide(side);
        dragDataRef.current = {
            files,
            sourceSide: side,
            sourcePath: pane.currentPath
        };
    };

    const handleDragEnd = () => {
        setDragSourceSide(null);
        setLeftDragOver(false);
        setRightDragOver(false);
        dragDataRef.current = null;
    };

    const handleDragOverPanel = (side: 'left' | 'right') => {
        // Only show drag over if dropping on opposite panel
        if (dragSourceSide && dragSourceSide !== side) {
            if (side === 'left') {
                setLeftDragOver(true);
            } else {
                setRightDragOver(true);
            }
        }
    };

    const handleDragLeavePanel = (side: 'left' | 'right') => {
        if (side === 'left') {
            setLeftDragOver(false);
        } else {
            setRightDragOver(false);
        }
    };

    const handleDrop = (side: 'left' | 'right') => {
        if (!dragDataRef.current) return;
        if (dragDataRef.current.sourceSide === side) return;

        const sourcePane = dragDataRef.current.sourceSide === 'left' ? leftPane : rightPane;
        const destPane = side === 'left' ? leftPane : rightPane;

        // Start copy transfer
        startTransfer('copy', sourcePane, destPane);

        // Reset drag state
        handleDragEnd();
    };

    // Check if operations are possible
    const canOperateLeftToRight = leftPane.selectedIds.length > 0 && rightPane.siteId !== null;
    const canOperateRightToLeft = rightPane.selectedIds.length > 0 && leftPane.siteId !== null;

    return (
        <div className="app-container">
            <TitleBar />
            <div className="toolbar">
                <button onClick={() => setIsSiteManagerOpen(true)} title={t('toolbar.siteManager')}>
                    <Cloudy size={18} />
                </button>

                <div style={{ flex: 1 }} />
                {/* DEBUG: Theme toggle button - uncomment for quick debugging
                <button
                    onClick={async () => {
                        const newTheme = theme === 'dark' ? 'light' : 'dark';
                        await (window as any).electronAPI.theme.save(newTheme);
                    }}
                    title={theme === 'dark' ? t('toolbar.switchToLight') : t('toolbar.switchToDark')}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                */}
                <button
                    onClick={() => setIsStatusPanelOpen(!isStatusPanelOpen)}
                    title={isStatusPanelOpen ? t('toolbar.hideTerminal') : t('toolbar.showTerminal')}
                    className={isStatusPanelOpen ? 'active' : ''}
                >
                    <PanelBottom size={18} />
                </button>
                <button onClick={() => setIsSettingsOpen(true)} title={t('toolbar.settings')}>
                    <Settings size={18} />
                </button>
            </div>

            <SiteManagerModal
                isOpen={isSiteManagerOpen}
                onClose={() => {
                    setIsSiteManagerOpen(false);
                    loadSites();
                }}
            />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            <div className="main-content">
                <div className="pane">
                    <div className="pane-header">
                        <SiteSelector
                            sites={sites}
                            selectedSiteId={leftPane.siteId}
                            onSelect={(id) => handleSiteSelect('left', id)}
                            connectionStatus={leftPane.connectionStatus}
                        />
                        <Breadcrumb
                            path={leftPane.siteId ? leftPane.currentPath : ''}
                            homePath={leftPane.siteId === 'local' ? localHomePath : undefined}
                            onNavigate={(path) => handleBreadcrumbNavigate('left', path)}
                            disabled={!leftPane.siteId}
                        />
                    </div>
                    <FileList
                        files={showHiddenFiles ? leftPane.files : leftPane.files.filter(f => !f.name.startsWith('.'))}
                        currentPath={leftPane.currentPath}
                        selectedIds={leftPane.selectedIds}
                        isLoading={leftPane.isLoading}
                        error={leftPane.error}
                        onNavigate={(path) => handleNavigate('left', path)}
                        onGoUp={() => handleGoUp('left')}
                        onSelect={(id, multi) => handleFileSelect('left', id, multi)}
                        panelSide="left"
                        otherPanelConnected={rightPane.siteId !== null}
                        isLocal={isLocalSite(leftPane.siteId)}
                        onCopy={handleCopyLeftToRight}
                        onMove={handleMoveLeftToRight}
                        onSync={handleSyncLeftToRight}
                        onDelete={() => handleDelete('left')}
                        onNewFolder={(folderName) => handleNewFolder('left', folderName)}
                        onRefresh={() => handleRefresh('left')}
                        onRename={(file, newName) => handleRename('left', file, newName)}
                        onCopyPath={(file) => handleCopyPath('left', file)}
                        isDragOver={leftDragOver}
                        onDragStart={(files) => handleDragStart('left', files)}
                        onDragEnd={handleDragEnd}
                        onDragOverPanel={() => handleDragOverPanel('left')}
                        onDragLeavePanel={() => handleDragLeavePanel('left')}
                        onDrop={() => handleDrop('left')}
                    />
                </div>

                <div className="pane">
                    <div className="pane-header">
                        <SiteSelector
                            sites={sites}
                            selectedSiteId={rightPane.siteId}
                            onSelect={(id) => handleSiteSelect('right', id)}
                            connectionStatus={rightPane.connectionStatus}
                        />
                        <Breadcrumb
                            path={rightPane.siteId ? rightPane.currentPath : ''}
                            homePath={rightPane.siteId === 'local' ? localHomePath : undefined}
                            onNavigate={(path) => handleBreadcrumbNavigate('right', path)}
                            disabled={!rightPane.siteId}
                        />
                    </div>
                    <FileList
                        files={showHiddenFiles ? rightPane.files : rightPane.files.filter(f => !f.name.startsWith('.'))}
                        currentPath={rightPane.currentPath}
                        selectedIds={rightPane.selectedIds}
                        isLoading={rightPane.isLoading}
                        error={rightPane.error}
                        onNavigate={(path) => handleNavigate('right', path)}
                        onGoUp={() => handleGoUp('right')}
                        onSelect={(id, multi) => handleFileSelect('right', id, multi)}
                        panelSide="right"
                        otherPanelConnected={leftPane.siteId !== null}
                        isLocal={isLocalSite(rightPane.siteId)}
                        onCopy={handleCopyRightToLeft}
                        onMove={handleMoveRightToLeft}
                        onSync={handleSyncRightToLeft}
                        onDelete={() => handleDelete('right')}
                        onNewFolder={(folderName) => handleNewFolder('right', folderName)}
                        onRefresh={() => handleRefresh('right')}
                        onRename={(file, newName) => handleRename('right', file, newName)}
                        onCopyPath={(file) => handleCopyPath('right', file)}
                        isDragOver={rightDragOver}
                        onDragStart={(files) => handleDragStart('right', files)}
                        onDragEnd={handleDragEnd}
                        onDragOverPanel={() => handleDragOverPanel('right')}
                        onDragLeavePanel={() => handleDragLeavePanel('right')}
                        onDrop={() => handleDrop('right')}
                    />
                </div>
            </div>

            {isStatusPanelOpen && <StatusPanel />}
        </div>
    );
};
