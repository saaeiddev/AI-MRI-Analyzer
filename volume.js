// Medical volume reading, entirely local in the browser.
// This research viewer deliberately does not perform diagnosis or AI inference.
const LIMIT = 24000000;
const index3 = (x,y,z,nx,ny) => x + nx*(y+ny*z);
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const voxelAt = (v,x,y,z) => v.data[index3(clamp(x,0,v.dims[0]-1),clamp(y,0,v.dims[1]-1),clamp(z,0,v.dims[2]-1),v.dims[0],v.dims[1])];

export function createPhantom(){
  const nx=108,ny=116,nz=96;
  const data=new Uint8Array(nx*ny*nz);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=(x-(nx-1)/2)/(nx*.44), b=(y-(ny-1)/2)/(ny*.43), c=(z-(nz-1)/2)/(nz*.44);
    const az=Math.atan2(c,b), longitudinal=Math.atan2(b,a);
    const grooves=.035*Math.sin(18*az+2.1*Math.sin(6*longitudinal))+.021*Math.sin(23*longitudinal+5*c)+.018*Math.sin(30*b+7*a);
    const separation=.11*Math.exp(-Math.pow(a/.07,2))*Math.max(0,.60+c);
    const r=Math.sqrt(a*a+(b*.97)*(b*.97)+c*c);
    const inside=r<1+grooves-separation;
    if(!inside)continue;
    const ventricle=Math.pow(a/.24,2)+Math.pow((b+.08)/.19,2)+Math.pow(c/.16,2)<1;
    const tissue=165+32*Math.sin(8*r)+18*Math.sin(13*a+9*b+7*c)+18*Math.sin(16*az+4*longitudinal);
    const shell=r>.85 ? 208-70*(r-.85) : tissue;
    data[index3(x,y,z,nx,ny)]=ventricle?16:clamp(Math.round(shell),20,255);
  }
  return {data,dims:[nx,ny,nz],spacing:[1,1,1],name:'SYNTHETIC PHANTOM',kind:'DEMO',synthetic:true};
}

function normalizeToBytes(floatData){
  // Robust global intensity display scaling, not a clinical window preset.
  const sample=[];
  const skip=Math.max(1,Math.floor(floatData.length/85000));
  for(let i=0;i<floatData.length;i+=skip){
    const v=floatData[i];if(Number.isFinite(v)&&v!==0)sample.push(v);
  }
  if(!sample.length)throw new Error('No usable nonzero voxel intensities found.');
  sample.sort((a,b)=>a-b);
  const lo=sample[Math.floor((sample.length-1)*.01)];
  const hi=sample[Math.floor((sample.length-1)*.99)];
  const span=(hi-lo)||1;
  const out=new Uint8Array(floatData.length);
  for(let i=0;i<floatData.length;i++){
    const v=floatData[i];
    out[i]=Number.isFinite(v)&&v!==0?clamp(Math.round((v-lo)/span*235+18),0,255):0;
  }
  return out;
}

