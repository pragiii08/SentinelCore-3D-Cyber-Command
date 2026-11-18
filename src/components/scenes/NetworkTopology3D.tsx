import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { NetworkLink, NetworkNode } from '../../types/security';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  createStudioRenderer,
  createTechGridTexture,
  disposeSceneResources,
} from '../../utils/threeHelpers';

interface NetworkTopology3DProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  isSoftwareGl: boolean;
}

const _vec = new THREE.Vector3();
const _mouse = new THREE.Vector2();

function statusColor(status: NetworkNode['status']): number {
  if (status === 'alert') return 0xef4444;
  if (status === 'elevated') return 0xf59e0b;
  return 0x10b981;
}

export function NetworkTopology3D({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
  isSoftwareGl,
}: NetworkTopology3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const selectedRef = useRef(selectedNodeId);
  const onSelectRef = useRef(onSelectNode);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [webglError, setWebglError] = useState(false);

  nodesRef.current = nodes;
  linksRef.current = links;
  selectedRef.current = selectedNodeId;
  onSelectRef.current = onSelectNode;

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
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.036);

    const envTex = applyStudioEnvironment(renderer, scene);
    addStudioLighting(scene, isSoftwareGl, 10);

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(container.clientWidth, 320) / Math.max(container.clientHeight, 260),
      0.1,
      80,
    );
    camera.position.set(0, 5.2, 10.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.54;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 0.4);

    // Grounded grid plane
    const gridTex = createTechGridTexture(renderer.capabilities.getMaxAnisotropy());
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.9, metalness: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.0;
    scene.add(floor);

    const nodeMap = new Map<string, NetworkNode>();
    const nodeGroups = new Map<string, { group: THREE.Group; ring: THREE.Mesh }>();
    const hitTargets: THREE.Mesh[] = [];

    for (const node of nodesRef.current) {
      nodeMap.set(node.id, node);
      const group = new THREE.Group();
      group.position.set(...node.position);
      const col = statusColor(node.status);

      // Composite 3-4 part node hardware model
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.56, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0x162136, roughness: 0.35, metalness: 0.85 }),
      );
      group.add(base);

      let core: THREE.Mesh;
      if (node.kind === 'firewall') {
        core = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.88, 0.36),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.3,
            metalness: 0.82,
          }),
        );
        core.position.y = 0.52;
        const shield = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.9,
            roughness: 0.2,
          }),
        );
        shield.position.y = 1.15;
        group.add(shield);
      } else if (node.kind === 'subnet') {
        core = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.32, 6),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 }),
        );
        core.position.y = 0.25;
      } else if (node.kind === 'sensor') {
        core = new THREE.Mesh(
          new THREE.ConeGeometry(0.36, 0.65, 16),
          new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.35, metalness: 0.75 }),
        );
        core.position.y = 0.4;
      } else {
        core = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.72, 0.46),
          new THREE.MeshStandardMaterial({ color: 0x131d33, roughness: 0.4, metalness: 0.75 }),
        );
        core.position.y = 0.45;
      }
      group.add(core);

      // Glowing status crown ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.032, 10, 32),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.95,
          roughness: 0.2,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      group.add(ring);

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.position.y = 0.45;
      hitProxy.userData = { nodeId: node.id, nodeName: `${node.name} (${node.ip})` };
      group.add(hitProxy);
      hitTargets.push(hitProxy);

      scene.add(group);
      nodeGroups.set(node.id, { group, ring });
    }

    // Links + animated packet orbs
    const linkEntries: {
      link: NetworkLink;
      curve: THREE.QuadraticBezierCurve3;
      tubeMat: THREE.MeshBasicMaterial;
      packet: THREE.Mesh;
      speed: number;
      offset: number;
    }[] = [];

    linksRef.current.forEach((link, idx) => {
      const src = nodeMap.get(link.sourceId);
      const dst = nodeMap.get(link.targetId);
      if (!src || !dst) return;

      const p0 = new THREE.Vector3(...src.position).add(new THREE.Vector3(0, 0.35, 0));
      const p2 = new THREE.Vector3(...dst.position).add(new THREE.Vector3(0, 0.35, 0));
      const mid = p0.clone().add(p2).multiplyScalar(0.5);
      mid.y += 0.55;

      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
      const colorHex = link.anomaly ? 0xef4444 : 0x00f0ff;
      const tubeMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: link.anomaly ? 0.8 : 0.45,
      });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.024, 6, false), tubeMat);
      scene.add(tube);

      const packet = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 10),
        new THREE.MeshBasicMaterial({ color: link.anomaly ? 0xef4444 : 0x10b981 }),
      );
      scene.add(packet);

      linkEntries.push({
        link,
        curve,
        tubeMat,
        packet,
        speed: link.anomaly ? 0.65 : 0.38 + (idx % 3) * 0.08,
        offset: idx * 0.17,
      });
    });

    // Raycasting
    const raycaster = new THREE.Raycaster();
    let lastMove = 0;
    let downPos = { x: 0, y: 0 };

    const updateMouse = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMove < 50) return;
      lastMove = now;
      updateMouse(e);
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        renderer.domElement.style.cursor = 'pointer';
        setHoveredName(hits[0].object.userData.nodeName as string);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredName(null);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      updateMouse(e);
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.nodeId as string;
        onSelectRef.current(selectedRef.current === id ? null : id);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestAnimationFrame(() => {
        if (!disposed) renderer.render(scene, camera);
      });
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += dt;

      const selectedId = selectedRef.current;

      for (const [id, entry] of nodeGroups.entries()) {
        const isSel = selectedId === id;
        const targetScale = isSel ? 1.24 : 1.0;
        const s = THREE.MathUtils.damp(entry.group.scale.x, targetScale, 8, dt);
        entry.group.scale.setScalar(s);
        entry.ring.rotation.z = elapsed * 0.6;
      }

      for (const item of linkEntries) {
        const connected =
          !selectedId ||
          item.link.sourceId === selectedId ||
          item.link.targetId === selectedId;
        item.tubeMat.opacity = connected ? (item.link.anomaly ? 0.9 : 0.68) : 0.14;
        const t = (elapsed * item.speed + item.offset) % 1;
        item.curve.getPointAt(t, _vec);
        item.packet.position.copy(_vec);
        item.packet.visible = connected;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(
          renderer,
          () => {
            if (!disposed) rafId = requestAnimationFrame(tick);
          },
          (id) => {
            timerId = id;
          },
        );
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
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
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0B111E] border border-cyan-500/20 rounded-xl p-6 text-center">
        <p className="text-sm font-medium text-slate-200">3D Network Topology Fallback</p>
        <p className="text-xs text-slate-400 mt-1">
          WebGL context unavailable; use the right-hand node &amp; port telemetry table.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        data-testid="network-3d-canvas"
        aria-label="3D Network Subnet and Endpoint Topology"
        className="w-full h-full rounded-xl overflow-hidden"
      />
      {hoveredName && (
        <div
          className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-mono text-cyan-200 bg-[#090D16]/90 border border-cyan-400/35"
          aria-live="polite"
        >
          {hoveredName} · Click to isolate links
        </div>
      )}
    </div>
  );
}
