import React from 'react';

interface Site {
    id: string;
    name: string;
    provider?: string;
}

interface SiteListProps {
    sites: Site[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const SiteList: React.FC<SiteListProps> = ({ sites, selectedId, onSelect }) => {
    return (
        <div className="site-list-container">
            {sites.map(site => (
                <div
                    key={site.id}
                    className={`site-list-item ${selectedId === site.id ? 'selected' : ''}`}
                    onClick={() => onSelect(site.id)}
                >
                    <span className="site-icon">☁️</span>
                    <span className="site-name">{site.name}</span>
                </div>
            ))}
        </div>
    );
};
