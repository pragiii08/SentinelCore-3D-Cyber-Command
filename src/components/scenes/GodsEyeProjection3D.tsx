import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type {
  GodsEyeLayerFilter,
  GodsEyeSensorMode,
  GodsEyeThreatArcItem,
  ModuleTab,
  NetworkLink,
  NetworkNode,
} from '../../types/security';
import {
  addStudioLighting,
  afterDraw,
  applyStudioEnvironment,
  disposeSceneResources,
} from '../../utils/threeHelpers';

export interface GodsEyeInspectedEntity {
  id: string;
  kind: 'node' | 'threat';
  title: string;
  subtitle: string;
  severityLabel: string;
  metricLabel: string;
  targetModule: ModuleTab;
}

interface GodsEyeProjection3DProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  threatArcs: GodsEyeThreatArcItem[];
  layerFilter: GodsEyeLayerFilter;
  sensorMode: GodsEyeSensorMode;
  searchQuery: string;
  showWireframeCage: boolean;
  showTargetBoxes: boolean;
  onInspectEntity: (entity: GodsEyeInspectedEntity | null) => void;
  isSoftwareGl: boolean;
}

interface TrackedProjectionTarget {
  id: string;
  code: string;
  sublabel: string;
  isAlert: boolean;
  worldPos: THREE.Vector3;
  entity: GodsEyeInspectedEntity;
  searchText: string;
  kind: 'node' | 'threat';
}

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _mouse = new THREE.Vector2();

function nodeStatusColor(status: NetworkNode['status']): number {
  if (status === 'alert') return 0xef4444;
  if (status === 'elevated') return 0xf59e0b;
  return 0x00f0ff;
}

function sensorPrimaryHex(mode: GodsEyeSensorMode): number {
  if (mode === 'nvg') return 0x10b981;
  if (mode === 'flir') return 0xf59e0b;
  if (mode === 'crt') return 0x38bdf8;
  return 0x00f0ff;
}

function sensorSecondaryHex(mode: GodsEyeSensorMode): number {
  if (mode === 'nvg') return 0x34d399;
  if (mode === 'flir') return 0xef4444;
  if (mode === 'crt') return 0x10b981;
  return 0x10b981;
}

function nodeGeometryByKind(kind: NetworkNode['kind']): THREE.BufferGeometry {
  switch (kind) {
    case 'firewall':
      return new THREE.OctahedronGeometry(0.46, 0);
    case 'subnet':
      return new THREE.CylinderGeometry(0.38, 0.44, 0.42, 6);
    case 'sensor':
      return new THREE.DodecahedronGeometry(0.36, 0);
    case 'endpoint':
      return new THREE.ConeGeometry(0.32, 0.56, 4);
    default:
      return new THREE.BoxGeometry(0.56, 0.64, 0.56);
  }
}

