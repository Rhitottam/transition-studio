import { useCallback } from 'react';

function PlaybackControls({ isPlaying, currentTime, totalDuration, onTogglePlayback, onSeek, disabled = false }) {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSliderChange = useCallback((e) => {
        if (disabled) return;
        const value = parseFloat(e.target.value);
        const time = (value / 1000) * totalDuration;
        onSeek(time);
    }, [totalDuration, onSeek, disabled]);

    const handlePlaybackToggle = useCallback(() => {
        if (disabled) return;
        onTogglePlayback();
    }, [onTogglePlayback, disabled]);

    const sliderValue = totalDuration > 0 ? (currentTime / totalDuration) * 1000 : 0;

    return (
        <div className="playback-controls active">
            <button 
                className="play-button" 
                onClick={handlePlaybackToggle}
                disabled={disabled}
                style={{
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
            >
                {isPlaying ? '⏸' : '▶'}
            </button>
            <div className="timeline-container">
                <input
                    type="range"
                    className="timeline-slider"
                    min="0"
                    max="1000"
                    value={sliderValue}
                    onChange={handleSliderChange}
                    disabled={disabled}
                    style={{
                        opacity: disabled ? 0.5 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer'
                    }}
                />
                <div className="time-display">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                </div>
            </div>
        </div>
    );
}

export default PlaybackControls;
