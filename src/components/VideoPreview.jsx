import { useEffect, useRef, useCallback } from 'react';
import { WebGLRendererMain } from '../utils/webgl-renderer-main';

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
    setFps
}) {
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const offscreenCanvasRef = useRef(null);
    const webglRendererRef = useRef(null);
    const fpsCounterRef = useRef({ count: 0, lastTime: 0 });
    const initializedRef = useRef(false);
    const lastRenderTimeRef = useRef(0);
    const renderThrottleMs = 16; // ~60fps throttle

    // Initialize Web Worker and OffscreenCanvas
    useEffect(() => {
        if (!canvasRef.current || clips.length === 0 || initializedRef.current) return;

        const canvas = canvasRef.current;
        const firstClip = clips[0];

        // Set canvas size
        canvas.width = firstClip.width;
        canvas.height = firstClip.height;

        // Check if OffscreenCanvas is supported and canvas hasn't been transferred yet
        if (typeof OffscreenCanvas !== 'undefined' &&
            canvas.transferControlToOffscreen &&
            !offscreenCanvasRef.current &&
            !workerRef.current) {

            try {
                // Transfer canvas control to worker
                offscreenCanvasRef.current = canvas.transferControlToOffscreen();

                // Create Web Worker
                workerRef.current = new Worker(
                    new URL('../workers/webgl-renderer.worker.js', import.meta.url),
                    { type: 'module' }
                );

                // Initialize worker with offscreen canvas
                workerRef.current.postMessage({
                    type: 'init',
                    data: {
                        canvas: offscreenCanvasRef.current,
                        width: firstClip.width,
                        height: firstClip.height
                    }
                }, [offscreenCanvasRef.current]);

                workerRef.current.onmessage = (e) => {
                    if (e.data.type === 'error') {
                        console.error('Worker error:', e.data.error);
                    }
                };

                initializedRef.current = true;
                console.log('WebGL renderer initialized with OffscreenCanvas + Web Worker');
            } catch (error) {
                console.warn('Failed to transfer canvas to OffscreenCanvas:', error);
                console.warn('Falling back to main thread WebGL rendering');
            }
        }

        // Fallback: Use WebGL on main thread (no Web Worker)
        if (!offscreenCanvasRef.current && !webglRendererRef.current && !initializedRef.current) {
            try {
                console.log('Using main thread WebGL renderer (OffscreenCanvas not supported)');
                webglRendererRef.current = new WebGLRendererMain(canvas);
                initializedRef.current = true;
            } catch (error) {
                console.error('Failed to initialize WebGL renderer:', error);
                console.warn('Falling back to 2D context rendering');
                initializedRef.current = true;
            }
        }

        // Don't cleanup on unmount in dev mode to prevent double-initialization
        // Only cleanup when component is truly destroyed
    }, [clips]);

    // Render frame
    const renderFrame = useCallback(async (state) => {
        if (!canvasRef.current || !state) return;

        const canvas = canvasRef.current;
        const now = performance.now();

        // Throttle rendering to prevent excessive ImageBitmap creation
        if (now - lastRenderTimeRef.current < renderThrottleMs) {
            return;
        }
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
            // Single clip - use WebGL renderer (main thread or worker)
            if (webglRendererRef.current) {
                // Main thread WebGL renderer
                state.clip.video.currentTime = state.clipTime;
                if (state.clip.video.readyState >= 2) {
                    webglRendererRef.current.renderSingleFrame(state.clip.video);
                }
            } else if (workerRef.current && offscreenCanvasRef.current) {
                // Worker-based rendering - use fade shader with progress 0 for single frame
                const video = state.clip.video;

                try {
                    if (video && video.readyState >= 2) {
                        video.currentTime = state.clipTime;

                        // Use requestVideoFrameCallback if available for better performance
                        if ('requestVideoFrameCallback' in video) {
                            video.requestVideoFrameCallback(() => {
                                createImageBitmap(video).then(frame => {
                                    if (workerRef.current && frame) {
                                        workerRef.current.postMessage({
                                            type: 'render',
                                            data: {
                                                videoFrame1: frame,
                                                videoFrame2: null,
                                                progress: 0,
                                                transitionType: 'fade'
                                            }
                                        }, [frame]);
                                        // Note: frame is neutered after transfer, worker will close it
                                    }
                                }).catch(e => console.error('ImageBitmap error:', e));
                            });
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 0));
                            const frame = await createImageBitmap(video);

                            if (workerRef.current && frame) {
                                workerRef.current.postMessage({
                                    type: 'render',
                                    data: {
                                        videoFrame1: frame,
                                        videoFrame2: null,
                                        progress: 0,
                                        transitionType: 'fade'
                                    }
                                }, [frame]);
                                // Note: frame is neutered after transfer, worker will close it
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error rendering single frame:', e);
                }
            } else {
                // Fallback to 2D context (only if canvas not transferred)
                try {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        if (state.clip.video.readyState >= 2) {
                            state.clip.video.currentTime = state.clipTime;
                            ctx.drawImage(state.clip.video, 0, 0, canvas.width, canvas.height);
                        }
                    }
                } catch (e) {
                    console.error('Error drawing video frame:', e);
                }
            }
        } else if (state.mode === 'transition') {
            // Transition - use Web Worker with WebGL if available
            if (workerRef.current && offscreenCanvasRef.current) {
                // Create ImageBitmaps from video elements
                const video1 = state.clip1?.video;
                const video2 = state.clip2?.video;

                try {
                    // Seek videos
                    if (video1 && video1.readyState >= 2) {
                        video1.currentTime = state.clip1Time;
                    }
                    if (video2 && video2.readyState >= 2) {
                        video2.currentTime = state.clip2Time;
                    }

                    // Create ImageBitmaps only after videos are ready
                    const promises = [];
                    if (video1 && video1.readyState >= 2) {
                        promises.push(createImageBitmap(video1));
                    } else {
                        promises.push(Promise.resolve(null));
                    }

                    if (video2 && video2.readyState >= 2) {
                        promises.push(createImageBitmap(video2));
                    } else {
                        promises.push(Promise.resolve(null));
                    }

                    const [frame1, frame2] = await Promise.all(promises);

                    if (workerRef.current) {
                        const transferList = [frame1, frame2].filter(Boolean);
                        workerRef.current.postMessage({
                            type: 'render',
                            data: {
                                videoFrame1: frame1,
                                videoFrame2: frame2,
                                progress: state.progress,
                                transitionType: state.transition.type
                            }
                        }, transferList);
                        // Bitmaps are neutered after transfer, worker will close them
                    }
                } catch (e) {
                    console.error('Error creating ImageBitmap:', e);
                    // Fallback to main thread WebGL or 2D rendering
                    renderTransitionMainThread(canvas, state);
                }
            } else {
                // Use main thread WebGL renderer
                renderTransitionMainThread(canvas, state);
            }
        }
    }, [setFps]);

    // Main thread rendering for transitions
    const renderTransitionMainThread = useCallback((canvas, state) => {
        // Try WebGL renderer first
        if (webglRendererRef.current) {
            const video1 = state.clip1?.video;
            const video2 = state.clip2?.video;

            if (video1 && video1.readyState >= 2) {
                video1.currentTime = state.clip1Time;
            }
            if (video2 && video2.readyState >= 2) {
                video2.currentTime = state.clip2Time;
            }

            webglRendererRef.current.render(
                video1,
                video2,
                state.progress,
                state.transition.type
            );
        } else {
            // Fallback to 2D rendering
            renderTransitionFallback(canvas, state);
        }
    }, []);

    // Fallback 2D rendering for transitions
    const renderTransitionFallback = useCallback((canvas, state) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const { clip1, clip2, progress } = state;

        if (clip1 && clip1.video.readyState >= 2) {
            ctx.globalAlpha = 1 - progress;
            try {
                ctx.drawImage(clip1.video, 0, 0, canvas.width, canvas.height);
            } catch (e) {}
        }

        ctx.globalAlpha = progress;
        if (clip2 && clip2.video.readyState >= 2) {
            try {
                ctx.drawImage(clip2.video, 0, 0, canvas.width, canvas.height);
            } catch (e) {}
        }

        ctx.globalAlpha = 1;
    }, []);

    // Seek and render
    const seekAndRender = useCallback(async (time) => {
        const state = getCurrentState(time);
        await renderFrame(state);
    }, [getCurrentState, renderFrame]);

    // Playback loop
    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        startTimeRef.current = performance.now();
        const initialTime = currentTime;
        fpsCounterRef.current = { count: 0, lastTime: performance.now() };

        const animate = async (now) => {
            if (!isPlaying) return;

            const elapsed = (now - startTimeRef.current) / 1000;
            const newTime = Math.min(initialTime + elapsed, totalDuration);
            setCurrentTime(newTime);

            if (newTime >= totalDuration - 0.01) {
                setIsPlaying(false);
                return;
            }

            const state = getCurrentState(newTime);
            await renderFrame(state);

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, currentTime, totalDuration, getCurrentState, renderFrame, setCurrentTime, setIsPlaying, startTimeRef, animationFrameRef]);

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
        </div>
    );
}

export default VideoPreview;
