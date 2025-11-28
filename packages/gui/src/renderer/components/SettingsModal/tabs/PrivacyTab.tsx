import React from 'react';
import { useTranslation } from 'react-i18next';

// Privacy content per language
const privacyContent = {
    'zh-TW': `
        <div class="privacy-content">
            <div class="privacy-section">
                <h4>資料收集</h4>
                <p>本應用程式不會收集、儲存或傳送任何個人識別資訊至我們的伺服器。所有雲端服務的授權認證資訊僅儲存在您的本機裝置上。</p>
            </div>
            <div class="privacy-section">
                <h4>雲端服務存取</h4>
                <p>當您連接雲端服務時，本應用程式會使用 OAuth 2.0 標準協議取得存取權限。我們僅會存取您明確授權的檔案和資料夾，絕不會存取其他資料。</p>
            </div>
            <div class="privacy-section">
                <h4>本機儲存</h4>
                <p>本應用程式會在您的裝置上儲存以下資訊：</p>
                <ul>
                    <li>雲端服務的授權令牌（加密儲存）</li>
                    <li>應用程式設定偏好</li>
                    <li>最近使用的路徑記錄</li>
                </ul>
            </div>
            <div class="privacy-section">
                <h4>資料傳輸</h4>
                <p>所有檔案傳輸均透過各雲端服務商的官方 API 進行，採用 HTTPS 加密連線。傳輸過程中，檔案資料不會經過我們的伺服器。</p>
            </div>
            <div class="privacy-section">
                <h4>第三方服務</h4>
                <p>本應用程式使用以下第三方服務，各服務有其獨立的隱私政策：</p>
                <ul>
                    <li>Dropbox API</li>
                    <li>Google Drive API</li>
                    <li>Microsoft OneDrive API</li>
                </ul>
            </div>
        </div>
    `,
    'en-US': `
        <div class="privacy-content">
            <div class="privacy-section">
                <h4>Data Collection</h4>
                <p>This application does not collect, store, or transmit any personally identifiable information to our servers. All cloud service authorization credentials are stored only on your local device.</p>
            </div>
            <div class="privacy-section">
                <h4>Cloud Service Access</h4>
                <p>When you connect to cloud services, this application uses the OAuth 2.0 standard protocol to obtain access permissions. We only access files and folders that you explicitly authorize, and never access any other data.</p>
            </div>
            <div class="privacy-section">
                <h4>Local Storage</h4>
                <p>This application stores the following information on your device:</p>
                <ul>
                    <li>Cloud service authorization tokens (encrypted)</li>
                    <li>Application preference settings</li>
                    <li>Recently used path history</li>
                </ul>
            </div>
            <div class="privacy-section">
                <h4>Data Transfer</h4>
                <p>All file transfers are conducted through the official APIs of each cloud service provider using HTTPS encrypted connections. During transfer, file data does not pass through our servers.</p>
            </div>
            <div class="privacy-section">
                <h4>Third-Party Services</h4>
                <p>This application uses the following third-party services, each with its own privacy policy:</p>
                <ul>
                    <li>Dropbox API</li>
                    <li>Google Drive API</li>
                    <li>Microsoft OneDrive API</li>
                </ul>
            </div>
        </div>
    `
};

export const PrivacyTab: React.FC = () => {
    const { t, i18n } = useTranslation();

    // Select content based on current language
    const htmlContent = privacyContent[i18n.language as keyof typeof privacyContent] || privacyContent['en-US'];

    return (
        <div className="settings-tab">
            <h3 className="settings-section-title">{t('settings.privacy.title')}</h3>
            <div
                className="html-content-container"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        </div>
    );
};
