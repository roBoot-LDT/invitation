// Two-layer rendering with a blurred background ("lens focused on the column").
// Background objects live on BG_LAYER: they are rendered at half resolution into a texture,
// blurred with a separable gaussian at quarter resolution, and composited behind the sharp foreground.
import * as THREE from 'three';

import { BG_LAYER } from './layers.js';
export { BG_LAYER };

const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export function createBlurPipeline(renderer) {
  const type = THREE.HalfFloatType; // linear colour without banding
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type });
  const ping = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
  const pong = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });

  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: fullscreenVert,
    // 9-tap gaussian with linear-sampling offsets; colours are premultiplied, so alpha blurs correctly
    fragmentShader: /* glsl */ `
      uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
      void main() {
        vec4 s = texture2D(tex, vUv) * 0.2270270270;
        s += (texture2D(tex, vUv + dir * 1.3846153846) + texture2D(tex, vUv - dir * 1.3846153846)) * 0.3162162162;
        s += (texture2D(tex, vUv + dir * 3.2307692308) + texture2D(tex, vUv - dir * 3.2307692308)) * 0.0702702703;
        gl_FragColor = s;
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  // Composite: un-premultiply → tone map → sRGB → premultiply again for the transparent canvas.
  const outMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null } },
    vertexShader: fullscreenVert,
    fragmentShader: /* glsl */ `
      uniform sampler2D tex; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tex, vUv);
        gl_FragColor = vec4(c.a > 0.001 ? c.rgb / c.a : vec3(0.0), c.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb *= gl_FragColor.a;
      }`,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthTest: false, depthWrite: false, toneMapped: true,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2();

  renderer.autoClear = false;
  renderer.shadowMap.autoUpdate = false;

  function setSize() {
    renderer.getDrawingBufferSize(size);
    sceneRT.setSize(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
    ping.setSize(Math.max(1, size.x >> 2), Math.max(1, size.y >> 2));
    pong.setSize(Math.max(1, size.x >> 2), Math.max(1, size.y >> 2));
  }

  function pass(src, dst, dx, dy) {
    blurMat.uniforms.tex.value = src.texture;
    blurMat.uniforms.dir.value.set(dx / dst.width, dy / dst.height);
    quad.material = blurMat;
    renderer.setRenderTarget(dst);
    renderer.render(quadScene, quadCam);
  }

  // amount: blur radius in quarter-resolution pixels (0 = no extra blur, just the soft half-res render)
  function render(scene, camera, amount) {
    const layers = camera.layers.mask;

    // 1) background, half resolution; the shadow map from the previous frame is reused
    camera.layers.set(BG_LAYER);
    renderer.setRenderTarget(sceneRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);

    // 2) blur: downsample into ping, then two horizontal+vertical rounds with growing radius
    pass(sceneRT, ping, 0, 0);
    pass(ping, pong, amount, 0);
    pass(pong, ping, 0, amount);
    pass(ping, pong, amount * 1.8, 0);
    pass(pong, ping, 0, amount * 1.8);

    // 3) composite the blurred background onto the (transparent) canvas
    renderer.setRenderTarget(null);
    renderer.clear();
    outMat.uniforms.tex.value = ping.texture;
    quad.material = outMat;
    renderer.render(quadScene, quadCam);

    // 4) sharp foreground on top; it also refreshes the shadow map (column/vine casters)
    camera.layers.set(0);
    renderer.clearDepth();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    camera.layers.mask = layers;
  }

  return { render, setSize };
}
