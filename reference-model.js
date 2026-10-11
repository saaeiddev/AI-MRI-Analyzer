import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

// This model is an independently sourced anatomical REFERENCE, not a segmentation
// or reconstruction of the visitor's uploaded MRI dataset.
// Z-Anatomy / BodyParts3D / DBCLS contributors (CC BY-SA 4.0).
// Source and licensing: https://github.com/itayinbarr/brainproject
const SOURCES=[
  'https://itayinbarr.github.io/brainproject/models/brain.glb',
  'https://raw.githubusercontent.com/itayinbarr/brainproject/main/brain-atlas/models/brain.glb'
];
const MAT={
  cortex:0xc9a3a0,
  cerebellum:0xe5a49b,
  brainstem:0xcdbb9d,
  white_matter:0xd7c8b5,
  deep_grey:0xbe9dba,
  diencephalon:0xc8acbc,
  ventricles:0x64d7d2,
  arteries:0xfa8c71,
  veins_sinuses:0x9a8ee2,
  cranial_nerves:0xe6c29a,
  tracts:0xa8d5c9
};
const DEFAULT=new Set(['cortex','cerebellum','brainstem']);
const DEEP=new Set(['cortex','cerebellum','brainstem','diencephalon','deep_grey','white_matter','ventricles']);
const CORE=new Set(['cortex','cerebellum','brainstem','white_matter','deep_grey','diencephalon']);

function getExtras(mesh){
  let obj=mesh;
  while(obj){
    if(obj.userData?.bx_cat)return obj.userData;
    obj=obj.parent;
  }
  return {};
}
export async function createReferenceModel(holder){
  const draco=new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/libs/draco/');
  const loader=new GLTFLoader();
  loader.setDRACOLoader(draco);
  let loaded=null,lastError=null;
  for(const url of SOURCES){
    try{loaded=await loader.loadAsync(url);break;}
    catch(error){lastError=error;console.warn('[Neuroforge] Anatomical reference source unavailable:',url,error);}
  }
  draco.dispose();
  if(!loaded)throw lastError||new Error('Anatomical reference asset unavailable');

  const model=loaded.scene;
  const root=new THREE.Group();
  root.name='Z-Anatomy CC BY-SA 4.0 reference specimen';
  root.add(model);
  const meshes=[];
  let count=0,triangles=0;
  model.traverse(node=>{
    if(!node.isMesh)return;
    const category=getExtras(node).bx_cat||'other';
    const shade=MAT[category]||0xbca9a8;
    const original=node.material;
    node.material=new THREE.MeshPhysicalMaterial({
      color:shade,metalness:.02,roughness:.83,
      clearcoat:.09,clearcoatRoughness:.7,
      side:THREE.FrontSide,
      emissive:category==='ventricles'?0x045f61:0x150c0e,
      emissiveIntensity:.10,
      transparent:false
    });
    // GLTF materials may be shared between meshes. Dispose only distinct originals
    // on root teardown; never dispose geometry from the external resource here.
    node.userData.referenceCategory=category;
    node.visible=DEFAULT.has(category);
    meshes.push(node);
    if(CORE.has(category)){
      count++;
      const g=node.geometry;
      triangles+=g.index?Math.floor(g.index.count/3):Math.floor((g.attributes.position?.count||0)/3);
    }
  });
  const coreBox=new THREE.Box3();
  for(const mesh of meshes)if(DEFAULT.has(mesh.userData.referenceCategory))coreBox.expandByObject(mesh);
  if(coreBox.isEmpty())coreBox.setFromObject(model);
  const center=coreBox.getCenter(new THREE.Vector3());
  const maxSide=Math.max(...coreBox.getSize(new THREE.Vector3()).toArray());
  model.position.sub(center);
  root.scale.setScalar(2.65/(maxSide||1));
  // Starting view turns the specimen slightly for depth perception.
  root.rotation.y=-.16;
  holder.add(root);
  let focus='whole',opacity=1;
  const updateMaterials=()=>{
    for(const mesh of meshes){
      const cat=mesh.userData.referenceCategory;
      // Deep structures cannot be explored through a fully opaque cortex.
      const layerOpacity=focus==='deep'&&cat==='cortex'?Math.min(.14,opacity):opacity;
      mesh.material.transparent=layerOpacity<.999;
      mesh.material.opacity=layerOpacity;
      mesh.material.depthWrite=layerOpacity>.85;
    }
  };
  const setFocus=(next='whole')=>{
    focus=next;
    for(const mesh of meshes){
      const cat=mesh.userData.referenceCategory;
      mesh.visible=next==='deep'?DEEP.has(cat):next==='cortex'?cat==='cortex':DEFAULT.has(cat);
    }
    updateMaterials();
  };
  const setOpacity=(value)=>{
    opacity=value;
    updateMaterials();
  };
  const dispose=()=>{
    holder.remove(root);
    for(const mesh of meshes)mesh.material.dispose();
  };
  return {root,setFocus,setOpacity,dispose,get focus(){return focus},get opacity(){return opacity},structures:count,triangles};
}
