const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    // Keep cream and pink broad, with burgundy at the pattern's peaks.
    float r1 = smoothstep(.15, .65 + .1 * edgesWidth + edge_blur, mixer);
    float r2 = smoothstep(.88, 1. + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    vec2 logical_resolution = u_resolution / u_pixelRatio;
    uv *= (noise_scale * logical_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * logical_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}
`;


// Aurora shader and preset adapted from the supplied AnimatedGradient component.
function mountGradient() {
  const canvas = document.createElement('canvas');
  canvas.className = 'animated-gradient';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return;

  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return;
  let frame = 0;
  let disposed = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function cleanup() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', resume);
    motion.removeEventListener('change', resume);
    window.removeEventListener('pagehide', onPageHide);
    for (const shader of shaders) gl!.deleteShader(shader);
    gl!.deleteProgram(program);
    gl!.deleteBuffer(buffer);
    canvas.remove();
  }

  for (const [kind, source] of [
    [gl.VERTEX_SHADER, '#version 300 es\nin vec4 a_position; void main() { gl_Position = a_position; }'],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
  ] as const) {
    const shader = gl.createShader(kind);
    if (!shader) { cleanup(); return; }
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { cleanup(); return; }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { cleanup(); return; }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const timeUniform = uniform('u_time');
  const resolutionUniform = uniform('u_resolution');
  const ratioUniform = uniform('u_pixelRatio');
  const values = {
    u_scale: 0.1,
    u_rotation: -25 * Math.PI / 180,
    u_proportion: 0.35,
    u_softness: 1,
    u_shape: 0,
    u_shapeScale: 0.5,
    u_distortion: 0.05,
    u_swirl: 0.1,
    u_swirlIterations: 10,
  };
  for (const [name, value] of Object.entries(values)) gl.uniform1f(uniform(name), value);
  // Read the shared palette so the shader follows changes in style.css.
  const palette = getComputedStyle(document.documentElement);
  for (const [name, property] of [
    ['u_color1', '--ivory'],
    ['u_color2', '--bubblegum'],
    ['u_color3', '--burgundy'],
  ]) {
    const hex = palette.getPropertyValue(property).trim().slice(1);
    gl.uniform4f(uniform(name),
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255, 1);
  }

  const start = performance.now();
  function draw(time: number) {
    if (disposed) return;
    gl!.uniform1f(timeUniform, motion.matches ? 2 : (time - start) / 1000 * 0.04 + 2);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    if (!motion.matches && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function resize() {
    // One rendered pixel per four CSS pixels keeps the background inexpensive.
    const ratio = 0.25;
    canvas.width = Math.max(1, Math.round(window.innerWidth * ratio));
    canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(resolutionUniform, canvas.width, canvas.height);
    gl!.uniform1f(ratioUniform, ratio);
    resume();
  }
  function resume() {
    cancelAnimationFrame(frame);
    if (!document.hidden) draw(performance.now());
  }
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    cleanup();
  });
  window.addEventListener('resize', resize);
  function onPageHide(event: PageTransitionEvent) {
    if (!event.persisted) cleanup();
  }
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', resume);
  motion.addEventListener('change', resume);
  document.body.prepend(canvas);
  resize();
}

mountGradient();
