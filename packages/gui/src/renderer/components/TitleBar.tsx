import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import './TitleBar.css';

export const TitleBar: React.FC = () => {
    const handleMinimize = () => {
        (window as any).electronAPI.minimizeWindow();
    };

    const handleMaximize = () => {
        (window as any).electronAPI.maximizeWindow();
    };

    const handleClose = () => {
        (window as any).electronAPI.closeWindow();
    };

    return (
        <div className="title-bar">
            <div className="title-bar-drag-region">
                <span className="app-title">CloudZilla</span>
            </div>
            <div className="window-controls">
                <button className="window-control-btn minimize" title="Minimize" onClick={handleMinimize}>
                    <Minus size={14} />
                </button>
                <button className="window-control-btn maximize" title="Maximize" onClick={handleMaximize}>
                    <Square size={12} />
                </button>
                <button className="window-control-btn close" title="Close" onClick={handleClose}>
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};
