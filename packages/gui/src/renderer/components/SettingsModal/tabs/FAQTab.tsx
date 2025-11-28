import React from 'react';
import { useTranslation } from 'react-i18next';

// FAQ content per language
const faqContent = {
    'zh-TW': `
        <div class="faq-list">
            <div class="faq-item">
                <p class="faq-question">Q: 如何新增雲端儲存服務？</p>
                <p class="faq-answer">A: 點擊左側面板的「新增雲端」按鈕，選擇您要連接的雲端服務（Dropbox、Google Drive 或 OneDrive），然後按照授權流程完成設定。</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: 如何在不同雲端之間傳輸檔案？</p>
                <p class="faq-answer">A: 選擇來源雲端中的檔案或資料夾，然後拖曳到目標雲端面板，或使用右鍵選單中的「複製到」功能。傳輸進度會顯示在底部狀態列。</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: 傳輸中斷怎麼辦？</p>
                <p class="faq-answer">A: 若啟用「自動重試」功能，程式會自動嘗試重新傳輸。您也可以在狀態面板中手動重試失敗的傳輸任務。</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: 如何限制傳輸頻寬？</p>
                <p class="faq-answer">A: 在「網路」設定頁面中，您可以設定頻寬限制（KB/s）。設為 0 表示不限制頻寬。</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: 支援哪些雲端服務？</p>
                <p class="faq-answer">A: 目前支援 Dropbox、Google Drive 和 OneDrive。我們計劃在未來版本中加入更多雲端服務的支援。</p>
            </div>
        </div>
    `,
    'en-US': `
        <div class="faq-list">
            <div class="faq-item">
                <p class="faq-question">Q: How do I add a cloud storage service?</p>
                <p class="faq-answer">A: Click the "Add Cloud" button in the left panel, select the cloud service you want to connect (Dropbox, Google Drive, or OneDrive), then follow the authorization process to complete setup.</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: How do I transfer files between different clouds?</p>
                <p class="faq-answer">A: Select files or folders in the source cloud, then drag them to the target cloud panel, or use the "Copy to" option in the context menu. Transfer progress is shown in the status bar at the bottom.</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: What if a transfer is interrupted?</p>
                <p class="faq-answer">A: If "Auto Retry" is enabled, the app will automatically attempt to resume the transfer. You can also manually retry failed transfers from the status panel.</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: How do I limit transfer bandwidth?</p>
                <p class="faq-answer">A: In the "Network" settings page, you can set a bandwidth limit (KB/s). Set it to 0 for unlimited bandwidth.</p>
            </div>
            <div class="faq-item">
                <p class="faq-question">Q: Which cloud services are supported?</p>
                <p class="faq-answer">A: Currently, Dropbox, Google Drive, and OneDrive are supported. We plan to add support for more cloud services in future versions.</p>
            </div>
        </div>
    `
};

export const FAQTab: React.FC = () => {
    const { t, i18n } = useTranslation();

    // Select content based on current language
    const htmlContent = faqContent[i18n.language as keyof typeof faqContent] || faqContent['en-US'];

    return (
        <div className="settings-tab">
            <h3 className="settings-section-title">{t('settings.faq.title')}</h3>
            <div
                className="html-content-container"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        </div>
    );
};
