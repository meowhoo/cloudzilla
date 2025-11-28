import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Config management
    config: {
        load: () => ipcRenderer.invoke('config:load'),
        save: (updates: any) => ipcRenderer.invoke('config:save', updates),
        get: (key: string) => ipcRenderer.invoke('config:get', key),
        set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
    },

    // Theme management
    theme: {
        get: () => ipcRenderer.invoke('theme:get'),
        save: (mode: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:save', mode),
        getOS: () => ipcRenderer.invoke('theme:get-os'),
    },

    // Rclone management
    rclone: {
        getVersion: () => ipcRenderer.invoke('rclone:version'),
        list: (remote: string, remotePath: string) => ipcRenderer.invoke('rclone:list', remote, remotePath),
        getConfigPath: () => ipcRenderer.invoke('rclone:getConfigPath'),
        // Config management
        listRemotes: () => ipcRenderer.invoke('rclone:listRemotes'),
        deleteRemote: (name: string) => ipcRenderer.invoke('rclone:deleteRemote', name),
        startOAuth: (provider: string, remoteName: string) => ipcRenderer.invoke('rclone:startOAuth', provider, remoteName),
        completeOAuth: (remoteName: string) => ipcRenderer.invoke('rclone:completeOAuth', remoteName),
        cancelOAuth: () => ipcRenderer.invoke('rclone:cancelOAuth'),
        getRemoteConfig: (name: string) => ipcRenderer.invoke('rclone:getRemoteConfig', name),
        // File operations
        delete: (fullPath: string) => ipcRenderer.invoke('rclone:delete', fullPath),
        purge: (fullPath: string) => ipcRenderer.invoke('rclone:purge', fullPath),
        mkdir: (fullPath: string) => ipcRenderer.invoke('rclone:mkdir', fullPath),
        rename: (sourcePath: string, destPath: string) => ipcRenderer.invoke('rclone:rename', sourcePath, destPath),
    },

    // Local file system operations
    local: {
        list: (dirPath: string) => ipcRenderer.invoke('local:list', dirPath),
        getHome: () => ipcRenderer.invoke('local:getHome'),
        getDrives: () => ipcRenderer.invoke('local:getDrives'),
        delete: (filePath: string, isDirectory: boolean) => ipcRenderer.invoke('local:delete', filePath, isDirectory),
        mkdir: (dirPath: string) => ipcRenderer.invoke('local:mkdir', dirPath),
        rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('local:rename', oldPath, newPath),
    },

    // Transfer management
    transfer: {
        // Task operations
        start: (taskParams: any) => ipcRenderer.invoke('transfer:start', taskParams),
        cancel: (taskId: string) => ipcRenderer.invoke('transfer:cancel', taskId),
        retry: (taskId: string) => ipcRenderer.invoke('transfer:retry', taskId),

        // Query operations
        list: () => ipcRenderer.invoke('transfer:list'),
        get: (taskId: string) => ipcRenderer.invoke('transfer:get', taskId),
        stats: () => ipcRenderer.invoke('transfer:stats'),

        // Cleanup operations
        clearCompleted: () => ipcRenderer.invoke('transfer:clear-completed'),
        clearFailed: () => ipcRenderer.invoke('transfer:clear-failed'),
        clearAll: () => ipcRenderer.invoke('transfer:clear-all'),
        clearHistory: () => ipcRenderer.invoke('transfer:clear-history'),
        remove: (taskId: string) => ipcRenderer.invoke('transfer:remove', taskId),

        // Queue control operations
        pauseQueue: () => ipcRenderer.invoke('transfer:pause-queue'),
        resumeQueue: () => ipcRenderer.invoke('transfer:resume-queue'),
        clearQueue: () => ipcRenderer.invoke('transfer:clear-queue'),
        setMaxConcurrent: (value: number) => ipcRenderer.invoke('transfer:set-max-concurrent', value),

        // Log operations
        logs: () => ipcRenderer.invoke('transfer:logs'),
        logsByTask: (taskId: string) => ipcRenderer.invoke('transfer:logs-by-task', taskId),
        clearLogs: () => ipcRenderer.invoke('transfer:logs-clear'),
    },

    // Event listeners
    on: {
        themeChanged: (callback: (theme: 'light' | 'dark') => void) => {
            ipcRenderer.on('theme-changed-broadcast', (_, theme) => callback(theme));
        },
        osThemeChanged: (callback: (data: { dark: boolean; actualTheme: 'light' | 'dark' }) => void) => {
            ipcRenderer.on('os-theme-changed', (_, data) => callback(data));
        },
        languageChanged: (callback: (language: string) => void) => {
            ipcRenderer.on('language-changed-broadcast', (_, language) => callback(language));
        },
        showHiddenFilesChanged: (callback: (show: boolean) => void) => {
            ipcRenderer.on('show-hidden-files-changed-broadcast', (_, show) => callback(show));
        },

        // Transfer event listeners
        transferTaskUpdate: (callback: (task: any) => void) => {
            ipcRenderer.on('transfer:task-update', (_, task) => callback(task));
        },
        transferProgressUpdate: (callback: (data: any) => void) => {
            ipcRenderer.on('transfer:progress-update', (_, data) => callback(data));
        },
        transferLogUpdate: (callback: (log: any) => void) => {
            ipcRenderer.on('transfer:log-update', (_, log) => callback(log));
        },
        // File-level progress for Progress Tab (from rclone stats.transferring)
        transferringFilesUpdate: (callback: (data: any) => void) => {
            ipcRenderer.on('transfer:transferring-update', (_, data) => callback(data));
        },
    },

    // Window controls
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    maximizeWindow: () => ipcRenderer.send('window:maximize'),
    closeWindow: () => ipcRenderer.send('window:close'),
});
