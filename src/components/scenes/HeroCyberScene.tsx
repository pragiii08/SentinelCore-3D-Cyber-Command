import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ThreatGlobeNode } from '../../types/security';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  createContactShadowTexture,
  createStudioRenderer,
  createTechGridTexture,
  disposeSceneResources,
} from '../../utils/threeHelpers';

export type HeroSceneMode = 'globe' | 'topology' | 'godseye';

interface HeroCyberSceneProps {
  mode: HeroSceneMode;
  threatNodes: ThreatGlobeNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: ThreatGlobeNode) => void;
  isSoftwareGl: boolean;
}

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _mouse = new THREE.Vector2();

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function severityToColor(severity: ThreatGlobeNode['severity']): number {
  if (severity === 'Critical') return 0xef4444;
  if (severity === 'Warning') return 0xf59e0b;
  return 0x00f0ff;
}

export function HeroCyberScene({
  mode,
  threatNodes,
  selectedNodeId,
  onSelectNode,
  isSoftwareGl,
}: HeroCyberSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<HeroSceneMode>(mode);
  const selectedIdRef = useRef<string | null>(selectedNodeId);
  const onSelectRef = useRef(onSelectNode);
  const nodesRef = useRef(threatNodes);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [webglError, setWebglError] = useState(false);

  modeRef.current = mode;
  selectedIdRef.current = selectedNodeId;
  onSelectRef.current = onSelectNode;
  nodesRef.current = threatNodes;

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
    scene.fog = new THREE.FogExp2(0x090d16, 0.042);

    const envTex = applyStudioEnvironment(renderer, scene);
    addStudioLighting(scene, isSoftwareGl, 9);

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(container.clientWidth, 300) / Math.max(container.clientHeight, 240),
      0.1,
      80,
    );
    camera.position.set(0, 2.8, 7.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 4.6;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.4, 0);

    // Grounded floor & contact shadow
    const gridTex = createTechGridTexture(renderer.capabilities.getMaxAnisotropy());
    const floorMesh = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({
        map: gridTex,
        roughness: 0.88,
        metalness: 0.15,
      }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -2.0;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    const shadowTex = createContactShadowTexture();
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 5.6),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -1.98;
    scene.add(contactShadow);

    // =========================================================================
    // MODE 1: 3D Cyber-Globe Assembly (Multi-part Group)
    // =========================================================================
    const globeRoot = new THREE.Group();
    globeRoot.position.y = 0.45;
    scene.add(globeRoot);

    // Pedestal base (LatheGeometry)
    const pedestalProfile = [
      new THREE.Vector2(0.0, 0),
      new THREE.Vector2(1.45, 0),
      new THREE.Vector2(1.38, 0.14),
      new THREE.Vector2(0.85, 0.28),
      new THREE.Vector2(0.72, 0.42),
      new THREE.Vector2(0.0, 0.42),
    ];
    const pedestalMesh = new THREE.Mesh(
      new THREE.LatheGeometry(pedestalProfile, 32),
      new THREE.MeshStandardMaterial({
        color: 0x111a2c,
        roughness: 0.35,
        metalness: 0.85,
      }),
    );
    pedestalMesh.position.y = -2.45;
    globeRoot.add(pedestalMesh);

    const pedestalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.03, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.6,
      }),
    );
    pedestalRing.rotation.x = Math.PI / 2;
    pedestalRing.position.y = -2.18;
    globeRoot.add(pedestalRing);

    const globeSpinGroup = new THREE.Group();
    globeRoot.add(globeSpinGroup);

    const GLOBE_RADIUS = 1.9;
    const coreSphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(GLOBE_RADIUS * 0.94, 3),
      new THREE.MeshStandardMaterial({
        color: 0x0f1b33,
        roughness: 0.45,
        metalness: 0.72,
      }),
    );
    globeSpinGroup.add(coreSphere);

    const wireframeShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(GLOBE_RADIUS, 2),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.46,
      }),
    );
    globeSpinGroup.add(wireframeShell);

    // Equator & meridian telemetry rings on the globe surface
    const equatorRing = new THREE.Mesh(
      new THREE.TorusGeometry(GLOBE_RADIUS + 0.02, 0.018, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.55 }),
    );
    equatorRing.rotation.x = Math.PI / 2;
    globeSpinGroup.add(equatorRing);

    const meridianRing = new THREE.Mesh(
      new THREE.TorusGeometry(GLOBE_RADIUS + 0.02, 0.015, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.42 }),
    );
    globeSpinGroup.add(meridianRing);

    // Gimbal orbital rings
    const outerGimbal = new THREE.Mesh(
      new THREE.TorusGeometry(GLOBE_RADIUS + 0.38, 0.025, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.9,
      }),
    );
    outerGimbal.rotation.x = Math.PI * 0.36;
    globeRoot.add(outerGimbal);

    const innerGimbal = new THREE.Mesh(
      new THREE.TorusGeometry(GLOBE_RADIUS + 0.22, 0.018, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.85,
      }),
    );
    innerGimbal.rotation.y = Math.PI * 0.25;
    innerGimbal.rotation.x = -Math.PI * 0.22;
    globeRoot.add(innerGimbal);

    // Clickable Threat Nodes on Globe + Curved Arcs + Animated Data Packets
    const interactables: THREE.Object3D[] = [];
    const nodeGroups: { id: string; head: THREE.Mesh; ring: THREE.Mesh; baseColor: number }[] = [];
    const packetTracks: { curve: THREE.QuadraticBezierCurve3; mesh: THREE.Mesh; speed: number; offset: number }[] = [];

    const hubVec = latLonToVec3(42, -10, GLOBE_RADIUS);

    nodesRef.current.forEach((node, idx) => {
      const surfacePos = latLonToVec3(node.lat, node.lon, GLOBE_RADIUS);
      const normal = surfacePos.clone().normalize();
      const colorHex = severityToColor(node.severity);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(surfacePos);
      nodeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Base collar
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.85 }),
      );
      collar.position.y = 0.025;
      nodeGroup.add(collar);

      // Beacon stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10),
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.65,
          roughness: 0.3,
        }),
      );
      stem.position.y = 0.14;
      nodeGroup.add(stem);

      // Beacon head (raycast target)
      const head = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 1.15,
          roughness: 0.2,
          metalness: 0.4,
        }),
      );
      head.position.y = 0.29;
      head.userData = { threatNode: node };
      nodeGroup.add(head);

      // Halo ring
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.015, 8, 24),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7 }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.04;
      nodeGroup.add(halo);

      // Invisible generous proxy sphere for reliable picking
      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.position.y = 0.22;
      hitProxy.userData = { threatNode: node };
      nodeGroup.add(hitProxy);
      interactables.push(hitProxy);

      globeSpinGroup.add(nodeGroup);
      nodeGroups.push({ id: node.id, head, ring: halo, baseColor: colorHex });

      // Arc to central hub
      const midPoint = surfacePos
        .clone()
        .add(hubVec)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(GLOBE_RADIUS + 0.72 + (idx % 2) * 0.2);
      const curve = new THREE.QuadraticBezierCurve3(surfacePos, midPoint, hubVec);
      const arcGeo = new THREE.TubeGeometry(curve, 24, 0.012, 6, false);
      const arcMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.42,
      });
      globeSpinGroup.add(new THREE.Mesh(arcGeo, arcMat));

      // Animated data packet along arc
      const packetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 10),
        new THREE.MeshBasicMaterial({ color: colorHex }),
      );
      globeSpinGroup.add(packetMesh);
      packetTracks.push({
        curve,
        mesh: packetMesh,
        speed: 0.34 + idx * 0.06,
        offset: idx * 0.19,
      });
    });

    // =========================================================================
    // MODE 2: Isometric 3D Network Server Topology
    // =========================================================================
    const topoRoot = new THREE.Group();
    topoRoot.position.y = -0.15;
    topoRoot.visible = modeRef.current === 'topology';
    globeRoot.visible = modeRef.current === 'globe';
    scene.add(topoRoot);

    // Base chassis platform
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.22, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x111a2c, roughness: 0.45, metalness: 0.78 }),
    );
    platform.position.y = -1.72;
    topoRoot.add(platform);

    const platformTrim = new THREE.Mesh(
      new THREE.BoxGeometry(5.92, 0.04, 4.52),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      }),
    );
    platformTrim.position.y = -1.81;
    topoRoot.add(platformTrim);

    // Build 5 multi-part server racks / firewall towers mapped to threatNodes
    const topoPositions: [number, number, number][] = [
      [0, -1.58, 0],        // Central Edge Firewall
      [-1.95, -1.58, 1.1],  // OIDC Server Rack
      [1.95, -1.58, 1.1],   // DMZ Switch Rack
      [-1.85, -1.58, -1.2], // Mail Relay Tower
      [1.85, -1.58, -1.2],  // WAF Node Tower
    ];
    const topoPackets: { curve: THREE.QuadraticBezierCurve3; mesh: THREE.Mesh; speed: number; offset: number }[] = [];

    nodesRef.current.forEach((node, idx) => {
      const [px, py, pz] = topoPositions[idx] || [0, -1.58, 0];
      const colorHex = severityToColor(node.severity);
      const rackGroup = new THREE.Group();
      rackGroup.position.set(px, py, pz);

      const isCenter = idx === 0;
      const height = isCenter ? 2.25 : 1.55;
      const width = isCenter ? 1.05 : 0.82;

      // Primary hull
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        new THREE.MeshStandardMaterial({ color: 0x131d33, roughness: 0.42, metalness: 0.78 }),
      );
      chassis.position.y = height / 2;
      rackGroup.add(chassis);

      // Secondary blades / louver fins
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(width + 0.05, 0.08, width * 0.86),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.85 }),
        );
        blade.position.y = 0.28 + b * (height * 0.2);
        rackGroup.add(blade);
      }

      // Accent glowing crown collar
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.74, 0.14, width * 0.74),
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 1.0,
          roughness: 0.2,
          metalness: 0.5,
        }),
      );
      crown.position.y = height + 0.08;
      crown.userData = { threatNode: node };
      rackGroup.add(crown);

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.25, height + 0.4, width + 0.25),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitBox.position.y = height / 2 + 0.1;
      hitBox.userData = { threatNode: node };
      rackGroup.add(hitBox);
      interactables.push(hitBox);

      topoRoot.add(rackGroup);

      if (idx > 0) {
        const start = new THREE.Vector3(px, py + height * 0.65, pz);
        const end = new THREE.Vector3(0, -1.58 + 1.4, 0);
        const mid = start.clone().add(end).multiplyScalar(0.5);
        mid.y += 0.65;
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const conduit = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 20, 0.02, 6, false),
          new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.45 }),
        );
        topoRoot.add(conduit);

        const packet = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 10, 10),
          new THREE.MeshBasicMaterial({ color: colorHex }),
        );
        topoRoot.add(packet);
        topoPackets.push({ curve, mesh: packet, speed: 0.42 + idx * 0.05, offset: idx * 0.25 });
      }
    });

    // =========================================================================
    // MODE 3: God's Eye — Panoramic Optical Iris & Cross-Domain Correlation
    // =========================================================================
    const godsEyeRoot = new THREE.Group();
    godsEyeRoot.visible = modeRef.current === 'godseye';
    scene.add(godsEyeRoot);

    const irisAssembly = new THREE.Group();
    irisAssembly.position.set(0, 1.65, 0);
    godsEyeRoot.add(irisAssembly);

    // Central optical aperture core
    const eyeLens = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 2),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.95,
        roughness: 0.15,
        metalness: 0.85,
      }),
    );
    irisAssembly.add(eyeLens);

    const irisRingA = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.032, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.7,
        roughness: 0.25,
        metalness: 0.88,
      }),
    );
    irisAssembly.add(irisRingA);

    const irisRingB = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.025, 12, 56),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.85,
      }),
    );
    irisRingB.rotation.x = Math.PI * 0.35;
    irisAssembly.add(irisRingB);

    const irisRingC = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.022, 10, 64),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.85,
      }),
    );
    irisRingC.rotation.y = Math.PI * 0.28;
    irisAssembly.add(irisRingC);

    // Volumetric scan cone sweeping toward radar plane
    const scanCone = new THREE.Mesh(
      new THREE.ConeGeometry(2.35, 3.1, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    scanCone.position.set(0, 0.1, 0);
    godsEyeRoot.add(scanCone);

    // Concentric radar range rings on plane
    const radarRadii = [1.1, 1.9, 2.75];
    for (const r of radarRadii) {
      const radarRing = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.02, r, 64),
        new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
        }),
      );
      radarRing.rotation.x = -Math.PI / 2;
      radarRing.position.y = -1.45;
      godsEyeRoot.add(radarRing);
    }

    const godsEyeNodes: {
      id: string;
      beacon: THREE.Mesh;
      reticle: THREE.Mesh;
      sightMat: THREE.MeshBasicMaterial;
      packet: THREE.Mesh;
      curve: THREE.QuadraticBezierCurve3;
      offset: number;
    }[] = [];

    nodesRef.current.forEach((node, idx) => {
      const angle = (idx / Math.max(nodesRef.current.length, 1)) * Math.PI * 2;
      const radius = 2.65;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const colorHex = severityToColor(node.severity);

      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(px, -1.45, pz);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.32, 0.16, 16),
        new THREE.MeshStandardMaterial({ color: 0x162136, roughness: 0.35, metalness: 0.85 }),
      );
      base.position.y = 0.08;
      pylonGroup.add(base);

      const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 1.0,
          roughness: 0.2,
        }),
      );
      beacon.position.y = 0.42;
      beacon.userData = { threatNode: node };
      pylonGroup.add(beacon);

      const reticle = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.02, 8, 28),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.75 }),
      );
      reticle.rotation.x = Math.PI / 2;
      reticle.position.y = 0.04;
      pylonGroup.add(reticle);

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.position.y = 0.35;
      hitProxy.userData = { threatNode: node };
      pylonGroup.add(hitProxy);
      interactables.push(hitProxy);

      godsEyeRoot.add(pylonGroup);

      // Optical sightline curve from iris down to perimeter pylon
      const start = new THREE.Vector3(0, 1.55, 0);
      const end = new THREE.Vector3(px, -1.03, pz);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += 0.35;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const sightMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
      });
      const sightLine = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 18, 0.018, 6, false),
        sightMat,
      );
      godsEyeRoot.add(sightLine);

      const packet = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color: colorHex }),
      );
      godsEyeRoot.add(packet);

      godsEyeNodes.push({
        id: node.id,
        beacon,
        reticle,
        sightMat,
        packet,
        curve,
        offset: idx * 0.21,
      });
    });

    // Raycasting interaction (throttled pointermove + click)
    const raycaster = new THREE.Raycaster();
    let lastMoveCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateMouse = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 50) return;
      lastMoveCheck = now;
      updateMouse(e);
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      const visibleHit = hits.find((h) => {
        let p: THREE.Object3D | null = h.object;
        while (p) {
          if (!p.visible) return false;
          p = p.parent;
        }
        return true;
      });

      if (visibleHit?.object.userData?.threatNode) {
        const node = visibleHit.object.userData.threatNode as ThreatGlobeNode;
        renderer.domElement.style.cursor = 'pointer';
        setHoveredLabel(`${node.label} (${node.ip})`);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredLabel(null);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      updateMouse(e);
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      const visibleHit = hits.find((h) => {
        let p: THREE.Object3D | null = h.object;
        while (p) {
          if (!p.visible) return false;
          p = p.parent;
        }
        return true;
      });
      if (visibleHit?.object.userData?.threatNode) {
        onSelectRef.current(visibleHit.object.userData.threatNode as ThreatGlobeNode);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Context loss safety
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 300);
      const h = Math.max(container.clientHeight, 240);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestAnimationFrame(() => {
        if (!disposed) renderer.render(scene, camera);
      });
    };
    window.addEventListener('resize', onResize);

    // Animation loop (paced with afterDraw on software WebGL)
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

      const activeMode = modeRef.current;
      globeRoot.visible = activeMode === 'globe';
      topoRoot.visible = activeMode === 'topology';
      godsEyeRoot.visible = activeMode === 'godseye';

      if (activeMode === 'globe') {
        globeSpinGroup.rotation.y += dt * 0.18;
        outerGimbal.rotation.z += dt * 0.12;
        innerGimbal.rotation.z -= dt * 0.16;

        for (const item of nodeGroups) {
          const isSelected = item.id === selectedIdRef.current;
          const targetScale = isSelected ? 1.45 : 1.0;
          const s = THREE.MathUtils.damp(item.head.scale.x, targetScale, 8, dt);
          item.head.scale.setScalar(s);
          item.ring.scale.setScalar(1 + Math.sin(elapsed * 2.5) * 0.12);
        }

        for (const p of packetTracks) {
          const t = (elapsed * p.speed + p.offset) % 1;
          p.curve.getPointAt(t, _vecA);
          p.mesh.position.copy(_vecA);
        }
      } else if (activeMode === 'topology') {
        topoRoot.rotation.y = Math.sin(elapsed * 0.25) * 0.18;
        for (const p of topoPackets) {
          const t = (elapsed * p.speed + p.offset) % 1;
          p.curve.getPointAt(t, _vecB);
          p.mesh.position.copy(_vecB);
        }
      } else {
        eyeLens.rotation.y += dt * 0.7;
        irisRingA.rotation.x += dt * 0.5;
        irisRingA.rotation.y += dt * 0.35;
        irisRingB.rotation.y -= dt * 0.48;
        irisRingC.rotation.z += dt * 0.3;
        scanCone.rotation.y += dt * 0.4;

        for (const item of godsEyeNodes) {
          const isSelected = item.id === selectedIdRef.current;
          const targetScale = isSelected ? 1.4 : 1.0;
          const s = THREE.MathUtils.damp(item.beacon.scale.x, targetScale, 8, dt);
          item.beacon.scale.setScalar(s);
          item.reticle.scale.setScalar(isSelected ? 1.35 : 1.0 + Math.sin(elapsed * 2.4) * 0.08);
          item.sightMat.opacity = isSelected ? 0.92 : 0.32;
          const t = (elapsed * 0.48 + item.offset) % 1;
          item.curve.getPointAt(t, _vecA);
          item.packet.position.copy(_vecA);
        }
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
        <p className="text-sm font-medium text-slate-200">3D WebGL Telemetry Viewport</p>
        <p className="text-xs text-slate-400 mt-1">
          Hardware context unavailable; switch tabs below to inspect telemetry tables.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        data-testid="hero-3d-canvas"
        aria-label="Interactive 3D cybersecurity telemetry viewport"
        className="w-full h-full rounded-xl overflow-hidden"
      />
      {hoveredLabel && (
        <div
          className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-mono text-cyan-200 bg-[#090D16]/90 border border-cyan-400/35"
          aria-live="polite"
        >
          {hoveredLabel} · Click to inspect
        </div>
      )}
    </div>
  );
}
