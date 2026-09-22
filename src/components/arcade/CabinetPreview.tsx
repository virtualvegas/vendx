import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox, useTexture } from "@react-three/drei";
import { Maximize2, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArtworkPreviews } from "./ArcadeArtworkUploader";

export interface CabinetCustomization {
  bodyColor: string; trimColor: string; buttonColor: string; joystickColor: string;
  finish: string; monitorOrientation: string; screenTreatment: string; marqueeType: string;
  speakerLayout: string; feet: string; coinDoor: boolean; accessibleControls: boolean;
  joystickStyle: string; buttonLayout: string; steeringWheel: boolean; pedals: boolean;
  flightStick: boolean; dancePads: boolean; pinballButtons: boolean; usbPorts: boolean;
  computerTier: string; storage: string; connectivity: string; bluetooth: boolean;
  lighting: string; cooling: string; audio: string;
}

interface Props {
  style: string; size: string; monitor: string; controls: string;
  trackball: boolean; spinner: boolean; lightGun: boolean; theme?: string;
  customization?: Partial<CabinetCustomization>; artwork?: ArtworkPreviews;
  compact?: boolean;
}

type View = "perspective" | "front" | "side";
type ProfilePoint = [number, number];

const VIEWS: Record<View, [number, number, number]> = {
  perspective: [6.8, 4.35, 8.2],
  front: [0, 3.15, 9.2],
  side: [9.2, 3.15, 0],
};

const DEFAULT_PROFILE: ProfilePoint[] = [
  [-0.68, 0], [0.62, 0], [0.62, 2.48], [0.88, 2.64], [0.52, 3.05],
  [0.50, 4.57], [0.69, 4.82], [0.58, 5.48], [-0.68, 5.48],
];

function CameraView({ view, reset }: { view: View; reset: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...VIEWS[view]);
    camera.lookAt(0, 2.65, 0);
    camera.updateProjectionMatrix();
  }, [camera, view, reset]);
  return null;
}

function ArtPanel({ url, position, rotation = [0, 0, 0], scale }: {
  url: string; position: [number, number, number]; rotation?: [number, number, number]; scale: [number, number];
}) {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);
  return (
    <mesh position={position} rotation={rotation} renderOrder={3}>
      <planeGeometry args={scale} />
      <meshPhysicalMaterial map={texture} roughness={0.38} clearcoat={0.28} polygonOffset polygonOffsetFactor={-3} />
    </mesh>
  );
}

