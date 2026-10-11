# NEUROFORGE — MRI Imaging Workstation

A fully interactive browser-based MRI viewer and **anatomical reference model explorer**, with a custom angular industrial interface in electric cyan, coral and violet. Deployed as static files on GitHub Pages.

**Live website:** https://saaeiddev.github.io/AI-MRI-Analyzer/

## What's new: real source assets, not synthetic "brain" blobs

Previous releases presented a mathematically generated synthetic object on initial load. This release **removes it from the startup experience**, replacing it with:

1. **Licensed high-detail brain anatomy** — real pre-made Z-Anatomy/BodyParts3D anatomical meshes with individual structures (cortex, cerebellum, brainstem, deep structures), loaded as an optimized Draco-compressed GLB from the public [Brain Project](https://github.com/itayinbarr/brainproject). Source credits and the mandatory CC BY-SA 4.0 asset notice are included below and on the site. The default view shows the true specimen and its natural tissue color/shape, not procedural wrinkles.
2. **MNI152 T1-weighted MRI atlas** — reference MR voxels from [Nilearn](https://github.com/nilearn/nilearn) are loaded into the three slice views on opening the demo. These are an average/template atlas, **not** a patient scan and **not** a clinical diagnostic study.
3. **Real 3D cross-sections** — the axial/coronal/sagittal slices, computed from the loaded voxel arrays, are displayed as moveable MRI planes in the 3D viewport. Changing any slice updates the model immediately.
4. **Experimental iso-surface** — original intensity-threshold reconstruction remains available as an explicit, separate visualization mode, and it is labeled *unsegmented*. This may look organically inaccurate and is not a brain-surface segmentation.

The high-detail atlas mesh is **not** auto-registered to a user's MRI. This boundary is explicit in the UI: don't confuse the anatomical reference illustration with results computed from a personal scan.

## Controls

- **ANATOMICAL MODEL**: explore the high-resolution licensed model; choose **WHOLE**, **CORTEX**, or **DEEP** to reveal structural layers.
- **MRI 3D SLICES**: view three intersecting planes of actual voxels from the loaded scan; use right-side slice sliders or click slice canvases to move them.
- **ISO-SURFACE**: display threshold-derived scalar geometry (exploratory only).
- Drag to orbit, scroll/pinch to zoom, choose FRONT/SIDE/TOP camera views; use scene grid, rotation and color tools.
- Adjust window/level, opacity, iso-threshold, mesh detail; **EXPORT VIEW** saves the 3D canvas.
- Click **IMPORT SCAN** for local NIfTI-1 (nii/nii.gz) or multiple supported uncompressed single-frame DICOM files.

## Security / data handling

All uploaded voxels are read on the user's device; there is no custom image-upload backend or user tracking in this repository. The externally hosted brain model, MRI template, scripts, and fonts must be fetched online. For regulated/identifiable patient data, audit and self-host dependencies and follow applicable clinical and privacy regulations. Browsers and plugins can have access to viewed files.

## Asset provenance, license, and attribution

**Ready-made 3D anatomy**: [Brain Project](https://github.com/itayinbarr/brainproject) by itayinbarr; the anatomical meshes are derived from **Z-Anatomy contributors / BodyParts3D © DBCLS (Database Center for Life Science)**, released under **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**. The GLB is streamed unmodified as a source asset and displayed with runtime materials, layer filtering and re-centering. Attribution: https://creativecommons.org/licenses/by-sa/4.0/. If you distribute modified anatomical assets, comply with the share-alike terms; our code does not relicense the source model. Repository source and registration/accuracy documentation: https://github.com/itayinbarr/brainproject/blob/main/docs/registration.md.

**MRI data**: the **MNI152 ICBM152 T1-weighted anatomical reference template**, distributed within [Nilearn](https://github.com/nilearn/nilearn/blob/main/nilearn/datasets/data/mni_icbm152_t1_tal_nlin_sym_09a_converted.nii.gz); the source template derives from 152 MRI scans and is not a patient-specific scan. Atlas licensing and acknowledgements remain with the original MNI/ICBM contributors.

The reference GLB is fetched from:
- https://itayinbarr.github.io/brainproject/models/brain.glb
- Fallback: https://raw.githubusercontent.com/itayinbarr/brainproject/main/brain-atlas/models/brain.glb

The MRI template is fetched from the Nilearn source file, with jsDelivr fallback. Source hosts/CDNs must be reachable over the network. No large third-party binaries were checked into this project; original upstream files and licenses remain authoritative.

## Clinical limitations

**EDUCATIONAL / RESEARCH VISUALIZATION ONLY. Not a medical device.**

There is **no pathology detection, tumor recognition, diagnostic AI inference, validated organ segmentation or automated radiological interpretation** here. The name "AI MRI Analyzer" is the project/roadmap name, not a claim that an AI diagnostic model has been implemented.

- Atlas illustrations and patient scan data are **not spatially registered**.
- NIfTI viewer currently uses voxel order and spacing without applying affine qform/sform. DICOM stack sorting may not correctly handle oblique orientations, multiframe, enhanced or compressed images.
- NIfTI-1 supported; uncompressed single-frame grayscale DICOM supported with limitations. 24-million-voxel upper bound.
- MRI intensities are normalized for visual presentation, **not** calibrated for quantitative or clinical interpretation.
- Iso-surfaces can show structures unrelated to brain anatomy because they use a simple intensity boundary.
- Always use validated medical imaging software and licensed clinicians for healthcare decisions.

## Local development

Serve the root over an HTTP server to satisfy JavaScript modules. For example, run:

    python3 -m http.server 8080

Open http://localhost:8080.

No build required. Main entry points:

- index.html — responsive interface
- styles.css — visual design and responsive behavior
- main.js — Three.js scene, controls, DICOM/NIfTI workflows
- volume.js — voxel import and NIfTI/DICOM parsing
- reference-model.js — attributed anatomical mesh loader / filters
- scan-planes.js — real voxel MRI planes
- .github/workflows/pages.yml — GitHub Pages workflow

## Deployment

For GitHub Pages: Settings → Pages → Build and deployment → Source **GitHub Actions**. The workflow deploys automatically on push to main. Use the repository Actions tab to confirm success. If the webpage was open before changes, do a hard reload (Ctrl/Cmd + Shift + R).

**Created by Amir Saeid Dehghan — © 2026.**
