import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  createStudioRenderer,
  disposeSceneResources,
} from '../../utils/threeHelpers';

interface HealthGauge3DProps {
  score: number; // 0..100
  isSoftwareGl: boolean;
}

export function HealthGauge3D({ score, isSoftwareGl }: HealthGauge3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef(score);
  const triggerRef = useRef<(() => void) | null>(null);
  const [webglError, setWebglError] = useState(false);

  scoreRef.current = score;

  useEffect(() => {
    triggerRef.current?.();
  }, [score]);

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
    addStudioLighting(scene, isSoftwareGl, 5);

    const camera = new THREE.PerspectiveCamera(
      36,
      Math.max(container.clientWidth, 260) / Math.max(container.clientHeight, 220),
      0.1,
      40,
    );
    camera.position.set(0, 0.8, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 3.8;
    controls.maxDistance = 8.0;
    controls.enableDamping = false;
    controls.target.set(0, 0, 0);

    // Multi-part Gauge Instrument Assembly
    const gaugeGroup = new THREE.Group();
    scene.add(gaugeGroup);

    // 1. Machined dark titanium outer bezel
    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.14, 18, 64),
      new THREE.MeshStandardMaterial({ color: 0x162136, roughness: 0.28, metalness: 0.88 }),
    );
    gaugeGroup.add(bezel);

    // 2. Backplate dial housing
    const backplate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.72, 1.78, 0.22, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1424, roughness: 0.65, metalness: 0.45 }),
    );
    backplate.rotation.x = Math.PI / 2;
    backplate.position.z = -0.14;
    gaugeGroup.add(backplate);

    // 3. 24 radial segmented indicator blocks spanning 240 degrees (-120 deg to +120 deg)
    const segmentCount = 24;
    const startAngle = (Math.PI * 7) / 6; // bottom-left
    const totalArc = (Math.PI * 4) / 3;  // 240 deg sweep
    const segmentMeshes: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
    const segGeo = new THREE.BoxGeometry(0.11, 0.26, 0.12);

    for (let i = 0; i < segmentCount; i++) {
      const t = i / (segmentCount - 1);
      const angle = startAngle - t * totalArc;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0x000000,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.5,
      });
      const seg = new THREE.Mesh(segGeo, mat);
      const r = 1.38;
      seg.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.04);
      seg.rotation.z = angle - Math.PI / 2;
      gaugeGroup.add(seg);
      segmentMeshes.push({ mesh: seg, mat });
    }

    // 4. Precision needle assembly
    const needleGroup = new THREE.Group();
    needleGroup.position.z = 0.12;
    gaugeGroup.add(needleGroup);

    const needleCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.14, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.9 }),
    );
    needleCap.rotation.x = Math.PI / 2;
    needleGroup.add(needleCap);

    const needleBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 1.18, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.6,
      }),
    );
    needleBlade.position.y = 0.52;
    needleGroup.add(needleBlade);

    let currentScore = scoreRef.current;
    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    const updateGaugeVisuals = (dt: number): boolean => {
      const target = scoreRef.current;
      currentScore = THREE.MathUtils.damp(currentScore, target, 8, dt);
      const moving = Math.abs(currentScore - target) > 0.15;

      const norm = THREE.MathUtils.clamp(currentScore / 100, 0, 1);
      // Needle rotation around Z: +120 deg at 0, -120 deg at 100
      const targetRot = (Math.PI * 2) / 3 - norm * ((Math.PI * 4) / 3);
      needleGroup.rotation.z = targetRot;

      const activeColor =
        currentScore >= 80 ? 0x10b981 : currentScore >= 60 ? 0x00f0ff : 0xef4444;

      const activeCount = Math.round(norm * segmentCount);
      for (let i = 0; i < segmentCount; i++) {
        const { mat } = segmentMeshes[i];
        if (i < activeCount) {
          mat.color.setHex(activeColor);
          mat.emissive.setHex(activeColor);
          mat.emissiveIntensity = 0.95;
        } else {
          mat.color.setHex(0x283852);
          mat.emissive.setHex(0x09101d);
          mat.emissiveIntensity = 0.2;
        }
      }

      const bladeMat = needleBlade.material as THREE.MeshStandardMaterial;
      bladeMat.color.setHex(activeColor);
      bladeMat.emissive.setHex(activeColor);

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

        const moving = updateGaugeVisuals(dt);
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
      const w = Math.max(container.clientWidth, 260);
      const h = Math.max(container.clientHeight, 220);
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
        3D health gauge unavailable; posture score is displayed below.
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="health-gauge-3d-canvas"
      aria-label="3D System Health Radial Gauge"
      className="w-full h-full rounded-lg overflow-hidden"
    />
  );
}
