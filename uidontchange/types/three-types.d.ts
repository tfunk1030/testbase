import * as THREE from 'three'
import { OrbitControls } from '@react-three/drei'

declare module '@react-three/fiber' {
  interface ThreeElements {
    orbitControls: React.ReactElement<typeof OrbitControls>
    mesh: React.ReactElement<THREE.Mesh>
    pointLight: React.ReactElement<THREE.PointLight>
    ambientLight: React.ReactElement<THREE.AmbientLight>
  }
}
