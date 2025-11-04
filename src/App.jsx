import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import ClipsList from './components/ClipsList';
import ControlsPanel from './components/ControlsPanel';
import PlaybackControls from './components/PlaybackControls';
import Timeline from './components/Timeline';
import VideoPreview from './components/VideoPreview';
import VideoUpload from './components/VideoUpload';

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
    const [isLoadingVideos, setIsLoadingVideos] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(0);

    // Calculate total duration whenever clips or transitions change
    useEffect(() => {
        calculateTotalDuration();
    }, [clips, transitions]);

    const calculateTotalDuration = () => {
        // New model: Total duration is simply the sum of all clip durations
        // Transitions don't affect total duration, they just span the clip boundaries
        let total = 0;
        
        for (let i = 0; i < clips.length; i++) {
            total += clips[i].duration;
        }

        setTotalDuration(total);
    };

    const addClips = useCallback(async (files) => {
        setIsLoadingVideos(true);
        setLoadingProgress({ current: 0, total: files.length });
        const newClips = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setLoadingProgress({ current: i, total: files.length });

                const video = document.createElement('video');
                video.preload = 'auto'; // Critical: load entire video
                video.muted = true;
                video.playsInline = true; // Critical for iOS
                video.crossOrigin = 'anonymous';
                
                // Mobile fix: Attach video to DOM (hidden) for better frame access
                video.style.opacity = '0';
                video.style.display = 'none';
                video.style.pointerEvents = 'none';
                document.body.appendChild(video);

                const objectUrl = URL.createObjectURL(file);
                video.src = objectUrl;

                // Wait for video to be fully loaded and buffered
                await new Promise((resolve, reject) => {
                    let resolved = false;
                    const timeoutDuration = 60000; // 60 seconds for large videos

                    const onCanPlayThrough = () => {
                        if (resolved) return;
                        
                        // Video is fully buffered and can play through without stopping
                        const clip = {
                            id: Date.now() + Math.random(),
                            video: video,
                            name: file.name,
                            duration: video.duration,
                            startTime: 0,
                            width: video.videoWidth,
                            height: video.videoHeight,
                            objectUrl: objectUrl,
                            loaded: true
                        };

                        newClips.push(clip);
                        resolved = true;
                        resolve();
                    };

                    const onError = (e) => {
                        if (resolved) return;
                        resolved = true;
                        console.error('Video load error:', e);
                        reject(new Error(`Failed to load: ${file.name}`));
                    };

                    const onTimeout = () => {
                        if (resolved) return;
                        resolved = true;
                        reject(new Error(`Timeout loading: ${file.name} - Video may be too large or slow network`));
                    };

                    // Listen for canplaythrough event - video is fully buffered
                    video.addEventListener('canplay', onCanPlayThrough);
                    video.addEventListener('error', onError);
                    const timeoutId = setTimeout(onTimeout, timeoutDuration);

                    // Cleanup function
                    const cleanup = () => {
                        clearTimeout(timeoutId);
                        video.removeEventListener('canplay', onCanPlayThrough);
                        video.removeEventListener('error', onError);
                    };

                    // Ensure cleanup happens
                    Promise.race([
                        new Promise(res => {
                            const handler = () => {
                                cleanup();
                                res();
                            };
                            video.addEventListener('canplay', handler, { once: true });
                        }),
                        new Promise((_, rej) => setTimeout(() => {
                            cleanup();
                            rej(new Error('timeout'));
                        }, timeoutDuration))
                    ]).catch(() => {});
                });

                // Preload first frame for immediate display
                video.currentTime = 0.1;
                video.play();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            setClips(prevClips => [...prevClips, ...newClips]);
            setLoadingProgress({ current: files.length, total: files.length });
        } catch (error) {
            console.error('Error loading videos:', error);
            alert(error.message);
        } finally {
            setIsLoadingVideos(false);
        }
    }, []);

    const removeClip = useCallback((clipId) => {
        setClips(prevClips => {
            const clip = prevClips.find(c => c.id === clipId);
            if (clip) {
                URL.revokeObjectURL(clip.objectUrl);
                // Remove from DOM if attached
                if (clip.video.parentNode) {
                    clip.video.parentNode.removeChild(clip.video);
                }
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

        // Calculate cumulative clip start times (no overlaps now!)
        let clipStartTime = 0;

        // Handle start transition (centered at clip boundary = time 0)
        const startTransition = transitions.find(t => t.position === 'start');
        if (startTransition) {
            const d = Math.min(startTransition.duration, clips[0].duration);
            const transitionStart = 0; // Starts at beginning
            const transitionEnd = d; // Ends at d
            
            if (time >= transitionStart && time < transitionEnd) {
                const progress = time / d;
                return {
                    mode: 'transition',
                    transition: startTransition,
                    clip1: null,
                    clip2: clips[0],
                    progress: progress,
                    clip2Time: time // Clip2 plays through transition
                };
            }
        }

        // Iterate through clips
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const clipEndTime = clipStartTime + clip.duration;

            // Check for between transition (centered at clip boundary)
            if (i < clips.length - 1) {
                const transition = transitions.find(t =>
                    t.position === 'between' && t.afterClipIndex === i
                );

                if (transition) {
                    const d = Math.min(transition.duration, clip.duration, clips[i + 1].duration);
                    const boundary = clipEndTime; // The exact boundary between clips
                    const transitionStart = boundary - d / 2;
                    const transitionEnd = boundary + d / 2;

                    // Are we in the transition zone?
                    if (time >= transitionStart && time < transitionEnd) {
                        const transitionTime = time - transitionStart; // 0 to d
                        const progress = transitionTime / d;

                        // First half: clip1 plays its last d/2 seconds, clip2 shows first frame
                        // Second half: clip1 shows last frame, clip2 plays its first d/2 seconds
                        if (time < boundary) {
                            // First half of transition
                            return {
                                mode: 'transition',
                                transition: transition,
                                clip1: clip,
                                clip2: clips[i + 1],
                                progress: progress,
                                clip1Time: clip.duration - d / 2 + transitionTime, // Plays from (duration - d/2) to duration
                                clip2Time: 0 // Shows first frame
                            };
                        } else {
                            // Second half of transition
                            return {
                                mode: 'transition',
                                transition: transition,
                                clip1: clip,
                                clip2: clips[i + 1],
                                progress: progress,
                                clip1Time: clip.duration, // Shows last frame
                                clip2Time: transitionTime - d / 2 // Plays from 0 to d/2
                            };
                        }
                    }
                }
            }

            // Check for end transition (centered at end boundary)
            const endTransition = transitions.find(t => t.position === 'end');
            if (i === clips.length - 1 && endTransition) {
                const d = Math.min(endTransition.duration, clip.duration);
                const boundary = clipEndTime;
                const transitionStart = boundary - d / 2;
                const transitionEnd = boundary + d / 2;

                if (time >= transitionStart && time < transitionEnd) {
                    const transitionTime = time - transitionStart;
                    const progress = transitionTime / d;

                    if (time < boundary) {
                        // Clip1 plays its last d/2 seconds
                        return {
                            mode: 'transition',
                            transition: endTransition,
                            clip1: clip,
                            clip2: null,
                            progress: progress,
                            clip1Time: clip.duration - d / 2 + transitionTime
                        };
                    } else {
                        // Clip1 shows last frame
                        return {
                            mode: 'transition',
                            transition: endTransition,
                            clip1: clip,
                            clip2: null,
                            progress: progress,
                            clip1Time: clip.duration,
                        };
                    }
                }
            }

            // Regular clip playback (not in transition)
            if (time >= clipStartTime && time < clipEndTime) {
                const clipTime = time - clipStartTime;
                return {
                    mode: 'clip',
                    clip: clip,
                    clipTime: Math.min(clipTime, clip.duration - 0.01)
                };
            }

            // Move to next clip (no overlap subtraction!)
            clipStartTime = clipEndTime;
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
        setIsPlaying(false);
        setCurrentTime(Math.min(Math.max(0, time), totalDuration));
        if(isPlaying) {
            setTimeout(() => {
                setIsPlaying(true);
            }, 1);
        }
    }, [totalDuration, isPlaying]);

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
                                isLoadingVideos={isLoadingVideos}
                                loadingProgress={loadingProgress}
                            />

                            <PlaybackControls
                                isPlaying={isPlaying}
                                currentTime={currentTime}
                                totalDuration={totalDuration}
                                onTogglePlayback={togglePlayback}
                                onSeek={seekTo}
                                disabled={isLoadingVideos}
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
                        clips={clips}
                        transitions={transitions}
                        onExport={(exportFn) => {
                            setIsExporting(true);
                            setExportProgress(0);
                            exportFn(
                                clips,
                                transitions,
                                totalDuration,
                                getCurrentState,
                                (progress) => {
                                    setExportProgress(progress);
                                },
                                () => {
                                    setIsExporting(false);
                                    setExportProgress(0);
                                }
                            );
                        }}
                        disabled={clips.length === 0}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
