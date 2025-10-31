import { useState, useEffect, useRef, useCallback } from 'react';
import VideoUpload from './components/VideoUpload';
import VideoPreview from './components/VideoPreview';
import ControlsPanel from './components/ControlsPanel';
import ClipsList from './components/ClipsList';
import Timeline from './components/Timeline';
import PlaybackControls from './components/PlaybackControls';
import './App.css';

function App() {
    const [clips, setClips] = useState([]);
    const [transitions, setTransitions] = useState([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [selectedTransition, setSelectedTransition] = useState('fade');
    const [transitionDuration, setTransitionDuration] = useState(1);
    const [transitionPosition, setTransitionPosition] = useState('between');
    const [fps, setFps] = useState(0);

    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(0);

    // Calculate total duration whenever clips or transitions change
    useEffect(() => {
        calculateTotalDuration();
    }, [clips, transitions]);

    const calculateTotalDuration = () => {
        let total = 0;

        // Start transition overlaps with first clip, no extra time added
        const startTransition = transitions.find(t => t.position === 'start');

        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            total += clip.duration;

            // Between transitions overlap the end of current clip and start of next clip
            // So we subtract the transition duration (overlap time)
            if (i < clips.length - 1) {
                const transition = transitions.find(t =>
                    t.position === 'between' && t.afterClipIndex === i
                );
                if (transition) {
                    // Subtract overlap duration (videos play simultaneously during transition)
                    total -= Math.min(transition.duration, clip.duration, clips[i + 1].duration);
                }
            }
        }

        // End transition overlaps with last clip, no extra time added
        const endTransition = transitions.find(t => t.position === 'end');

        setTotalDuration(total);
    };

    const addClips = useCallback(async (files) => {
        const newClips = [];

        for (const file of files) {
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';

            const objectUrl = URL.createObjectURL(file);
            video.src = objectUrl;

            await new Promise((resolve, reject) => {
                video.addEventListener('loadedmetadata', () => {
                    const clip = {
                        id: Date.now() + Math.random(),
                        video: video,
                        name: file.name,
                        duration: video.duration,
                        startTime: 0,
                        width: video.videoWidth,
                        height: video.videoHeight,
                        objectUrl: objectUrl
                    };

                    newClips.push(clip);
                    resolve();
                });

                video.addEventListener('error', (e) => {
                    reject(new Error(`Failed to load: ${file.name}`));
                });

                setTimeout(() => reject(new Error(`Timeout loading: ${file.name}`)), 15000);
            });
        }

        setClips(prevClips => [...prevClips, ...newClips]);
    }, []);

    const removeClip = useCallback((clipId) => {
        setClips(prevClips => {
            const clip = prevClips.find(c => c.id === clipId);
            if (clip) {
                URL.revokeObjectURL(clip.objectUrl);
                clip.video.remove();
            }
            return prevClips.filter(c => c.id !== clipId);
        });

        // Clean up transitions
        setTransitions(prevTransitions =>
            prevTransitions.filter(t => t.position !== 'between' || t.afterClipIndex < clips.length - 1)
        );
    }, [clips.length]);

    const moveClip = useCallback((fromIndex, toIndex) => {
        setClips(prevClips => {
            const newClips = [...prevClips];
            const [movedClip] = newClips.splice(fromIndex, 1);
            newClips.splice(toIndex, 0, movedClip);
            return newClips;
        });
    }, []);

    const applyTransition = useCallback(() => {
        if (selectedTransition === 'none') {
            setTransitions([]);
        } else if (transitionPosition === 'between') {
            // Apply to all clip pairs
            setTransitions(prevTransitions => {
                const filtered = prevTransitions.filter(t => t.position !== 'between');

                const newTransitions = [];
                for (let i = 0; i < clips.length - 1; i++) {
                    newTransitions.push({
                        type: selectedTransition,
                        duration: transitionDuration,
                        position: 'between',
                        afterClipIndex: i
                    });
                }

                return [...filtered, ...newTransitions];
            });
        } else if (transitionPosition.startsWith('pair-')) {
            // Apply to specific clip pair
            const pairIndex = parseInt(transitionPosition.split('-')[1]);
            setTransitions(prevTransitions => {
                // Remove existing transition for this pair
                const filtered = prevTransitions.filter(t =>
                    !(t.position === 'between' && t.afterClipIndex === pairIndex)
                );

                return [
                    ...filtered,
                    {
                        type: selectedTransition,
                        duration: transitionDuration,
                        position: 'between',
                        afterClipIndex: pairIndex
                    }
                ];
            });
        } else {
            // Apply to start or end
            setTransitions(prevTransitions => {
                const filtered = prevTransitions.filter(t => t.position !== transitionPosition);
                return [
                    ...filtered,
                    {
                        type: selectedTransition,
                        duration: transitionDuration,
                        position: transitionPosition
                    }
                ];
            });
        }

        // Force preview update by triggering a re-render at current time
        setCurrentTime(prev => prev);
    }, [selectedTransition, transitionDuration, transitionPosition, clips.length, setCurrentTime]);

    const getCurrentState = useCallback((time) => {
        if (clips.length === 0) return null;

        let clipStartTime = 0;

        // Handle start transition (overlaps with first clip start)
        const startTransition = transitions.find(t => t.position === 'start');
        if (startTransition) {
            const transitionDuration = Math.min(startTransition.duration, clips[0].duration);
            if (time < transitionDuration) {
                const progress = time / transitionDuration;
                return {
                    mode: 'transition',
                    transition: startTransition,
                    clip1: null,
                    clip2: clips[0],
                    progress: progress,
                    clip2Time: time
                };
            }
        }

        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const clipEndTime = clipStartTime + clip.duration;

            // Check for transition to next clip
            if (i < clips.length - 1) {
                const transition = transitions.find(t =>
                    t.position === 'between' && t.afterClipIndex === i
                );

                if (transition) {
                    const overlap = Math.min(transition.duration, clip.duration, clips[i + 1].duration);
                    const transitionStartTime = clipEndTime - overlap;

                    // Are we in the transition zone?
                    if (time >= transitionStartTime && time < clipEndTime) {
                        const transitionTime = time - transitionStartTime;
                        const progress = transitionTime / overlap;

                        return {
                            mode: 'transition',
                            transition: transition,
                            clip1: clip,
                            clip2: clips[i + 1],
                            progress: progress,
                            clip1Time: clip.duration - overlap + transitionTime,
                            clip2Time: transitionTime
                        };
                    }
                }
            }

            // Regular clip playback (not in transition)
            if (time >= clipStartTime && time < clipEndTime) {
                const clipTime = time - clipStartTime;

                // Check if we're in end transition zone
                const endTransition = transitions.find(t => t.position === 'end');
                if (i === clips.length - 1 && endTransition) {
                    const overlap = Math.min(endTransition.duration, clip.duration);
                    const transitionStartTime = clipEndTime - overlap;

                    if (time >= transitionStartTime) {
                        const transitionTime = time - transitionStartTime;
                        const progress = transitionTime / overlap;

                        return {
                            mode: 'transition',
                            transition: endTransition,
                            clip1: clip,
                            clip2: null,
                            progress: progress,
                            clip1Time: clip.duration - overlap + transitionTime
                        };
                    }
                }

                return {
                    mode: 'clip',
                    clip: clip,
                    clipTime: Math.min(clipTime, clip.duration - 0.01)
                };
            }

            // Move to next clip (subtract overlap if there's a transition)
            const nextTransition = transitions.find(t =>
                t.position === 'between' && t.afterClipIndex === i
            );
            if (nextTransition) {
                const overlap = Math.min(nextTransition.duration, clip.duration, clips[i + 1]?.duration || 0);
                clipStartTime = clipEndTime - overlap;
            } else {
                clipStartTime = clipEndTime;
            }
        }

        // Fallback: show last clip at end
        return {
            mode: 'clip',
            clip: clips[clips.length - 1],
            clipTime: clips[clips.length - 1].duration - 0.01
        };
    }, [clips, transitions]);

    const togglePlayback = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const seekTo = useCallback((time) => {
        setCurrentTime(Math.min(Math.max(0, time), totalDuration));
    }, [totalDuration]);

    return (
        <div className="app">
            <div className="main-container">
                {/* Left side - Video section */}
                <div className="left-section">
                    {clips.length === 0 ? (
                        <VideoUpload onFilesSelected={addClips} />
                    ) : (
                        <>
                            <VideoPreview
                                clips={clips}
                                currentTime={currentTime}
                                getCurrentState={getCurrentState}
                                isPlaying={isPlaying}
                                setIsPlaying={setIsPlaying}
                                setCurrentTime={setCurrentTime}
                                totalDuration={totalDuration}
                                startTimeRef={startTimeRef}
                                animationFrameRef={animationFrameRef}
                                fps={fps}
                                setFps={setFps}
                            />

                            <PlaybackControls
                                isPlaying={isPlaying}
                                currentTime={currentTime}
                                totalDuration={totalDuration}
                                onTogglePlayback={togglePlayback}
                                onSeek={seekTo}
                            />

                            <Timeline
                                clips={clips}
                                transitions={transitions}
                                totalDuration={totalDuration}
                            />

                            <button
                                className="btn btn-secondary"
                                onClick={() => document.getElementById('video-input-hidden')?.click()}
                            >
                                Add More Videos
                            </button>
                            <input
                                id="video-input-hidden"
                                type="file"
                                accept="video/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    if (e.target.files) {
                                        addClips(Array.from(e.target.files));
                                        e.target.value = '';
                                    }
                                }}
                            />

                            {isExporting && (
                                <div className="progress-container">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${exportProgress}%` }}></div>
                                        <div className="progress-text">Exporting: {Math.round(exportProgress)}%</div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right sidebar - Clips and controls */}
                <div className="right-sidebar">
                    <ClipsList
                        clips={clips}
                        onRemoveClip={removeClip}
                        onMoveClip={moveClip}
                    />

                    <ControlsPanel
                        selectedTransition={selectedTransition}
                        transitionDuration={transitionDuration}
                        transitionPosition={transitionPosition}
                        onTransitionChange={setSelectedTransition}
                        onDurationChange={setTransitionDuration}
                        onPositionChange={setTransitionPosition}
                        onApplyTransition={applyTransition}
                        onExport={(exportFn) => {
                            setIsExporting(true);
                            setExportProgress(0);
                            exportFn(
                                clips,
                                transitions,
                                totalDuration,
                                getCurrentState,
                                (progress) => setExportProgress(progress),
                                () => {
                                    setIsExporting(false);
                                    setExportProgress(0);
                                }
                            );
                        }}
                        disabled={clips.length === 0}
                        clips={clips}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
