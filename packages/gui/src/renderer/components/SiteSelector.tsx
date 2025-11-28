import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Loader, ChevronDown } from 'lucide-react';
import './SiteSelector.css';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

interface Site {
    id: string;
    name: string;
    provider?: string;
}

interface SiteSelectorProps {
    sites: Site[];
    selectedSiteId: string | null;
    onSelect: (siteId: string) => void;
    connectionStatus?: ConnectionStatus;
}

export const SiteSelector: React.FC<SiteSelectorProps> = ({
    sites,
    selectedSiteId,
    onSelect,
    connectionStatus = 'idle'
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getStatusIcon = (status: ConnectionStatus) => {
        switch (status) {
            case 'connecting':
                return <Loader size={14} className="status-icon connecting" />;
            case 'connected':
                return <CheckCircle size={14} className="status-icon connected" />;
            case 'failed':
                return <XCircle size={14} className="status-icon failed" />;
            default:
                return null;
        }
    };

    const getSelectedLabel = () => {
        if (!selectedSiteId || selectedSiteId === 'local') {
            return t('siteManager.local');
        }
        const site = sites.find(s => s.id === selectedSiteId);
        return site ? site.name : selectedSiteId;
    };

    const handleSelect = (siteId: string) => {
        onSelect(siteId);
        setIsOpen(false);
    };

    return (
        <div className="site-selector-custom" ref={dropdownRef}>
            <button
                className="site-selector-button"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="site-selector-label">
                    {connectionStatus !== 'idle' && getStatusIcon(connectionStatus)}
                    {getSelectedLabel()}
                </span>
                <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="site-selector-dropdown">
                    <div
                        className={`site-selector-option ${selectedSiteId === 'local' || !selectedSiteId ? 'selected' : ''}`}
                        onClick={() => handleSelect('local')}
                    >
                        <span className="option-label">{t('siteManager.local')}</span>
                    </div>
                    {sites.map(site => (
                        <div
                            key={site.id}
                            className={`site-selector-option ${selectedSiteId === site.id ? 'selected' : ''}`}
                            onClick={() => handleSelect(site.id)}
                        >
                            <span className="option-label">
                                {site.name}{site.provider ? ` (${site.provider})` : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
