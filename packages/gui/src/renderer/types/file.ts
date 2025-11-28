/**
 * Unified file item interface for both local and remote files
 * Maps from rclone lsjson output
 */
export interface FileItem {
    id: string;          // Unique identifier (Path)
    name: string;        // File/folder name
    path: string;        // Full path within remote
    type: 'file' | 'folder';
    size: number;        // Size in bytes (0 for folders)
    modTime: string;     // ISO timestamp
    mimeType?: string;   // MIME type (optional)
}

/**
 * Pane state for file browser
 */
export interface PaneState {
    siteId: string | null;
    siteName: string;
    remoteName: string;    // rclone remote name (e.g., "gdrive")
    currentPath: string;   // Current directory path
    files: FileItem[];
    selectedIds: string[];
    isLoading: boolean;
    error: string | null;
    connectionStatus: 'idle' | 'connecting' | 'connected' | 'failed';
}

/**
 * Convert rclone lsjson output to FileItem
 *
 * Note: Cloud providers like Google Drive allow multiple files with the same name
 * in the same folder. We use the native ID from rclone (when available) to ensure
 * uniqueness. Falls back to Path for local filesystems or backends without ID support.
 */
export function rcloneToFileItem(item: {
    Path: string;
    Name: string;
    Size: number;
    MimeType?: string;
    ModTime?: string;
    IsDir: boolean;
    ID?: string; // Native cloud provider ID (Google Drive, OneDrive, etc.)
}): FileItem {
    return {
        // Use native ID if available (unique for cloud providers), otherwise fall back to Path
        id: item.ID || item.Path,
        name: item.Name,
        path: item.Path,
        type: item.IsDir ? 'folder' : 'file',
        size: item.Size || 0,
        modTime: item.ModTime || new Date().toISOString(),
        mimeType: item.MimeType
    };
}