export function GodsEyeProjection3D({
  nodes,
  links,
  threatArcs,
  layerFilter,
  sensorMode,
  searchQuery,
  showWireframeCage,
  showTargetBoxes,
  onInspectEntity,
  isSoftwareGl,
}: GodsEyeProjection3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const boxRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const threatArcsRef = useRef(threatArcs);
  const layerFilterRef = useRef<GodsEyeLayerFilter>(layerFilter);
  const sensorModeRef = useRef<GodsEyeSensorMode>(sensorMode);
  const searchQueryRef = useRef<string>(searchQuery);
  const showCageRef = useRef<boolean>(showWireframeCage);
  const showBoxesRef = useRef<boolean>(showTargetBoxes);
  const onInspectRef = useRef(onInspectEntity);
  const rebuildThreatsRef = useRef<(() => void) | null>(null);
  const [hoveredText, setHoveredText] = useState<string | null>(null);
  const [webglError, setWebglError] = useState(false);

  nodesRef.current = nodes;
  linksRef.current = links;
  threatArcsRef.current = threatArcs;
  layerFilterRef.current = layerFilter;
  sensorModeRef.current = sensorMode;
  searchQueryRef.current = searchQuery.trim().toLowerCase();
  showCageRef.current = showWireframeCage;
  showBoxesRef.current = showTargetBoxes;
  onInspectRef.current = onInspectEntity;

  const threatSignature = threatArcs.map((a) => a.id).join('|');

  useEffect(() => {
    rebuildThreatsRef.current?.();
  }, [threatSignature]);

  // Memoize tracked targets for screen-space bounding boxes (up to 7 spatially separated targets)
  const trackedTargets = useMemo<TrackedProjectionTarget[]>(() => {
    const items: TrackedProjectionTarget[] = [];
    const preferredNodeIds = new Set(['fw-edge', 'srv-api', 'srv-db', 'end-ws']);
    const featuredNodes = nodes.filter((n) => preferredNodeIds.has(n.id));
    for (const node of featuredNodes.length > 0 ? featuredNodes : nodes.slice(0, 4)) {
      items.push({
        id: `box-node-${node.id}`,
        code: node.name.split(' ').slice(0, 2).join('-').toUpperCase(),
        sublabel: `${node.ip} · ${node.throughputMbps}M`,
        isAlert: node.status !== 'nominal',
        worldPos: new THREE.Vector3(
          node.position[0] * 0.9,
          node.position[1] * 0.65 + 0.2,
          node.position[2] * 0.9,
        ),
        entity: {
          id: node.id,
          kind: 'node',
          title: node.name,
          subtitle: `${node.ip} · ${node.subnet}`,
          severityLabel: node.status.toUpperCase(),
          metricLabel: `${node.throughputMbps} Mbps · ${node.packetLossPct}% loss`,
          targetModule: 'network',
        },
        searchText: `${node.name} ${node.ip} ${node.subnet}`.toLowerCase(),
        kind: 'node',
      });
    }
    const maxThreats = Math.min(threatArcs.length, 3);
    for (let idx = 0; idx < maxThreats; idx++) {
      const arc = threatArcs[idx];
      const angle = (idx / Math.max(threatArcs.length, 1)) * Math.PI * 2 + 0.35;
      const perimeterRadius = 5.45;
      items.push({
        id: `box-threat-${arc.id}`,
        code: arc.signature.slice(0, 14).toUpperCase(),
        sublabel: arc.sourceIp,
        isAlert: true,
        worldPos: new THREE.Vector3(
          Math.cos(angle) * perimeterRadius,
          1.55 + (idx % 2) * 0.75,
          Math.sin(angle) * perimeterRadius,
        ),
        entity: {
          id: arc.id,
          kind: 'threat',
          title: arc.signature,
          subtitle: `${arc.sourceIp} -> ${arc.targetHost}`,
          severityLabel: arc.severity,
          metricLabel: `Vector targeting ${arc.targetHost}`,
          targetModule: arc.targetModule,
        },
        searchText: `${arc.signature} ${arc.sourceIp} ${arc.targetHost}`.toLowerCase(),
        kind: 'threat',
      });
    }
    return items;
  }, [nodes, threatArcs]);

  const trackedTargetsRef = useRef<TrackedProjectionTarget[]>(trackedTargets);
  trackedTargetsRef.current = trackedTargets;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: true,
        preserveDrawingBuffer: isSoftwareGl,
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 300);
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const envTex = applyStudioEnvironment(renderer, scene);
    addStudioLighting(scene, isSoftwareGl, 12);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 5.3, 12.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 6.5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.54;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.4, 0);

    // =========================================================================
    // 1. Translucent Wireframe Dome, Orbital Satellites & Dual Horizon Grids
    // =========================================================================
    const cageGroup = new THREE.Group();
    scene.add(cageGroup);

    const primaryCageMats: THREE.MeshBasicMaterial[] = [];
    const secondaryCageMats: THREE.MeshBasicMaterial[] = [];

    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.13,
    });
    primaryCageMats.push(domeMat);
    const domeWireframe = new THREE.Mesh(new THREE.IcosahedronGeometry(7.2, 2), domeMat);
    domeWireframe.position.y = 0.3;
    cageGroup.add(domeWireframe);

    const orbitRingMatA = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.3,
    });
    primaryCageMats.push(orbitRingMatA);
    const orbitRingA = new THREE.Mesh(new THREE.TorusGeometry(6.35, 0.016, 8, 80), orbitRingMatA);
    orbitRingA.rotation.x = Math.PI * 0.42;
    orbitRingA.rotation.y = Math.PI * 0.12;
    cageGroup.add(orbitRingA);

    const orbitRingMatB = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.28,
    });
    secondaryCageMats.push(orbitRingMatB);
    const orbitRingB = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.016, 8, 80), orbitRingMatB);
    orbitRingB.rotation.x = -Math.PI * 0.36;
    orbitRingB.rotation.z = Math.PI * 0.18;
    cageGroup.add(orbitRingB);

    const satellites: { mesh: THREE.Group; radius: number; tiltX: number; tiltZ: number; speed: number; offset: number }[] = [];
    for (let s = 0; s < 3; s++) {
      const satGroup = new THREE.Group();
      const satBody = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true }),
      );
      const satWing = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.02, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true }),
      );
      satGroup.add(satBody, satWing);
      cageGroup.add(satGroup);
      satellites.push({
        mesh: satGroup,
        radius: s === 0 ? 6.35 : 5.9,
        tiltX: s === 0 ? Math.PI * 0.42 : -Math.PI * 0.36,
        tiltZ: s === 0 ? 0.12 : 0.18,
        speed: 0.32 + s * 0.14,
        offset: s * 2.1,
      });
    }

    const outerHorizonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.34,
    });
    primaryCageMats.push(outerHorizonMat);
    const outerHorizonRing = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.024, 8, 72), outerHorizonMat);
    outerHorizonRing.rotation.x = Math.PI / 2;
    outerHorizonRing.position.y = -1.6;
    cageGroup.add(outerHorizonRing);

    const innerHorizonMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.28,
    });
    secondaryCageMats.push(innerHorizonMat);
    const innerHorizonRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.018, 8, 64), innerHorizonMat);
    innerHorizonRing.rotation.x = Math.PI / 2;
    innerHorizonRing.position.y = -1.6;
    cageGroup.add(innerHorizonRing);

    const upperLatticeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.11,
    });
    primaryCageMats.push(upperLatticeMat);
    const upperLattice = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 13.5, 14, 14), upperLatticeMat);
    upperLattice.rotation.x = -Math.PI / 2;
    upperLattice.position.y = -1.62;
    cageGroup.add(upperLattice);

    const lowerLatticeMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    secondaryCageMats.push(lowerLatticeMat);
    const lowerLattice = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 10.5, 10, 10), lowerLatticeMat);
    lowerLattice.rotation.x = -Math.PI / 2;
    lowerLattice.position.y = -2.2;
    cageGroup.add(lowerLattice);

    // Overhead God's Eye Optical Iris & Wireframe Scan Cone
    const reticleGroup = new THREE.Group();
    reticleGroup.position.set(0, 3.85, 0);
    cageGroup.add(reticleGroup);

    const eyeCoreMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    primaryCageMats.push(eyeCoreMat);
    const eyeCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 1), eyeCoreMat);
    reticleGroup.add(eyeCore);

    const eyeRingInnerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.72,
    });
    primaryCageMats.push(eyeRingInnerMat);
    const eyeRingInner = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 8, 48), eyeRingInnerMat);
    eyeRingInner.rotation.x = Math.PI * 0.3;
    reticleGroup.add(eyeRingInner);

    const eyeRingOuterMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.52,
    });
    secondaryCageMats.push(eyeRingOuterMat);
    const eyeRingOuter = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.018, 8, 56), eyeRingOuterMat);
    eyeRingOuter.rotation.y = Math.PI * 0.25;
    reticleGroup.add(eyeRingOuter);

    const scanConeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.09,
    });
    primaryCageMats.push(scanConeMat);
    const wireframeScanCone = new THREE.Mesh(
      new THREE.ConeGeometry(5.2, 5.4, 18, 2, true),
      scanConeMat,
    );
    wireframeScanCone.position.set(0, 1.15, 0);
    cageGroup.add(wireframeScanCone);

    // =========================================================================
    // 2. Network Traffic Wireframe Graph (Mounted Once)
    // =========================================================================
    const trafficGroup = new THREE.Group();
    scene.add(trafficGroup);

    const nodeInteractables: THREE.Object3D[] = [];
    const threatInteractables: THREE.Object3D[] = [];
    const nodePosMap = new Map<string, THREE.Vector3>();
    const nodeRecords: {
      id: string;
      searchText: string;
      wireMat: THREE.MeshBasicMaterial;
      coreMat: THREE.MeshBasicMaterial;
      group: THREE.Group;
    }[] = [];

    nodesRef.current.forEach((node) => {
      const pos = new THREE.Vector3(
        node.position[0] * 0.9,
        node.position[1] * 0.65 + 0.2,
        node.position[2] * 0.9,
      );
      nodePosMap.set(node.id, pos);
      const colorHex = nodeStatusColor(node.status);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(pos);

      const baseGeo = nodeGeometryByKind(node.kind);

      const coreMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.22,
      });
      nodeGroup.add(new THREE.Mesh(baseGeo, coreMat));

      const wireMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        wireframe: true,
        transparent: true,
        opacity: 0.88,
      });
      const wireMesh = new THREE.Mesh(baseGeo, wireMat);
      wireMesh.scale.setScalar(1.06);
      nodeGroup.add(wireMesh);

      const tetherHeight = Math.max(0.2, pos.y - -1.62);
      const tether = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, tetherHeight, 6),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.32,
        }),
      );
      tether.position.y = -tetherHeight / 2;
      nodeGroup.add(tether);

      const footprint = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.38, 24),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
        }),
      );
      footprint.rotation.x = -Math.PI / 2;
      footprint.position.y = -tetherHeight + 0.02;
      nodeGroup.add(footprint);

      const entity: GodsEyeInspectedEntity = {
        id: node.id,
        kind: 'node',
        title: node.name,
        subtitle: `${node.ip} · ${node.subnet}`,
        severityLabel: node.status.toUpperCase(),
        metricLabel: `${node.throughputMbps} Mbps · ${node.packetLossPct}% loss`,
        targetModule: 'network',
      };

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.userData = { entity };
      nodeGroup.add(hitProxy);
      nodeInteractables.push(hitProxy);

      trafficGroup.add(nodeGroup);
      nodeRecords.push({
        id: node.id,
        searchText: `${node.name} ${node.ip} ${node.subnet} ${node.kind}`.toLowerCase(),
        wireMat,
        coreMat,
        group: nodeGroup,
      });
    });

    const trafficPackets: {
      curve: THREE.LineCurve3;
      mesh: THREE.Mesh;
      speed: number;
      offset: number;
    }[] = [];

    linksRef.current.forEach((link, idx) => {
      const start = nodePosMap.get(link.sourceId);
      const end = nodePosMap.get(link.targetId);
      if (!start || !end) return;

      const colorHex = link.anomaly ? 0xef4444 : 0x00f0ff;
      const curve = new THREE.LineCurve3(start, end);

      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, link.anomaly ? 0.028 : 0.016, 6, false),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          wireframe: true,
          transparent: true,
          opacity: link.anomaly ? 0.72 : 0.36,
        }),
      );
      trafficGroup.add(tube);

      const packet = new THREE.Mesh(
        new THREE.OctahedronGeometry(link.anomaly ? 0.085 : 0.06, 0),
        new THREE.MeshBasicMaterial({
          color: link.anomaly ? 0xef4444 : 0x10b981,
        }),
      );
      trafficGroup.add(packet);

      trafficPackets.push({
        curve,
        mesh: packet,
        speed: link.anomaly ? 0.72 : 0.38 + (idx % 3) * 0.08,
        offset: idx * 0.17,
      });
    });

    // =========================================================================
    // 3. Active Threat Vectors (In-place updatable without tearing down WebGL)
    // =========================================================================
    const threatGroup = new THREE.Group();
    scene.add(threatGroup);

    const threatRecords: {
      id: string;
      searchText: string;
      beacon: THREE.Mesh;
      arcMat: THREE.MeshBasicMaterial;
      packet: THREE.Mesh;
      curve: THREE.QuadraticBezierCurve3;
      speed: number;
      offset: number;
    }[] = [];

    const rebuildThreatGroup = () => {
      // Dispose prior threat geometries/materials cleanly
      threatGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m.dispose());
        }
      });
      threatGroup.clear();
      threatRecords.length = 0;
      threatInteractables.length = 0;

      const arcs = threatArcsRef.current;
      arcs.forEach((arc, idx) => {
        const targetPos = nodePosMap.get(arc.targetNodeId) ?? new THREE.Vector3(0, 0.8, 0);
        const angle = (idx / Math.max(arcs.length, 1)) * Math.PI * 2 + 0.35;
        const perimeterRadius = 5.45;
        const originPos = new THREE.Vector3(
          Math.cos(angle) * perimeterRadius,
          1.55 + (idx % 2) * 0.75,
          Math.sin(angle) * perimeterRadius,
        );

        const colorHex = arc.severity === 'Critical' ? 0xef4444 : 0xf59e0b;

        const beaconGroup = new THREE.Group();
        beaconGroup.position.copy(originPos);

        const beaconWire = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshBasicMaterial({
            color: colorHex,
            wireframe: true,
            transparent: true,
            opacity: 0.92,
          }),
        );
        beaconGroup.add(beaconWire);

        const beaconCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16, 0),
          new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.45,
          }),
        );
        beaconGroup.add(beaconCore);

        const entity: GodsEyeInspectedEntity = {
          id: arc.id,
          kind: 'threat',
          title: arc.signature,
          subtitle: `${arc.sourceIp} -> ${arc.targetHost}`,
          severityLabel: arc.severity,
          metricLabel: `Vector targeting ${arc.targetHost}`,
          targetModule: arc.targetModule,
        };

        const hitProxy = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hitProxy.userData = { entity };
        beaconGroup.add(hitProxy);
        threatInteractables.push(hitProxy);

        threatGroup.add(beaconGroup);

        const midPoint = originPos.clone().add(targetPos).multiplyScalar(0.5);
        midPoint.y += 1.65;

        const curve = new THREE.QuadraticBezierCurve3(originPos, midPoint, targetPos);
        const arcMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          wireframe: true,
          transparent: true,
          opacity: arc.severity === 'Critical' ? 0.65 : 0.44,
        });

        const arcTube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.026, 5, false),
          arcMat,
        );
        threatGroup.add(arcTube);

        const packet = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshBasicMaterial({ color: colorHex }),
        );
        threatGroup.add(packet);

        threatRecords.push({
          id: arc.id,
          searchText: `${arc.signature} ${arc.sourceIp} ${arc.targetHost} ${arc.severity}`.toLowerCase(),
          beacon: beaconWire,
          arcMat,
          packet,
          curve,
          speed: arc.severity === 'Critical' ? 0.56 : 0.36,
          offset: idx * 0.23,
        });
      });
    };

    rebuildThreatGroup();
    rebuildThreatsRef.current = rebuildThreatGroup;

    // =========================================================================
    // 4. Pointer Raycasting (Hover + Click Entity Inspection)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    let lastMoveCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateMouse = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const findVisibleEntity = (): GodsEyeInspectedEntity | null => {
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects([...nodeInteractables, ...threatInteractables], false);
      const hit = hits.find((h) => {
        let p: THREE.Object3D | null = h.object;
        while (p) {
          if (!p.visible) return false;
          p = p.parent;
        }
        return true;
      });
      return (hit?.object.userData?.entity as GodsEyeInspectedEntity | undefined) ?? null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 50) return;
      lastMoveCheck = now;
      updateMouse(e);
      const entity = findVisibleEntity();
      if (entity) {
        renderer.domElement.style.cursor = 'pointer';
        setHoveredText(`${entity.title} (${entity.severityLabel})`);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredText(null);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      updateMouse(e);
      const entity = findVisibleEntity();
      if (entity) {
        onInspectRef.current(entity);
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

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let viewWidth = width;
    let viewHeight = height;

    const onResize = () => {
      if (!container) return;
      viewWidth = Math.max(container.clientWidth, 320);
      viewHeight = Math.max(container.clientHeight, 300);
      camera.aspect = viewWidth / viewHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(viewWidth, viewHeight);
      requestAnimationFrame(() => {
        if (!disposed) renderer.render(scene, camera);
      });
    };
    window.addEventListener('resize', onResize);

    // =========================================================================
    // 5. Render Loop with Software-WebGL afterDraw Pacing + Screen-Space Boxes
    // =========================================================================
    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let activeAppliedSensor: GodsEyeSensorMode | null = null;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += dt;

      const filter = layerFilterRef.current;
      const sensor = sensorModeRef.current;
      const q = searchQueryRef.current;

      if (sensor !== activeAppliedSensor) {
        activeAppliedSensor = sensor;
        const pHex = sensorPrimaryHex(sensor);
        const sHex = sensorSecondaryHex(sensor);
        for (const m of primaryCageMats) m.color.setHex(pHex);
        for (const m of secondaryCageMats) m.color.setHex(sHex);
      }

      cageGroup.visible = showCageRef.current;
      trafficGroup.visible = filter === 'all' || filter === 'traffic';
      threatGroup.visible = filter === 'all' || filter === 'threats';

      domeWireframe.rotation.y += dt * 0.04;
      eyeCore.rotation.y += dt * 0.65;
      eyeRingInner.rotation.z += dt * 0.45;
      eyeRingOuter.rotation.y -= dt * 0.35;
      wireframeScanCone.rotation.y += dt * 0.25;

      for (const sat of satellites) {
        const a = elapsed * sat.speed + sat.offset;
        const x = Math.cos(a) * sat.radius;
        const z = Math.sin(a) * sat.radius;
        sat.mesh.position.set(
          x * Math.cos(sat.tiltZ),
          z * Math.sin(sat.tiltX) + 0.3,
          z * Math.cos(sat.tiltX),
        );
        sat.mesh.lookAt(0, 0, 0);
      }

      for (const n of nodeRecords) {
        const matched = !q || n.searchText.includes(q);
        n.wireMat.opacity = matched ? 0.9 : 0.18;
        n.coreMat.opacity = matched ? 0.24 : 0.04;
        n.group.rotation.y += dt * 0.22;
      }

      if (trafficGroup.visible) {
        for (const p of trafficPackets) {
          const t = (elapsed * p.speed + p.offset) % 1;
          p.curve.getPointAt(t, _vecA);
          p.mesh.position.copy(_vecA);
        }
      }

      if (threatGroup.visible) {
        for (const th of threatRecords) {
          const matched = !q || th.searchText.includes(q);
          th.arcMat.opacity = matched ? 0.7 : 0.12;
          th.beacon.rotation.y += dt * 0.9;
          th.packet.visible = matched;
          const t = (elapsed * th.speed + th.offset) % 1;
          th.curve.getPointAt(t, _vecB);
          th.packet.position.copy(_vecB);
        }
      }

      controls.update();
      renderer.render(scene, camera);

      const boxesVisible = showBoxesRef.current;
      for (const target of trackedTargetsRef.current) {
        const el = boxRefs.current.get(target.id);
        if (!el) continue;

        const layerMatch =
          filter === 'all' ||
          (filter === 'traffic' && target.kind === 'node') ||
          (filter === 'threats' && target.kind === 'threat');
        const queryMatch = !q || target.searchText.includes(q);

        if (!boxesVisible || !layerMatch || !queryMatch) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        _proj.copy(target.worldPos).project(camera);
        if (_proj.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const sx = (_proj.x * 0.5 + 0.5) * viewWidth;
        const sy = (-_proj.y * 0.5 + 0.5) * viewHeight;

        if (sy < 95 || sy > viewHeight - 150 || sx < 48 || sx > viewWidth - 48) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -120%)`;
      }

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
      rebuildThreatsRef.current = null;
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
      <div className="flex h-full w-full items-center justify-center p-6 text-center">
        <div className="rounded-xl border border-cyan-500/30 bg-[#090D16]/90 p-6 max-w-md">
          <p className="text-sm font-semibold text-slate-100">
            God&apos;s Eye 3D Projection Fallback
          </p>
          <p className="mt-1 text-xs text-slate-400">
            WebGL context is unavailable in this environment. Use the summary dock below to inspect threats and traffic.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={mountRef}
        data-testid="gods-eye-canvas"
        aria-label="Global God's Eye translucent 3D wireframe projection"
        className="h-full w-full"
      />

      {/* Screen-Space Optical Detection Bounding Boxes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {trackedTargets.map((target) => {
          const borderClass = target.isAlert
            ? 'border-[#EF4444]/80 text-[#FCA5A5]'
            : sensorMode === 'nvg'
              ? 'border-[#10B981]/75 text-[#6EE7B7]'
              : sensorMode === 'flir'
                ? 'border-amber-400/80 text-amber-200'
                : 'border-[#00F0FF]/70 text-cyan-200';

          return (
            <button
              key={target.id}
              ref={(el) => {
                if (el) boxRefs.current.set(target.id, el);
                else boxRefs.current.delete(target.id);
              }}
              type="button"
              onClick={() => onInspectEntity(target.entity)}
              aria-label={`Inspect ${target.entity.title}`}
              style={{ opacity: 0 }}
              className={`absolute top-0 left-0 rounded border bg-[#060A12]/80 px-2 py-1 text-left transition-opacity duration-150 hover:bg-[#0D1320] ${borderClass}`}
            >
              <div className="font-mono text-[10px] font-bold leading-none tracking-wide">
                [{target.code}]
              </div>
              <div className="font-mono text-[9px] text-slate-300 leading-tight mt-0.5 tabular-nums">
                {target.sublabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* CRT Scanlines (CSS-only, zero GPU stall) */}
      {sensorMode === 'crt' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,240,255,0.22) 0px, rgba(0,240,255,0.22) 1px, transparent 1px, transparent 4px)',
          }}
        />
      )}

      {hoveredText && (
        <div
          className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 rounded-md border border-[#00F0FF]/45 bg-[#090D16]/92 px-3 py-1.5 font-mono text-xs text-cyan-200"
          aria-live="polite"
        >
          {hoveredText} · Click to inspect
        </div>
      )}
    </div>
  );
}