function useCabinetGeometry(profile: ProfilePoint[], width: number) {
  const geometry = useMemo(() => {
    const shape = profile.map(([z, y]) => new THREE.Vector2(z, y));
    const triangles = THREE.ShapeUtils.triangulateShape(shape, []);
    const vertices: number[] = [];
    const indices: number[] = [];
    const halfWidth = width / 2;

    for (const x of [-halfWidth, halfWidth]) {
      profile.forEach(([z, y]) => vertices.push(x, y, z));
    }
    triangles.forEach(([a, b, c]) => {
      indices.push(a, c, b);
      const offset = profile.length;
      indices.push(a + offset, b + offset, c + offset);
    });
    profile.forEach((_, index) => {
      const next = (index + 1) % profile.length;
      const a = index;
      const b = next;
      const c = next + profile.length;
      const d = index + profile.length;
      indices.push(a, b, c, a, c, d);
    });
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [profile, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function FinishMaterial({ color, finish = "satin" }: { color: string; finish?: string }) {
  const gloss = finish === "gloss";
  const metallic = finish === "metallic";
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={gloss ? 0.18 : metallic ? 0.28 : finish === "matte" ? 0.78 : 0.46}
      metalness={metallic ? 0.62 : 0.04}
      clearcoat={gloss ? 0.72 : 0.12}
      clearcoatRoughness={0.2}
    />
  );
}

function SideTrim({ width, profile, color }: { width: number; profile: ProfilePoint[]; color: string }) {
  return (
    <>
      {[-1, 1].map(side => {
        const curve = new THREE.CatmullRomCurve3(
          [...profile, profile[0]].map(([z, y]) => new THREE.Vector3(side * (width / 2 + 0.025), y, z)),
          false,
          "centripetal",
        );
        return (
          <mesh key={side} castShadow>
            <tubeGeometry args={[curve, 72, 0.035, 8, false]} />
            <meshStandardMaterial color={color} roughness={0.34} metalness={0.12} />
          </mesh>
        );
      })}
    </>
  );
}

function Screen({ width, height, position, rotation = [0, 0, 0], treatment, artwork }: {
  width: number; height: number; position: [number, number, number]; rotation?: [number, number, number]; treatment?: string; artwork?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[width + 0.24, height + 0.24, 0.13]} radius={0.045} castShadow>
        <meshStandardMaterial color="#111318" roughness={0.4} metalness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0, 0.072]}>
        <planeGeometry args={[width, height]} />
        <meshPhysicalMaterial
          color="#071019"
          emissive="#082b3b"
          emissiveIntensity={0.18}
          roughness={treatment === "matte" ? 0.58 : 0.08}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </mesh>
      {artwork && <ArtPanel url={artwork} position={[0, 0, 0.078]} scale={[width * 0.98, height * 0.98]} />}
      <mesh position={[0, -height / 2 - 0.075, 0.075]}>
        <boxGeometry args={[0.22, 0.018, 0.01]} />
        <meshStandardMaterial color="#68717a" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

function SpeakerGrille({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.17, 0.17, 0.025, 32]} />
        <meshStandardMaterial color="#090b0e" roughness={0.72} metalness={0.45} />
      </mesh>
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh key={index} position={[0, (index - 2) * 0.052, 0.018]}>
          <boxGeometry args={[0.24 - Math.abs(index - 2) * 0.025, 0.012, 0.012]} />
          <meshStandardMaterial color="#626a72" metalness={0.72} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function ArcadeButton({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.078, 0.085, 0.035, 24]} />
        <meshStandardMaterial color="#111318" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.026, 0]} castShadow>
        <cylinderGeometry args={[0.063, 0.069, 0.032, 24]} />
        <meshPhysicalMaterial color={color} roughness={0.22} clearcoat={0.8} emissive={color} emissiveIntensity={0.06} />
      </mesh>
    </group>
  );
}

function ControlSet({ x, buttonColor, joystickColor, buttonCount }: {
  x: number; buttonColor: string; joystickColor: string; buttonCount: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <group position={[-0.18, 0.02, 0.03]}>
        <mesh castShadow><cylinderGeometry args={[0.055, 0.055, 0.33, 20]} /><meshStandardMaterial color="#aeb6bd" metalness={0.82} roughness={0.2} /></mesh>
        <mesh position={[0, 0.2, 0]} castShadow><sphereGeometry args={[0.115, 24, 16]} /><meshPhysicalMaterial color={joystickColor} roughness={0.2} clearcoat={0.9} /></mesh>
        <mesh position={[0, -0.145, 0]}><cylinderGeometry args={[0.12, 0.12, 0.018, 24]} /><meshStandardMaterial color="#101216" roughness={0.48} /></mesh>
      </group>
      {Array.from({ length: buttonCount }).map((_, index) => {
        const column = index % Math.ceil(buttonCount / 2);
        const row = Math.floor(index / Math.ceil(buttonCount / 2));
        return <ArcadeButton key={index} x={0.08 + column * 0.17} z={-0.04 + row * 0.17} color={buttonColor} />;
      })}
    </group>
  );
}

