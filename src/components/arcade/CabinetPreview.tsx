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
const views: Record<View, [number, number, number]> = { perspective: [5.8, 4.3, 7], front: [0, 3.4, 8], side: [8, 3.4, 0] };

function CameraView({ view, reset }: { view: View; reset: number }) {
  const { camera } = useThree();
  useEffect(() => { camera.position.set(...views[view]); camera.lookAt(0, 2.2, 0); camera.updateProjectionMatrix(); }, [camera, view, reset]);
  return null;
}

function ArtPanel({ url, position, rotation = [0, 0, 0], scale }: { url: string; position: [number, number, number]; rotation?: [number, number, number]; scale: [number, number, number] }) {
  const texture = useTexture(url);
  useEffect(() => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; texture.needsUpdate = true; }, [texture]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={[scale[0], scale[1]]} /><meshStandardMaterial map={texture} roughness={0.45} polygonOffset polygonOffsetFactor={-2} /></mesh>;
}

function ArcadeCabinet({ style, size, monitor, controls, trackball, spinner, lightGun, customization = {}, artwork = {} }: Props) {
  const scale = size === "mini" ? 0.78 : size === "mid" ? 0.9 : 1;
  const players = controls === "4p" ? 4 : controls === "2p" ? 2 : 1;
  const wide = style === "four_player" || players === 4;
  const width = wide ? 3.2 : style === "cocktail" ? 3 : 2.35;
  const depth = style === "cocktail" ? 2.2 : style === "racing" || style === "sit_down" ? 3 : 1.5;
  const bodyHeight = style === "bartop" ? 2.6 : style === "cocktail" ? 2 : style === "wall_mount" ? 3.8 : 5.2;
  const bodyColor = customization.bodyColor || "#172033";
  const trimColor = customization.trimColor || "#12bde8";
  const controlColor = customization.buttonColor || "#39e58c";
  const isCocktail = style === "cocktail";
  const isPedestal = style === "pedestal";
  const isPinball = style === "virtual_pinball";
  const y = bodyHeight / 2;
  const roughness = customization.finish === "gloss" ? 0.18 : customization.finish === "metallic" ? 0.3 : 0.62;
  const monitorWidth = Math.min(width - .35, 1.25 + Number(monitor || 24) / 30);
  const screenHeight = customization.monitorOrientation === "portrait" ? monitorWidth * 1.05 : monitorWidth * .62;

  if (isPinball) return (
    <group scale={scale}>
      <RoundedBox args={[2.2, .75, 4.4]} radius={.12} position={[0, 2, .25]} rotation={[-.08, 0, 0]} castShadow><meshStandardMaterial color={bodyColor} roughness={roughness} metalness={customization.finish === "metallic" ? .5 : .05} /></RoundedBox>
      <RoundedBox args={[2.1, 2.35, .42]} radius={.1} position={[0, 3.5, -1.55]} castShadow><meshStandardMaterial color={bodyColor} roughness={roughness} /></RoundedBox>
      <mesh position={[0, 2.4, .25]} rotation={[-Math.PI / 2 - .08, 0, 0]}><planeGeometry args={[1.9, 3.7]} /><meshStandardMaterial color="#101827" emissive="#0d8eb8" emissiveIntensity={.3} roughness={.15} /></mesh>
      {[[-.85, .55], [.85, .55], [-.85, -1.35], [.85, -1.35]].map(([x,z], i) => <mesh key={i} position={[x, .9, z]} castShadow><cylinderGeometry args={[.07,.07,1.8,16]} /><meshStandardMaterial color="#252d38" metalness={.8} /></mesh>)}
    </group>
  );

  return (
    <group scale={scale} position={[0, style === "bartop" ? 1.1 : 0, 0]}>
      <RoundedBox args={[width, bodyHeight, depth]} radius={.14} position={[0, y, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={bodyColor} roughness={roughness} metalness={customization.finish === "metallic" ? .5 : .04} />
      </RoundedBox>
      {isPedestal && <RoundedBox args={[width * .58, 2.25, depth * .7]} radius={.1} position={[0, 1.15, .12]} castShadow><meshStandardMaterial color={bodyColor} roughness={roughness} /></RoundedBox>}
      <RoundedBox args={[width + .08, .1, depth + .08]} radius={.04} position={[0, bodyHeight, 0]}><meshStandardMaterial color={trimColor} emissive={trimColor} emissiveIntensity={.4} /></RoundedBox>
      {!isCocktail && <RoundedBox args={[width * .86, .72, .12]} radius={.08} position={[0, bodyHeight - .5, depth / 2 + .065]} castShadow><meshStandardMaterial color={trimColor} emissive={trimColor} emissiveIntensity={customization.marqueeType === "unlit" ? .08 : .65} /></RoundedBox>}
      {!isCocktail && artwork.marquee && <ArtPanel url={artwork.marquee} position={[0, bodyHeight - .5, depth / 2 + .13]} scale={[width * .75, .58, 1]} />}
      <mesh position={isCocktail ? [0, bodyHeight + .06, 0] : [0, bodyHeight - 1.65, depth / 2 + .075]} rotation={isCocktail ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <planeGeometry args={[monitorWidth, screenHeight]} /><meshPhysicalMaterial color="#07111e" emissive="#0b73a4" emissiveIntensity={.26} roughness={customization.screenTreatment === "matte" ? .52 : .08} clearcoat={.8} />
      </mesh>
      {artwork.screen && <ArtPanel url={artwork.screen} position={isCocktail ? [0, bodyHeight + .071, 0] : [0, bodyHeight - 1.65, depth / 2 + .085]} rotation={isCocktail ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} scale={[monitorWidth * .94, screenHeight * .92, 1]} />}
      <RoundedBox args={[width + (wide ? .4 : .12), .3, depth + .42]} radius={.1} position={[0, isCocktail ? bodyHeight + .16 : bodyHeight - 2.55, depth * .12]} rotation={[-.09,0,0]} castShadow><meshStandardMaterial color={trimColor} roughness={.35} /></RoundedBox>
      {artwork.controlPanel && <ArtPanel url={artwork.controlPanel} position={[0, isCocktail ? bodyHeight + .322 : bodyHeight - 2.385, depth * .12]} rotation={[-Math.PI/2-.09,0,0]} scale={[width * .92, depth * .75, 1]} />}
      {Array.from({ length: players }).map((_, index) => {
        const x = (index - (players - 1) / 2) * (wide ? .65 : .82);
        return <group key={index} position={[x, isCocktail ? bodyHeight + .36 : bodyHeight - 2.25, depth * .13]}>
          <mesh castShadow><cylinderGeometry args={[.09,.09,.38,18]} /><meshStandardMaterial color={customization.joystickColor || controlColor} metalness={.35} /></mesh>
          <mesh position={[0,.23,0]} castShadow><sphereGeometry args={[.16,18,18]} /><meshStandardMaterial color={customization.joystickColor || controlColor} roughness={.28} /></mesh>
          {[0,.18,.36].map((dx, i) => <mesh key={i} position={[.24 + dx,.03,.12]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.075,.075,.05,16]} /><meshStandardMaterial color={controlColor} emissive={controlColor} emissiveIntensity={.2} /></mesh>)}
        </group>;
      })}
      {trackball && <mesh position={[0, isCocktail ? bodyHeight + .39 : bodyHeight - 2.2, depth * .32]}><sphereGeometry args={[.19,24,24]} /><meshPhysicalMaterial color="#d5e8ef" roughness={.2} metalness={.2} /></mesh>}
      {spinner && <mesh position={[width*.3, isCocktail ? bodyHeight + .4 : bodyHeight - 2.2, depth*.36]}><cylinderGeometry args={[.12,.12,.18,20]} /><meshStandardMaterial color="#c9d0d8" metalness={.8} roughness={.2} /></mesh>}
      {lightGun && <group position={[-width*.34,bodyHeight-2.15,depth*.66]} rotation={[0,0,-.18]}><mesh><boxGeometry args={[.4,.18,.16]} /><meshStandardMaterial color={controlColor} /></mesh><mesh position={[.1,-.18,0]} rotation={[0,0,-.35]}><boxGeometry args={[.12,.35,.13]} /><meshStandardMaterial color="#151922" /></mesh></group>}
      {customization.coinDoor !== false && !isCocktail && <group position={[0,1.25,depth/2+.08]}><mesh><boxGeometry args={[.62,.9,.08]} /><meshStandardMaterial color="#11151b" metalness={.72} roughness={.3} /></mesh>{[-.18,.18].map(x => <mesh key={x} position={[x,.18,.055]}><boxGeometry args={[.14,.27,.05]} /><meshStandardMaterial color="#b9c1c9" metalness={.9} /></mesh>)}</group>}
      {artwork.front && <ArtPanel url={artwork.front} position={[0,1.35,depth/2+.13]} scale={[width*.86,1.65,1]} />}
      {artwork.leftSide && <ArtPanel url={artwork.leftSide} position={[-width/2-.006,y,0]} rotation={[0,-Math.PI/2,0]} scale={[depth*.9,bodyHeight*.88,1]} />}
      {artwork.rightSide && <ArtPanel url={artwork.rightSide} position={[width/2+.006,y,0]} rotation={[0,Math.PI/2,0]} scale={[depth*.9,bodyHeight*.88,1]} />}
      {customization.feet === "casters" && [-1,1].flatMap(x => [-1,1].map(z => <mesh key={`${x}-${z}`} position={[x*width*.35,-.08,z*depth*.32]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.1,.04,10,20]} /><meshStandardMaterial color="#20262f" metalness={.7} /></mesh>))}
    </group>
  );
}

export default function CabinetPreview(props: Props) {
  const [view, setView] = useState<View>("perspective");
  const [reset, setReset] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { try { const canvas = document.createElement("canvas"); setWebgl(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))); } catch { setWebgl(false); } }, []);
  const labels = useMemo(() => (["perspective", "front", "side"] as View[]), []);

  if (!webgl) return <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">3D preview is unavailable on this device.</div>;
  return (
    <div ref={wrap} className={cn("relative overflow-hidden rounded-lg border border-border bg-background", props.compact ? "h-72" : "h-[480px]")}> 
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: views.perspective, fov: 38 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <color attach="background" args={["#080c14"]} />
        <fog attach="fog" args={["#080c14", 11, 22]} />
        <ambientLight intensity={.55} />
        <directionalLight position={[5,8,6]} intensity={2.2} castShadow shadow-mapSize={[1024,1024]} />
        <spotLight position={[-5,7,4]} intensity={1.6} angle={.5} penumbra={.8} color="#82dfff" />
        <Suspense fallback={null}><ArcadeCabinet {...props} /></Suspense>
        <mesh rotation-x={-Math.PI/2} position={[0,-.2,0]} receiveShadow><circleGeometry args={[7,64]} /><meshStandardMaterial color="#101722" roughness={.82} metalness={.08} /></mesh>
        <ContactShadows position={[0,-.18,0]} opacity={.52} scale={9} blur={2.5} far={7} />
        <Environment resolution={128}><Lightformer intensity={2.4} position={[0,7,-4]} scale={[8,3,1]} /><Lightformer intensity={1.4} color="#5dd8ff" position={[-5,2,1]} rotation-y={Math.PI/2} scale={[5,2,1]} /></Environment>
        <CameraView view={view} reset={reset} />
        <OrbitControls makeDefault target={[0,2.2,0]} minDistance={5} maxDistance={12} minPolarAngle={.45} maxPolarAngle={Math.PI/2.05} enablePan={false} />
      </Canvas>
      <div className="absolute left-3 top-3 flex gap-1 rounded-md border border-border bg-background/90 p-1 backdrop-blur-sm">
        {labels.map(label => <Button key={label} type="button" size="sm" variant={view === label ? "default" : "ghost"} className="h-7 px-2 text-xs capitalize" onClick={() => setView(label)}>{label}</Button>)}
      </div>
      <div className="absolute right-3 top-3 flex gap-1">
        <Button type="button" size="icon" variant="secondary" className="h-8 w-8" aria-label="Reset camera" onClick={() => setReset(value => value + 1)}><RotateCcw className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="secondary" className="h-8 w-8" aria-label="Open fullscreen preview" onClick={() => wrap.current?.requestFullscreen?.()}><Maximize2 className="h-4 w-4" /></Button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur-sm">Drag to rotate · Pinch or scroll to zoom</div>
    </div>
  );
}
