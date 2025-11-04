import { useCallback, useEffect, useRef } from 'react';
import { getOptimalThrottleMs } from '../utils/deviceDetection';
import { ThreeRenderer } from '../utils/three-renderer';

function VideoPreview({
    clips,
    currentTime,
    getCurrentState,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    totalDuration,
    startTimeRef,
    animationFrameRef,
    fps,
    setFps,
    isLoadingVideos,
    loadingProgress
}) {
    const canvasRef = useRef(null);
    const threeRendererRef = useRef(null);
    const fpsCounterRef = useRef({ count: 0, lastTime: 0 });
    const initializedRef = useRef(false);
    const lastRenderTimeRef = useRef(0);
    const renderThrottleMs = getOptimalThrottleMs(); // Adaptive throttle based on device
    
    // Use refs for functions to avoid animation loop restarts
    const getCurrentStateRef = useRef(getCurrentState);
    const renderFrameRef = useRef(null);
    
    // Track currently playing videos
    const currentlyPlayingVideosRef = useRef(new Set());
    
    // Update refs when functions change
    useEffect(() => {
        getCurrentStateRef.current = getCurrentState;
    }, [getCurrentState]);
    // Initialize Three.js Renderer
    useEffect(() => {
        if (!canvasRef.current || clips.length === 0 || initializedRef.current) return;

        const canvas = canvasRef.current;
        const firstClip = clips[0];

        // Set canvas size
        canvas.width = firstClip.width;
        canvas.height = firstClip.height;

        try {
            threeRendererRef.current = new ThreeRenderer(canvas);
            initializedRef.current = true;
        } catch (error) {
            console.error('Failed to initialize Three.js renderer:', error);
            initializedRef.current = true;
        }

        // Cleanup on unmount
        return () => {
            if (threeRendererRef.current) {
                threeRendererRef.current.destroy();
                threeRendererRef.current = null;
                initializedRef.current = false;
            }
        };
    }, [clips]);

    // Helper function to wait for video to be seeked (critical for mobile)
    const waitForVideoSeeked = useCallback((video, targetTime) => {
        return new Promise((resolve) => {
            if (!video || video.readyState < 3) {
                resolve();
                return;
            }

            const timeDiff = Math.abs(video.currentTime - targetTime);
            
            // If already at target time, resolve immediately
            if (timeDiff < 0.01) {
                resolve();
                return;
            }

            // Mobile browsers need actual waiting for seek to complete
            let resolved = false;
            
            const onSeeked = () => {
                if (resolved) return;
                resolved = true;
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };

            // Set up seeked listener with timeout
            const timeoutId = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                video.removeEventListener('seeked', onSeeked);
                resolve();
            }, 100); // 200ms timeout (balance between waiting and responsiveness)

            video.addEventListener('seeked', onSeeked, { once: true });
            
            try {
                video.currentTime = targetTime;
            } catch (e) {
                clearTimeout(timeoutId);
                video.removeEventListener('seeked', onSeeked);
                console.error('Error seeking video:', e);
                resolve();
            }
        });
    }, []);

    // Helper to start video playback at specific time
    const startVideoPlayback = useCallback(async (video, targetTime) => {
        try {
            // If video is far from target, seek first
            const timeDiff = Math.abs(video.currentTime - targetTime);
            if (timeDiff > 0.1) {
                video.currentTime = targetTime;
                // Wait briefly for seek
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Start playback
            if (video.paused) {
                await video.play();
            }
            
            currentlyPlayingVideosRef.current.add(video);
        } catch (e) {
            console.warn('Error starting video playback:', e);
        }
    }, []);

    // Helper to pause video
    const pauseVideo = useCallback((video) => {
        try {
            if (!video.paused) {
                video.pause();
            }
            currentlyPlayingVideosRef.current.delete(video);
        } catch (e) {
            console.warn('Error pausing video:', e);
        }
    }, []);

    // Helper to pause all videos
    const pauseAllVideos = useCallback(() => {
        currentlyPlayingVideosRef.current.forEach(video => {
            try {
                if (!video.paused) {
                    video.pause();
                }
            } catch (e) {
                console.warn('Error pausing video:', e);
            }
        });
        currentlyPlayingVideosRef.current.clear();
    }, []);

    // Render frame
    const renderFrame = useCallback(async (state) => {
        if (!canvasRef.current || !state) return;

        const canvas = canvasRef.current;
        const now = performance.now();

        // Throttle rendering to prevent excessive ImageBitmap creation
        // if (now - lastRenderTimeRef.current < renderThrottleMs) {
        //     return;
        // }
        lastRenderTimeRef.current = now;

        // Update FPS counter
        fpsCounterRef.current.count++;
        if (now - fpsCounterRef.current.lastTime >= 1000) {
            const calculatedFps = Math.round(fpsCounterRef.current.count * 1000 / (now - fpsCounterRef.current.lastTime));
            setFps(calculatedFps);
            fpsCounterRef.current.count = 0;
            fpsCounterRef.current.lastTime = now;
        }

        if (state.mode === 'clip' && state.clip) {
            // Single clip - use playing video with Three.js
            if (threeRendererRef.current) {
                const video = state.clip.video;
                const targetTime = state.clipTime;
                
                // Ensure video is playing (if timeline is playing)
                if (isPlaying && video.paused) {
                    await startVideoPlayback(video, targetTime);
                }
                const timeDiff = Math.abs(video.currentTime - targetTime);
                // If paused, just ensure we're at the right position
                if (!isPlaying) {
                    
                    if (timeDiff > 0.05) {
                        video.currentTime = targetTime;
                        // await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                
                // Check sync and adjust playback rate if needed (smooth sync)
                // const timeDiff = Math.abs(video.currentTime - targetTime);
                
                if (isPlaying && timeDiff > 0.1) {
                    // Out of sync - adjust playback rate to catch up/slow down
                    const correction = Math.min(Math.max(timeDiff * 0.5, -0.5), 0.5);
                    video.playbackRate = 1.0 + correction * (video.currentTime < targetTime ? 1 : -1);
                } else if (isPlaying) {
                    // In sync - normal playback
                    video.playbackRate = 1.0;
                }
                
                // Three.js VideoTexture auto-updates from playing video
                // Just render the current frame
                threeRendererRef.current.renderSingleFrame(video);
            }
        } else if (state.mode === 'transition') {
            // Transition - both videos playing with Three.js
            if (threeRendererRef.current) {
                const video1 = state.clip1?.video;
                const video2 = state.clip2?.video;

                // Ensure both videos are playing
                if (isPlaying) {
                    if (video1 && video1.paused) {
                        await startVideoPlayback(video1, state.clip1Time);
                    }
                    if (video2 && video2.paused) {
                        await startVideoPlayback(video2, state.clip2Time);
                    }
                }

                // Sync video1
                if (video1) {
                    const timeDiff1 = Math.abs(video1.currentTime - state.clip1Time);
                    if (isPlaying && timeDiff1 > 0.1) {
                        const correction = Math.min(Math.max(timeDiff1 * 0.5, -0.5), 0.5);
                        video1.playbackRate = 1.0 + correction * (video1.currentTime < state.clip1Time ? 1 : -1);
                    } else if (isPlaying) {
                        video1.playbackRate = 1.0;
                    }
                }

                // Sync video2
                if (video2) {
                    const timeDiff2 = Math.abs(video2.currentTime - state.clip2Time);
                    if (isPlaying && timeDiff2 > 0.1) {
                        const correction = Math.min(Math.max(timeDiff2 * 0.5, -0.5), 0.5);
                        video2.playbackRate = 1.0 + correction * (video2.currentTime < state.clip2Time ? 1 : -1);
                    } else if (isPlaying) {
                        video2.playbackRate = 1.0;
                    }
                }

                // Three.js VideoTextures auto-update from playing videos
                // Render transition with current frames
                threeRendererRef.current.render(
                    video1,
                    video2,
                    state.progress,
                    state.transition.type
                );
            }
        }
    }, [setFps, isPlaying, startVideoPlayback]);

    // Store renderFrame in ref for animation loop
    useEffect(() => {
        renderFrameRef.current = renderFrame;
    }, [renderFrame]);

    // Pause all videos when playback stops
    useEffect(() => {
        if (!isPlaying) {
            pauseAllVideos();
        }
    }, [isPlaying, pauseAllVideos]);

    // Seek and render
    const seekAndRender = useCallback(async (time) => {
        const state = getCurrentStateRef.current(time);
        await renderFrameRef.current(state);
    }, []);

    // Playback loop - OPTIMIZED with minimal dependencies
    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        // Capture initial time only once when playback starts
        const initialTime = currentTime;
        startTimeRef.current = performance.now();
        fpsCounterRef.current = { count: 0, lastTime: performance.now() };
        
        const animate = async (now) => {
            // Calculate new time based on elapsed time
            const elapsed = (now - startTimeRef.current) / 1000;
            const newTime = Math.min(initialTime + elapsed, totalDuration);
            setCurrentTime(newTime);

            // Check if we've reached the end
            if (newTime >= totalDuration - 0.015) {
                setIsPlaying(false);
                return;
            }

            // Use refs to get current functions (avoids dependency issues)
            const state = getCurrentStateRef.current(newTime);
            await renderFrameRef.current(state);

            // Continue animation loop
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, totalDuration]); // Only essential dependencies!

    // Render when currentTime changes (seeking)
    useEffect(() => {
        if (!isPlaying) {
            seekAndRender(currentTime);
        }
    }, [currentTime, isPlaying, seekAndRender]);

    return (
        <div className="video-container active">
            <canvas ref={canvasRef}></canvas>
            <div className="fps-counter">{fps} FPS</div>
            {isLoadingVideos && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 10
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '4px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '4px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <div style={{
                        marginTop: '20px',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>
                        Loading Videos...
                    </div>
                    <div style={{
                        marginTop: '10px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '14px'
                    }}>
                        {loadingProgress.current} / {loadingProgress.total}
                    </div>
                    <div style={{
                        marginTop: '15px',
                        width: '200px',
                        height: '4px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                            height: '100%',
                            background: 'white',
                            transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default VideoPreview;

