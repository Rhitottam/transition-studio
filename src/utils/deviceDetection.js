/**
 * Device detection utilities for optimizing performance
 */

export const isMobileDevice = () => {
    // Check for mobile user agent
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileUA = mobileRegex.test(navigator.userAgent);

    // Check for touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check for small screen
    const isSmallScreen = window.innerWidth < 768;

    return isMobileUA || (hasTouch && isSmallScreen);
};

export const isIOSDevice = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

export const isSafari = () => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const supportsOffscreenCanvas = () => {
    return typeof OffscreenCanvas !== 'undefined' &&
           typeof OffscreenCanvas.prototype.getContext !== 'undefined';
};

export const getOptimalRenderingMode = () => {
    const isMobile = isMobileDevice();
    const isIOS = isIOSDevice();
    const hasOffscreen = supportsOffscreenCanvas();

    if (isIOS || isMobile) {
        // Mobile devices: use main thread WebGL with direct video rendering
        return 'main-thread-direct';
    } else if (hasOffscreen) {
        // Desktop with OffscreenCanvas: use worker
        return 'worker';
    } else {
        // Desktop without OffscreenCanvas: use main thread
        return 'main-thread';
    }
};

export const getOptimalThrottleMs = () => {
    const isMobile = isMobileDevice();
    const isIOS = isIOSDevice();
    
    // iOS: 50ms (~20fps) for better stability
    // Other Mobile: 33ms (~30fps)
    // Desktop: 16ms (~60fps)
    if (isIOS) return 50;
    if (isMobile) return 33;
    return 16;
};

export const supportsWebGL2 = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
    } catch (e) {
        return false;
    }
};

export const getDeviceInfo = () => {
    return {
        isMobile: isMobileDevice(),
        isIOS: isIOSDevice(),
        isSafari: isSafari(),
        supportsOffscreen: supportsOffscreenCanvas(),
        supportsWebGL2: supportsWebGL2(),
        renderingMode: getOptimalRenderingMode(),
        throttleMs: getOptimalThrottleMs()
    };
};
