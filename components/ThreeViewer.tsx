
import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { ExportConfig, SceneSettings } from '../types';

interface ViewerProps {
  modelUrl: string | null;
  extension: string | null;
  settings: SceneSettings;
  onModelMetadata: (metadata: any) => void;
  onLoadingStatus?: (status: string) => void;
}

export interface ViewerHandle {
  exportModel: (config: ExportConfig) => Promise<void>;
  frameModel: () => void;
}

const ModelManager = forwardRef<ViewerHandle, ViewerProps>(({ 
  modelUrl, 
  extension, 
  settings,
  onModelMetadata,
  onLoadingStatus 
}, ref) => {
  const { camera, controls, gl, scene } = useThree() as any;
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const clips = useRef<THREE.AnimationClip[]>([]);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const skeletonHelper = useRef<THREE.SkeletonHelper | null>(null);
  const modelRef = useRef<THREE.Group>(null);

  const frameCamera = (object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = camera.fov || 45;
    const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * fov) / 360));
    const fitWidthDistance = fitHeightDistance / (camera.aspect || 1);
    const distance = 1.2 * Math.max(fitHeightDistance, fitWidthDistance);

    const direction = new THREE.Vector3()
      .subVectors(camera.position, center)
      .normalize();

    camera.position.copy(direction.multiplyScalar(distance).add(center));
    camera.near = distance / 1000;
    camera.far = distance * 1000;
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  };

  useFrame((state, delta) => {
    if (mixer.current && settings.playAnimation) {
      mixer.current.update(delta);
    }
  });

  // Handle Animation Switching
  useEffect(() => {
    if (!mixer.current || clips.current.length === 0) return;

    if (activeAction.current) {
      activeAction.current.fadeOut(0.3);
    }

    const nextClip = clips.current[settings.activeAnimationIndex] || clips.current[0];
    if (nextClip) {
      const action = mixer.current.clipAction(nextClip);
      action.reset().fadeIn(0.3).play();
      activeAction.current = action;
    }
  }, [settings.activeAnimationIndex]);

  // Apply visual settings to the model
  useEffect(() => {
    if (!model) return;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if ((mesh as any).isSkinnedMesh) {
          mesh.frustumCulled = false;
        }
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: any) => {
            mat.wireframe = settings.wireframe;
          });
        }
      }
      if ((child as THREE.Points).isPoints) {
        const points = child as THREE.Points;
        if (points.material) {
          (points.material as THREE.PointsMaterial).size = settings.pointSize;
          (points.material as THREE.PointsMaterial).sizeAttenuation = true;
        }
      }
    });

    // Skeleton Management
    if (settings.showSkeleton && model) {
      let hasBones = false;
      model.traverse(c => { if ((c as any).isBone) hasBones = true; });

      if (hasBones) {
        if (!skeletonHelper.current) {
          const helper = new THREE.SkeletonHelper(model);
          const mat = helper.material as THREE.LineBasicMaterial;
          mat.depthTest = false;
          mat.depthWrite = false;
          mat.transparent = true;
          mat.opacity = 0.8;
          helper.renderOrder = 999;
          scene.add(helper);
          skeletonHelper.current = helper;
        }
      }
    } else if (!settings.showSkeleton && skeletonHelper.current) {
      scene.remove(skeletonHelper.current);
      skeletonHelper.current = null;
    }

  }, [model, settings.wireframe, settings.pointSize, settings.showSkeleton, scene]);

  useImperativeHandle(ref, () => ({
    frameModel: () => {
      if (model) frameCamera(model);
    },
    exportModel: async (config: ExportConfig) => {
      if (!model) return;
      
      const exporter = new GLTFExporter();
      const exportScene = new THREE.Scene();
      const clone = model.clone();
      
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      clone.position.sub(center);
      exportScene.add(clone);

      const options: any = {
        binary: true,
        animations: clips.current,
        truncateDrawRange: true
      };

      if (config.draco) {
        options.dracoOptions = { compressionLevel: 7 };
      }
      
      exporter.parse(
        exportScene,
        (result) => {
          let output: any = result;
          const blob = new Blob([output], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          
          let suffix = '';
          if (config.draco) suffix += '_draco';
          if (config.ktx2) suffix += '_ktx2';
          if (!suffix) suffix = '_optimized';
          
          link.download = `${config.fileName.replace(/\.[^/.]+$/, "")}${suffix}.glb`;
          link.click();
          URL.revokeObjectURL(url);
        },
        (error) => {
          console.error('Export error:', error);
          throw error;
        },
        options
      );
    }
  }));

  useEffect(() => {
    if (!modelUrl || !extension) {
      setModel(null);
      return;
    }

    const ext = extension.toLowerCase();
    const manager = new THREE.LoadingManager();
    
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    
    const ktx2Loader = new KTX2Loader(manager);
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r182/examples/jsm/libs/basis/');
    ktx2Loader.detectSupport(gl);

    const processResult = (result: any) => {
      let object: THREE.Object3D;
      let modelAnimations: THREE.AnimationClip[] = [];
      
      if (ext === 'glb' || ext === 'gltf') {
        object = result.scene;
        modelAnimations = result.animations;
      } else if (ext === 'obj') {
        object = result;
      } else if (ext === 'pcd') {
        // PCDLoader returns THREE.Points
        object = result;
        if ((object as THREE.Points).material) {
           (object as THREE.Points).material = new THREE.PointsMaterial({ 
              size: settings.pointSize, 
              vertexColors: (object as any).geometry.hasAttribute('color') 
           });
        }
      } else if (ext === 'xyz' || ext === 'ply') {
        let geometry = result;
        // loaders for xyz and ply can return geometry directly
        if (result.scene) geometry = result.scene; 
        
        const isPointCloud = ext === 'xyz' || (ext === 'ply' && (!geometry.index || geometry.index.count === 0));

        if (isPointCloud) {
           const material = new THREE.PointsMaterial({ 
             size: settings.pointSize, 
             vertexColors: geometry.hasAttribute('color'),
             sizeAttenuation: true
           });
           object = new THREE.Points(geometry, material);
        } else {
           const material = new THREE.MeshStandardMaterial({ 
             color: 0x808080, 
             roughness: 0.5, 
             metalness: 0.5 
           });
           object = new THREE.Mesh(geometry, material);
        }
      } else {
        object = new THREE.Mesh(result, new THREE.MeshStandardMaterial());
      }

      // Cleanup
      if (mixer.current) {
        mixer.current.stopAllAction();
        mixer.current = null;
      }
      activeAction.current = null;
      clips.current = modelAnimations;

      if (modelAnimations && modelAnimations.length > 0) {
        mixer.current = new THREE.AnimationMixer(object);
        const action = mixer.current.clipAction(modelAnimations[0]);
        action.play();
        activeAction.current = action;
      }

      object.updateMatrixWorld(true);

      let vertices = 0;
      let triangles = 0;
      let meshes = 0;
      let materialsCount = new Set();
      let texturesCount = new Set();

      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.Points).isPoints) {
          meshes++;
          const geom = (child as THREE.Mesh).geometry;
          
          if ((child as any).isSkinnedMesh) {
            child.frustumCulled = false;
          }

          if (geom.attributes.position) {
            vertices += geom.attributes.position.count;
            if ((child as THREE.Mesh).isMesh) {
              triangles += geom.attributes.position.count / 3;
            }
          }

          if (ext !== 'glb' && ext !== 'gltf' && (child as THREE.Mesh).isMesh) {
             const mesh = child as THREE.Mesh;
             if (mesh.material) {
               const oldMat = mesh.material as any;
               mesh.material = new THREE.MeshStandardMaterial({
                 color: oldMat.color || 0xcccccc,
                 map: oldMat.map || null,
                 roughness: 0.6,
                 metalness: 0.2,
               });
             }
          }

          if ((child as THREE.Mesh).material) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(m => {
              materialsCount.add(m.uuid);
              const mat = m as any;
              ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(key => {
                if (mat[key]) texturesCount.add(mat[key].uuid);
              });
            });
          }
        }
      });

      setModel(object);
      onModelMetadata({
        vertices,
        triangles: Math.round(triangles),
        meshes,
        materials: materialsCount.size,
        textures: texturesCount.size,
        animations: modelAnimations.map(c => c.name || `Animation ${modelAnimations.indexOf(c) + 1}`)
      });

      setTimeout(() => frameCamera(object), 100);
    };

    const handleError = (err: any) => {
      onLoadingStatus?.(`Error: ${err.message || 'Parsing failed'}`);
    };

    const loadModel = async () => {
      onLoadingStatus?.(`Fetching data stream...`);
      try {
        const response = await fetch(modelUrl);
        const buffer = await response.arrayBuffer();
        onLoadingStatus?.(`Decoding ${ext.toUpperCase()} payloads...`);

        switch (ext) {
          case 'glb':
          case 'gltf': {
            const loader = new GLTFLoader(manager);
            loader.setDRACOLoader(dracoLoader);
            loader.setKTX2Loader(ktx2Loader);
            loader.setMeshoptDecoder(MeshoptDecoder);
            loader.parse(buffer, '', processResult, handleError);
            break;
          }
          case 'obj': {
            const loader = new OBJLoader(manager);
            const text = new TextDecoder().decode(buffer);
            processResult(loader.parse(text));
            break;
          }
          case 'ply': {
            const loader = new PLYLoader(manager);
            processResult(loader.parse(buffer));
            break;
          }
          case 'pcd': {
            const loader = new PCDLoader(manager);
            processResult(loader.parse(buffer));
            break;
          }
          case 'xyz': {
            const loader = new XYZLoader(manager);
            const text = new TextDecoder().decode(buffer);
            processResult(loader.parse(text));
            break;
          }
          default:
            handleError(new Error(`Unsupported format: ${ext}`));
        }
      } catch (e) {
        handleError(e);
      }
    };

    loadModel();

    return () => {
      dracoLoader.dispose();
      ktx2Loader.dispose();
      if (mixer.current) mixer.current.stopAllAction();
      if (skeletonHelper.current) scene.remove(skeletonHelper.current);
    };
  }, [modelUrl, extension, gl]);

  return (
    <group ref={modelRef}>
      {model && <primitive object={model} />}
    </group>
  );
});

const ThreeViewer = forwardRef<ViewerHandle, ViewerProps>((props, ref) => {
  return (
    <div className="w-full h-full bg-[#0a0f1a]">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [5, 5, 5], fov: 45 }}>
        <color attach="background" args={['#0a0f1a']} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
        />
        <spotLight 
          position={[-10, 10, 10]} 
          angle={0.25} 
          penumbra={1} 
          intensity={2} 
          castShadow 
        />
        
        <ModelManager ref={ref} {...props} />
        
        <Environment preset="city" />
        
        <ContactShadows 
          opacity={0.4} 
          scale={50} 
          blur={2} 
          far={20} 
          resolution={512} 
          color="#000000" 
        />
        <OrbitControls 
          makeDefault 
          autoRotate={props.settings.autoRotate}
          autoRotateSpeed={1.5}
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 1.5} 
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

      {!props.modelUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-12 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800/50 shadow-2xl animate-in zoom-in-95 duration-700">
             <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-cube text-5xl text-blue-500 animate-pulse"></i>
             </div>
             <h2 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">PolyPress 3D Viewer</h2>
             <p className="text-slate-400 max-w-xs mx-auto">Upload a 3D asset or Point Cloud to start analyzing geometry.</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default ThreeViewer;
