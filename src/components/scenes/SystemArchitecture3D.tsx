import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ArchitectureLayer } from '../../types/security';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  createStudioRenderer,
  disposeSceneResources,
} from '../../utils/threeHelpers';

interface SystemArchitecture3DProps {
  layers: ArchitectureLayer[];
  selectedLayerId: string;
  onSelectLayer: (layerId: string) => void;
  exploded: boolean;
  isSoftwareGl: boolean;
}

const _mouse = new THREE.Vector2();

export function SystemArchitecture3D({
  layers,
  selectedLayerId,
  onSelectLayer,
  exploded,
  isSoftwareGl,
}: SystemArchitecture3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const layersRef = useRef(layers);
  const selectedRef = useRef(selectedLayerId);
  const explodedRef = useRef(exploded);
  const onSelectRef = useRef(onSelectLayer);
  const triggerRef = useRef<(() => void) | null>(null);
  const [webglError, setWebglError] = useState(false);

  layersRef.current = layers;
  selectedRef.current = selectedLayerId;
  explodedRef.current = exploded;
  onSelectRef.current = onSelectLayer;

  useEffect(() => {
    triggerRef.current?.();
  }, [selectedLayerId, exploded]);

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
    addStudioLighting(scene, isSoftwareGl, 7);

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(container.clientWidth, 300) / Math.max(container.clientHeight, 260),
      0.1,
      60,
    );
    camera.position.set(4.8, 3.8, 6.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 12;
    controls.enableDamping = false;
    controls.target.set(0, 0.1, 0);

    // Ordered bottom to top (index 1..4)
    const ordered = [...layersRef.current].sort((a, b) => a.index - b.index);
    const layerGroups: {
      id: string;
      group: THREE.Group;
      slabMat: THREE.MeshStandardMaterial;
      edgeMat: THREE.MeshStandardMaterial;
      baseIndex: number;
      currentY: number;
    }[] = [];
    const hitTargets: THREE.Mesh[] = [];

    ordered.forEach((layer, idx) => {
      const group = new THREE.Group();
      const colorVal = new THREE.Color(layer.colorHex);

      // Primary slab
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x111a2c,
        roughness: 0.32,
        metalness: 0.78,
        transparent: true,
        opacity: 0.92,
      });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.22, 2.8), slabMat);
      group.add(slab);

      // Glowing perimeter frame
      const edgeMat = new THREE.MeshStandardMaterial({
        color: colorVal,
        emissive: colorVal,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.6,
      });
      const frontBar = new THREE.Mesh(new THREE.BoxGeometry(3.86, 0.06, 0.06), edgeMat);
      frontBar.position.set(0, 0.09, 1.41);
      group.add(frontBar);

      const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.86), edgeMat);
      rightBar.position.set(1.91, 0.09, 0);
      group.add(rightBar);

      // Internal module blocks on top of slab
      for (let m = 0; m < 3; m++) {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.14, 1.8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 }),
        );
        block.position.set(-1.15 + m * 1.15, 0.16, 0);
        group.add(block);
      }

      const hitProxy = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 0.45, 3.0),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.userData = { layerId: layer.id };
      group.add(hitProxy);
      hitTargets.push(hitProxy);

      const initialY = (idx - 1.5) * 0.75;
      group.position.y = initialY;
      scene.add(group);
      layerGroups.push({
        id: layer.id,
        group,
        slabMat,
        edgeMat,
        baseIndex: idx,
        currentY: initialY,
      });
    });

    // Vertical optical data risers at corners
    const riserGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.4, 8);
    const riserMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.25 });
    const riserCorners: [number, number][] = [
      [-1.7, -1.2],
      [1.7, -1.2],
      [-1.7, 1.2],
      [1.7, 1.2],
    ];
    for (const [rx, rz] of riserCorners) {
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(rx, 0, rz);
      scene.add(riser);
    }

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    const updateLayers = (dt: number): boolean => {
      const spacing = explodedRef.current ? 1.18 : 0.62;
      let moving = false;

      for (const item of layerGroups) {
        const targetY = (item.baseIndex - 1.5) * spacing;
        item.currentY = THREE.MathUtils.damp(item.currentY, targetY, 9, dt);
        item.group.position.y = item.currentY;
        if (Math.abs(item.currentY - targetY) > 0.004) moving = true;

        const isSelected = item.id === selectedRef.current;
        const targetScale = isSelected ? 1.06 : 1.0;
        const s = THREE.MathUtils.damp(item.group.scale.x, targetScale, 9, dt);
        item.group.scale.set(s, 1, s);
        if (Math.abs(s - targetScale) > 0.003) moving = true;

        item.edgeMat.emissiveIntensity = isSelected ? 1.25 : 0.45;
        item.slabMat.color.setHex(isSelected ? 0x17243d : 0x111a2c);
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

        const moving = updateLayers(dt);
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
        onSelectRef.current(hits[0].object.userData.layerId as string);
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
      const h = Math.max(container.clientHeight, 260);
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
        3D architecture diagram unavailable; inspect tiers using Layer buttons on the right.
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="architecture-3d-canvas"
      aria-label="Interactive 3D Layered System Architecture Diagram"
      className="w-full h-full rounded-lg overflow-hidden"
    />
  );
}