function headerError(message){throw new Error(message);}
export async function loadNifti(file){
  let buffer=await file.arrayBuffer();
  if(file.name.toLowerCase().endsWith('.gz')||(new Uint8Array(buffer))[0]===31&&(new Uint8Array(buffer))[1]===139){
    if(!('DecompressionStream' in window))headerError('Your browser cannot read .nii.gz directly. Unzip it and use .nii.');
    try{buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
    catch{headerError('Could not decompress this NIfTI gzip file.');}
  }
  if(buffer.byteLength<352)headerError('This file is too small to be a NIfTI-1 volume.');
  const v=new DataView(buffer);let le=true;
  if(v.getInt32(0,true)!==348){if(v.getInt32(0,false)===348)le=false;else headerError('Only NIfTI-1 .nii/.nii.gz files are supported.');}
  const dimensions=v.getInt16(40,le);
  if(dimensions<3)headerError('This NIfTI file does not contain a 3D volume.');
  const nx=v.getInt16(42,le),ny=v.getInt16(44,le),nz=v.getInt16(46,le);
  const count=nx*ny*nz;
  if(nx<2||ny<2||nz<2||count>LIMIT)headerError('Unsupported dimensions or volume too large (max 24 million voxels).');
  const datatype=v.getInt16(70,le),bitpix=v.getInt16(72,le);
  const byteSize=bitpix/8, offset=Math.max(352,Math.floor(v.getFloat32(108,le)));
  const supported=[2,4,8,16,64,256,512,768];
  if(!supported.includes(datatype)||byteSize<1)headerError('Unsupported NIfTI voxel datatype: '+datatype);
  if(offset+count*byteSize>buffer.byteLength)headerError('NIfTI voxel data is incomplete.');
  const read={
    2:(p)=>v.getUint8(p),4:(p)=>v.getInt16(p,le),8:(p)=>v.getInt32(p,le),
    16:(p)=>v.getFloat32(p,le),64:(p)=>v.getFloat64(p,le),256:(p)=>v.getInt8(p),
    512:(p)=>v.getUint16(p,le),768:(p)=>v.getUint32(p,le)
  }[datatype];
  const slope=v.getFloat32(112,le)||1,intercept=v.getFloat32(116,le)||0;
  const values=new Float32Array(count);
  for(let i=0;i<count;i++)values[i]=read(offset+i*byteSize)*slope+intercept;
  const spacing=[80,84,88].map(p=>{const n=Math.abs(v.getFloat32(p,le));return n>.001&&n<1000?n:1;});
  return {data:normalizeToBytes(values),dims:[nx,ny,nz],spacing,name:file.name.replace(/\.nii(\.gz)?$/i,'').slice(0,65),kind:'NIFTI',synthetic:false};
}
export async function loadDicomSeries(files){
  const module=await import('https://esm.sh/dicom-parser@1.8.21');
  const parser=module.default||module;
  const slices=[];
  const warnings=[];
  for(const file of files){
    try{
      if(file.size>110*1024*1024){warnings.push(file.name+' too large');continue;}
      const bytes=new Uint8Array(await file.arrayBuffer());
      const ds=parser.parseDicom(bytes,{TransferSyntaxUID:'1.2.840.10008.1.2'});
      const syntax=(ds.string('x00020010')||'1.2.840.10008.1.2').trim();
      if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1'].includes(syntax)){warnings.push('Compressed/unsupported DICOM transfer syntax');continue;}
      const rows=ds.uint16('x00280010'),cols=ds.uint16('x00280011');
      const bits=ds.uint16('x00280100')||16,sign=ds.uint16('x00280103')||0;
      const samples=ds.uint16('x00280002')||1;
      const frames=Number(ds.string('x00280008')||1);
      const pixels=ds.elements.x7fe00010;
      if(!pixels||!rows||!cols||samples!==1||frames!==1||![8,16].includes(bits)){warnings.push('Unsupported DICOM image layout');continue;}
      const stride=bits/8,count=rows*cols;
      if(pixels.length<count*stride){warnings.push('Incomplete DICOM pixel data');continue;}
      const px=new DataView(bytes.buffer,bytes.byteOffset+pixels.dataOffset,count*stride);
      const slope=parseFloat(ds.string('x00281053')||'1')||1;
      const intercept=parseFloat(ds.string('x00281052')||'0')||0;
      const inversion=(ds.string('x00280004')||'')==='MONOCHROME1';
      const raw=new Float32Array(count);
      for(let i=0;i<count;i++){
        let n=bits===8?(sign?px.getInt8(i):px.getUint8(i)):(sign?px.getInt16(i*2,true):px.getUint16(i*2,true));
        raw[i]=n*slope+intercept;
      }
      const point=(ds.string('x00200032')||'').split('\\').map(Number);
      const imagePosition=point.length===3&&point.every(Number.isFinite)?point[2]:null;
      const pixelSpacing=(ds.string('x00280030')||'1\\1').split('\\').map(Number);
      slices.push({raw,rows,cols,imagePosition,instance:parseInt(ds.string('x00200013')||'0',10)||0,
        series:ds.string('x0020000e')||'single',spacing:pixelSpacing,inversion});
    }catch(err){warnings.push(file.name+': '+err.message);}
  }
  if(!slices.length)throw new Error('No readable uncompressed grayscale DICOM slices. JPEG/RLE/other compressed DICOM images need a dedicated decoder.');
  const counts=new Map();
  for(const s of slices)counts.set(s.series,(counts.get(s.series)||0)+1);
  const uid=[...counts].sort((a,b)=>b[1]-a[1])[0][0];
  const series=slices.filter(s=>s.series===uid&&s.rows===slices.find(a=>a.series===uid).rows&&s.cols===slices.find(a=>a.series===uid).cols);
  if(series.length<2)throw new Error('Select at least 2 slices from one DICOM series for a 3D reconstruction.');
  if(series.every(s=>s.imagePosition!==null))series.sort((a,b)=>a.imagePosition-b.imagePosition);
  else series.sort((a,b)=>a.instance-b.instance);
  const nx=series[0].cols,ny=series[0].rows,nz=series.length,count=nx*ny*nz;
  if(count>LIMIT)throw new Error('DICOM series too large for this browser viewer (24M voxel limit).');
  const floatData=new Float32Array(count);
  for(let z=0;z<nz;z++)floatData.set(series[z].raw,z*nx*ny);
  let dz=1;
  if(series[0].imagePosition!==null&&series[1].imagePosition!==null){const delta=Math.abs(series[1].imagePosition-series[0].imagePosition);if(delta>0&&delta<100)dz=delta;}
  const spacing=[series[0].spacing[1]||1,series[0].spacing[0]||1,dz].map(v=>v>0&&v<100?v:1);
  const data=normalizeToBytes(floatData);
  if(series[0].inversion)for(let i=0;i<data.length;i++)if(data[i])data[i]=255-data[i];
  return {data,dims:[nx,ny,nz],spacing,name:'DICOM SERIES · '+nz+' SLICES',kind:'DICOM',synthetic:false,warnings};
}
export async function loadVolume(files){
  const list=Array.from(files||[]).filter(f=>f.size>0);
  if(!list.length)throw new Error('Choose at least one imaging file.');
  const nifti=list.find(f=>/\.nii(\.gz)?$/i.test(f.name));
  return nifti?loadNifti(nifti):loadDicomSeries(list);
}
export {voxelAt,clamp};
