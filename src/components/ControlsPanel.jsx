import { useState, useCallback } from 'react';
import { WebGLRendererMain } from '../utils/webgl-renderer-main';
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
    clips
}) {
    const [transitionDescription, setTransitionDescription] = useState('');

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

    const handleExport = useCallback((quality) => {
        const exportFn = async (clips, transitions, totalDuration, getCurrentState, onProgress, onComplete) => {
            let renderer = null;

            try {
                // Get the first clip to determine canvas size
                const firstClip = clips[0];
                const canvas = document.createElement('canvas');
                canvas.width = firstClip.width;
                canvas.height = firstClip.height;

                // Initialize WebGL renderer for proper transition effects
                try {
                    renderer = new WebGLRendererMain(canvas);
                } catch (error) {
                    console.error('Failed to initialize WebGL renderer:', error);
                    throw new Error('WebGL is required for export with transitions');
                }

                // Determine export settings
                const fps = quality === 'high' ? 30 : quality === 'medium' ? 24 : 15;
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

                // Create MediaRecorder
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

                // Render frames
                let currentTime = 0;
                const frameTime = 1 / fps;

                while (currentTime < totalDuration) {
                    const state = getCurrentState(currentTime);

                    if (state.mode === 'clip' && state.clip) {
                        // Set video to correct time and render
                        state.clip.video.currentTime = state.clipTime;
                        await new Promise(resolve => {
                            if (state.clip.video.readyState >= 2) {
                                resolve();
                            } else {
                                state.clip.video.addEventListener('seeked', resolve, { once: true });
                            }
                        });

                        if (state.clip.video.readyState >= 2) {
                            renderer.renderSingleFrame(state.clip.video);
                        }
                    } else if (state.mode === 'transition') {
                        // Use WebGL renderer with proper transition effects
                        const { clip1, clip2, progress, transition } = state;

                        // Set video times
                        if (clip1) {
                            clip1.video.currentTime = state.clip1Time;
                        }
                        if (clip2) {
                            clip2.video.currentTime = state.clip2Time;
                        }

                        // Wait for both videos to be ready
                        await Promise.all([
                            clip1 ? new Promise(resolve => {
                                if (clip1.video.readyState >= 2) {
                                    resolve();
                                } else {
                                    clip1.video.addEventListener('seeked', resolve, { once: true });
                                }
                            }) : Promise.resolve(),
                            clip2 ? new Promise(resolve => {
                                if (clip2.video.readyState >= 2) {
                                    resolve();
                                } else {
                                    clip2.video.addEventListener('seeked', resolve, { once: true });
                                }
                            }) : Promise.resolve()
                        ]);

                        // Render transition using WebGL
                        const transitionType = transition.type || 'fade';
                        renderer.render(
                            clip1 ? clip1.video : null,
                            clip2 ? clip2.video : null,
                            progress,
                            transitionType
                        );
                    }

                    // Update progress
                    const progressPercent = (currentTime / totalDuration) * 100;
                    onProgress(progressPercent);

                    currentTime += frameTime;
                    await new Promise(resolve => setTimeout(resolve, 1000 / fps));
                }

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

                onProgress(100);
            } catch (error) {
                console.error('Export error:', error);
                alert('Export failed: ' + error.message);
            } finally {
                // Clean up renderer
                if (renderer) {
                    renderer.destroy();
                }
                onComplete();
            }
        };

        onExport(exportFn);
    }, [onExport]);

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
                <div className="export-group">
                    <button
                        className="btn btn-export-high"
                        onClick={() => handleExport('high')}
                        disabled={disabled}
                    >
                        High
                        <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px', opacity: '0.9' }}>30fps, 5Mbps</div>
                    </button>
                    <button
                        className="btn btn-export-medium"
                        onClick={() => handleExport('medium')}
                        disabled={disabled}
                    >
                        Medium
                        <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px', opacity: '0.9' }}>24fps, 2.5Mbps</div>
                    </button>
                    <button
                        className="btn btn-export-low"
                        onClick={() => handleExport('low')}
                        disabled={disabled}
                    >
                        Low
                        <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '2px', opacity: '0.9' }}>15fps, 1Mbps</div>
                    </button>
                </div>
            </div>
        </>
    );
}

export default ControlsPanel;
