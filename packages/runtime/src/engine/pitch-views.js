import { parseRig } from '../rig/validate.ts';
import { headLandmarks, headViewWarp, pitchViewWeights, prepareHeadMorph } from './head-warp.js';
import { pitchMorphs } from './head-morph.js';

export function pitchViewPackages(rig, sheet, asset) {
  pitchMorphs(rig, sheet);
  return rig.head.pitch.views.map(({ id, angleY }) => {
    const view = sheet.pitchViews?.[id];
    if (!view || !view.layers || typeof view.layers !== 'object') throw new Error(`Pitch view ${id}: missing layer metadata`);
    const posedRig = parseRig(view.rig);
    if (posedRig.head.pitch?.views?.length) throw new Error(`Pitch view ${id}: nested views are not supported`);
    if (posedRig.image.width !== rig.image.width || posedRig.image.height !== rig.image.height)
      throw new Error(`Pitch view ${id}: image size must match the neutral rig`);
    const aliases = {}, layers = {}, sprites = {};
    const map = (name, target, sprite = false) => {
      if (!/^[A-Za-z0-9_-]+$/.test(name) || typeof target !== 'string' || !/^pitch_view_[A-Za-z0-9_-]+$/.test(target)
        || !Object.hasOwn(sheet.layers, target)) throw new Error(`Pitch view ${id}: invalid image alias ${name}`);
      aliases[`${sprite ? 'sprites/' : ''}${name}.png`] = asset(`sprites/${target}.png`, sheet.build);
      (sprite ? sprites : layers)[name] = sheet.layers[target];
    };
    for (const [name, target] of Object.entries(view.layers)) map(name, target);
    for (const [name, target] of Object.entries(view.sprites ?? {})) map(name, target, true);
    const required = ['base', 'hairmask', ...[0, 1].flatMap(i => ['ball', 'lash', 'low', 'crease'].map(p => `eye${i}_${p}`)),
      ...(posedRig.hand ? ['hand'] : []), ...(posedRig.accessories ?? []).map(t => t.name)];
    for (const name of required) if (!Object.hasOwn(aliases, `${name}.png`)) throw new Error(`Pitch view ${id}: missing ${name}`);
    return { id, angleY, rig: posedRig, assets: aliases, metadata: { build: sheet.build, layers, eyes: posedRig.eyes },
      spriteMetadata: Object.keys(sprites).length ? { build: sheet.build, layers: sprites } : null };
  });
}

