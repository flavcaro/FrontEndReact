import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line } from "react-konva";

export default function Canvas({
  lines = [],
  onMouseDown,
  onMouseMove,
  onMouseUp,
  isArtist,
  nickname,
  chaosEffects
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const clientWidth = container.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // Calculate available vertical space from the container itself.
      // Important: layout (CSS) controls header/chat/players sizing — the canvas
      // should simply use the space its parent provides to avoid double layout
      // calculations that cause jumps on resize (especially on mobile/Safari).
      const availableHeight = Math.max(160, Math.floor(container.clientHeight));

      // Respect both viewport width and height constraints so canvas scales proportionally
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vwConstraint = Math.floor(vw * 0.88); // ridotto da 0.99 a 0.88 per dare più margini
      // Prefer using the real center column width to determine available canvas horizontal space
      let availableHorizontal = clientWidth;
      const centerEl = document.querySelector('.board-center');
      if (centerEl) {
        const centerRect = centerEl.getBoundingClientRect();
        const gutter = 10; // aumentato per dare più spazio
        // subtract center paddings / floating palette area
        availableHorizontal = Math.max(220, Math.floor(centerRect.width - gutter * 2));
      } else {
        // Fallback: compute from board minus sidebars
        const board = document.querySelector('.board-container');
        if (board) {
          const boardRect = board.getBoundingClientRect();
          const playersEl = document.querySelector('.players-sidebar');
          const chatEl = document.querySelector('.chat-sidebar');
          const playersW = playersEl && playersEl.offsetParent !== null ? playersEl.getBoundingClientRect().width : 0;
          const chatW = chatEl && chatEl.offsetParent !== null ? chatEl.getBoundingClientRect().width : 0;
          const reserved = Math.max(16, Math.floor((playersW || 0) + (chatW || 0)) + 32);
          availableHorizontal = Math.max(220, Math.floor(boardRect.width - reserved));
        }
      }
      const vhConstraint = Math.floor((window.innerHeight || document.documentElement.clientHeight) * 0.72); // ridotto da 0.80 a 0.72 per bilanciamento

      // Ensure canvas height never exceeds its wrapper visible height (avoids creating page scroll)
      const containerRect = container.getBoundingClientRect();
      // Limit container available height to the smaller of the container's actual height
      // and the previously computed availableHeight (based on viewport minus header/sidebars).
      // This prevents cases on mobile where the container's rect can be much larger
      // than the viewport (causing an oversized canvas).
      const rawContainerHeight = Math.floor(containerRect.height - 16);
      const containerAvailableHeight = Math.max(160, Math.min(rawContainerHeight, availableHeight + 16));

      // Compute sensible minimums so the canvas doesn't become visually tiny
      const minWidth = Math.max(220, Math.floor(vw * 0.2));
      const minHeight = Math.max(180, Math.floor(vh * 0.2));

      // Allow rectangular canvas: width limited by availableHorizontal and vwConstraint,
      // height limited by availableHeight and vhConstraint
      const computedWidth = Math.max(minWidth, Math.min(availableHorizontal, clientWidth, vwConstraint));
      let computedHeight = Math.max(minHeight, Math.min(availableHeight, vhConstraint));
      computedHeight = Math.min(computedHeight, containerAvailableHeight);

      setDimensions({ width: computedWidth, height: computedHeight });
    };

    updateDimensions();

    const node = containerRef.current;
    let ro;
    if (typeof ResizeObserver !== 'undefined' && node) {
      ro = new ResizeObserver(updateDimensions);
      ro.observe(node);
    }

    window.addEventListener('resize', updateDimensions);
    document.addEventListener('fullscreenchange', updateDimensions);

    return () => {
      if (ro && node) ro.unobserve(node);
      window.removeEventListener('resize', updateDimensions);
      document.removeEventListener('fullscreenchange', updateDimensions);
    };
  }, []);

  // Build combined visual styles while preserving multiple transforms
  const visualEffects = Array.isArray(chaosEffects) ? chaosEffects.filter(e => e && e.type === 'visual') : [];
  const transformParts = [];
  const otherStyle = {};
  visualEffects.forEach(effect => {
    if (effect.style) {
      if (effect.style.transform) transformParts.push(effect.style.transform);
      Object.keys(effect.style).forEach(k => {
        if (k !== 'transform') otherStyle[k] = effect.style[k];
      });
    }
  });

  const wrapperStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    transform: transformParts.join(' '),
    transformOrigin: 'center center',
    ...otherStyle
  };

  // If tremble visual present, animate inner container instead of overriding transforms
  const trembleActive = Array.isArray(chaosEffects) && chaosEffects.some(e => e && e.id === 'trembleVisual');
  const skewActive = Array.isArray(chaosEffects) && chaosEffects.some(e => e && e.id === 'skew');

  const [trembleAnimation, setTrembleAnimation] = useState(null);

  // Create dynamic tremble keyframes and periodically re-generate intensity/zoom
  useEffect(() => {
    if (!trembleActive) {
      setTrembleAnimation(null);
      return;
    }

    const styleId = 'chaos-tremble-keyframes';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const trembleEffect = Array.isArray(chaosEffects) ? chaosEffects.find(e => e && e.id === 'trembleVisual') : null;

    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const getRange = (key, fallback) => {
      if (trembleEffect && trembleEffect.params) {
        // generateChaosEffects writes resolved values and preserves ranges as _keyRange
        if (trembleEffect.params[`_${key}Range`]) return trembleEffect.params[`_${key}Range`];
        if (trembleEffect.params[key] && typeof trembleEffect.params[key] === 'object' && 'min' in trembleEffect.params[key]) return trembleEffect.params[key];
      }
      return fallback;
    };

    const ampRange = getRange('amplitudeRange', { min: 0, max: 2 });
    const durRange = getRange('durationRange', { min: 800, max: 1600 });
    const zoomRange = getRange('zoomRange', { min: 105, max: 140 });
    const switchRange = getRange('switchIntervalRange', { min: 1500, max: 4000 });

    let intervalId = null;

    const generate = () => {
      const amp = randInt(ampRange.min, ampRange.max);
      const duration = randInt(durRange.min, durRange.max);
      const switchInterval = randInt(switchRange.min, switchRange.max);

      // stronger random zoom values (percent => scale)
      const s1 = randInt(zoomRange.min, zoomRange.max) / 100;
      const s2 = randInt(zoomRange.min, zoomRange.max) / 100;
      const s3 = randInt(zoomRange.min, zoomRange.max) / 100;

      // Keep translations very subtle when amplitude is small
      const tx1 = amp === 0 ? 0 : randInt(-amp, amp);
      const ty1 = amp === 0 ? 0 : randInt(-amp, amp);
      const tx2 = amp === 0 ? 0 : randInt(-amp, amp);
      const ty2 = amp === 0 ? 0 : randInt(-amp, amp);
      const tx3 = amp === 0 ? 0 : randInt(-amp, amp);
      const ty3 = amp === 0 ? 0 : randInt(-amp, amp);

      // Random transform-origins (percentages) to make zoom focus on random canvas points
      const ox1 = randInt(10, 90);
      const oy1 = randInt(10, 90);
      const ox2 = randInt(10, 90);
      const oy2 = randInt(10, 90);
      const ox3 = randInt(10, 90);
      const oy3 = randInt(10, 90);

      const keyframes = `@keyframes chaos-tremble { 
        0% { transform-origin: 50% 50%; transform: translate(0px,0px) scale(1); }
        25% { transform-origin: ${ox1}% ${oy1}%; transform: translate(${tx1}px, ${ty1}px) scale(${s1}); }
        50% { transform-origin: ${ox2}% ${oy2}%; transform: translate(${tx2}px, ${ty2}px) scale(${s2}); }
        75% { transform-origin: ${ox3}% ${oy3}%; transform: translate(${tx3}px, ${ty3}px) scale(${s3}); }
        100% { transform-origin: 50% 50%; transform: translate(0px,0px) scale(1); }
      }`;

      styleEl.innerHTML = keyframes;
      // use gentle easing and slightly longer durations by default
      setTrembleAnimation(`chaos-tremble ${duration}ms infinite ease-in-out`);

      // reset interval using new switchInterval
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(generate, switchInterval);
    };

    generate();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      setTrembleAnimation(null);
    };
  }, [trembleActive, chaosEffects]);

  // Create dynamic skew filter (SVG displacement) when `skew` effect is active
  useEffect(() => {
    if (!skewActive) {
      const existing = document.getElementById('chaos-skew-svg');
      if (existing) existing.remove();
      return;
    }

    const skewEffect = Array.isArray(chaosEffects) ? chaosEffects.find(e => e && e.id === 'skew') : null;
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const getRange = (key, fallback) => {
      if (skewEffect && skewEffect.params) {
        if (skewEffect.params[`_${key}Range`]) return skewEffect.params[`_${key}Range`];
        if (skewEffect.params[key] && typeof skewEffect.params[key] === 'object' && 'min' in skewEffect.params[key]) return skewEffect.params[key];
      }
      return fallback;
    };

    const scaleRange = getRange('scaleRange', { min: 6, max: 24 });
    const baseFreqRange = getRange('baseFreqRange', { min: 3, max: 12 });
    const seedRange = getRange('seedRange', { min: 1, max: 1000 });

    const createFilter = () => {
      // Create a single, static but strong deformation filter
      const scale = randInt(scaleRange.min, scaleRange.max) * 1.5; // amplify
      // use a more aggressive baseFrequency (divide by 100 to get larger values)
      const bf = randInt(baseFreqRange.min, baseFreqRange.max) / 100; // e.g. 0.08 - 0.8
      const seed = randInt(seedRange.min, seedRange.max);

      // build SVG defs with multiple turbulence layers + displacement for stronger warps
      const svgId = 'chaos-skew-svg';
      const filterId = 'chaos-skew-filter';
      const existing = document.getElementById(svgId);
      if (existing) existing.remove();

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', svgId);
      svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', filterId);

      // strong low-frequency turbulence
      const feTurb1 = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
      feTurb1.setAttribute('type', 'turbulence');
      feTurb1.setAttribute('baseFrequency', `${bf} ${bf}`);
      feTurb1.setAttribute('numOctaves', '4');
      feTurb1.setAttribute('seed', `${seed}`);
      feTurb1.setAttribute('result', 'turb1');

      // higher-frequency turbulence to create fine warp details
      const feTurb2 = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
      feTurb2.setAttribute('type', 'turbulence');
      feTurb2.setAttribute('baseFrequency', `${Math.max(bf * 3, 0.1)} ${Math.max(bf * 3, 0.1)}`);
      feTurb2.setAttribute('numOctaves', '3');
      feTurb2.setAttribute('seed', `${seed + 7}`);
      feTurb2.setAttribute('result', 'turb2');

      // combine turbulences
      const feBlend = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend');
      feBlend.setAttribute('in', 'turb1');
      feBlend.setAttribute('in2', 'turb2');
      feBlend.setAttribute('mode', 'multiply');
      feBlend.setAttribute('result', 'blend');

      const feBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      feBlur.setAttribute('in', 'blend');
      feBlur.setAttribute('stdDeviation', '3');
      feBlur.setAttribute('result', 'blur');

      const feDisp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
      feDisp.setAttribute('in', 'SourceGraphic');
      feDisp.setAttribute('in2', 'blur');
      feDisp.setAttribute('scale', `${scale}`);
      feDisp.setAttribute('xChannelSelector', 'R');
      feDisp.setAttribute('yChannelSelector', 'G');

      filter.appendChild(feTurb1);
      filter.appendChild(feTurb2);
      filter.appendChild(feBlend);
      filter.appendChild(feBlur);
      filter.appendChild(feDisp);
      defs.appendChild(filter);
      svg.appendChild(defs);
      document.body.appendChild(svg);
    };

    // create once — static deformation
    createFilter();

    return () => {
      const existing = document.getElementById('chaos-skew-svg');
      if (existing) existing.remove();
    };
  }, [skewActive, chaosEffects]);

  // combine inner styles (tremble animation + optional skew filter)
  const innerStyle = {};
  if (trembleAnimation) innerStyle.animation = trembleAnimation;
  if (skewActive) innerStyle.filter = 'url(#chaos-skew-filter)';

  return (
    <div
      className="canvas-wrapper"
      ref={containerRef}
      style={wrapperStyle}
    >
      <div
        className="canvas-stage-inner"
        style={{
          width: dimensions.width > 0 ? `${dimensions.width}px` : '100%',
          height: dimensions.height > 0 ? `${dimensions.height}px` : '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...innerStyle
        }}
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            className="canvas-stage"
            style={{ display: 'block', width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
            pixelRatio={window.devicePixelRatio || 1}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          >
            <Layer>
              {lines.map((line, i) => {
                let strokeColor = line && line.color ? line.color : "#1e293b";
                if (isArtist && line && line.temp && line.user !== nickname) {
                  strokeColor = "#cbd5e1";
                }

                const pts = Array.isArray(line && line.points) ? line.points : [];

                // Calculate stroke width based on canvas size for consistent appearance
                // Use square root scaling so strokes don't grow too thick on large canvases
                const baseCanvasSize = 600;
                const currentCanvasSize = Math.min(dimensions.width, dimensions.height);
                const scaleFactor = Math.sqrt(currentCanvasSize / baseCanvasSize);
                const baseStrokeWidth = 2.5;
                const baseEraserWidth = 16;
                const scaledStrokeWidth = baseStrokeWidth * scaleFactor;
                const scaledEraserWidth = baseEraserWidth * scaleFactor;

                return (
                  <Line
                    key={(line && line.id) || i}
                    points={pts.map((p, idx) => (idx % 2 === 0 ? p * dimensions.width : p * dimensions.height))}
                    stroke={strokeColor}
                    strokeWidth={line && line.eraser ? scaledEraserWidth : scaledStrokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={line && line.eraser ? 'destination-out' : 'source-over'}
                  />
                );
              })}
            </Layer>
          </Stage>
        )}
      </div>

    </div>
  );
}