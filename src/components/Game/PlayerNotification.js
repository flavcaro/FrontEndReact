import React, { useEffect } from 'react';

export default function PlayerNotification({ message, type, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3500);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className={`player-notification ${type}`}>
            <span className="notification-icon">
                {type === 'join' ? '👋' : '👋'}
            </span>
            <span className="notification-text">{message}</span>
        </div>
    );
}
