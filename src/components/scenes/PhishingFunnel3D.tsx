import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { FunnelMetrics } from '../../utils/securityLogic';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  createStudioRenderer,
  disposeSceneResources,
} from '../../utils/threeHelpers';

interface PhishingFunnel3DProps {
  metrics: FunnelMetrics;
  isSoftwareGl: boolean;
}

export function PhishingFunnel3D({ metrics, isSoftwareGl }: PhishingFunnel3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef(metrics);
  const triggerRef = useRef<(() => void) | null>(null);
  const [webglError, setWebglError] = useState(false);

  metricsRef.current = metrics;

  useEffect(() => {
    triggerRef.current?.();
  }, [metrics]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createStudioRenderer(container, isSoftwareGl);
    } catch {
      setWebglError(true);
      return;
    }
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101b);
    const envTex = applyStudioEnvironment(renderer, scene);
    addStudioLighting(scene, isSoftwareGl, 6);

    const camera = new THREE.PerspectiveCamera(
      36,
      Math.max(container.clientWidth, 280) / Math.max(container.clientHeight, 240),
      0.1,
      50,
    );
    camera.position.set(0, 2.2, 6.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 9.5;
    controls.enableDamping = false;
    controls.target.set(0, 0.1, 0);

    // Base plate
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 0.16, 48),
      new THREE.MeshStandardMaterial({ color: 0x111a2c, roughness: 0.45, metalness: 0.78 }),
    );
    plate.position.y = -1.65;
    scene.add(plate);

    // 4 Tapered Funnel Tiers: Sent (top), Opened, Reported (emerald), Clicked (crimson)
    const stageSpecs = [
      { y: 1.15, color: 0x00f0ff, height: 0.62 },
      { y: 0.32, color: 0x38bdf8, height: 0.62 },
      { y: -0.5, color: 0x10b981, height: 0.62 },
      { y: -1.25, color: 0xef4444, height: 0.52 },
    ];

    const stageMeshes: { body: THREE.Mesh; collar: THREE.Mesh; currentScale: number }[] = [];

    for (const spec of stageSpecs) {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 0.78, spec.height, 40),
        new THREE.MeshStandardMaterial({
          color: spec.color,
          emissive: spec.color,
          emissiveIntensity: 0.35,
          roughness: 0.28,
          metalness: 0.55,
        }),
      );
      body.position.y = spec.y;
      scene.add(body);

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.032, 10, 48),
        new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.25,
          metalness: 0.9,
        }),
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = spec.y + spec.height / 2;
      scene.add(collar);

      stageMeshes.push({ body, collar, currentScale: 1 });
    }

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    const applyMetrics = (dt: number): boolean => {
      const m = metricsRef.current;
      const targets = [
        1.75,
        Math.max(0.55, 1.75 * (m.openRatePct / 100)),
        Math.max(0.45, 1.75 * (m.reportRatePct / 100)),
        Math.max(0.32, 1.75 * Math.max(m.clickRatePct / 100, 0.16)),
      ];

      let moving = false;
      for (let i = 0; i < stageMeshes.length; i++) {
        const st = stageMeshes[i];
        const next = THREE.MathUtils.damp(st.currentScale, targets[i], 8, dt);
        if (Math.abs(next - targets[i]) > 0.005) moving = true;
        st.currentScale = next;
        st.body.scale.set(next, 1, next);
        st.collar.scale.set(next, next, 1);
      }
      return moving;
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      rafId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.08);
        lastTime = now;

        const moving = applyMetrics(dt);
        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (disposed) return;
          if (moving || renderDirty) requestRender();
        };

        if (isSoftwareGl) {
          afterDraw(renderer, done, (id) => {
            timerId = id;
          });
        } else {
          done();
        }
      });
    };

    triggerRef.current = () => {
      lastTime = performance.now();
      requestRender();
    };

    controls.addEventListener('change', requestRender);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 280);
      const h = Math.max(container.clientHeight, 240);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', requestRender);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      envTex.dispose();
      disposeSceneResources(scene);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isSoftwareGl]);

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0B101B] p-4 text-center text-xs text-slate-400">
        3D funnel viewport unavailable; conversion metrics are displayed below.
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="phishing-funnel-3d-canvas"
      aria-label="3D Phishing Delivery and Click Rate Funnel"
      className="w-full h-full rounded-lg overflow-hidden"
    />
  );
}
