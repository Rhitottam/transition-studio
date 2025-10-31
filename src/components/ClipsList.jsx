import { useEffect, useRef } from 'react';

function ClipsList({ clips, onRemoveClip, onMoveClip }) {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (clips.length === 0) {
        return (
            <div className="control-group">
                <label>Video Clips</label>
                <div className="video-clips-list">
                    <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                        No videos uploaded yet
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="control-group">
            <label>Video Clips</label>
            <div className="video-clips-list">
                {clips.map((clip, index) => (
                    <ClipItem
                        key={clip.id}
                        clip={clip}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === clips.length - 1}
                        onMoveUp={() => onMoveClip(index, index - 1)}
                        onMoveDown={() => onMoveClip(index, index + 1)}
                        onRemove={() => onRemoveClip(clip.id)}
                        formatTime={formatTime}
                    />
                ))}
            </div>
        </div>
    );
}

function ClipItem({ clip, index, isFirst, isLast, onMoveUp, onMoveDown, onRemove, formatTime }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current && clip.video.readyState >= 2) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // Wait a bit for video to be ready
            setTimeout(() => {
                try {
                    ctx.drawImage(clip.video, 0, 0, 60, 40);
                } catch (e) {
                    console.error('Error drawing thumbnail:', e);
                }
            }, 200);
        }
    }, [clip]);

    return (
        <div className="clip-item">
            <canvas ref={canvasRef} className="clip-thumbnail" width="60" height="40"></canvas>
            <div className="clip-info">
                <div className="clip-name">{clip.name}</div>
                <div className="clip-duration">{formatTime(clip.duration)}</div>
            </div>
            <div className="clip-actions">
                <button onClick={onMoveUp} disabled={isFirst}>↑</button>
                <button onClick={onMoveDown} disabled={isLast}>↓</button>
                <button className="delete" onClick={onRemove}>✕</button>
            </div>
        </div>
    );
}

export default ClipsList;
