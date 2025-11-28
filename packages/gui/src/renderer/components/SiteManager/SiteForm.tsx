import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Provider = 'google' | 'dropbox' | 'onedrive';

interface SiteFormProps {
    onSave: (name: string, provider: Provider) => void;
    onCancel: () => void;
}

type OAuthStatus = 'idle' | 'starting' | 'waiting' | 'completing' | 'success' | 'error';

export const SiteForm: React.FC<SiteFormProps> = ({ onSave, onCancel }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [provider, setProvider] = useState<Provider>('google');
    const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>('idle');
    const [oauthError, setOAuthError] = useState<string>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleRcloneOAuth();
    };

    const handleRcloneOAuth = async () => {
        if (!name.trim()) {
            setOAuthError(t('siteManager.enterName'));
            return;
        }

        setOAuthStatus('starting');
        setOAuthError('');

        try {
            // Map provider to rclone type
            const rcloneType = {
                'google': 'drive',
                'dropbox': 'dropbox',
                'onedrive': 'onedrive'
            }[provider] || 'drive';

            console.log(`[SiteForm] Starting OAuth for ${name} (${rcloneType})`);

            // Start OAuth flow
            const startResult = await (window as any).electronAPI.rclone.startOAuth(rcloneType, name);

            if (!startResult.success) {
                throw new Error(startResult.error || 'Failed to start OAuth');
            }

            console.log('[SiteForm] OAuth started, browser should open automatically');
            setOAuthStatus('waiting');

            // Wait for OAuth to complete
            const completeResult = await (window as any).electronAPI.rclone.completeOAuth(name);

            if (completeResult.success) {
                console.log('[SiteForm] OAuth completed successfully');
                setOAuthStatus('success');

                // Save the remote to site manager
                onSave(name, provider);

                // Reset form after short delay
                setTimeout(() => {
                    setOAuthStatus('idle');
                    onCancel();
                }, 1500);
            } else {
                throw new Error(completeResult.error || 'OAuth completion failed');
            }
        } catch (err) {
            console.error('[SiteForm] OAuth failed:', err);
            setOAuthStatus('error');
            setOAuthError((err as Error).message);
        }
    };

    const handleCancelOAuth = async () => {
        await (window as any).electronAPI.rclone.cancelOAuth();
        setOAuthStatus('idle');
        setOAuthError('');
    };

    const getOAuthStatusMessage = () => {
        switch (oauthStatus) {
            case 'starting':
                return t('siteManager.oauthStarting');
            case 'waiting':
                return t('siteManager.oauthWaiting');
            case 'completing':
                return t('siteManager.oauthCompleting');
            case 'success':
                return t('siteManager.oauthSuccess');
            case 'error':
                return t('siteManager.oauthError', { error: oauthError });
            default:
                return '';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="site-form">
            <h3>{t('siteManager.newSite')}</h3>

            <div className="form-group">
                <label>{t('siteManager.protocol')}:</label>
                <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as Provider)}
                    disabled={oauthStatus !== 'idle'}
                >
                    <option value="google">Google Drive</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="onedrive">OneDrive</option>
                </select>
            </div>

            <div className="form-group">
                <label>{t('siteManager.hostName')}:</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={oauthStatus !== 'idle'}
                />
            </div>

            {oauthStatus !== 'idle' && (
                <div className={`oauth-status oauth-status-${oauthStatus}`} style={{
                    padding: '12px',
                    marginBottom: '16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: oauthStatus === 'error'
                        ? 'rgba(255, 93, 108, 0.1)'
                        : oauthStatus === 'success'
                        ? 'rgba(46, 213, 115, 0.1)'
                        : 'rgba(87, 101, 242, 0.1)',
                    border: `1px solid ${oauthStatus === 'error'
                        ? 'var(--color-danger)'
                        : oauthStatus === 'success'
                        ? '#2ed573'
                        : 'var(--color-primary)'}`,
                    color: 'var(--color-fg)'
                }}>
                    {getOAuthStatusMessage()}
                </div>
            )}

            <div className="form-actions">
                {oauthStatus === 'idle' && (
                    <>
                        <button type="submit" className="btn-primary">
                            {t('siteManager.connect')}
                        </button>
                        <button type="button" onClick={onCancel}>{t('actions.cancel')}</button>
                    </>
                )}
                {(oauthStatus === 'starting' || oauthStatus === 'waiting' || oauthStatus === 'completing') && (
                    <button type="button" onClick={handleCancelOAuth} className="btn-danger">
                        {t('siteManager.cancelOAuth')}
                    </button>
                )}
                {oauthStatus === 'error' && (
                    <>
                        <button type="button" onClick={() => setOAuthStatus('idle')} className="btn-primary">
                            {t('siteManager.tryAgain')}
                        </button>
                        <button type="button" onClick={onCancel}>{t('actions.cancel')}</button>
                    </>
                )}
            </div>
        </form>
    );
};
