import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnomalyBucket } from '../../types/security';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  createStudioRenderer,
  disposeSceneResources,
} from '../../utils/threeHelpers';

interface LogAnomaly3DBarsProps {
  buckets: AnomalyBucket[];
  selectedBucketIndex: number | null;
  onSelectBucket: (index: number | null) => void;
  isSoftwareGl: boolean;
}

const _mouse = new THREE.Vector2();

export function LogAnomaly3DBars({
  buckets,
  selectedBucketIndex,
  onSelectBucket,
  isSoftwareGl,
}: LogAnomaly3DBarsProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const bucketsRef = useRef(buckets);
  const selectedRef = useRef(selectedBucketIndex);
  const onSelectRef = useRef(onSelectBucket);
  const triggerUpdateRef = useRef<(() => void) | null>(null);
  const [webglError, setWebglError] = useState(false);

  bucketsRef.current = buckets;
  selectedRef.current = selectedBucketIndex;
  onSelectRef.current = onSelectBucket;

  useEffect(() => {
    triggerUpdateRef.current?.();
  }, [buckets, selectedBucketIndex]);

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
      Math.max(container.clientWidth, 300) / Math.max(container.clientHeight, 220),
      0.1,
      50,
    );
    camera.position.set(1.8, 3.8, 8.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 5.5;
    controls.maxDistance = 13;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.enableDamping = false;
    controls.target.set(0, 1.1, 0);

    // Base plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.24, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x111a2c, roughness: 0.45, metalness: 0.75 }),
    );
    plinth.position.y = -0.12;
    scene.add(plinth);

    const plinthEdge = new THREE.Mesh(
      new THREE.BoxGeometry(8.88, 0.04, 2.48),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.35,
        roughness: 0.3,
      }),
    );
    plinthEdge.position.y = 0.01;
    scene.add(plinthEdge);

    // 12 stacked 3D bar groups
    const barUnitGeo = new THREE.BoxGeometry(0.42, 1, 0.42);
    const collarGeo = new THREE.BoxGeometry(0.48, 0.05, 0.48);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.85 });
    const infoMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.35,
    });
    const warnMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.35,
    });
    const critMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.35,
    });

    interface BarRig {
      index: number;
      infoMesh: THREE.Mesh;
      warnMesh: THREE.Mesh;
      critMesh: THREE.Mesh;
      collarMesh: THREE.Mesh;
      currentInfo: number;
      currentWarn: number;
      currentCrit: number;
    }

    const rigs: BarRig[] = [];
    const hitTargets: THREE.Mesh[] = [];

    for (let i = 0; i < 12; i++) {
      const x = -3.85 + i * 0.7;
      const group = new THREE.Group();
      group.position.set(x, 0.03, 0);

      const collarMesh = new THREE.Mesh(collarGeo, collarMat);
      collarMesh.position.y = 0.025;
      group.add(collarMesh);

      const infoMesh = new THREE.Mesh(barUnitGeo, infoMat);
      const warnMesh = new THREE.Mesh(barUnitGeo, warnMat);
      const critMesh = new THREE.Mesh(barUnitGeo, critMat);
      group.add(infoMesh, warnMesh, critMesh);

      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 2.8, 0.9),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitMesh.position.y = 1.4;
      hitMesh.userData = { bucketIndex: i };
      group.add(hitMesh);
      hitTargets.push(hitMesh);

      scene.add(group);
      rigs.push({
        index: i,
        infoMesh,
        warnMesh,
        critMesh,
        collarMesh,
        currentInfo: 0.05,
        currentWarn: 0.05,
        currentCrit: 0.05,
      });
    }

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTickTime = performance.now();

    let isFirstPaint = true;

    const applyBarHeights = (dt: number): boolean => {
      const list = bucketsRef.current;
      let stillMoving = false;
      const unitScale = 0.65;

      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i];
        const b = list[i];
        const targetInfo = b && b.infoCount > 0 ? Math.min(b.infoCount * unitScale, 1.15) : 0.04;
        const targetWarn = b && b.warningCount > 0 ? Math.min(b.warningCount * unitScale, 1.15) : 0.04;
        const targetCrit = b && b.criticalCount > 0 ? Math.min(b.criticalCount * unitScale, 1.35) : 0.04;

        if (isFirstPaint) {
          rig.currentInfo = targetInfo;
          rig.currentWarn = targetWarn;
          rig.currentCrit = targetCrit;
        } else {
          rig.currentInfo = THREE.MathUtils.damp(rig.currentInfo, targetInfo, 9, dt);
          rig.currentWarn = THREE.MathUtils.damp(rig.currentWarn, targetWarn, 9, dt);
          rig.currentCrit = THREE.MathUtils.damp(rig.currentCrit, targetCrit, 9, dt);

          if (
            Math.abs(rig.currentInfo - targetInfo) > 0.004 ||
            Math.abs(rig.currentWarn - targetWarn) > 0.004 ||
            Math.abs(rig.currentCrit - targetCrit) > 0.004
          ) {
            stillMoving = true;
          }
        }

        const selected = selectedRef.current === i;
        const xzScale = selected ? 1.24 : 1.0;

        let yCursor = 0.05;
        rig.infoMesh.scale.set(xzScale, rig.currentInfo, xzScale);
        rig.infoMesh.position.y = yCursor + rig.currentInfo / 2;
        yCursor += rig.currentInfo;

        rig.warnMesh.scale.set(xzScale, rig.currentWarn, xzScale);
        rig.warnMesh.position.y = yCursor + rig.currentWarn / 2;
        yCursor += rig.currentWarn;

        rig.critMesh.scale.set(xzScale, rig.currentCrit, xzScale);
        rig.critMesh.position.y = yCursor + rig.currentCrit / 2;

        rig.collarMesh.scale.set(xzScale, 1, xzScale);
      }

      isFirstPaint = false;
      return stillMoving;
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
        const dt = Math.min((now - lastTickTime) / 1000, 0.08);
        lastTickTime = now;

        const moving = applyBarHeights(dt);
        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (disposed) return;
          if (moving || renderDirty) {
            requestRender();
          }
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

    triggerUpdateRef.current = () => {
      lastTickTime = performance.now();
      requestRender();
    };

    controls.addEventListener('change', requestRender);

    const raycaster = new THREE.Raycaster();
    let downPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.bucketIndex as number;
        onSelectRef.current(selectedRef.current === idx ? null : idx);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 300);
      const h = Math.max(container.clientHeight, 220);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
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
        3D anomaly bar viewport unavailable; filter SIEM events below.
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="log-anomaly-3d-canvas"
      aria-label="3D Anomaly Spike Bar Chart"
      className="w-full h-full rounded-lg overflow-hidden"
    />
  );
}
