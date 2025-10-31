// Color mapping for transition types
export const TRANSITION_COLORS = {
    'none': '#64748b',
    'fade': '#6366f1',
    'dissolve': '#8b5cf6',
    'wipe-left': '#ec4899',
    'wipe-right': '#f43f5e',
    'wipe-up': '#ef4444',
    'wipe-down': '#f97316',
    'circle-wipe': '#f59e0b',
    'diamond-wipe': '#eab308',
    'slide-left': '#84cc16',
    'slide-right': '#22c55e',
    'slide-up': '#10b981',
    'slide-down': '#14b8a6',
    'zoom-in': '#06b6d4',
    'zoom-out': '#0ea5e9',
    'scale-rotate': '#3b82f6',
    'pixelate': '#6366f1',
    'blur-transition': '#8b5cf6',
    'glitch': '#a855f7',
    'ripple': '#d946ef',
    'swirl': '#e879f9',
    'kaleidoscope': '#f0abfc',
    'dreamy': '#c084fc',
    'page-curl': '#a78bfa',
    'directional-warp': '#818cf8',
    'mosaic': '#6366f1',
    'radial-blur': '#4f46e5',
    'crosshatch': '#4338ca'
};

// Get color for a transition type
export const getTransitionColor = (type) => {
    return TRANSITION_COLORS[type] || '#64748b';
};

// Get gradient for a transition type (for timeline display)
export const getTransitionGradient = (type) => {
    const color = getTransitionColor(type);
    return `linear-gradient(135deg, ${color} 0%, ${adjustBrightness(color, -20)} 100%)`;
};

// Helper function to adjust color brightness
function adjustBrightness(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}
