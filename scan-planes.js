import * as THREE from 'three';

// True three-plane MRI visualization: 3D cross-sections sampled directly from
// the active uploaded/reference volume, NOT tissue segmentation.
const AXES={axial:2,coronal:1,sagittal:0};
export class ScanPlanes {
  constructor(holder,canvases){
    this.group=new THREE.Group();this.group.name='MRI planes (data-derived)';
    this.surfaces={};
    for(const [name,canvas] of Object.entries(canvases)){
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=4;
      const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:true,opacity:.90,depthWrite:false});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
      mesh.name=name+' true MRI slice';
      mesh.renderOrder={axial:3,coronal:2,sagittal:1}[name];
      this.group.add(mesh);
      this.surfaces[name]={mesh,texture};
    }
    holder.add(this.group);
    this.setVisible(false);
  }
  setVisible(value){this.group.visible=value;}
  update(volume,slice){
    if(!volume)return;
    const metric=volume.dims.map((n,i)=>n*volume.spacing[i]);
    const norm=2.75/Math.max(...metric);
    const [x,y,z]=metric.map(n=>n*norm);
    const axial=this.surfaces.axial.mesh;
    const coronal=this.surfaces.coronal.mesh;
    const sagittal=this.surfaces.sagittal.mesh;
    axial.rotation.set(0,0,0);
    axial.scale.set(x,y,1);
    axial.position.set(0,0,(slice[2]/Math.max(1,volume.dims[2]-1)-.5)*z);
    coronal.rotation.set(Math.PI/2,0,0);
    coronal.scale.set(x,z,1);
    coronal.position.set(0,(slice[1]/Math.max(1,volume.dims[1]-1)-.5)*y,0);
    sagittal.rotation.set(0,Math.PI/2,0);
    sagittal.scale.set(z,y,1);
    sagittal.position.set((slice[0]/Math.max(1,volume.dims[0]-1)-.5)*x,0,0);
    for(const data of Object.values(this.surfaces))data.texture.needsUpdate=true;
  }
  setOpacity(value){for(const {mesh} of Object.values(this.surfaces))mesh.material.opacity=value;}
}