function CoinDoor({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <group position={[0, 1.2, 0.642]}>
      <RoundedBox args={[0.7, 1.02, 0.07]} radius={0.035} castShadow>
        <meshStandardMaterial color="#0b0d10" metalness={0.72} roughness={0.3} />
      </RoundedBox>
      {[-0.2, 0.2].map(x => (
        <group key={x} position={[x, 0.2, 0.048]}>
          <RoundedBox args={[0.15, 0.31, 0.035]} radius={0.018}>
            <meshStandardMaterial color="#9da5ab" metalness={0.9} roughness={0.22} />
          </RoundedBox>
          <mesh position={[0, 0.06, 0.025]}><boxGeometry args={[0.075, 0.025, 0.015]} /><meshStandardMaterial color="#d8e0e5" emissive="#d8e0e5" emissiveIntensity={0.2} /></mesh>
          <mesh position={[0, -0.18, 0.02]}><boxGeometry args={[0.085, 0.055, 0.018]} /><meshStandardMaterial color="#171b20" /></mesh>
        </group>
      ))}
      <mesh position={[0, -0.34, 0.05]}><boxGeometry args={[0.42, 0.08, 0.03]} /><meshStandardMaterial color="#191d22" metalness={0.6} /></mesh>
    </group>
  );
}

