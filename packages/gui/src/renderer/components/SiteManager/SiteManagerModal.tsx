import React, { useState, useEffect } from 'react';
import { SiteList } from './SiteList';
import { SiteForm } from './SiteForm';
import { X, Plus } from 'lucide-react';
import './SiteManager.css';
import { useTranslation } from 'react-i18next';

// Site interface for rclone remotes
interface RcloneSite {
    id: string;
    name: string;
    provider: 'google' | 'dropbox' | 'onedrive';
}

interface SiteManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const getProviderDisplayName = (provider: string): string => {
    switch (provider) {
        case 'google': return 'Google Drive';
        case 'dropbox': return 'Dropbox';
        case 'onedrive': return 'OneDrive';
        default: return provider;
    }
};

export const SiteManagerModal: React.FC<SiteManagerModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [sites, setSites] = useState<RcloneSite[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    console.log('[SiteManagerModal] Render - isOpen:', isOpen, 'sites:', sites.length);

    useEffect(() => {
        console.log('[SiteManagerModal] useEffect triggered - isOpen:', isOpen);
        if (isOpen) {
            loadSites();
        }
    }, [isOpen]);

    const loadSites = async () => {
        try {
            console.log('[SiteManager] Loading remotes from rclone...');
            // Use rclone.listRemotes() instead of old getSites()
            const remoteNames: string[] = await (window as any).electronAPI.rclone.listRemotes();
            console.log('[SiteManager] Loaded remotes:', remoteNames);

            // Convert remote names to site objects
            // Try to get provider info from rclone config
            const sitesWithInfo: RcloneSite[] = await Promise.all(
                remoteNames.map(async (name) => {
                    try {
                        const config = await (window as any).electronAPI.rclone.getRemoteConfig(name);
                        const type = config?.type || 'unknown';
                        // Map rclone type to provider
                        const providerMap: { [key: string]: 'google' | 'dropbox' | 'onedrive' } = {
                            'drive': 'google',
                            'dropbox': 'dropbox',
                            'onedrive': 'onedrive'
                        };
                        return {
                            id: name,
                            name: name,
                            provider: providerMap[type] || 'google'
                        };
                    } catch {
                        return { id: name, name: name, provider: 'google' as const };
                    }
                })
            );

            setSites(sitesWithInfo);
        } catch (err) {
            console.error('[SiteManager] Failed to load remotes:', err);
            setSites([]);
        }
    };

    const handleCreate = () => {
        setIsCreating(true);
        setSelectedSiteId(null);
    };

    const handleSave = async () => {
        // Remote is already created by rclone OAuth flow
        // Just refresh the list
        await loadSites();
        setIsCreating(false);
    };

    const handleDelete = async (id: string) => {
        try {
            // Use rclone.deleteRemote() to actually delete from rclone config
            await (window as any).electronAPI.rclone.deleteRemote(id);
            console.log('[SiteManager] Deleted remote:', id);
            await loadSites();
            if (selectedSiteId === id) {
                setSelectedSiteId(null);
            }
        } catch (err) {
            console.error('[SiteManager] Failed to delete remote:', err);
        }
    };

    if (!isOpen) {
        console.log('[SiteManagerModal] Not rendering (isOpen is false)');
        return null;
    }

    const selectedSite = sites.find(s => s.id === selectedSiteId);

    const handleOverlayClick = (e: React.MouseEvent) => {
        console.log('[SiteManagerModal] Overlay clicked', e.target, e.currentTarget, e.target === e.currentTarget);
        // Only close if clicking directly on the overlay (not on the modal content)
        if (e.target === e.currentTarget) {
            console.log('[SiteManagerModal] Closing modal (clicked on overlay)');
            onClose();
        }
    };

    const handleCloseButton = () => {
        console.log('[SiteManagerModal] Close button clicked');
        onClose();
    };

    console.log('[SiteManagerModal] About to render, isOpen:', isOpen);

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content site-manager">
                <div className="site-manager-header">
                    <h2>{t('siteManager.title')}</h2>
                    <button onClick={handleCloseButton} title={t('actions.close')}>
                        <X size={20} />
                    </button>
                </div>
                <div className="site-manager-body">
                    <div className="site-sidebar">
                        <SiteList
                            sites={sites}
                            selectedId={selectedSiteId}
                            onSelect={(id) => {
                                setSelectedSiteId(id);
                                setIsCreating(false);
                            }}
                        />
                        <button className="btn-new-site" onClick={handleCreate}>
                            <Plus size={16} style={{ marginRight: 8 }} />
                            {t('siteManager.addSite')}
                        </button>
                    </div>
                    <div className="site-details">
                        {isCreating ? (
                            <SiteForm
                                onSave={handleSave}
                                onCancel={() => setIsCreating(false)}
                            />
                        ) : selectedSite ? (
                            <div className="site-info">
                                <h3>{t('siteManager.siteDetails')}</h3>
                                <div className="info-row">
                                    <span className="info-label">{t('siteManager.hostName')}:</span>
                                    <span className="info-value">{selectedSite.name}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">{t('siteManager.protocol')}:</span>
                                    <span className="info-value">{getProviderDisplayName(selectedSite.provider)}</span>
                                </div>
                                <div className="form-actions" style={{ marginTop: '24px' }}>
                                    <button
                                        type="button"
                                        className="btn-danger"
                                        onClick={() => handleDelete(selectedSite.id)}
                                    >
                                        {t('actions.delete')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">{t('siteManager.noSites')}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