function compositor(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
  if (!gl) throw new Error('WebGL2 is required for drawn pitch views');
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(error); }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, `#version 300 es
    out vec2 uv;
    void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); uv=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`);
  const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; in vec2 uv; uniform sampler2D a; uniform sampler2D b; uniform float blend; out vec4 color;
    void main(){ color=mix(texture(a,uv),texture(b,uv),blend); }`);
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const error = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(error); }
  const vao = gl.createVertexArray();
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  const mix = gl.getUniformLocation(program, 'blend');
  return {
    draw(first, second, weight) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr)), height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST);
      gl.colorMask(true, true, true, true); gl.useProgram(program); gl.bindVertexArray(vao);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      for (const [i, image] of [first, second].entries()) {
        if (i === 1 && first === second) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[0]); continue; }
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      }
      gl.uniform1i(gl.getUniformLocation(program, 'a'), 0); gl.uniform1i(gl.getUniformLocation(program, 'b'), 1);
      gl.uniform1f(mix, weight); gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); textures.forEach(t => gl.deleteTexture(t)); gl.deleteVertexArray(vao); gl.deleteProgram(program); },
  };
}

export async function createPitchViewAvatar(canvas, options, sheet, asset, createAvatar) {
  const packages = pitchViewPackages(options.rig, sheet, asset);
  const morphs = pitchMorphs(options.rig, sheet);
  const neutralRig = structuredClone(options.rig); delete neutralRig.head.pitch.views;
  const container = canvas.ownerDocument.createElement('div');
  container.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;';
  container.setAttribute('aria-hidden', 'true');
  canvas.ownerDocument.body.appendChild(container);
  const nodes = [];
  let composite, raf = 0, destroyed = false;
  const removeSurfaces = () => {
    // These canvases are private and will never be reused by the caller. Release
    // their contexts explicitly so repeated project loads do not exhaust WebGL.
    for (const surface of container.querySelectorAll('canvas')) surface.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    container.remove();
  };
  const resize = () => { container.style.width = `${Math.max(1, canvas.clientWidth)}px`; container.style.height = `${Math.max(1, canvas.clientHeight)}px`; };
  resize();
  try {
    for (const pack of [{ id: 'neutral', angleY: 0, rig: neutralRig, assets: options.assets }, ...packages]) {
      const surface = canvas.ownerDocument.createElement('canvas');
      surface.style.cssText = 'width:100%;height:100%;display:block;'; container.appendChild(surface);
      const sources = morphs.filter(m => [m.from, m.to].includes(pack.id)).map(m => ({ key: `${m.from}:${m.to}`,
        grid: m.grid, field: pack.id === m.from ? m.forward : m.backward, sourceBand: pack.rig.head.weightBand,
        neutralBand: neutralRig.head.weightBand, toCanonical: headViewWarp(pack.rig, headLandmarks(neutralRig)) }));
      const avatar = await createAvatar(surface, { ...options, rig: pack.rig, assets: pack.assets, manual: true,
        _headMorphSources: sources.length ? sources : undefined,
        _metadata: pack.metadata, _sprites: pack.spriteMetadata });
      nodes.push({ ...pack, surface, avatar, landmarks: headLandmarks(pack.rig) });
    }
    composite = compositor(canvas);
    const root = nodes[0].avatar;
    let selected = 0, previous = 0, fade = 1;
    const step = dt => {
      resize(); root.advanceParameters(dt);
      const p = root.getParameters(), active = pitchViewWeights(nodes.map(n => n.angleY), p.angleY ?? 0);
      const mood = root._spriteMood();
      const nearest = active.reduce((a, b) => b.weight > a.weight ? b : a).index;
      // Keep one crisp drawing at a held angle. A brief temporal dissolve hides
      // changes in painted hair/clip contours; angle-based dissolves leave ghosts.
      if (nearest !== selected && Math.abs((p.angleY ?? 0) - nodes[nearest].angleY) + 1 < Math.abs((p.angleY ?? 0) - nodes[selected].angleY)) {
        previous = fade < 0.5 ? previous : selected; selected = nearest; fade = 0;
      }
      fade = dt > 0 ? Math.min(1, fade + dt / 0.08) : 1;
      const target = { x: [0, 0], y: [0, 0, 0, 0, 0] };
      for (const { index, weight } of active) for (const key of ['x', 'y'])
        nodes[index].landmarks[key].forEach((v, i) => { target[key][i] += v * weight; });
      const pair = active.length === 2 ? morphs.find(m => active.every(v => [m.from, m.to].includes(nodes[v.index].id))) : null;
      const continuous = morphs.length > 0;
      if (continuous) { selected = active.at(-1).index; previous = active[0].index; fade = active.at(-1).weight; }
      nodes.forEach((node, index) => {
        const drawn = index !== 0 || (p.angleY ?? 0) < 0;
        const part = pair && active.find(v => v.index === index);
        const morph = part ? prepareHeadMorph({ key: `${pair.from}:${pair.to}`, grid: pair.grid, field: node.id === pair.from ? pair.forward : pair.backward,
          weight: 1 - part.weight, sourceBottom: node.rig.head.weightBand[1],
          sourceBand: node.rig.head.weightBand, neutralBand: neutralRig.head.weightBand,
          toCanonical: headViewWarp(node.rig, nodes[0].landmarks), fromCanonical: headViewWarp(neutralRig, target) }) : undefined;
        node.avatar._setHeadWarp(drawn ? headViewWarp(node.rig, target, morph) : null);
        // One motion/expression clock drives every drawing. Each view keeps its own
        // rig, eye clipping, mouth sprites and physics, including while not visible.
        node.avatar._renderParameters(p, dt, continuous ? active.some(v => v.index === index) : index === selected || (fade < 1 && index === previous), mood);
      });
      if (continuous) composite.draw(nodes[previous].surface, nodes[selected].surface, previous === selected ? 0 : fade);
      else composite.draw(nodes[fade < 1 ? previous : selected].surface, nodes[selected].surface, fade < 1 ? fade : 0);
    };
    const advance = (seconds, fps = 60) => {
      if (destroyed) return;
      if (seconds === 0) step(0);
      else for (let i = 0; i < Math.round(seconds * fps); i++) step(1 / fps);
    };
    const forward = method => value => { for (const node of nodes) node.avatar[method](value); };
    let last = performance.now();
    const frame = now => { const dt = Math.max(0.001, Math.min(0.05, (now - last) / 1000)); last = now; step(dt); raf = requestAnimationFrame(frame); };
    if (!options.manual) raf = requestAnimationFrame(frame);
    return Object.assign({}, root, { advance,
      setViewport: forward('setViewport'), setLighting: forward('setLighting'), setSwayGain: forward('setSwayGain'),
      destroy() {
        if (destroyed) return; destroyed = true; cancelAnimationFrame(raf);
        for (const node of nodes) node.avatar.destroy(); composite.destroy(); removeSurfaces();
      },
    });
  } catch (error) {
    cancelAnimationFrame(raf); for (const node of nodes) node.avatar.destroy(); composite?.destroy(); removeSurfaces(); throw error;
  }
}