function UprightCabinet({ style, size, monitor, controls, trackball, spinner, lightGun, customization = {}, artwork = {} }: Props) {
  const sizeScale = size === "mini" ? 0.78 : size === "mid" ? 0.89 : 1;
  const players = controls === "4p" ? 4 : controls === "2p" ? 2 : 1;
  const wide = style === "four_player" || players === 4;
  const width = wide ? 3.32 : style === "deluxe_upright" ? 2.62 : 2.42;
  const profile = useMemo<ProfilePoint[]>(() => {
    if (style === "wall_mount") return [[-0.38, 0], [0.43, 0], [0.43, 3.65], [0.56, 3.84], [0.42, 4.42], [-0.38, 4.42]];
    if (style === "bartop") return [[-0.56, 0], [0.6, 0], [0.78, 0.3], [0.48, 0.7], [0.47, 2.14], [0.62, 2.34], [0.52, 2.82], [-0.56, 2.82]];
    return DEFAULT_PROFILE;
  }, [style]);
  const geometry = useCabinetGeometry(profile, width);
  const bodyColor = customization.bodyColor || "#172033";
  const trimColor = customization.trimColor || "#12bde8";
  const buttonColor = customization.buttonColor || "#39e58c";
  const joystickColor = customization.joystickColor || buttonColor;
  const bodyHeight = style === "bartop" ? 2.82 : style === "wall_mount" ? 4.42 : 5.48;
  const lift = style === "bartop" ? 1.15 : style === "wall_mount" ? 0.72 : 0;
  const monitorWidth = Math.min(width - 0.48, 1.2 + Number(monitor || 24) / 29);
  const monitorHeight = customization.monitorOrientation === "portrait" ? monitorWidth * 1.05 : monitorWidth * 0.6;
  const monitorY = style === "bartop" ? 1.6 : bodyHeight - 1.72;
  const deckY = style === "bartop" ? 0.74 : bodyHeight - 2.72;
  const buttonCount = customization.buttonLayout === "four" ? 4 : customization.buttonLayout === "eight" ? 8 : 6;
  const frontZ = style === "wall_mount" ? 0.44 : 0.63;

  return (
    <group scale={sizeScale} position={[0, lift, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow><FinishMaterial color={bodyColor} finish={customization.finish} /></mesh>
      <SideTrim width={width} profile={profile} color={trimColor} />

      <group position={[0, monitorY, frontZ]} rotation={[-0.035, 0, 0]}>
        <Screen width={monitorWidth} height={monitorHeight} position={[0, 0, 0]} treatment={customization.screenTreatment} artwork={artwork.screen} />
      </group>

      <group position={[0, bodyHeight - 0.46, frontZ + 0.05]}>
        <RoundedBox args={[width - 0.22, 0.64, 0.12]} radius={0.035} castShadow>
          <meshPhysicalMaterial color={trimColor} roughness={0.28} emissive={trimColor} emissiveIntensity={customization.marqueeType === "unlit" ? 0.015 : 0.18} />
        </RoundedBox>
        <RoundedBox args={[width - 0.38, 0.48, 0.025]} radius={0.02} position={[0, 0, 0.074]}>
          <meshPhysicalMaterial color="#e7edf0" roughness={0.35} transmission={customization.marqueeType === "unlit" ? 0 : 0.12} emissive={trimColor} emissiveIntensity={customization.marqueeType === "unlit" ? 0 : 0.22} />
        </RoundedBox>
        {artwork.marquee && <ArtPanel url={artwork.marquee} position={[0, 0, 0.09]} scale={[width - 0.46, 0.43]} />}
      </group>

      <group position={[0, bodyHeight - 2.32, frontZ + 0.01]}>
        <mesh><boxGeometry args={[width - 0.38, 0.25, 0.08]} /><meshStandardMaterial color="#15191e" roughness={0.5} /></mesh>
        <SpeakerGrille position={[-width * 0.27, 0, 0.055]} />
        <SpeakerGrille position={[width * 0.27, 0, 0.055]} />
      </group>

      <group position={[0, deckY, 0.72]} rotation={[-0.1, 0, 0]}>
        <RoundedBox args={[width + (wide ? 0.48 : 0.16), 0.22, 1.08]} radius={0.055} castShadow>
          <FinishMaterial color={bodyColor} finish={customization.finish} />
        </RoundedBox>
        <mesh position={[0, 0.125, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[width + (wide ? 0.35 : 0.04), 0.91]} />
          <meshStandardMaterial color="#20252a" roughness={0.42} />
        </mesh>
        {artwork.controlPanel && <ArtPanel url={artwork.controlPanel} position={[0, 0.132, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[width, 0.84]} />}
        <group position={[0, 0.15, 0]}>
          {Array.from({ length: players }).map((_, index) => {
            const spacing = wide ? 0.78 : 0.92;
            return <ControlSet key={index} x={(index - (players - 1) / 2) * spacing} buttonColor={buttonColor} joystickColor={joystickColor} buttonCount={buttonCount} />;
          })}
          {trackball && <mesh position={[0, 0.08, 0.26]} castShadow><sphereGeometry args={[0.16, 28, 18]} /><meshPhysicalMaterial color="#d2dbe0" roughness={0.14} metalness={0.2} clearcoat={0.7} /></mesh>}
          {spinner && <mesh position={[width * 0.32, 0.1, 0.28]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.15, 24]} /><meshStandardMaterial color="#b9c0c5" metalness={0.88} roughness={0.18} /></mesh>}
        </group>
      </group>

      {lightGun && (
        <group position={[-width * 0.36, deckY - 0.15, 1.04]} rotation={[0.06, 0, -0.18]}>
          <RoundedBox args={[0.48, 0.19, 0.16]} radius={0.035}><meshPhysicalMaterial color={buttonColor} roughness={0.32} /></RoundedBox>
          <mesh position={[0.1, -0.2, -0.01]} rotation-z={-0.38}><boxGeometry args={[0.13, 0.36, 0.13]} /><meshStandardMaterial color="#171a1e" roughness={0.54} /></mesh>
        </group>
      )}

      <CoinDoor enabled={customization.coinDoor !== false && style !== "bartop" && style !== "wall_mount"} />
      {customization.usbPorts && style !== "wall_mount" && (
        <group position={[width * 0.28, 1.78, frontZ + 0.045]}>
          <RoundedBox args={[0.34, 0.14, 0.04]} radius={0.018}><meshStandardMaterial color="#0c0f12" metalness={0.5} /></RoundedBox>
          {[-0.09, 0.09].map(x => <mesh key={x} position={[x, 0, 0.025]}><boxGeometry args={[0.08, 0.035, 0.012]} /><meshStandardMaterial color="#4c5962" metalness={0.75} /></mesh>)}
        </group>
      )}
      {artwork.front && <ArtPanel url={artwork.front} position={[0, 1.43, frontZ + 0.052]} scale={[width * 0.76, 1.48]} />}
      {artwork.leftSide && <ArtPanel url={artwork.leftSide} position={[-width / 2 - 0.055, bodyHeight * 0.49, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[1.03, bodyHeight * 0.78]} />}
      {artwork.rightSide && <ArtPanel url={artwork.rightSide} position={[width / 2 + 0.055, bodyHeight * 0.49, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1.03, bodyHeight * 0.78]} />}

      {customization.feet === "casters" ? [-1, 1].flatMap(x => [-1, 1].map(z => (
        <group key={`${x}-${z}`} position={[x * width * 0.36, -0.08, z * 0.34]}>
          <mesh rotation-z={Math.PI / 2}><cylinderGeometry args={[0.11, 0.11, 0.08, 20]} /><meshStandardMaterial color="#181c20" metalness={0.4} /></mesh>
          <mesh position={[0, 0.09, 0]}><boxGeometry args={[0.09, 0.12, 0.05]} /><meshStandardMaterial color="#7f878d" metalness={0.82} /></mesh>
        </group>
      ))) : (
        <RoundedBox args={[width * 0.88, 0.1, 0.94]} radius={0.025} position={[0, -0.035, 0]}><meshStandardMaterial color="#090b0d" roughness={0.68} /></RoundedBox>
      )}
    </group>
  );
}

function CocktailCabinet({ customization = {}, artwork = {}, controls }: Props) {
  const body = customization.bodyColor || "#172033";
  const trim = customization.trimColor || "#12bde8";
  const button = customization.buttonColor || "#39e58c";
  const players = controls === "1p" ? 1 : 2;
  return (
    <group>
      <RoundedBox args={[3.2, 0.34, 2.25]} radius={0.13} position={[0, 2.35, 0]} castShadow><FinishMaterial color={body} finish={customization.finish} /></RoundedBox>
      <RoundedBox args={[2.68, 0.18, 1.72]} radius={0.06} position={[0, 2.54, 0]} castShadow><meshStandardMaterial color="#11151a" roughness={0.22} metalness={0.18} /></RoundedBox>
      <Screen width={1.95} height={1.25} position={[0, 2.65, 0]} rotation={[-Math.PI / 2, 0, 0]} treatment={customization.screenTreatment} artwork={artwork.screen} />
      <RoundedBox args={[3.25, 0.08, 2.3]} radius={0.04} position={[0, 2.55, 0]}><meshPhysicalMaterial color={trim} transparent opacity={0.34} roughness={0.12} /></RoundedBox>
      {[-1, 1].map(side => <RoundedBox key={side} args={[0.28, 1.8, 0.28]} radius={0.045} position={[side * 1.18, 1.25, 0]} castShadow><meshStandardMaterial color="#24292e" metalness={0.5} roughness={0.38} /></RoundedBox>)}
      <RoundedBox args={[2.72, 0.26, 1.7]} radius={0.04} position={[0, 0.36, 0]} castShadow><meshStandardMaterial color="#171b1f" roughness={0.7} /></RoundedBox>
      {Array.from({ length: players }).map((_, index) => (
        <group key={index} position={[(index - (players - 1) / 2) * 1.15, 2.64, 0.78]}>
          <ControlSet x={0} buttonColor={button} joystickColor={customization.joystickColor || button} buttonCount={4} />
        </group>
      ))}
    </group>
  );
}

function PinballCabinet({ customization = {}, artwork = {} }: Props) {
  const body = customization.bodyColor || "#172033";
  const trim = customization.trimColor || "#12bde8";
  return (
    <group>
      <RoundedBox args={[2.18, 0.78, 4.35]} radius={0.08} position={[0, 2.22, 0.2]} rotation={[-0.075, 0, 0]} castShadow><FinishMaterial color={body} finish={customization.finish} /></RoundedBox>
      <RoundedBox args={[1.98, 0.1, 3.92]} radius={0.025} position={[0, 2.63, 0.18]} rotation={[-0.075, 0, 0]}><meshStandardMaterial color="#0d1116" metalness={0.28} roughness={0.16} /></RoundedBox>
      <Screen width={1.8} height={3.62} position={[0, 2.7, 0.18]} rotation={[-Math.PI / 2 - 0.075, 0, 0]} treatment={customization.screenTreatment} artwork={artwork.screen} />
      <RoundedBox args={[2.08, 2.42, 0.44]} radius={0.06} position={[0, 3.72, -1.72]} castShadow><FinishMaterial color={body} finish={customization.finish} /></RoundedBox>
      <Screen width={1.72} height={1.55} position={[0, 3.83, -1.485]} treatment={customization.screenTreatment} artwork={artwork.marquee} />
      {[-1, 1].map(x => [-1.42, 1.4].map(z => <mesh key={`${x}-${z}`} position={[x * 0.84, 0.98, z]} castShadow><cylinderGeometry args={[0.055, 0.075, 1.9, 20]} /><meshStandardMaterial color="#8a9197" metalness={0.88} roughness={0.24} /></mesh>))}
      <RoundedBox args={[2.26, 0.18, 0.3]} radius={0.04} position={[0, 2.45, 2.28]}><meshPhysicalMaterial color={trim} roughness={0.28} /></RoundedBox>
      {[-1, 1].map(side => <mesh key={side} position={[side * 1.13, 2.3, 0.35]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.085, 0.085, 0.08, 24]} /><meshPhysicalMaterial color={trim} roughness={0.18} clearcoat={0.8} /></mesh>)}
    </group>
  );
}

function RacingCabinet({ customization = {} }: Props) {
  const body = customization.bodyColor || "#172033";
  const trim = customization.trimColor || "#12bde8";
  const button = customization.buttonColor || "#39e58c";
  return (
    <group>
      <RoundedBox args={[2.45, 0.34, 5.4]} radius={0.12} position={[0, 0.18, 0]} castShadow><FinishMaterial color={body} finish={customization.finish} /></RoundedBox>
      <RoundedBox args={[2.35, 3.45, 1.15]} radius={0.14} position={[0, 2.05, -2]} castShadow><FinishMaterial color={body} finish={customization.finish} /></RoundedBox>
      <Screen width={1.85} height={1.1} position={[0, 2.48, -1.39]} treatment={customization.screenTreatment} />
      <group position={[0, 1.45, -1.25]} rotation-x={-0.2}>
        <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.43, 0.075, 18, 44]} /><meshStandardMaterial color="#171a1e" roughness={0.42} /></mesh>
        <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.1, 0.1, 0.18, 24]} /><meshStandardMaterial color={trim} metalness={0.5} /></mesh>
        {[0, 2.1, 4.2].map(angle => <mesh key={angle} rotation={[Math.PI / 2, 0, angle]} position={[Math.sin(angle) * 0.18, 0, Math.cos(angle) * 0.18]}><boxGeometry args={[0.09, 0.04, 0.38]} /><meshStandardMaterial color="#252a2f" metalness={0.45} /></mesh>)}
      </group>
      <group position={[0, 0.9, 0.82]}>
        <RoundedBox args={[1.62, 0.28, 1.45]} radius={0.16} rotation-x={-0.18} castShadow><meshStandardMaterial color="#15191d" roughness={0.58} /></RoundedBox>
        <RoundedBox args={[1.62, 1.75, 0.3]} radius={0.16} position={[0, 0.65, 0.7]} rotation-x={0.18} castShadow><meshStandardMaterial color="#171b20" roughness={0.58} /></RoundedBox>
        <RoundedBox args={[1.05, 0.08, 0.26]} radius={0.025} position={[0, 0.18, -0.78]}><meshStandardMaterial color={button} roughness={0.3} /></RoundedBox>
      </group>
      {[-0.38, 0.38].map(x => <RoundedBox key={x} args={[0.34, 0.08, 0.55]} radius={0.025} position={[x, 0.35, -0.78]} rotation-x={-0.42}><meshStandardMaterial color="#858d94" metalness={0.72} roughness={0.28} /></RoundedBox>)}
    </group>
  );
}

