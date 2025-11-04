// Three.js-based Video Renderer
// Optimized for video transitions with hardware acceleration

import * as THREE from 'three';

export class ThreeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.contextLost = false;

        // Initialize Three.js renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: false,
            antialias: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
        });

        // Set up scene
        this.scene = new THREE.Scene();
        
        // Orthographic camera for 2D rendering
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Plane geometry for video rendering
        this.geometry = new THREE.PlaneGeometry(2, 2);
        
        // Video textures
        this.texture1 = null;
        this.texture2 = null;
        
        // Current material
        this.material = null;
        this.mesh = null;
        
        // Handle context loss
        canvas.addEventListener('webglcontextlost', (e) => {
            console.warn('WebGL context lost (Three.js)');
            e.preventDefault();
            this.contextLost = true;
        }, false);

        canvas.addEventListener('webglcontextrestored', () => {
            this.contextLost = false;
            this.initRenderer();
        }, false);

        this.initRenderer();
    }

    initRenderer() {
        this.renderer.setSize(this.canvas.width, this.canvas.height, false);
        this.renderer.setClearColor(0x000000, 1);
    }

    createVideoTexture(video) {
        if (!video) return null;
        
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;
        texture.generateMipmaps = false;
        
        return texture;
    }

    updateTextures(video1, video2) {
        // Update or create texture1
        if (video1) {
            if (!this.texture1 || this.texture1.image !== video1) {
                if (this.texture1) this.texture1.dispose();
                this.texture1 = this.createVideoTexture(video1);
                // Force immediate texture update
                this.texture1.needsUpdate = true;
            } else {
                // Also set needsUpdate for existing texture to ensure fresh frame
                this.texture1.needsUpdate = true;
            }
        }
    
        // Update or create texture2
        if (video2) {
            if (!this.texture2 || this.texture2.image !== video2) {
                if (this.texture2) this.texture2.dispose();
                this.texture2 = this.createVideoTexture(video2);
                // Force immediate texture update
                this.texture2.needsUpdate = true;
            } else {
                // Also set needsUpdate for existing texture to ensure fresh frame
                this.texture2.needsUpdate = true;
            }
        }
    }

    getShader(transitionType) {
        const shaders = {
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

        return shaders[transitionType] || shaders['fade'];
    }

    createMaterial(transitionType, progress = 0) {
        const shader = this.getShader(transitionType);
        
        return new THREE.ShaderMaterial({
            uniforms: {
                u_texture1: { value: this.texture1 },
                u_texture2: { value: this.texture2 },
                u_progress: { value: progress },
                u_resolution: { value: new THREE.Vector2(this.canvas.width, this.canvas.height) }
            },
            // vertexShader: `
            //     attribute vec2 a_position;
            //     attribute vec2 a_texCoord;
            //     varying vec2 v_texCoord;

            //     void main() {
            //         gl_Position = vec4(a_position, 0.0, 1.0);
            //         v_texCoord = a_texCoord;
            //     }
            // `,
            vertexShader: `
                varying vec2 v_texCoord;
                
                void main() {
                    v_texCoord = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            // vertexShader: `
            //     attribute vec2 a_position;
            //     attribute vec2 a_texCoord;
            //     varying vec2 v_texCoord;

            //     void main() {
            //         gl_Position = vec4(a_position, 0.0, 1.0);
            //         v_texCoord = a_texCoord;
            //     }
            // `,
            fragmentShader: shader,
            transparent: false,
            depthTest: false,
            depthWrite: false
        });
    }

    render(video1, video2, progress, transitionType) {
        if (this.contextLost) {
            console.warn('Context lost, skipping render');
            return;
        }

        // Update textures
        this.updateTextures(video1, video2);

        // Create or update material
        if (!this.material || this.currentTransition !== transitionType) {
            if (this.material) this.material.dispose();
            this.material = this.createMaterial(transitionType, progress);
            this.currentTransition = transitionType;

            // Create or update mesh
            if (this.mesh) {
                this.scene.remove(this.mesh);
            }
            this.mesh = new THREE.Mesh(this.geometry, this.material);
            this.scene.add(this.mesh);
        } else {
            // Update uniforms
            this.material.uniforms.u_texture1.value = this.texture1;
            this.material.uniforms.u_texture2.value = this.texture2;
            this.material.uniforms.u_progress.value = progress;
            this.material.uniforms.u_resolution.value.set(this.canvas.width, this.canvas.height);
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    renderSingleFrame(video) {
        this.render(video, null, 0, 'fade');
    }

    destroy() {
        // Dispose textures
        if (this.texture1) this.texture1.dispose();
        if (this.texture2) this.texture2.dispose();

        // Dispose material
        if (this.material) this.material.dispose();

        // Dispose geometry
        if (this.geometry) this.geometry.dispose();

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    // Shader implementations (same as before, optimized for Three.js)
    
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
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);

                float noise = random(v_texCoord);
                float threshold = u_progress * 1.2 - 0.1;
                float alpha = smoothstep(threshold, threshold + 0.1, noise);

                gl_FragColor = mix(color2, color1, alpha);
            }
        `;
    }

    getWipeShader(direction) {
        const conditions = {
            'left': 'v_texCoord.x < u_progress',
            'right': 'v_texCoord.x > 1.0 - u_progress',
            'up': 'v_texCoord.y < u_progress',
            'down': 'v_texCoord.y > 1.0 - u_progress'
        };

        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                gl_FragColor = ${conditions[direction]} ? color2 : color1;
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
        const offsets = {
            'left': 'vec2(1.0 - u_progress, 0.0)',
            'right': 'vec2(u_progress - 1.0, 0.0)',
            'up': 'vec2(0.0, 1.0 - u_progress)',
            'down': 'vec2(0.0, u_progress - 1.0)'
        };

        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec2 offset = ${offsets[direction]};
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
            return `
                precision mediump float;
                uniform sampler2D u_texture1;
                uniform sampler2D u_texture2;
                uniform float u_progress;
                varying vec2 v_texCoord;

                void main() {
                    vec4 color2 = texture2D(u_texture2, v_texCoord);
                    float scale = 1.0 - u_progress;
                    vec2 center = vec2(0.5, 0.5);
                    vec2 scaledCoord = center + (v_texCoord - center) / max(scale, 0.001);

                    vec4 color1;
                    if (scaledCoord.x < 0.0 || scaledCoord.x > 1.0 || scaledCoord.y < 0.0 || scaledCoord.y > 1.0) {
                        color1 = vec4(0.0, 0.0, 0.0, 0.0);
                    } else {
                        color1 = texture2D(u_texture1, scaledCoord);
                    }

                    gl_FragColor = mix(color1, color2, u_progress);
                }
            `;
        } else {
            return `
                precision mediump float;
                uniform sampler2D u_texture1;
                uniform sampler2D u_texture2;
                uniform float u_progress;
                varying vec2 v_texCoord;

                void main() {
                    vec4 color1 = texture2D(u_texture1, v_texCoord);
                    float scale = u_progress;
                    vec2 center = vec2(0.5, 0.5);
                    vec2 scaledCoord = center + (v_texCoord - center) / max(scale, 0.001);

                    vec4 color2;
                    if (scaledCoord.x < 0.0 || scaledCoord.x > 1.0 || scaledCoord.y < 0.0 || scaledCoord.y > 1.0) {
                        color2 = vec4(0.0);
                    } else {
                        color2 = texture2D(u_texture2, scaledCoord);
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
                vec4 color2 = texture2D(u_texture2, v_texCoord);

                float angle = u_progress * 3.14159 / 2.0;
                float scale = 1.0 - u_progress * 0.5;
                vec2 center = vec2(0.5, 0.5);
                vec2 pos = v_texCoord - center;

                float s = sin(angle);
                float c = cos(angle);
                vec2 rotated = vec2(
                    pos.x * c - pos.y * s,
                    pos.x * s + pos.y * c
                ) / scale + center;

                vec4 color1;
                if (rotated.x < 0.0 || rotated.x > 1.0 || rotated.y < 0.0 || rotated.y > 1.0) {
                    color1 = vec4(0.0, 0.0, 0.0, 0.0);
                } else {
                    color1 = texture2D(u_texture1, rotated);
                }

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

                float swirl1 = u_progress * 6.28318 * (1.0 - dist);
                float angle1 = angle + swirl1;
                vec2 swirlCoord1 = center + dist * vec2(cos(angle1), sin(angle1));
                vec4 color1 = texture2D(u_texture1, swirlCoord1);

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
                float curlAmount = 1.0 - u_progress * 1.2;
                vec2 pos = v_texCoord;

                float curl = smoothstep(curlAmount - 0.3, curlAmount + 0.1, pos.x);

                float shadow = smoothstep(curlAmount, curlAmount + 0.2, pos.x) *
                              (1.0 - smoothstep(curlAmount + 0.2, curlAmount + 0.4, pos.x));

                vec4 color1 = texture2D(u_texture1, pos);
                vec4 color2 = texture2D(u_texture2, pos);

                color1.rgb *= 1.0 - shadow * 0.6;

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
}

