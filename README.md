# NEUROFORGE — AI MRI Analyzer

**A browser-based volumetric medical imaging research workstation.** Distinctive polygonal industrial UI, coral / cyan / violet palette, interactive 3D WebGL isosurfaces and three orthogonal image viewers.

**IMPORTANT: EDUCATIONAL / RESEARCH USE ONLY.** The initial release is a medical image viewer, **not** a clinically validated AI model or diagnostic tool. It does **not** detect tumors, diagnose disease, segment named anatomical structures, or replace a radiologist. The project name describes its longer-term roadmap, not current diagnostic functionality.

## Live website

https://saaeiddev.github.io/AI-MRI-Analyzer/

If this is initially a 404, activate **Settings → Pages → Source: GitHub Actions** in the repository and check the **Actions** tab for successful deployment.

## Features

- Responsive high-contrast navy industrial interface with angled controls, electric coral/cyan/violet and large live 3D center stage.
- 3D scalar threshold isosurface reconstruction with Three.js MarchingCubes.
- Synchronized axial, coronal, sagittal image viewers with clickable crosshairs and slice sliders.
- Isosurface threshold, three quality levels, adjustable opacity, color palettes, orbit controls, camera presets, auto-rotation and spatial reference grid.
- Display window width/center, volume dimensions and voxel spacing. Export 3D viewport as PNG.
- Reads NIfTI-1 .nii and .nii.gz 3D volumes, or first frame from 4D.
- Reads multiple single-frame grayscale DICOM slices in the same series (8/16-bit, uncompressed, Little Endian Implicit or Explicit VR only).
- Clearly labeled **synthetic educational phantom** automatically displayed at startup. It is not a real MRI.
- All pixel processing happens inside your browser. No scans are posted to an application server. Note that fonts and JS dependencies are loaded from public CDNs; do not upload identifiable patient scans to an unaudited public web deployment.

## Using the app

Open the webpage on a modern device supporting WebGL. Click **IMPORT SCAN** and select one NIfTI file or several DICOM slices from the same acquisition. The axial, coronal and sagittal viewers appear at right. Click a slice to move the crosshair; drag the sliders to browse. Adjust **ISO-SURFACE THRESHOLD** and **MESH DETAIL** for the 3D rendering. Drag the model to rotate and scroll or pinch to zoom. Choose **EXPORT VIEW** to save a PNG of the 3D viewport.

## Limitations

- Threshold visualization is **not** an AI-generated anatomical or pathological segmentation. Bright areas may be artifact, not anatomy.
- The first version uses voxel array axes for slice views; NIfTI sform/qform orientation and DICOM ImageOrientationPatient obliquity, tilt and gantry geometry are **not** applied. Plane labels are approximations and are not guaranteed to correspond to patient anatomy.
- DICOM stacks are sorted by ImagePositionPatient Z when available, otherwise InstanceNumber; some oblique or irregular imaging stacks are unsupported.
- Compressed JPEG/JPEG2000, RLE, enhanced multiframe, color DICOM and other encapsulated formats are unsupported.
- Browser-safe upper limit of 24 million voxels; browser and GPU memory usage may still vary.
- Intensity values are normalized for visualization, **not** quantitative clinical measurement.
- All scans are processed locally, but local processing alone does not establish regulatory or clinical compliance. Validate security, consent, CDNs, browser extensions and local data management before handling real medical records.

## Architecture

The static GitHub Pages application uses HTML, CSS and JavaScript modules with Three.js, OrbitControls and MarchingCubes loaded from jsDelivr. DICOM parsing is dynamically loaded from esm.sh. The gzip browser API handles NIfTI compression. No backend, user account, analytics or build stage is needed.

## Deploy

This repository contains a deployment workflow at .github/workflows/pages.yml. Set **Settings → Pages → Build and deployment → GitHub Actions**, and push changes to main. If a static branch deployment is preferred, the root can be deployed from **main / (root)** instead.

For local development, run a simple HTTP server from the repository root, for example: python3 -m http.server 8080 and browse to http://localhost:8080. ES modules will not load reliably from file:// URLs.

## Future research roadmap

Validated ONNX/WebGPU inference, labeled anatomy segmentation and clinical uncertainty reporting, improved DICOM geometry, NRRD, and authenticated medical service integrations. These require model selection, licensing, rigorous tests and clinical validation before they can be called diagnostic.

**Created by Amir Saeid Dehghan. © 2026.**
