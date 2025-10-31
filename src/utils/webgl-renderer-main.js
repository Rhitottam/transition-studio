// WebGL Renderer for main thread (when OffscreenCanvas is not available)
// This is the same renderer logic but works directly on the main canvas

export class WebGLRendererMain {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this.setupWebGL();
        this.createTextures();
        this.compileShaders();
    }

    setupWebGL() {
        const gl = this.gl;

        // Create vertex buffer
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Create texture coordinates
        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ]);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    }

    createTextures() {
        const gl = this.gl;

        this.texture1 = gl.createTexture();
        this.texture2 = gl.createTexture();

        for (const texture of [this.texture1, this.texture2]) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
    }

    compileShaders() {
        const gl = this.gl;

        // Vertex shader (same for all transitions)
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;

            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        this.shaderPrograms = {};

        // Import shader sources from a shared module
        const shaders = this.getShaderSources();

        for (const [name, fragmentSource] of Object.entries(shaders)) {
            this.shaderPrograms[name] = this.createShaderProgram(vertexShaderSource, fragmentSource);
        }
    }

    createShaderProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Shader program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        return {
            program: program,
            locations: {
                position: gl.getAttribLocation(program, 'a_position'),
                texCoord: gl.getAttribLocation(program, 'a_texCoord'),
                texture1: gl.getUniformLocation(program, 'u_texture1'),
                texture2: gl.getUniformLocation(program, 'u_texture2'),
                progress: gl.getUniformLocation(program, 'u_progress'),
                resolution: gl.getUniformLocation(program, 'u_resolution'),
            }
        };
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    getShaderSources() {
        return {
            'fade': this.getFadeShader(),
            'dissolve': this.getDissolveShader(),
            'wipe-left': this.getWipeShader('left'),
            'wipe-right': this.getWipeShader('right'),
            'wipe-up': this.getWipeShader('up'),
            'wipe-down': this.getWipeShader('down'),
            'circle-wipe': this.getCircleWipeShader(),
            'diamond-wipe': this.getDiamondWipeShader(),
            'slide-left': this.getSlideShader('left'),
            'slide-right': this.getSlideShader('right'),
            'slide-up': this.getSlideShader('up'),
            'slide-down': this.getSlideShader('down'),
            'zoom-in': this.getZoomShader('in'),
            'zoom-out': this.getZoomShader('out'),
            'scale-rotate': this.getScaleRotateShader(),
            'pixelate': this.getPixelateShader(),
            'blur-transition': this.getBlurTransitionShader(),
            'glitch': this.getGlitchShader(),
            'ripple': this.getRippleShader(),
            'swirl': this.getSwirlShader(),
            'kaleidoscope': this.getKaleidoscopeShader(),
            'dreamy': this.getDreamyShader(),
            'page-curl': this.getPageCurlShader(),
            'directional-warp': this.getDirectionalWarpShader(),
            'mosaic': this.getMosaicShader(),
            'radial-blur': this.getRadialBlurShader(),
            'crosshatch': this.getCrosshatchShader()
        };
    }

    // Shader implementations (same as worker)
    getFadeShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getDissolveShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            float random(vec2 co) {
                return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord); // Current video
                vec4 color2 = texture2D(u_texture2, v_texCoord); // Next video

                float noise = random(v_texCoord);
                float threshold = u_progress * 1.2 - 0.1;

                // Calculate alpha: starts at 1 (show color1), ends at 0 (show color2)
                float alpha = smoothstep(threshold, threshold + 0.1, noise);

                // Mix from color2 to color1 based on alpha (so we go from color1 to color2 as alpha decreases)
                gl_FragColor = mix(color2, color1, alpha);
            }
        `;
    }

    getWipeShader(direction) {
        const condition = {
            'left': 'v_texCoord.x < u_progress',
            'right': 'v_texCoord.x > 1.0 - u_progress',
            'up': 'v_texCoord.y < u_progress',
            'down': 'v_texCoord.y > 1.0 - u_progress'
        }[direction];

        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                gl_FragColor = ${condition} ? color2 : color1;
            }
        `;
    }

    getCircleWipeShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(v_texCoord, center);
                float radius = u_progress * 0.707;
                float edge = 0.02;
                float alpha = smoothstep(radius - edge, radius + edge, dist);
                gl_FragColor = mix(color2, color1, alpha);
            }
        `;
    }

    getDiamondWipeShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                vec2 center = v_texCoord - 0.5;
                float dist = abs(center.x) + abs(center.y);
                float edge = 0.02;
                float alpha = smoothstep(u_progress - edge, u_progress + edge, dist);
                gl_FragColor = mix(color2, color1, alpha);
            }
        `;
    }

    getSlideShader(direction) {
        const offset = {
            'left': 'vec2(1.0 - u_progress, 0.0)',
            'right': 'vec2(u_progress - 1.0, 0.0)',
            'up': 'vec2(0.0, 1.0 - u_progress)',
            'down': 'vec2(0.0, u_progress - 1.0)'
        }[direction];

        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec2 offset = ${offset};
                vec2 texCoord2 = v_texCoord + offset;

                if (texCoord2.x < 0.0 || texCoord2.x > 1.0 || texCoord2.y < 0.0 || texCoord2.y > 1.0) {
                    gl_FragColor = texture2D(u_texture1, v_texCoord);
                } else {
                    gl_FragColor = texture2D(u_texture2, texCoord2);
                }
            }
        `;
    }

    getZoomShader(type) {
        if (type === 'out') {
            // Zoom out: current video (texture1) zooms out to reveal next video (texture2) underneath
            return `
                precision mediump float;
                uniform sampler2D u_texture1;
                uniform sampler2D u_texture2;
                uniform float u_progress;
                varying vec2 v_texCoord;

                void main() {
                    vec4 color2 = texture2D(u_texture2, v_texCoord); // Next video (background)
                    float scale = 1.0 - u_progress; // Zoom out current video
                    vec2 center = vec2(0.5, 0.5);
                    vec2 scaledCoord = center + (v_texCoord - center) / max(scale, 0.001);

                    vec4 color1;
                    if (scaledCoord.x < 0.0 || scaledCoord.x > 1.0 || scaledCoord.y < 0.0 || scaledCoord.y > 1.0) {
                        color1 = vec4(0.0, 0.0, 0.0, 0.0); // Transparent outside bounds
                    } else {
                        color1 = texture2D(u_texture1, scaledCoord); // Current video (zooming)
                    }

                    // Mix: as progress increases, fade out the zooming video to reveal background
                    gl_FragColor = mix(color1, color2, u_progress);
                }
            `;
        } else {
            // Zoom in: next video (texture2) zooms in over current video (texture1)
            return `
                precision mediump float;
                uniform sampler2D u_texture1;
                uniform sampler2D u_texture2;
                uniform float u_progress;
                varying vec2 v_texCoord;

                void main() {
                    vec4 color1 = texture2D(u_texture1, v_texCoord); // Current video (background)
                    float scale = u_progress; // Zoom in next video
                    vec2 center = vec2(0.5, 0.5);
                    vec2 scaledCoord = center + (v_texCoord - center) / max(scale, 0.001);

                    vec4 color2;
                    if (scaledCoord.x < 0.0 || scaledCoord.x > 1.0 || scaledCoord.y < 0.0 || scaledCoord.y > 1.0) {
                        color2 = vec4(0.0);
                    } else {
                        color2 = texture2D(u_texture2, scaledCoord); // Next video (zooming)
                    }

                    gl_FragColor = mix(color1, color2, u_progress);
                }
            `;
        }
    }

    getScaleRotateShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color2 = texture2D(u_texture2, v_texCoord); // Next video (background)

                // Rotate and scale down the current video
                float angle = u_progress * 3.14159 / 2.0; // Rotate 90 degrees
                float scale = 1.0 - u_progress * 0.5; // Scale down to 50%
                vec2 center = vec2(0.5, 0.5);
                vec2 pos = v_texCoord - center;

                // Apply rotation
                float s = sin(angle);
                float c = cos(angle);
                vec2 rotated = vec2(
                    pos.x * c - pos.y * s,
                    pos.x * s + pos.y * c
                ) / scale + center;

                vec4 color1;
                if (rotated.x < 0.0 || rotated.x > 1.0 || rotated.y < 0.0 || rotated.y > 1.0) {
                    color1 = vec4(0.0, 0.0, 0.0, 0.0); // Transparent outside bounds
                } else {
                    color1 = texture2D(u_texture1, rotated); // Current video (rotating/scaling)
                }

                // Mix: as progress increases, current video fades out revealing next video
                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getPixelateShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            void main() {
                float pixelSize = mix(1.0, 50.0, sin(u_progress * 3.14159));
                vec2 pixelated = floor(v_texCoord * u_resolution / pixelSize) * pixelSize / u_resolution;

                vec4 color1 = texture2D(u_texture1, pixelated);
                vec4 color2 = texture2D(u_texture2, pixelated);

                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getBlurTransitionShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            vec4 blur(sampler2D tex, vec2 coord, float amount) {
                vec4 sum = vec4(0.0);
                float blurSize = amount / u_resolution.x;

                sum += texture2D(tex, vec2(coord.x - 4.0 * blurSize, coord.y)) * 0.05;
                sum += texture2D(tex, vec2(coord.x - 3.0 * blurSize, coord.y)) * 0.09;
                sum += texture2D(tex, vec2(coord.x - 2.0 * blurSize, coord.y)) * 0.12;
                sum += texture2D(tex, vec2(coord.x - blurSize, coord.y)) * 0.15;
                sum += texture2D(tex, vec2(coord.x, coord.y)) * 0.16;
                sum += texture2D(tex, vec2(coord.x + blurSize, coord.y)) * 0.15;
                sum += texture2D(tex, vec2(coord.x + 2.0 * blurSize, coord.y)) * 0.12;
                sum += texture2D(tex, vec2(coord.x + 3.0 * blurSize, coord.y)) * 0.09;
                sum += texture2D(tex, vec2(coord.x + 4.0 * blurSize, coord.y)) * 0.05;

                return sum;
            }

            void main() {
                float blurAmount = sin(u_progress * 3.14159) * 20.0;
                vec4 color1 = blur(u_texture1, v_texCoord, blurAmount);
                vec4 color2 = blur(u_texture2, v_texCoord, blurAmount);
                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getGlitchShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            float random(vec2 co) {
                return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                float glitchAmount = sin(u_progress * 3.14159) * 0.5;
                vec2 offset = vec2(
                    (random(vec2(v_texCoord.y, u_progress)) - 0.5) * glitchAmount,
                    0.0
                );

                vec4 color1 = texture2D(u_texture1, v_texCoord + offset);
                vec4 color2 = texture2D(u_texture2, v_texCoord - offset);

                // RGB split effect
                color1.r = texture2D(u_texture1, v_texCoord + offset * 2.0).r;
                color2.b = texture2D(u_texture2, v_texCoord - offset * 2.0).b;

                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getRippleShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(v_texCoord, center);
                float ripple = sin((dist - u_progress) * 30.0) * 0.02;

                vec2 rippleCoord = v_texCoord + normalize(v_texCoord - center) * ripple;

                vec4 color1 = texture2D(u_texture1, rippleCoord);
                vec4 color2 = texture2D(u_texture2, rippleCoord);

                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getSwirlShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec2 center = vec2(0.5, 0.5);
                vec2 pos = v_texCoord - center;
                float dist = length(pos);
                float angle = atan(pos.y, pos.x);

                // Apply swirl to texture1 (current video swirls away)
                // Swirl increases as progress increases
                float swirl1 = u_progress * 6.28318 * (1.0 - dist);
                float angle1 = angle + swirl1;
                vec2 swirlCoord1 = center + dist * vec2(cos(angle1), sin(angle1));
                vec4 color1 = texture2D(u_texture1, swirlCoord1);

                // Apply reverse swirl to texture2 (next video unswirls from swirled state)
                // Swirl decreases as progress increases (starts swirled, ends normal)
                float swirl2 = (1.0 - u_progress) * 6.28318 * (1.0 - dist);
                float angle2 = angle + swirl2;
                vec2 swirlCoord2 = center + dist * vec2(cos(angle2), sin(angle2));
                vec4 color2 = texture2D(u_texture2, swirlCoord2);

                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getKaleidoscopeShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec2 center = vec2(0.5, 0.5);
                vec2 pos = v_texCoord - center;
                float angle = atan(pos.y, pos.x);
                float radius = length(pos);

                float segments = 6.0;
                float segmentAngle = 6.28318 / segments;
                angle = mod(angle, segmentAngle);
                if (mod(floor((atan(pos.y, pos.x) + 3.14159) / segmentAngle), 2.0) < 1.0) {
                    angle = segmentAngle - angle;
                }

                vec2 kaleidoCoord = center + radius * vec2(cos(angle), sin(angle));

                vec4 color1 = texture2D(u_texture1, kaleidoCoord);
                vec4 color2 = texture2D(u_texture2, kaleidoCoord);

                float mixer = smoothstep(0.0, 1.0, u_progress);
                gl_FragColor = mix(color1, color2, mixer);
            }
        `;
    }

    getDreamyShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            vec4 dreamBlur(sampler2D tex, vec2 coord) {
                vec4 sum = vec4(0.0);
                float blurSize = 2.0 / u_resolution.x;

                for (float x = -3.0; x <= 3.0; x += 1.0) {
                    for (float y = -3.0; y <= 3.0; y += 1.0) {
                        sum += texture2D(tex, coord + vec2(x, y) * blurSize);
                    }
                }

                return sum / 49.0;
            }

            void main() {
                float blurFactor = sin(u_progress * 3.14159);

                vec4 color1 = mix(
                    texture2D(u_texture1, v_texCoord),
                    dreamBlur(u_texture1, v_texCoord),
                    blurFactor
                );

                vec4 color2 = mix(
                    texture2D(u_texture2, v_texCoord),
                    dreamBlur(u_texture2, v_texCoord),
                    blurFactor
                );

                gl_FragColor = mix(color1, color2, u_progress);
                gl_FragColor.rgb += vec3(0.1, 0.05, 0.15) * blurFactor;
            }
        `;
    }

    getPageCurlShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                // Curl from right to left (curling away the current page)
                float curlAmount = 1.0 - u_progress * 1.2;
                vec2 pos = v_texCoord;

                // Create curl transition zone based on x position
                float curl = smoothstep(curlAmount - 0.3, curlAmount + 0.1, pos.x);

                // Add shadow effect on the curling edge
                float shadow = smoothstep(curlAmount, curlAmount + 0.2, pos.x) *
                              (1.0 - smoothstep(curlAmount + 0.2, curlAmount + 0.4, pos.x));

                vec4 color1 = texture2D(u_texture1, pos); // Current page being curled away
                vec4 color2 = texture2D(u_texture2, pos); // Next page underneath

                // Apply shadow to the page being curled
                color1.rgb *= 1.0 - shadow * 0.6;

                // Mix: show texture2 (underneath) where curled away, texture1 where still flat
                gl_FragColor = mix(color1, color2, curl);
            }
        `;
    }

    getDirectionalWarpShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                float warpAmount = sin(u_progress * 3.14159) * 0.1;

                vec2 warp1 = v_texCoord + vec2(warpAmount * sin(v_texCoord.y * 10.0), 0.0);
                vec2 warp2 = v_texCoord - vec2(warpAmount * sin(v_texCoord.y * 10.0), 0.0);

                vec4 color1 = texture2D(u_texture1, warp1);
                vec4 color2 = texture2D(u_texture2, warp2);

                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getMosaicShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            void main() {
                float cells = mix(1.0, 30.0, sin(u_progress * 3.14159));
                vec2 cellSize = vec2(1.0 / cells);
                vec2 cell = floor(v_texCoord / cellSize);
                vec2 cellCenter = (cell + 0.5) * cellSize;

                float random = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
                float threshold = u_progress;

                vec4 color1 = texture2D(u_texture1, cellCenter);
                vec4 color2 = texture2D(u_texture2, cellCenter);

                gl_FragColor = random < threshold ? color2 : color1;
            }
        `;
    }

    getRadialBlurShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            vec4 radialBlur(sampler2D tex, vec2 coord, float amount) {
                vec2 center = vec2(0.5, 0.5);
                vec2 dir = coord - center;
                vec4 sum = vec4(0.0);

                for (float i = 0.0; i < 10.0; i++) {
                    float scale = 1.0 - amount * (i / 10.0) * 0.5;
                    sum += texture2D(tex, center + dir * scale);
                }

                return sum / 10.0;
            }

            void main() {
                float blurAmount = sin(u_progress * 3.14159) * 2.0;

                vec4 color1 = radialBlur(u_texture1, v_texCoord, blurAmount);
                vec4 color2 = radialBlur(u_texture2, v_texCoord, blurAmount);

                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    getCrosshatchShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            float hatch(vec2 coord, float angle, float spacing) {
                float s = sin(angle);
                float c = cos(angle);
                vec2 rotated = vec2(
                    coord.x * c - coord.y * s,
                    coord.x * s + coord.y * c
                );
                return step(0.5, fract(rotated.x * spacing));
            }

            void main() {
                float density = mix(5.0, 50.0, u_progress);
                float pattern = hatch(v_texCoord * u_resolution / 100.0, 0.785, density);

                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);

                gl_FragColor = mix(color1, color2, pattern * u_progress);
            }
        `;
    }

    render(video1, video2, progress, transitionType) {
        const gl = this.gl;
        const program = this.shaderPrograms[transitionType];

        if (!program) {
            console.warn('Shader not found:', transitionType);
            return;
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program.program);

        // Bind textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture1);
        if (video1 && video1.readyState >= 2) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video1);
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texture2);
        if (video2 && video2.readyState >= 2) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video2);
        }

        // Set uniforms
        gl.uniform1i(program.locations.texture1, 0);
        gl.uniform1i(program.locations.texture2, 1);
        gl.uniform1f(program.locations.progress, progress);
        gl.uniform2f(program.locations.resolution, gl.canvas.width, gl.canvas.height);

        // Set attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(program.locations.position);
        gl.vertexAttribPointer(program.locations.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(program.locations.texCoord);
        gl.vertexAttribPointer(program.locations.texCoord, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    renderSingleFrame(video) {
        const gl = this.gl;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use simple fade shader with progress 0 for single frame
        const program = this.shaderPrograms['fade'];
        if (!program) return;

        gl.useProgram(program.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture1);
        if (video && video.readyState >= 2) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        }

        gl.uniform1i(program.locations.texture1, 0);
        gl.uniform1i(program.locations.texture2, 0);
        gl.uniform1f(program.locations.progress, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(program.locations.position);
        gl.vertexAttribPointer(program.locations.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(program.locations.texCoord);
        gl.vertexAttribPointer(program.locations.texCoord, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    destroy() {
        const gl = this.gl;

        // Clean up textures
        if (this.texture1) gl.deleteTexture(this.texture1);
        if (this.texture2) gl.deleteTexture(this.texture2);

        // Clean up buffers
        if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
        if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);

        // Clean up shader programs
        for (const program of Object.values(this.shaderPrograms)) {
            if (program && program.program) {
                gl.deleteProgram(program.program);
            }
        }
    }
}
