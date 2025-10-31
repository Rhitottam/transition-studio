import { getTransitionGradient } from '../utils/transitionColors';

function Timeline({ clips, transitions, totalDuration }) {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (clips.length === 0 || totalDuration === 0) {
        return null;
    }

    const elements = [];

    // Add start transition if exists
    const startTransition = transitions.find(t => t.position === 'start');
    if (startTransition) {
        const width = (startTransition.duration / totalDuration) * 100;
        elements.push(
            <div
                key="start-transition"
                className="timeline-transition"
                style={{
                    width: `${width}%`,
                    background: getTransitionGradient(startTransition.type)
                }}
            >
                START
            </div>
        );
    }

    // Add clips and between transitions
    clips.forEach((clip, index) => {
        const width = (clip.duration / totalDuration) * 100;
        elements.push(
            <div
                key={`clip-${clip.id}`}
                className="timeline-clip"
                style={{ width: `${width}%` }}
            >
                <span>{clip.name.substring(0, 20)}</span>
                <span>{formatTime(clip.duration)}</span>
            </div>
        );

        // Add between transition if exists
        if (index < clips.length - 1) {
            const transition = transitions.find(t =>
                t.position === 'between' && t.afterClipIndex === index
            );

            if (transition) {
                const transitionWidth = (transition.duration / totalDuration) * 100;
                elements.push(
                    <div
                        key={`transition-${index}`}
                        className="timeline-transition"
                        style={{
                            width: `${transitionWidth}%`,
                            background: getTransitionGradient(transition.type)
                        }}
                        title={`${transition.type} transition`}
                    >
                        T
                    </div>
                );
            }
        }
    });

    // Add end transition if exists
    const endTransition = transitions.find(t => t.position === 'end');
    if (endTransition) {
        const width = (endTransition.duration / totalDuration) * 100;
        elements.push(
            <div
                key="end-transition"
                className="timeline-transition"
                style={{
                    width: `${width}%`,
                    background: getTransitionGradient(endTransition.type)
                }}
            >
                END
            </div>
        );
    }

    return (
        <div className="timeline-view active">
            <h4>Timeline</h4>
            <div className="timeline-tracks">
                {elements}
            </div>
        </div>
    );
}

export default Timeline;