function ArcadeCabinet(props: Props) {
  if (props.style === "cocktail") return <CocktailCabinet {...props} />;
  if (props.style === "virtual_pinball") return <PinballCabinet {...props} />;
  if (props.style === "racing") return <RacingCabinet {...props} />;
  return <UprightCabinet {...props} />;
}

function StudioFloor() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#191c20";
      context.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1200; i += 1) {
        const value = 26 + Math.floor(Math.random() * 18);
        context.fillStyle = `rgba(${value},${value},${value},0.25)`;
        context.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
      }
    }
    const result = new THREE.CanvasTexture(canvas);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.repeat.set(8, 8);
    return result;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.16, 0]} receiveShadow>
      <circleGeometry args={[8, 96]} />
      <meshStandardMaterial map={texture} color="#2b2f34" roughness={0.86} metalness={0.08} />
    </mesh>
  );
}

export default function CabinetPreview(props: Props) {
  const [view, setView] = useState<View>("perspective");
  const [reset, setReset] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebgl(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
  }, []);

  if (!webgl) return <div className="flex aspect-[4/5] items-center justify-center rounded-md border border-border bg-muted/30 text-sm text-muted-foreground">3D preview is unavailable on this device.</div>;
  return (
    <div ref={wrap} className={cn("relative overflow-hidden rounded-md border border-border bg-background", props.compact ? "h-72" : "h-[520px]")}> 
      <Canvas
        shadows="soft"
        dpr={[1, 1.6]}
        camera={{ position: VIEWS.perspective, fov: 34, near: 0.1, far: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
      >
        <color attach="background" args={["#16191d"]} />
        <fog attach="fog" args={["#16191d", 13, 24]} />
        <hemisphereLight args={["#dce7ed", "#31363b", 1.05]} />
        <directionalLight position={[5.5, 9, 7]} intensity={3.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={7} shadow-camera-bottom={-2} shadow-bias={-0.0002} />
        <spotLight position={[-5, 6, 5]} intensity={2.8} angle={0.48} penumbra={0.85} color="#b7e9f5" />
        <spotLight position={[5, 3, -4]} intensity={2.1} angle={0.55} penumbra={0.9} color="#f2e7d2" />
        <Suspense fallback={null}><ArcadeCabinet {...props} /></Suspense>
        <StudioFloor />
        <ContactShadows position={[0, -0.145, 0]} opacity={0.58} scale={9} blur={2.1} far={7} resolution={512} />
        <Environment resolution={256}>
          <Lightformer intensity={4.4} position={[0, 8, 1]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
          <Lightformer intensity={2.8} color="#d9f4fa" position={[-5, 3, 2]} rotation-y={Math.PI / 2} scale={[5, 2, 1]} />
          <Lightformer intensity={2.1} color="#f0dfc6" position={[5, 2, -3]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        </Environment>
        <CameraView view={view} reset={reset} />
        <OrbitControls makeDefault target={[0, 2.65, 0]} minDistance={5.5} maxDistance={13} minPolarAngle={0.48} maxPolarAngle={Math.PI / 2.02} enablePan={false} />
      </Canvas>

      <div className="absolute left-3 top-3 rounded-md border border-border bg-background/90 p-1 shadow-lg backdrop-blur-md">
        <div className="px-2 pb-1 pt-0.5 text-[9px] font-semibold uppercase text-muted-foreground">View</div>
        <div className="flex gap-1">
          {(["perspective", "front", "side"] as View[]).map(label => (
            <Button key={label} type="button" size="sm" variant={view === label ? "default" : "ghost"} className="h-7 px-2 text-xs capitalize" onClick={() => setView(label)}>{label}</Button>
          ))}
        </div>
      </div>
      <div className="absolute right-3 top-3 flex gap-1">
        <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shadow-lg" aria-label="Reset camera" title="Reset camera" onClick={() => setReset(value => value + 1)}><RotateCcw className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shadow-lg" aria-label="Open fullscreen preview" title="Open fullscreen preview" onClick={() => wrap.current?.requestFullscreen?.()}><Maximize2 className="h-4 w-4" /></Button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border/60 bg-background/85 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur-md">Drag to rotate · Scroll to zoom</div>
    </div>
  );
}