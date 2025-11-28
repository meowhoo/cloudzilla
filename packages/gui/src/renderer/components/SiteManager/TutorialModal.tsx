import React from 'react';
import './SiteManager.css';

interface TutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider: 'google' | 'dropbox' | 'onedrive';
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, provider }) => {
    if (!isOpen) return null;

    const getTutorialContent = () => {
        switch (provider) {
            case 'google':
                return (
                    <div>
                        <h3>How to get Google Drive Credentials</h3>
                        <ol>
                            <li>Go to the <a href="#" onClick={() => (window as any).open('https://console.cloud.google.com/')}>Google Cloud Console</a>.</li>
                            <li>Create a new project.</li>
                            <li>Enable the <strong>Google Drive API</strong>.</li>
                            <li>Go to <strong>Credentials</strong> and create an <strong>OAuth Client ID</strong>.</li>
                            <li>Choose "Desktop App".</li>
                            <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.</li>
                        </ol>
                        <div className="tutorial-placeholder-image">
                            [Screenshot Placeholder: Google Cloud Console Credentials Screen]
                        </div>
                    </div>
                );
            case 'dropbox':
                return (
                    <div>
                        <h3>How to get Dropbox Credentials</h3>
                        <ol>
                            <li>Go to the <a href="#" onClick={() => (window as any).open('https://www.dropbox.com/developers/apps')}>Dropbox App Console</a>.</li>
                            <li>Click "Create App".</li>
                            <li>Choose "Scoped Access" and "Full Dropbox".</li>
                            <li>Go to the Settings tab.</li>
                            <li>Copy the <strong>App key</strong> (Client ID) and <strong>App secret</strong> (Client Secret).</li>
                        </ol>
                    </div>
                );
            case 'onedrive':
                return (
                    <div>
                        <h3>How to get OneDrive Credentials</h3>
                        <ol>
                            <li>Go to the <a href="#" onClick={() => (window as any).open('https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade')}>Azure Portal</a>.</li>
                            <li>Register a new application.</li>
                            <li>Copy the <strong>Application (client) ID</strong>.</li>
                            <li>Go to "Certificates & secrets" and create a new client secret.</li>
                            <li>Copy the <strong>Value</strong> of the secret.</li>
                        </ol>
                    </div>
                );
            default:
                return <div>Select a provider to see instructions.</div>;
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content tutorial-modal">
                <div className="site-manager-header">
                    <h2>{provider.charAt(0).toUpperCase() + provider.slice(1)} Setup Guide</h2>
                    <button onClick={onClose}>Close</button>
                </div>
                <div className="site-manager-body" style={{ padding: '20px', overflowY: 'auto' }}>
                    {getTutorialContent()}
                </div>
            </div>
        </div>
    );
};
