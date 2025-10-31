import { useCallback } from 'react';

function PlaybackControls({ isPlaying, currentTime, totalDuration, onTogglePlayback, onSeek }) {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSliderChange = useCallback((e) => {
        const value = parseFloat(e.target.value);
        const time = (value / 1000) * totalDuration;
        onSeek(time);
    }, [totalDuration, onSeek]);

    const sliderValue = totalDuration > 0 ? (currentTime / totalDuration) * 1000 : 0;

    return (
        <div className="playback-controls active">
            <button className="play-button" onClick={onTogglePlayback}>
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
                />
                <div className="time-display">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                </div>
            </div>
        </div>
    );
}

export default PlaybackControls;
