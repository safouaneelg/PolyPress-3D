
export interface ModelMetadata {
  name: string;
  size: number;
  format: string;
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  animations: string[];
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  VIEWING = 'VIEWING',
  OPTIMIZING = 'OPTIMIZING'
}

export type SupportedExtension = 'glb' | 'gltf' | 'obj' | 'ply' | 'pcd' | 'xyz';

export interface SceneSettings {
  autoRotate: boolean;
  wireframe: boolean;
  showSkeleton: boolean;
  playAnimation: boolean;
  activeAnimationIndex: number;
  pointSize: number;
}

export interface ExportConfig {
  format: 'glb';
  draco: boolean;
  ktx2: boolean;
  fileName: string;
}
