import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Scissors, RefreshCw, Trash2, FolderPlus, ArrowRight, ArrowLeft, Pencil, ClipboardCopy } from 'lucide-react';
import './FileContextMenu.css';

export interface ContextMenuPosition {
    x: number;
    y: number;
}

interface FileContextMenuProps {
    visible: boolean;
    position: ContextMenuPosition;
    panelSide: 'left' | 'right';
    hasSelection: boolean;
    isSingleSelection: boolean;  // Only one item selected (for rename)
    hasFolder: boolean;  // At least one selected item is a folder
    otherPanelConnected: boolean;
    isLocal: boolean;  // Whether current pane is local (for copy path)
    onCopy: () => void;
    onMove: () => void;
    onSync: () => void;
    onDelete: () => void;
    onNewFolder: () => void;
    onRefresh: () => void;
    onRename: () => void;
    onCopyPath: () => void;
    onClose: () => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
    visible,
    position,
    panelSide,
    hasSelection,
    isSingleSelection,
    hasFolder,
    otherPanelConnected,
    isLocal,
    onCopy,
    onMove,
    onSync,
    onDelete,
    onNewFolder,
    onRefresh,
    onRename,
    onCopyPath,
    onClose
}) => {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [visible, onClose]);

    // Adjust position to stay within viewport
    useEffect(() => {
        if (!visible || !menuRef.current) return;

        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = position.x;
        let adjustedY = position.y;

        if (position.x + rect.width > viewportWidth) {
            adjustedX = viewportWidth - rect.width - 10;
        }
        if (position.y + rect.height > viewportHeight) {
            adjustedY = viewportHeight - rect.height - 10;
        }

        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;
    }, [visible, position]);

    if (!visible) return null;

    const direction = panelSide === 'left' ? 'Right' : 'Left';
    const DirectionIcon = panelSide === 'left' ? ArrowRight : ArrowLeft;

    const canTransfer = hasSelection && otherPanelConnected;
    const canSync = hasSelection && otherPanelConnected && hasFolder;

    return (
        <div
            className="file-context-menu"
            ref={menuRef}
            style={{ left: position.x, top: position.y }}
        >
            {hasSelection && (
                <>
                    <div
                        className={`context-menu-item ${!canTransfer ? 'disabled' : ''}`}
                        onClick={canTransfer ? onCopy : undefined}
                    >
                        <Copy size={14} className="icon" />
                        <span>{t(`contextMenu.copyTo${direction}`)}</span>
                        <DirectionIcon size={12} className="direction" />
                    </div>
                    <div
                        className={`context-menu-item ${!canTransfer ? 'disabled' : ''}`}
                        onClick={canTransfer ? onMove : undefined}
                    >
                        <Scissors size={14} className="icon" />
                        <span>{t(`contextMenu.moveTo${direction}`)}</span>
                        <DirectionIcon size={12} className="direction" />
                    </div>
                    <div
                        className={`context-menu-item ${!canSync ? 'disabled' : ''}`}
                        onClick={canSync ? onSync : undefined}
                    >
                        <RefreshCw size={14} className="icon" />
                        <span>{t(`contextMenu.syncTo${direction}`)}</span>
                        <DirectionIcon size={12} className="direction" />
                    </div>
                    <div className="context-menu-divider" />
                    <div
                        className={`context-menu-item ${!isSingleSelection ? 'disabled' : ''}`}
                        onClick={isSingleSelection ? onRename : undefined}
                    >
                        <Pencil size={14} className="icon" />
                        <span>{t('contextMenu.rename')}</span>
                        <span className="shortcut">F2</span>
                    </div>
                    {isLocal && isSingleSelection && (
                        <div
                            className="context-menu-item"
                            onClick={onCopyPath}
                        >
                            <ClipboardCopy size={14} className="icon" />
                            <span>{t('contextMenu.copyPath')}</span>
                        </div>
                    )}
                    <div
                        className="context-menu-item delete"
                        onClick={onDelete}
                    >
                        <Trash2 size={14} className="icon" />
                        <span>{t('contextMenu.delete')}</span>
                    </div>
                    <div className="context-menu-divider" />
                </>
            )}
            <div
                className="context-menu-item"
                onClick={onNewFolder}
            >
                <FolderPlus size={14} className="icon" />
                <span>{t('contextMenu.newFolder')}</span>
            </div>
            <div
                className="context-menu-item"
                onClick={onRefresh}
            >
                <RefreshCw size={14} className="icon" />
                <span>{t('contextMenu.refresh')}</span>
            </div>
        </div>
    );
};
