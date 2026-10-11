import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {createPhantom,loadVolume,voxelAt,clamp} from './volume.js';

const $=id=>document.getElementById(id);
const el={
  scene:$('scene'),threshold:$('threshold'),opacity:$('opacity'),detail:$('detail'),
  thresholdValue:$('thresholdValue'),opacityValue:$('opacityValue'),detailValue:$('detailValue'),
  datasetName:$('datasetName'),datasetMeta:$('datasetMeta'),resolution:$('resolution'),voxelSpacing:$('voxelSpacing'),
  meshFaces:$('meshFaces'),statusLine:$('statusLine'),renderStatus:$('renderStatus'),sceneLabel:$('sceneLabel'),
  dropzone:$('dropzone'),fileInput:$('fileInput'),window:$('windowRange'),level:$('levelRange')
};
const canvas={axial:$('axialCanvas'),coronal:$('coronalCanvas'),sagittal:$('sagittalCanvas')};
const sliders={axial:$('axialSlider'),coronal:$('coronalSlider'),sagittal:$('sagittalSlider')};
const axisMap={axial:2,coronal:1,sagittal:0};
let volume=createPhantom(),slice=[54,58,48],palette=0,surface=null;
let toastTimer,rebuildTimer,busy=false;
const palettes=[{name:'ION CYAN',color:0x39ead6,emissive:0x08443b},{name:'SOLAR CORAL',color:0xff8059,emissive:0x4b1809},{name:'VIOLET PULSE',color:0xae8aff,emissive:0x291455}];
function notify(msg,error=false){
  const t=$('toast');t.textContent=msg;t.classList.toggle('error',error);t.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),4500);
}
function status(msg){el.statusLine.textContent=msg;el.renderStatus.textContent=msg.includes('ERROR')?'ERROR':'READY';}
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.05,100);
camera.position.set(3.5,2.1,4.0);
let renderer=null,controls=null;
const holder=new THREE.Group();scene.add(holder);
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.65;
  el.scene.appendChild(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=2;controls.maxDistance=9;
  controls.autoRotate=true;controls.autoRotateSpeed=.7;
}catch(err){notify('3D requires WebGL. Try another browser or enable GPU acceleration.',true);status('ERROR: WEBGL UNAVAILABLE');}
scene.add(new THREE.AmbientLight(0x9dc7d4,1.55));
const l1=new THREE.DirectionalLight(0xd6ffff,3);l1.position.set(3,4,5);scene.add(l1);
const l2=new THREE.PointLight(0xff7c58,80);l2.position.set(-3,-.3,-1.7);scene.add(l2);
const l3=new THREE.PointLight(0x9272ff,70);l3.position.set(0,1.8,-3);scene.add(l3);
const planeGrid=new THREE.GridHelper(4.8,18,0x1e7a81,0x224458);
planeGrid.position.y=-1.65;planeGrid.material.transparent=true;planeGrid.material.opacity=.32;
holder.add(planeGrid);
const bounding=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.42,2.42,2.42)),new THREE.LineBasicMaterial({color:0x347b88,transparent:true,opacity:.19}));
holder.add(bounding);
const orbitRing=new THREE.Mesh(new THREE.TorusGeometry(1.59,.004,5,128),new THREE.MeshBasicMaterial({color:0x2b8b97,transparent:true,opacity:.34}));
orbitRing.rotation.x=Math.PI/2.85;holder.add(orbitRing);
const starPositions=new Float32Array(280*3);
for(let i=0;i<280;i++){
  const p=i*3;
  const t=i*2.399963229728653,z=(i/280)*2-1,r=Math.sqrt(1-z*z);
  starPositions[p]=Math.cos(t)*r*4.0;starPositions[p+1]=z*3;starPositions[p+2]=Math.sin(t)*r*4.0;
}
const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0x61c9cf,size:.018,transparent:true,opacity:.36}));
scene.add(stars);
function sizeScene(){
  if(!renderer)return;
  const rect=el.scene.getBoundingClientRect();
  if(rect.width<1||rect.height<1)return;
  renderer.setSize(rect.width,rect.height,false);
  camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
}
if(renderer){
  new ResizeObserver(sizeScene).observe(el.scene);
  window.addEventListener('resize',sizeScene);
  sizeScene();
  let previous=0;
  function tick(t){
    requestAnimationFrame(tick);
    if(document.hidden)return;
    const dt=t-previous;previous=t;
    if(controls){controls.autoRotate=$('autorotate').checked&&!busy;controls.update();}
    stars.rotation.y+=Math.min(dt,50)*.000015;
    renderer.render(scene,camera);
  }
  requestAnimationFrame(tick);
}
function setupMetadata(){
  const [x,y,z]=volume.dims;
  el.datasetName.textContent=volume.name.toUpperCase();
  el.datasetMeta.textContent=volume.synthetic?'SYNTHETIC / EDUCATIONAL SAMPLE':volume.kind+' · '+z+' IMAGES · LOCAL';
  el.resolution.textContent=x+' × '+y+' × '+z;
  el.voxelSpacing.textContent=volume.spacing.map(s=>s.toFixed(2)).join(' × ')+' mm';
  el.sceneLabel.querySelector('span').textContent=volume.synthetic?'FIG 01 — SYNTHETIC PHANTOM':'FIG 01 — USER-SUPPLIED VOLUME';
  for(const [name,axis] of Object.entries(axisMap)){
    const slider=sliders[name];
    slider.max=volume.dims[axis]-1;slider.value=slice[axis];
  }
}
function resetSlices(){
  slice=volume.dims.map(n=>Math.floor((n-1)/2));
  for(const [name,axis] of Object.entries(axisMap))sliders[name].value=slice[axis];
}
function sampleTrilinear(x,y,z){
  const [nx,ny,nz]=volume.dims;
  const ix=clamp(Math.round(x*(nx-1)),0,nx-1),iy=clamp(Math.round(y*(ny-1)),0,ny-1),iz=clamp(Math.round(z*(nz-1)),0,nz-1);
  return voxelAt(volume,ix,iy,iz);
}
function rebuildMesh(){
  if(!renderer){el.meshFaces.textContent='WEBGL REQUIRED';return;}
  el.renderStatus.textContent='PROCESSING';
  const resolution=[0,37,53,69][Number(el.detail.value)];
  const material=new THREE.MeshPhysicalMaterial({
    color:palettes[palette].color,emissive:palettes[palette].emissive,
    emissiveIntensity:.24,metalness:.16,roughness:.34,
    clearcoat:.45,clearcoatRoughness:.23,side:THREE.DoubleSide,
    transparent:true,opacity:Number(el.opacity.value)/100,depthWrite:Number(el.opacity.value)>80
  });
  try{
    const mc=new MarchingCubes(resolution,material,false,false,125000);
    mc.isolation=Number(el.threshold.value);
    const size=resolution-1;
    for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
      const border=x===0||y===0||z===0||x===size||y===size||z===size;
      mc.setCell(x,y,z,border?0:sampleTrilinear(x/size,y/size,z/size));
    }
    mc.update();
    mc.scale.set(...volume.dims.map((d,i)=>{
      const mm=volume.dims.map((n,j)=>n*volume.spacing[j]);
      const max=Math.max(...mm);
      return mm[i]/max*2.6;
    }));
    if(surface){holder.remove(surface);surface.geometry.dispose();surface.material.dispose();}
    surface=mc;holder.add(surface);
    const count=Math.round((mc.count||0)/3);
    el.meshFaces.textContent=count?count.toLocaleString()+' TRIANGLES':'NO SURFACE';
    if(!count)notify('No surface at this threshold. Try lowering the threshold.');
    el.renderStatus.textContent='READY';
  }catch(error){
    material.dispose();
    el.meshFaces.textContent='RENDER ERROR';
    el.renderStatus.textContent='ERROR';
    notify('3D reconstruction: '+error.message,true);
  }
}
function scheduleMesh(){
  clearTimeout(rebuildTimer);rebuildTimer=setTimeout(rebuildMesh,180);
}
function mapIntensity(v){
  const width=Number(el.window.value),level=Number(el.level.value);
  return clamp(Math.round((v-(level-width/2))/width*255),0,255);
}
function renderSlice(name){
  const c=canvas[name],axis=axisMap[name],dims=volume.dims;
  const a=name==='sagittal'?dims[1]:dims[0];
  const b=name==='axial'?dims[1]:dims[2];
  c.width=a;c.height=b;
  const ctx=c.getContext('2d',{willReadFrequently:false});
  if(!ctx)return;
  const frame=ctx.createImageData(a,b),pixels=frame.data;
  for(let j=0;j<b;j++)for(let i=0;i<a;i++){
    let x,y,z;
    if(name==='axial'){x=i;y=b-1-j;z=slice[2];}
    else if(name==='coronal'){x=i;y=slice[1];z=b-1-j;}
    else{x=slice[0];y=i;z=b-1-j;}
    const gray=mapIntensity(voxelAt(volume,x,y,z));
    const p=(j*a+i)*4;
    pixels[p]=gray;pixels[p+1]=gray;pixels[p+2]=gray;pixels[p+3]=255;
  }
  ctx.putImageData(frame,0,0);
  let crossX,crossY;
  if(name==='axial'){crossX=slice[0];crossY=b-1-slice[1];}
  if(name==='coronal'){crossX=slice[0];crossY=b-1-slice[2];}
  if(name==='sagittal'){crossX=slice[1];crossY=b-1-slice[2];}
  ctx.lineWidth=Math.max(.6,a/380);ctx.strokeStyle='rgba(56,235,218,.82)';
  ctx.beginPath();ctx.moveTo(crossX+.5,0);ctx.lineTo(crossX+.5,b);ctx.moveTo(0,crossY+.5);ctx.lineTo(a,crossY+.5);ctx.stroke();
  ctx.fillStyle='#ff8059';ctx.beginPath();ctx.arc(crossX+.5,crossY+.5,Math.max(1.3,a/120),0,2*Math.PI);ctx.fill();
  $(name+'Index').textContent=['X','Y','Z'][axis]+' '+String(slice[axis]).padStart(3,'0');
  sliders[name].value=slice[axis];
}
function renderAllSlices(){for(const name of Object.keys(canvas))renderSlice(name);}
function jumpFromClick(name,event){
  const c=canvas[name],rect=c.getBoundingClientRect(),a=c.width,b=c.height;
  const fit=Math.min(rect.width/a,rect.height/b),drawW=a*fit,drawH=b*fit;
  const u=clamp(Math.round((event.clientX-rect.left-(rect.width-drawW)/2)/fit),0,a-1);
  const v=clamp(Math.round((event.clientY-rect.top-(rect.height-drawH)/2)/fit),0,b-1);
  if(name==='axial'){slice[0]=u;slice[1]=b-1-v;}
  else if(name==='coronal'){slice[0]=u;slice[2]=b-1-v;}
  else{slice[1]=u;slice[2]=b-1-v;}
  renderAllSlices();
}
for(const [name,c] of Object.entries(canvas)){
  c.addEventListener('click',event=>jumpFromClick(name,event));
  sliders[name].addEventListener('input',event=>{slice[axisMap[name]]=Number(event.target.value);renderAllSlices();});
}
for(const [input,output,suffix] of [['threshold','thresholdValue',''],['opacity','opacityValue','%'],['detail','detailValue','']]){
  $(input).addEventListener('input',()=>{
    $(output).textContent=input==='detail'?['','LOW','MEDIUM','HIGH'][Number($(input).value)]:$(input).value+suffix;
    if(input==='opacity'&&surface){
      surface.material.opacity=Number(el.opacity.value)/100;
      surface.material.depthWrite=Number(el.opacity.value)>80;
    }else scheduleMesh();
  });
}
for(const [id,out] of [['windowRange','windowValue'],['levelRange','levelValue']])$(id).addEventListener('input',event=>{$(out).textContent=event.target.value;renderAllSlices();});
$('gridToggle').addEventListener('change',event=>{planeGrid.visible=event.target.checked;bounding.visible=event.target.checked;orbitRing.visible=event.target.checked;});
function cameraPreset(name){
  const pos={perspective:[3.5,2.1,4],front:[0,0,5],side:[5,0,0],top:[0,5,.001]}[name];
  camera.position.set(...pos);controls?.target.set(0,0,0);controls?.update();
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('selected',b.dataset.camera===name));
}
document.querySelectorAll('.view-btn').forEach(b=>b.addEventListener('click',()=>cameraPreset(b.dataset.camera)));
$('resetCamera').addEventListener('click',()=>cameraPreset('perspective'));
$('meshColor').addEventListener('click',()=>{palette=(palette+1)%palettes.length;if(surface){surface.material.color.setHex(palettes[palette].color);surface.material.emissive.setHex(palettes[palette].emissive);}notify('Surface palette: '+palettes[palette].name);});
$('fullScreen').addEventListener('click',async()=>{
  const target=document.querySelector('.render-shell');
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(target.requestFullscreen)await target.requestFullscreen();else notify('Fullscreen is not supported by this browser.',true);}
  catch(err){notify('Fullscreen is blocked in this browser.',true);}
});
$('exportBtn').addEventListener('click',()=>{
  if(!renderer)return notify('3D renderer unavailable.',true);
  try{
    renderer.render(scene,camera);
    const link=document.createElement('a');link.download='neuroforge-3d-'+Date.now()+'.png';link.href=renderer.domElement.toDataURL('image/png');link.click();
    notify('3D viewport screenshot exported.');
  }catch(err){notify('Could not export image: '+err.message,true);}
});
async function setVolume(next){
  volume=next;resetSlices();setupMetadata();renderAllSlices();
  // Returning to the default threshold also gives new datasets a predictable first view.
  el.threshold.value=95;el.thresholdValue.textContent='95';
  await new Promise(requestAnimationFrame);
  rebuildMesh();
  status(volume.synthetic?'SYNTHETIC PHANTOM READY · NO PATIENT DATA':'YOUR VOLUME IS READY · ALL PROCESSING ON YOUR DEVICE');
  if(next.warnings?.length)notify(next.warnings.length+' DICOM file(s) were skipped. Check format compatibility.',true);
}
async function handleFiles(files){
  if(busy)return;
  busy=true;status('READING IMAGING DATA LOCALLY...');el.renderStatus.textContent='LOADING';
  notify('Reading and assembling your imaging data in this browser…');
  try{
    const next=await loadVolume(files);
    await setVolume(next);
    notify('Volume loaded: '+next.dims.join(' × ')+' voxels.');
  }catch(err){console.error('Imaging read failed:',err);status('ERROR · '+err.message);notify(err.message,true);}
  finally{busy=false;}
}
$('uploadBtn').addEventListener('click',()=>el.fileInput.click());
el.dropzone.addEventListener('click',()=>el.fileInput.click());
el.dropzone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.fileInput.click();}});
el.fileInput.addEventListener('change',event=>{handleFiles(event.target.files);event.target.value='';});
for(const type of ['dragenter','dragover'])el.dropzone.addEventListener(type,event=>{event.preventDefault();el.dropzone.classList.add('dragover');});
for(const type of ['dragleave','drop'])el.dropzone.addEventListener(type,event=>{event.preventDefault();el.dropzone.classList.remove('dragover');});
el.dropzone.addEventListener('drop',event=>handleFiles(event.dataTransfer.files));
$('demoBtn').addEventListener('click',()=>{setVolume(createPhantom()).then(()=>notify('Synthetic phantom loaded. Not a real patient scan.'));});
document.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement)return;
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
    slice[2]=clamp(slice[2]+(event.key==='ArrowUp'?1:-1),0,volume.dims[2]-1);renderAllSlices();
  }
});
resetSlices();setupMetadata();renderAllSlices();setTimeout(rebuildMesh,70);
