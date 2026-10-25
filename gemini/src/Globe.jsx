import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const COUNTRIES = [
  { name: 'Greece', minLat: 34, maxLat: 42, minLon: 19, maxLon: 29 },
  { name: 'United States', minLat: 24, maxLat: 49, minLon: -125, maxLon: -66 },
  { name: 'United Kingdom', minLat: 49, maxLat: 59, minLon: -8, maxLon: 2 },
  { name: 'France', minLat: 42, maxLat: 51, minLon: -5, maxLon: 8 },
  { name: 'Germany', minLat: 47, maxLat: 55, minLon: 5, maxLon: 15 },
  { name: 'Italy', minLat: 35, maxLat: 47, minLon: 6, maxLon: 19 },
  { name: 'Japan', minLat: 30, maxLat: 46, minLon: 128, maxLon: 146 },
  { name: 'Egypt', minLat: 22, maxLat: 32, minLon: 25, maxLon: 35 },
  { name: 'Australia', minLat: -44, maxLat: -10, minLon: 112, maxLon: 154 },
  { name: 'Brazil', minLat: -34, maxLat: 5, minLon: -74, maxLon: -34 }
];

// Simple procedural noise for generating realistic Earth terrain offline
function generateEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  // Simple pseudo-random hash noise
  const hash = (x, y) => {
    let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return h - Math.floor(h);
  };

  // Value noise function
  const noise = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const u = fx * fx * (3.0 - 2.0 * fx);
    const v = fy * fy * (3.0 - 2.0 * fy);

    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);

    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };

  // Fractional Brownian Motion (fBm)
  const fbm = (x, y, octaves = 6) => {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise(x * frequency, y * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  };

  for (let y = 0; y < canvas.height; y++) {
    const lat = ((canvas.height - y) / canvas.height) * Math.PI - Math.PI / 2;
    for (let x = 0; x < canvas.width; x++) {
      const lon = (x / canvas.width) * Math.PI * 2 - Math.PI;

      // Project spherical to 3D for noise mapping to avoid distortion at poles
      const nx = Math.cos(lat) * Math.cos(lon) * 2.5;
      const ny = Math.cos(lat) * Math.sin(lon) * 2.5;
      const nz = Math.sin(lat) * 2.5;

      const nVal = fbm(nx + 50, ny + 50 + nz);

      let r = 0, g = 0, b = 0;

      if (nVal < 0.46) {
        // Deep Ocean
        r = 5; g = 15; b = 45;
      } else if (nVal < 0.49) {
        // Shallow Ocean/Coast
        r = 10; g = 40; b = 80;
      } else if (nVal < 0.52) {
        // Beach Sand
        r = 180; g = 160; b = 120;
      } else if (nVal < 0.65) {
        // Green Grassland/Forest
        r = 25; g = 90; b = 35;
      } else if (nVal < 0.72) {
        // Mountains (Brown)
        r = 95; g = 75; b = 50;
      } else {
        // Mountain Peaks (White Ice)
        r = 235; g = 235; b = 245;
      }

      // Add polar ice caps based on latitude
      const absLatDeg = Math.abs(lat * (180 / Math.PI));
      if (absLatDeg > 72) {
        // High lat = Ice sheet
        const mix = (absLatDeg - 72) / 18; // 0 to 1
        r = Math.round(r * (1 - mix) + 240 * mix);
        g = Math.round(g * (1 - mix) + 240 * mix);
        b = Math.round(b * (1 - mix) + 250 * mix);
      }

      const idx = (y * canvas.width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

// Procedural cloud texture
function generateCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  const hash = (x, y) => {
    let h = Math.sin(x * 17.13 + y * 97.37) * 43758.5453;
    return h - Math.floor(h);
  };

  const noise = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3.0 - 2.0 * fx);
    const v = fy * fy * (3.0 - 2.0 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };

  const fbm = (x, y, octaves = 5) => {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise(x * frequency, y * frequency);
      frequency *= 2.2;
      amplitude *= 0.45;
    }
    return value;
  };

  for (let y = 0; y < canvas.height; y++) {
    const lat = ((canvas.height - y) / canvas.height) * Math.PI - Math.PI / 2;
    for (let x = 0; x < canvas.width; x++) {
      const lon = (x / canvas.width) * Math.PI * 2 - Math.PI;

      const nx = Math.cos(lat) * Math.cos(lon) * 1.8;
      const ny = Math.cos(lat) * Math.sin(lon) * 1.8;
      const nz = Math.sin(lat) * 1.8;

      const nVal = fbm(nx + 10, ny + nz);
      const intensity = nVal > 0.48 ? Math.round((nVal - 0.48) * 2.5 * 255) : 0;

      const idx = (y * canvas.width + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.min(240, intensity);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export default function Globe({ onSelectCountry }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 250;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Starfield Background
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1200;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      // Random position inside a shell far away
      const radius = 450 + Math.random() * 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      sizeAttenuation: true
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // Ambient and Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(200, 100, 150);
    scene.add(sunLight);

    // Glow Lighting helper (behind Earth)
    const glowLight = new THREE.DirectionalLight(0x00f0ff, 0.6);
    glowLight.position.set(-200, -100, -150);
    scene.add(glowLight);

    // Globe Group for rotations
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Earth Sphere Geometry
    const earthGeometry = new THREE.SphereGeometry(70, 64, 64);
    const earthTexture = generateEarthTexture();
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 8,
      bumpScale: 1.5
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    globeGroup.add(earthMesh);

    // Earth Clouds Overlay
    const cloudGeometry = new THREE.SphereGeometry(70.5, 64, 64);
    const cloudTexture = generateCloudTexture();
    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: cloudTexture,
      transparent: true,
      blending: THREE.NormalBlending
    });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    globeGroup.add(cloudMesh);

    // Custom atmospheric glow effect (simple shader or outer shell)
    const atmosphereGeometry = new THREE.SphereGeometry(73, 32, 32);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
          gl_FragColor = vec4(0.0, 0.94, 1.0, 1.0) * intensity * 0.75;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // Trackball rotation variables (Quaternion-based dragging)
    let isDragging = false;
    const previousMousePosition = { x: 0, y: 0 };
    const targetQuaternion = new THREE.Quaternion().copy(globeGroup.quaternion);

    const onPointerDown = (e) => {
      isDragging = true;
      previousMousePosition.x = e.clientX;
      previousMousePosition.y = e.clientY;
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      // Map drag distance to rotation angles
      const deltaRotationOffset = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(
          (deltaY * Math.PI) / 600,
          (deltaX * Math.PI) / 600,
          0,
          'XYZ'
        ));

      targetQuaternion.premultiply(deltaRotationOffset);

      previousMousePosition.x = e.clientX;
      previousMousePosition.y = e.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    // Raycast hit testing
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      // Don't trigger click if dragging
      if (isDragging) return;

      // Get mouse coords
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(earthMesh);

      if (intersects.length > 0) {
        const point = intersects[0].point;

        // Convert the hit point back to local space of the rotating Earth mesh
        const localPoint = earthMesh.worldToLocal(point.clone());
        localPoint.normalize();

        // Calculate latitude and longitude
        // standard spherical coords:
        // x = cos(lat) * cos(lon)
        // y = sin(lat)
        // z = cos(lat) * sin(lon)
        const lat = Math.asin(localPoint.y) * (180 / Math.PI);
        const lon = Math.atan2(localPoint.z, localPoint.x) * (180 / Math.PI);

        // Resolve country based on lat/lon
        let resolved = null;
        for (const country of COUNTRIES) {
          if (lat >= country.minLat && lat <= country.maxLat &&
              lon >= country.minLon && lon <= country.maxLon) {
            resolved = country.name;
            break;
          }
        }

        if (resolved) {
          // Trigger country selection and zoom effect
          onSelectCountry(resolved);
        } else {
          // Output clicked coordinate info to console or minor warning
          console.log(`Clicked unassigned waters. Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`);
        }
      }
    };

    // Attach listeners
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onClick);

    // Animation Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate Earth slowly and naturally
      if (!isDragging) {
        const slowRotate = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.0012, 0, 'XYZ'));
        targetQuaternion.premultiply(slowRotate);
      }

      // Smooth interpolation for dragging
      globeGroup.quaternion.slerp(targetQuaternion, 0.15);

      // Rotate clouds slightly faster for realistic relative motion
      cloudMesh.rotation.y += 0.0004;

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('click', onClick);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      earthTexture.dispose();
      cloudTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onSelectCountry]);

  return <div ref={mountRef} className="globe-container" />;
}
