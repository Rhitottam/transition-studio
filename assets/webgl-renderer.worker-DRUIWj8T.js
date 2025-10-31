class d{constructor(e){if(this.canvas=e,this.gl=e.getContext("webgl2")||e.getContext("webgl"),!this.gl)throw new Error("WebGL not supported in worker");this.setupWebGL(),this.createTextures(),this.compileShaders()}setupWebGL(){const e=this.gl,r=new Float32Array([-1,-1,1,-1,-1,1,1,1]);this.positionBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.positionBuffer),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW);const t=new Float32Array([0,1,1,1,0,0,1,0]);this.texCoordBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.texCoordBuffer),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW)}createTextures(){const e=this.gl;this.texture1=e.createTexture(),this.texture2=e.createTexture();for(const r of[this.texture1,this.texture2])e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR)}compileShaders(){this.gl;const e=`
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;

            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;this.shaderPrograms={};const r={fade:this.getFadeShader(),dissolve:this.getDissolveShader(),"wipe-left":this.getWipeShader("left"),"wipe-right":this.getWipeShader("right"),"wipe-up":this.getWipeShader("up"),"wipe-down":this.getWipeShader("down"),"circle-wipe":this.getCircleWipeShader(),"diamond-wipe":this.getDiamondWipeShader(),"slide-left":this.getSlideShader("left"),"slide-right":this.getSlideShader("right"),"slide-up":this.getSlideShader("up"),"slide-down":this.getSlideShader("down"),"zoom-in":this.getZoomShader("in"),"zoom-out":this.getZoomShader("out"),"scale-rotate":this.getScaleRotateShader(),pixelate:this.getPixelateShader(),"blur-transition":this.getBlurTransitionShader(),glitch:this.getGlitchShader(),ripple:this.getRippleShader(),swirl:this.getSwirlShader(),kaleidoscope:this.getKaleidoscopeShader(),dreamy:this.getDreamyShader(),"page-curl":this.getPageCurlShader(),"directional-warp":this.getDirectionalWarpShader(),mosaic:this.getMosaicShader(),"radial-blur":this.getRadialBlurShader(),crosshatch:this.getCrosshatchShader()};for(const[t,i]of Object.entries(r))this.shaderPrograms[t]=this.createShaderProgram(e,i)}createShaderProgram(e,r){const t=this.gl,i=this.compileShader(t.VERTEX_SHADER,e),o=this.compileShader(t.FRAGMENT_SHADER,r),a=t.createProgram();return t.attachShader(a,i),t.attachShader(a,o),t.linkProgram(a),t.getProgramParameter(a,t.LINK_STATUS)?{program:a,locations:{position:t.getAttribLocation(a,"a_position"),texCoord:t.getAttribLocation(a,"a_texCoord"),texture1:t.getUniformLocation(a,"u_texture1"),texture2:t.getUniformLocation(a,"u_texture2"),progress:t.getUniformLocation(a,"u_progress"),resolution:t.getUniformLocation(a,"u_resolution")}}:(console.error("Shader program link error:",t.getProgramInfoLog(a)),null)}compileShader(e,r){const t=this.gl,i=t.createShader(e);return t.shaderSource(i,r),t.compileShader(i),t.getShaderParameter(i,t.COMPILE_STATUS)?i:(console.error("Shader compile error:",t.getShaderInfoLog(i)),t.deleteShader(i),null)}getFadeShader(){return`
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
        `}getDissolveShader(){return`
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
        `}getWipeShader(e){return`
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                gl_FragColor = ${{left:"v_texCoord.x < u_progress",right:"v_texCoord.x > 1.0 - u_progress",up:"v_texCoord.y < u_progress",down:"v_texCoord.y > 1.0 - u_progress"}[e]} ? color2 : color1;
            }
        `}getCircleWipeShader(){return`
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
        `}getDiamondWipeShader(){return`
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
        `}getSlideShader(e){return`
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            varying vec2 v_texCoord;

            void main() {
                vec2 offset = ${{left:"vec2(1.0 - u_progress, 0.0)",right:"vec2(u_progress - 1.0, 0.0)",up:"vec2(0.0, 1.0 - u_progress)",down:"vec2(0.0, u_progress - 1.0)"}[e]};
                vec2 texCoord2 = v_texCoord + offset;

                if (texCoord2.x < 0.0 || texCoord2.x > 1.0 || texCoord2.y < 0.0 || texCoord2.y > 1.0) {
                    gl_FragColor = texture2D(u_texture1, v_texCoord);
                } else {
                    gl_FragColor = texture2D(u_texture2, texCoord2);
                }
            }
        `}getZoomShader(e){return e==="out"?`
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
            `:`
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
            `}getScaleRotateShader(){return`
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
        `}getPixelateShader(){return`
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
        `}getBlurTransitionShader(){return`
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
        `}getGlitchShader(){return`
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
        `}getRippleShader(){return`
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
        `}getSwirlShader(){return`
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
        `}getKaleidoscopeShader(){return`
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
        `}getDreamyShader(){return`
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
        `}getPageCurlShader(){return`
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
        `}getDirectionalWarpShader(){return`
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
        `}getMosaicShader(){return`
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
        `}getRadialBlurShader(){return`
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
        `}getCrosshatchShader(){return`
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
        `}render(e,r,t,i){const o=this.gl,a=this.shaderPrograms[i];if(!a){console.warn("Shader not found:",i);return}o.viewport(0,0,o.canvas.width,o.canvas.height),o.clearColor(0,0,0,1),o.clear(o.COLOR_BUFFER_BIT),o.useProgram(a.program),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,this.texture1),e&&o.texImage2D(o.TEXTURE_2D,0,o.RGBA,o.RGBA,o.UNSIGNED_BYTE,e),o.activeTexture(o.TEXTURE1),o.bindTexture(o.TEXTURE_2D,this.texture2),r&&o.texImage2D(o.TEXTURE_2D,0,o.RGBA,o.RGBA,o.UNSIGNED_BYTE,r),o.uniform1i(a.locations.texture1,0),o.uniform1i(a.locations.texture2,1),o.uniform1f(a.locations.progress,t),o.uniform2f(a.locations.resolution,o.canvas.width,o.canvas.height),o.bindBuffer(o.ARRAY_BUFFER,this.positionBuffer),o.enableVertexAttribArray(a.locations.position),o.vertexAttribPointer(a.locations.position,2,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,this.texCoordBuffer),o.enableVertexAttribArray(a.locations.texCoord),o.vertexAttribPointer(a.locations.texCoord,2,o.FLOAT,!1,0,0),o.drawArrays(o.TRIANGLE_STRIP,0,4)}renderSingleFrame(e){const r=this.gl;r.viewport(0,0,r.canvas.width,r.canvas.height),r.clearColor(0,0,0,1),r.clear(r.COLOR_BUFFER_BIT);const t=this.shaderPrograms.fade;t&&(r.useProgram(t.program),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.texture1),e&&r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,e),r.uniform1i(t.locations.texture1,0),r.uniform1i(t.locations.texture2,0),r.uniform1f(t.locations.progress,0),r.bindBuffer(r.ARRAY_BUFFER,this.positionBuffer),r.enableVertexAttribArray(t.locations.position),r.vertexAttribPointer(t.locations.position,2,r.FLOAT,!1,0,0),r.bindBuffer(r.ARRAY_BUFFER,this.texCoordBuffer),r.enableVertexAttribArray(t.locations.texCoord),r.vertexAttribPointer(t.locations.texCoord,2,r.FLOAT,!1,0,0),r.drawArrays(r.TRIANGLE_STRIP,0,4))}}let u=null;self.onmessage=async function(l){const{type:e,data:r}=l.data;try{switch(e){case"init":const{canvas:t,width:i,height:o}=r;t.width=i,t.height=o,u=new d(t),self.postMessage({type:"init-complete"});break;case"render":const{videoFrame1:a,videoFrame2:s,progress:c,transitionType:n}=r;u&&(s?u.render(a,s,c,n):u.renderSingleFrame(a)),a&&typeof a.close=="function"&&a.close(),s&&typeof s.close=="function"&&s.close(),self.postMessage({type:"render-complete"});break;case"resize":u&&r.canvas&&(r.canvas.width=r.width,r.canvas.height=r.height);break}}catch(t){self.postMessage({type:"error",error:t.message})}};
