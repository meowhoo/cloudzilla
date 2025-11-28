import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, ChevronRight, MoreHorizontal, Monitor } from 'lucide-react';
import { THIS_PC_PATH } from './Layout';
import './Breadcrumb.css';

export interface BreadcrumbProps {
    path: string;                    // Current path, e.g., "/Documents/Projects/MyApp"
    remoteName?: string;             // Remote name (optional)
    homePath?: string;               // Home directory path (for local filesystem)
    maxVisible?: number;             // Max visible segments (default 3)
    onNavigate: (path: string) => void;
    disabled?: boolean;              // Whether the breadcrumb is disabled
}

interface BreadcrumbItem {
    name: string;      // Display name
    path: string;      // Full path (original format for navigation)
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
    path,
    homePath,
    maxVisible = 3,
    onNavigate,
    disabled = false
}) => {
    const { t } = useTranslation();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const ellipsisRef = useRef<HTMLDivElement>(null);

    // Normalize path for comparison (convert backslashes to forward slashes, lowercase)
    const normalizePath = (p: string): string => {
        return p.replace(/\\/g, '/').toLowerCase();
    };

    // Check if we're at "This PC" level
    const isAtThisPC = path === THIS_PC_PATH;

    // Check if current path is under or equal to home path
    const isUnderHomePath = (): boolean => {
        if (isAtThisPC) return false; // "This PC" is not under home
        if (!homePath) return true; // No home path means show home for remote
        const normalizedPath = normalizePath(path);
        const normalizedHome = normalizePath(homePath);
        return normalizedPath.startsWith(normalizedHome);
    };

    const showHomeIcon = isUnderHomePath();

    // Check if we should show "This PC" in breadcrumb (Windows local paths outside home)
    const showThisPCIcon = homePath && !isAtThisPC && !showHomeIcon;

    // Get the relative path after homePath
    const getRelativePath = (): string => {
        if (!homePath || !showHomeIcon) return path;

        const normalizedPath = normalizePath(path);
        const normalizedHome = normalizePath(homePath);

        if (normalizedPath === normalizedHome) {
            return ''; // At home directory, no relative path
        }

        // Get the part after homePath
        // path: C:\Users\meowh\Documents
        // homePath: C:\Users\meowh
        // relative: Documents
        const pathParts = path.replace(/\\/g, '/').split('/');
        const homeParts = homePath.replace(/\\/g, '/').split('/');

        // Remove homePath prefix parts
        const relativeParts = pathParts.slice(homeParts.length);
        return relativeParts.join('/');
    };

    // Parse path into segments - only for the relative part when homePath is provided
    const parsePathSegments = (): BreadcrumbItem[] => {
        // If at "This PC" level, no segments to show
        if (isAtThisPC) return [];

        if (homePath && showHomeIcon) {
            // For local with homePath, only show segments after home
            const relativePath = getRelativePath();
            if (!relativePath) return []; // At home, no additional segments

            const parts = relativePath.split('/').filter(Boolean);
            const items: BreadcrumbItem[] = [];

            // Build paths using original path format (with backslashes for Windows)
            const separator = path.includes('\\') ? '\\' : '/';
            let currentPath = homePath;

            for (const part of parts) {
                currentPath = currentPath + separator + part;
                items.push({
                    name: part,
                    path: currentPath
                });
            }

            return items;
        } else if (showThisPCIcon) {
            // For paths outside home (e.g., "C:\", "D:\folder"), show full path from drive
            // path is like "C:\" or "D:\folder\subfolder"
            const normalized = path.replace(/\\/g, '/').replace(/\/+$/g, '');
            const parts = normalized.split('/').filter(Boolean);
            const items: BreadcrumbItem[] = [];

            // Build paths with Windows backslash separator
            let currentPath = '';
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === 0 && part.endsWith(':')) {
                    // Drive letter (e.g., "C:")
                    currentPath = part + '\\';
                    items.push({
                        name: part,
                        path: currentPath
                    });
                } else {
                    currentPath = currentPath + part + (i < parts.length - 1 ? '\\' : '');
                    items.push({
                        name: part,
                        path: currentPath
                    });
                }
            }

            return items;
        } else {
            // For remote or non-home paths, show all segments
            const normalized = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            if (!normalized) return [];

            const parts = normalized.split('/').filter(Boolean);
            const items: BreadcrumbItem[] = [];

            let currentPath = '';
            for (const part of parts) {
                currentPath += '/' + part;
                items.push({
                    name: part,
                    path: currentPath
                });
            }

            return items;
        }
    };

    const allSegments = parsePathSegments();
    const totalSegments = allSegments.length;

    // Determine which segments to show
    const needsEllipsis = totalSegments > maxVisible;
    const hiddenSegments = needsEllipsis ? allSegments.slice(0, totalSegments - 2) : [];
    const visibleSegments = needsEllipsis ? allSegments.slice(totalSegments - 2) : allSegments;

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDropdown]);

    const handleHomeClick = () => {
        // Navigate to homePath if provided, otherwise "/"
        const targetPath = homePath || '/';
        onNavigate(targetPath);
        setShowDropdown(false);
    };

    const handleThisPCClick = () => {
        // Navigate to "This PC" to show drives
        onNavigate(THIS_PC_PATH);
        setShowDropdown(false);
    };

    const handleSegmentClick = (item: BreadcrumbItem) => {
        onNavigate(item.path);
        setShowDropdown(false);
    };

    const handleEllipsisClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDropdown(!showDropdown);
    };

    return (
        <div className={`breadcrumb ${disabled ? 'disabled' : ''}`}>
            {/* "This PC" button - show when at "This PC" level or navigating outside home */}
            {(isAtThisPC || showThisPCIcon) && (
                <>
                    <div
                        className={`breadcrumb-item this-pc ${isAtThisPC ? 'current' : ''}`}
                        onClick={disabled || isAtThisPC ? undefined : handleThisPCClick}
                        title={t('breadcrumb.thisPC')}
                    >
                        <Monitor size={14} />
                    </div>

                    {!disabled && !isAtThisPC && totalSegments > 0 && (
                        <ChevronRight size={12} className="breadcrumb-separator" />
                    )}
                </>
            )}

            {/* Home button - only show if path is under home directory */}
            {showHomeIcon && (
                <>
                    <div
                        className="breadcrumb-item home"
                        onClick={disabled ? undefined : handleHomeClick}
                        title={t('breadcrumb.home')}
                    >
                        <Home size={14} />
                    </div>

                    {!disabled && totalSegments > 0 && (
                        <ChevronRight size={12} className="breadcrumb-separator" />
                    )}
                </>
            )}

            {/* Ellipsis for hidden segments */}
            {!disabled && needsEllipsis && (
                <>
                    <div
                        className="breadcrumb-item breadcrumb-ellipsis"
                        ref={ellipsisRef}
                        onClick={handleEllipsisClick}
                    >
                        <MoreHorizontal size={14} />

                        {showDropdown && (
                            <div className="breadcrumb-dropdown" ref={dropdownRef}>
                                {hiddenSegments.map((item, index) => (
                                    <div
                                        key={index}
                                        className="breadcrumb-dropdown-item"
                                        onClick={() => handleSegmentClick(item)}
                                    >
                                        {item.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <ChevronRight size={12} className="breadcrumb-separator" />
                </>
            )}

            {/* Visible segments */}
            {!disabled && visibleSegments.map((item, index) => (
                <React.Fragment key={item.path}>
                    <div
                        className={`breadcrumb-item ${index === visibleSegments.length - 1 ? 'current' : ''}`}
                        onClick={() => handleSegmentClick(item)}
                        title={item.path}
                    >
                        {item.name}
                    </div>
                    {index < visibleSegments.length - 1 && (
                        <ChevronRight size={12} className="breadcrumb-separator" />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};
