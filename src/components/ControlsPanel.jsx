import { useCallback, useState } from 'react';
import { ThreeRenderer } from '../utils/three-renderer';
import { getTransitionColor } from '../utils/transitionColors';

function ControlsPanel({
    selectedTransition,
    transitionDuration,
    transitionPosition,
    onTransitionChange,
    onDurationChange,
    onPositionChange,
    onApplyTransition,
    onExport,
    disabled,
    clips,
    transitions
}) {
    const [transitionDescription, setTransitionDescription] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportTransitionOnly, setExportTransitionOnly] = useState(false);
    const [selectedTransitionIndex, setSelectedTransitionIndex] = useState(0);

    const transitionDescriptions = {
        'none': '',
        'fade': 'Simple opacity crossfade',
        'dissolve': 'Random dissolve with noise',
        'blur-transition': 'Smooth blur crossfade',
        'glitch': 'Digital glitch effect with RGB split',
        'ripple': 'Water ripple distortion',
        'swirl': 'Spiral swirl effect',
        'kaleidoscope': 'Kaleidoscope mirror effect',
        'dreamy': 'Soft dreamy blur with glow',
        'page-curl': 'Page turning effect with shadow',
        'directional-warp': 'Wavy directional distortion',
        'mosaic': 'Animated mosaic tiles',
        'radial-blur': 'Radial zoom blur',
        'crosshatch': 'Crosshatch pattern fade'
    };

    const handleTransitionChange = useCallback((e) => {
        const value = e.target.value;
        onTransitionChange(value);
        setTransitionDescription(transitionDescriptions[value] || '');
    }, [onTransitionChange]);

    // Helper function to calculate transition start time (centered model)
    const calculateTransitionStartTime = useCallback((transition, clips, transitions) => {
        if (transition.position === 'start') {
            // Start transition begins at time 0
            return 0;
        }
        
        if (transition.position === 'end') {
            // End transition is centered at the end boundary
            let total = 0;
            for (let i = 0; i < clips.length; i++) {
                total += clips[i].duration;
            }
            // Transition is centered at total duration, so it starts at total - d/2
            const d = Math.min(transition.duration, clips[clips.length - 1].duration);
            return total - d / 2;
        }
        
        if (transition.position === 'between') {
            // Between transition is centered at the clip boundary
            // Calculate the boundary time (sum of clips up to and including afterClipIndex)
            let boundaryTime = 0;
            for (let i = 0; i <= transition.afterClipIndex; i++) {
                boundaryTime += clips[i].duration;
            }
            
            // Transition is centered at boundary, so it starts at boundary - d/2
            const clip = clips[transition.afterClipIndex];
            const nextClip = clips[transition.afterClipIndex + 1];
            const d = Math.min(transition.duration, clip.duration, nextClip.duration);
            
            return boundaryTime - d / 2;
        }
        
        return 0;
    }, []);

    const handleExport = useCallback((quality) => {
        // Set exporting state
        setIsExporting(true);
        setExportProgress(0);
        
        const exportFn = async (clips, transitions, totalDuration, getCurrentState, onProgress, onComplete) => {
            // Calculate export duration and start time
            let exportStartTime = 0;
            let exportDuration = totalDuration;
            let transitionInfo = null;
            
            if (exportTransitionOnly && transitions && transitions.length > 0) {
                const transition = transitions[selectedTransitionIndex] || transitions[0];
                const paddingBefore = 0.1; // 100ms before transition
                const paddingAfter = 0.1;  // 100ms after transition
                const actualTransitionStart = calculateTransitionStartTime(transition, clips, transitions);
                
                exportStartTime = actualTransitionStart - paddingBefore;
                exportDuration = transition.duration + paddingBefore + paddingAfter;
                transitionInfo = {
                    ...transition,
                    actualStart: actualTransitionStart,
                    actualDuration: transition.duration,
                    paddingBefore: paddingBefore,
                    paddingAfter: paddingAfter
                };
            }
            let renderer = null;
            let exportClips = [];
            let animationFrameId = null;
            let currentlyPlayingVideos = new Set();

            try {
                // Get the first clip to determine canvas size
                const firstClip = clips[0];
                const canvas = document.createElement('canvas');
                canvas.width = firstClip.width;
                canvas.height = firstClip.height;

                // Initialize Three.js renderer for proper transition effects
                try {
                    renderer = new ThreeRenderer(canvas);
                } catch (error) {
                    console.error('Failed to initialize Three.js renderer:', error);
                    throw new Error('WebGL is required for export with transitions');
                }

                // Helper: Start video playback at specific time
                const startVideoPlayback = async (video, targetTime) => {
                    try {
                    // Check if video buffer was evicted by browser (readyState < 3)
                    if (video.readyState < 3) {
                        // Re-prime video by loading it again
                            video.currentTime = 0;
                            
                            // Wait for video to be ready again
                            await new Promise((resolve) => {
                                if (video.readyState >= 3) {
                                    resolve();
                                } else {
                                    let resolved = false;
                                    
                                    const onCanPlay = () => {
                                        if (resolved) return;
                                        resolved = true;
                                        video.removeEventListener('canplay', onCanPlay);
                                        video.removeEventListener('loadeddata', onLoadedData);
                                        clearTimeout(timeoutId);
                                        resolve();
                                    };
                                    
                                    const onLoadedData = () => {
                                        if (resolved) return;
                                        resolved = true;
                                        video.removeEventListener('canplay', onCanPlay);
                                        video.removeEventListener('loadeddata', onLoadedData);
                                        clearTimeout(timeoutId);
                                        resolve();
                                    };
                                    
                                    // Timeout in case events don't fire
                                    const timeoutId = setTimeout(() => {
                                        if (resolved) return;
                                        resolved = true;
                                        video.removeEventListener('canplay', onCanPlay);
                                        video.removeEventListener('loadeddata', onLoadedData);
                                        console.warn('Video re-prime timeout, proceeding anyway...');
                                        resolve();
                                    }, 3000);
                                    
                                    video.addEventListener('canplay', onCanPlay);
                                    video.addEventListener('loadeddata', onLoadedData);
                                    
                                    // Try to trigger loading by calling load()
                                    video.load();
                                }
                            });
                        }
                        
                        // Now proceed with normal playback
                        const timeDiff = Math.abs(video.currentTime - targetTime);
                        if (timeDiff > 0.1) {
                            video.currentTime = targetTime;
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                        
                        if (video.paused) {
                            await video.play();
                        }
                        
                        currentlyPlayingVideos.add(video);
                    } catch (e) {
                        console.warn('Error starting video playback:', e, video.src, video.readyState);
                    }
                };

                // Helper: Pause all videos
                const pauseAllVideos = () => {
                    currentlyPlayingVideos.forEach(video => {
                        try {
                            if (!video.paused) {
                                video.pause();
                            }
                        } catch (e) {
                            console.warn('Error pausing video:', e);
                        }
                    });
                    currentlyPlayingVideos.clear();
                };

                // Create export video elements (clones for export)
                exportClips = await Promise.all(clips.map(async (clip) => {
                    const video = document.createElement('video');
                    video.src = clip.objectUrl;
                    video.preload = 'auto';
                    video.muted = true;
                    video.playsInline = true;
                    
                    // Attach to DOM (hidden) for mobile browsers
                    video.style.position = 'absolute';
                    video.style.left = '-9999px';
                    video.style.width = '1px';
                    video.style.height = '1px';
                    video.style.opacity = '0';
                    video.style.pointerEvents = 'none';
                    const readyPromise = new Promise((resolve) => {
                        if (video.readyState >= 3) {
                            resolve();
                        } else {
                            video.addEventListener('canplay', resolve, { once: true });
                        }
                    });
                    document.body.appendChild(video);

                     // Wait for video to be ready
                     await readyPromise;
                    
                    return {
                        ...clip,
                        video: video
                    };
                }));

                // Keep videos "warm" by playing and immediately pausing
                // This prevents browsers from aggressively evicting buffers
                for (const clip of exportClips) {
                    try {
                        clip.video.currentTime = 0;
                        await clip.video.play();
                        clip.video.pause();
                    } catch (e) {
                        console.warn('Failed to prime video:', e);
                    }
                }

                // Determine export settings
                const fps = quality === 'high' ? 30 : quality === 'medium' ? 24 : 20;
                const videoBitrate = quality === 'high' ? 5000000 : quality === 'medium' ? 2500000 : 1000000;

                // Check for supported codec
                const supportedMimeTypes = [
                    'video/webm;codecs=vp9',
                    'video/webm;codecs=vp8',
                    'video/webm',
                ];

                let mimeType = null;
                for (const type of supportedMimeTypes) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        mimeType = type;
                        break;
                    }
                }

                if (!mimeType) {
                    throw new Error('No supported video codec found');
                }

                // Create MediaRecorder with natural stream capture
                const stream = canvas.captureStream(fps);
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: videoBitrate
                });

                const chunks = [];
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.start(100);

                // Create modified getCurrentState that uses exportClips
                const getExportState = (time) => {
                    const state = getCurrentState(time);
                    
                    // Replace clip references with export clips
                    if (state.mode === 'clip' && state.clip) {
                        const exportClip = exportClips.find(c => c.id === state.clip.id);
                        if (exportClip) {
                            return { ...state, clip: exportClip };
                        }
                    } else if (state.mode === 'transition') {
                        const exportClip1 = exportClips.find(c => c.id === state.clip1?.id);
                        const exportClip2 = exportClips.find(c => c.id === state.clip2?.id);
                        return {
                            ...state,
                            clip1: exportClip1 || state.clip1,
                            clip2: exportClip2 || state.clip2
                        };
                    }
                    
                    return state;
                };

                // Natural playback export loop (reuses our proven playback approach!)
                let currentTime = exportStartTime;
                const perfStartTime = performance.now();
                let isExportingLoop = true;
                let loopDelay = 0;

                const exportLoop = async () => {
                    const loopStartTime = performance.now();
                    try {
                        if (!isExportingLoop) return;

                        // Calculate elapsed time (real-time export)
                        const elapsed = (performance.now() - perfStartTime - loopDelay) / 1000;
                        currentTime = exportStartTime + elapsed;

                        // Check if export is complete
                        if (currentTime >= exportStartTime + exportDuration) {
                        // Pause all videos
                            pauseAllVideos();
                            
                            // Stop recording
                            mediaRecorder.stop();
                            
                            // Wait for recording to complete
                            await new Promise(resolve => {
                                mediaRecorder.onstop = resolve;
                            });

                            // Create download link
                            const blob = new Blob(chunks, { type: mimeType });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `video-transitions-${Date.now()}.webm`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);

                            setTimeout(() => URL.revokeObjectURL(url), 1000);

                            // Cleanup export video elements AFTER export completes successfully
                            exportClips.forEach(clip => {
                                if (clip.video && clip.video.parentNode) {
                                    clip.video.pause();
                                    clip.video.src = '';
                                    clip.video.parentNode.removeChild(clip.video);
                                }
                            });

                            if (renderer) {
                                renderer.destroy();
                            }
                            
                            setTimeout(() => {
                                setExportProgress(100);
                                setIsExporting(false);
                                onProgress(100);
                                onComplete();
                            }, 1);
                            
                            return;
                        }

                    // Get current state with export clips
                    let state = getExportState(currentTime);
                    
                    // Safety check
                    if (!state) {
                        console.warn('No state returned at time:', currentTime);
                        animationFrameId = requestAnimationFrame(exportLoop);
                        return;
                    }
                    
                    // PADDING HANDLER: Convert clip states in padding zones to transition states
                    if (exportTransitionOnly && transitionInfo && transitionInfo.actualStart) {
                        const inPaddingBefore = currentTime < transitionInfo.actualStart;
                        const inPaddingAfter = currentTime >= (transitionInfo.actualStart + transitionInfo.actualDuration);
                        
                        if (inPaddingBefore || inPaddingAfter) {
                            // In padding zone - synthesize a transition state
                            if (state.mode === 'clip') {
                                // Convert clip state to transition state
                                const clipIndex = clips.findIndex(c => c.id === state.clip.id);
                                const nextClipIndex = clipIndex + 1;
                                
                                if (nextClipIndex < clips.length) {
                                    const exportClip1 = exportClips.find(c => c.id === clips[clipIndex].id);
                                    const exportClip2 = exportClips.find(c => c.id === clips[nextClipIndex].id);
                                    
                                    // Create synthetic transition state
                                    state = {
                                        mode: 'transition',
                                        transition: transitionInfo,
                                        clip1: exportClip1,
                                        clip2: exportClip2,
                                        progress: inPaddingBefore ? 0.0 : 1.0, // 0 = show clip1, 1 = show clip2
                                        clip1Time: inPaddingBefore ? state.clipTime : exportClip1.duration - 0.01,
                                        clip2Time: inPaddingAfter ? state.clipTime : 0.0
                                    };
                                }
                            } else if (state.mode === 'transition') {
                                // Already in transition mode, just clamp progress
                                state = {
                                    ...state,
                                    progress: inPaddingBefore ? 0.0 : 1.0
                                };
                            }
                        }
                    }

                    // Render frame using natural playback approach (same as VideoPreview!)
                        if (state.mode === 'clip' && state.clip) {
                            const video = state.clip.video;
                            const targetTime = state.clipTime;

                            // Ensure video is playing
                            if (video.paused) {
                                await startVideoPlayback(video, targetTime);
                            }

                            // Sync with playback rate (same logic as VideoPreview)
                            const timeDiff = Math.abs(video.currentTime - targetTime);
                            if (timeDiff > 0.1) {
                                const correction = Math.min(Math.max(timeDiff * 0.5, -0.5), 0.5);
                                video.playbackRate = 1.0 + correction * (video.currentTime < targetTime ? 1 : -1);
                            } else {
                                video.playbackRate = 1.0;
                            }

                            // Render with Three.js (VideoTexture auto-updates from playing video!)
                            renderer.renderSingleFrame(video);
                        } else if (state.mode === 'transition') {
                            const video1 = state.clip1?.video;
                            const video2 = state.clip2?.video;

                            // NEW CENTERED TRANSITION MODEL:
                            // First half (clip2Time === 0): Only video1 plays, video2 static at frame 0
                            // Second half (clip2Time > 0): Only video2 plays, video1 static at last frame
                            
                            if (video1) {
                                // Check if we're in first half (video1 should be playing)
                                if (state.clip2Time <= 0.01) {
                                    // First half: video1 plays
                                    if (video1.paused) {
                                        await startVideoPlayback(video1, state.clip1Time);
                                    }
                                    
                                    // Sync video1 with playback rate
                                    const timeDiff1 = Math.abs(video1.currentTime - state.clip1Time);
                                    if (timeDiff1 > 0.1) {
                                        const correction = Math.min(Math.max(timeDiff1 * 0.5, -0.5), 0.5);
                                        video1.playbackRate = 1.0 + correction * (video1.currentTime < state.clip1Time ? 1 : -1);
                                    } else {
                                        video1.playbackRate = 1.0;
                                    }
                                } else {
                                    // Second half: video1 static at last frame
                                    if (!video1.paused) {
                                        video1.pause();
                                    }
                                    // Keep at last frame
                                    if (Math.abs(video1.currentTime - state.clip1Time) > 0.1) {
                                        video1.currentTime = state.clip1Time;
                                    }
                                }
                            }

                            if (video2) {
                                // Check if we're in second half (video2 should be playing)
                                if (state.clip2Time > 0.01) {
                                    // Second half: video2 plays
                                    if (video2.paused) {
                                        await startVideoPlayback(video2, state.clip2Time);
                                    }
                                    
                                    // Sync video2 with playback rate
                                    const timeDiff2 = Math.abs(video2.currentTime - state.clip2Time);
                                    if (timeDiff2 > 0.1) {
                                        const correction = Math.min(Math.max(timeDiff2 * 0.5, -0.5), 0.5);
                                        video2.playbackRate = 1.0 + correction * (video2.currentTime < state.clip2Time ? 1 : -1);
                                    } else {
                                        video2.playbackRate = 1.0;
                                    }
                                } else {
                                    // First half: video2 static at frame 0
                                    if (!video2.paused) {
                                        video2.pause();
                                    }
                                    // Keep at frame 0
                                    if (Math.abs(video2.currentTime) > 0.01) {
                                        video2.currentTime = 0;
                                    }
                                }
                            }

                            // Render transition with Three.js (VideoTextures auto-update!)
                            const transitionType = state.transition?.type || 'fade';
                            renderer.render(video1, video2, state.progress, transitionType);
                        } else {
                            // Unknown state - log warning but continue
                            console.warn('Unknown state mode:', state.mode);
                        }

                        // Update progress (real-time 1:1 mapping)
                        const progressPercent = Math.min(((currentTime - exportStartTime) / exportDuration) * 100, 99);
                        setExportProgress(progressPercent);
                        onProgress(progressPercent);

                        // Continue loop
                        animationFrameId = requestAnimationFrame(exportLoop);
                    } catch (loopError) {
                        console.error('Error in export loop:', loopError);
                        // Continue loop despite error
                        animationFrameId = requestAnimationFrame(exportLoop);
                    } finally {
                        const loopEndTime = performance.now();
                        loopDelay = loopEndTime - loopStartTime + loopDelay;
                    }
                };

                // Start natural playback export
                exportLoop();
            } catch (error) {
                console.error('Export error:', error);
                alert('Export failed: ' + error.message);
                
                // Reset export state
                setIsExporting(false);
                setExportProgress(0);
                
                // Ensure videos are stopped on error
                pauseAllVideos();
                
                // Cancel animation frame if running
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                
                // Clean up export video elements on error
                exportClips.forEach(clip => {
                    if (clip.video && clip.video.parentNode) {
                        clip.video.pause();
                        clip.video.src = '';
                        clip.video.parentNode.removeChild(clip.video);
                    }
                });
                
                if (renderer) {
                    renderer.destroy();
                }
                
                onComplete();
            } finally {
                // Clean up renderer (always)
                
            }
        };

        onExport(exportFn);
    }, [onExport, exportTransitionOnly, selectedTransitionIndex, calculateTransitionStartTime]);

    return (
        <>
            <div className="control-group">
                <label htmlFor="transitionSelect">Transition Effect</label>
                <div style={{ position: 'relative' }}>
                    <div
                        style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: getTransitionColor(selectedTransition),
                            pointerEvents: 'none',
                            zIndex: 1,
                            border: '2px solid var(--color-bg-secondary)'
                        }}
                    />
                    <select
                        id="transitionSelect"
                        value={selectedTransition}
                        onChange={handleTransitionChange}
                        disabled={disabled}
                        style={{ paddingLeft: '32px' }}
                    >
                        <option value="none">⚪ None (Direct Cut)</option>
                        <optgroup label="Basic Transitions">
                            <option value="fade">🔵 Fade</option>
                            <option value="dissolve">🟣 Cross Dissolve</option>
                        </optgroup>
                        <optgroup label="Wipe Transitions">
                            <option value="wipe-left">🔴 Wipe Left</option>
                            <option value="wipe-right">🔴 Wipe Right</option>
                            <option value="wipe-up">🟠 Wipe Up</option>
                            <option value="wipe-down">🟠 Wipe Down</option>
                            <option value="circle-wipe">🟡 Circle Wipe</option>
                            <option value="diamond-wipe">🟡 Diamond Wipe</option>
                        </optgroup>
                        <optgroup label="Slide Transitions">
                            <option value="slide-left">🟢 Slide Left</option>
                            <option value="slide-right">🟢 Slide Right</option>
                            <option value="slide-up">🟢 Slide Up</option>
                            <option value="slide-down">🟩 Slide Down</option>
                        </optgroup>
                        <optgroup label="Zoom & Scale">
                            <option value="zoom-in">🔵 Zoom In</option>
                            <option value="zoom-out">🔵 Zoom Out</option>
                            <option value="scale-rotate">🔵 Scale & Rotate</option>
                        </optgroup>
                        <optgroup label="WebGL Shader Effects">
                            <option value="pixelate">🔵 Pixelate</option>
                            <option value="blur-transition">🟣 Blur Transition</option>
                            <option value="glitch">🟣 Glitch</option>
                            <option value="ripple">🟣 Ripple</option>
                            <option value="swirl">🟣 Swirl</option>
                            <option value="kaleidoscope">🟣 Kaleidoscope</option>
                            <option value="dreamy">🟣 Dreamy Blur</option>
                            <option value="page-curl">🟣 Page Curl</option>
                            <option value="directional-warp">🔵 Directional Warp</option>
                            <option value="mosaic">🔵 Mosaic</option>
                            <option value="radial-blur">🔵 Radial Blur</option>
                            <option value="crosshatch">🔵 Crosshatch Fade</option>
                        </optgroup>
                    </select>
                </div>
                {transitionDescription && (
                    <div className="transition-category">{transitionDescription}</div>
                )}
            </div>

            <div className="control-group">
                <label htmlFor="transitionPosition">Apply Transition To</label>
                <select
                    id="transitionPosition"
                    value={transitionPosition}
                    onChange={(e) => onPositionChange(e.target.value)}
                    disabled={disabled}
                >
                    <option value="between">All Clip Pairs</option>
                    <option value="start">Start of First Clip</option>
                    <option value="end">End of Last Clip</option>
                    {clips && clips.length > 1 && (
                        <optgroup label="Specific Clip Pairs">
                            {clips.slice(0, -1).map((clip, index) => (
                                <option key={`pair-${index}`} value={`pair-${index}`}>
                                    Between Clip {index + 1} & {index + 2}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </div>

            <div className="control-group">
                <label htmlFor="transitionDuration">Transition Duration (seconds)</label>
                <input
                    type="number"
                    id="transitionDuration"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={transitionDuration}
                    onChange={(e) => onDurationChange(parseFloat(e.target.value))}
                    disabled={disabled}
                />
            </div>

            <button
                className="btn btn-primary"
                onClick={onApplyTransition}
                disabled={disabled}
            >
                Apply Transition
            </button>

            <div className="control-group" style={{ marginTop: '30px' }}>
                <label>Export Video</label>
                
                {transitions && transitions.length > 0 && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input
                                type="checkbox"
                                checked={exportTransitionOnly}
                                onChange={(e) => {
                                    setExportTransitionOnly(e.target.checked);
                                    if (e.target.checked && transitions.length > 0) {
                                        setSelectedTransitionIndex(0);
                                    }
                                }}
                                disabled={isExporting}
                                style={{ marginRight: '8px', cursor: 'pointer' }}
                            />
                            Export Transition Only
                        </label>
                        
                        {exportTransitionOnly && transitions.length > 0 && (
                            <select
                                value={selectedTransitionIndex}
                                onChange={(e) => setSelectedTransitionIndex(parseInt(e.target.value))}
                                disabled={isExporting}
                                style={{ marginTop: '8px', width: '100%' }}
                            >
                                {transitions.map((t, index) => {
                                    const startTime = calculateTransitionStartTime(t, clips, transitions);
                                    return (
                                        <option key={index} value={index}>
                                            Transition {index + 1}: {t.position} - {t.type} at {startTime.toFixed(1)}s ({t.duration.toFixed(1)}s)
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                    </div>
                )}
                
                {isExporting && (
                    <div style={{ 
                        marginTop: '10px', 
                        marginBottom: '10px',
                        padding: '10px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '8px'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>
                                Exporting...
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>
                                {Math.round(exportProgress)}%
                            </span>
                        </div>
                        <div style={{ 
                            width: '100%', 
                            height: '6px', 
                            background: 'rgba(255, 255, 255, 0.1)', 
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ 
                                width: `${exportProgress}%`, 
                                height: '100%', 
                                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                transition: 'width 0.3s ease',
                                borderRadius: '3px'
                            }}></div>
                        </div>
                    </div>
                )}
                <div className="export-group">
                    <button
                        className="btn btn-export-high"
                        onClick={() => handleExport('high')}
                        disabled={disabled || isExporting}
                    >
                        {isExporting ? '⏳' : 'High'}
                        <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px', opacity: '0.9' }}>
                            30fps, 5Mbps
                        </div>
                    </button>
                    <button
                        className="btn btn-export-medium"
                        onClick={() => handleExport('medium')}
                        disabled={disabled || isExporting}
                    >
                        {isExporting ? '⏳' : 'Medium'}
                        <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px', opacity: '0.9' }}>
                            24fps, 2.5Mbps
                        </div>
                    </button>
                    <button
                        className="btn btn-export-low"
                        onClick={() => handleExport('low')}
                        disabled={disabled || isExporting}
                    >
                        {isExporting ? '⏳' : 'Low'}
                        <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px', opacity: '0.9' }}>
                            20fps, 1Mbps
                        </div>
                    </button>
                </div>
            </div>
        </>
    );
}

export default ControlsPanel;
