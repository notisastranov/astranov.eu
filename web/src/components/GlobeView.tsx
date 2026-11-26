"use client";

import { useEffect, useRef } from "react";
import { CONTINUUM_HEIGHT, levelFromHeight } from "@/lib/geo/continuum";
import { RHODES, type CadastreLayerMode } from "@/lib/geo/ktima";
import type { Plot, ZoomLevel } from "@/lib/types";

interface GlobeViewProps {
  plots: Plot[];
  cadastreMode: CadastreLayerMode;
  flyTarget: { lat: number; lon: number; height?: number; nonce: number } | null;
  onLevelChange: (level: ZoomLevel) => void;
  onPlotClick: (plot: Plot) => void;
}

/**
 * CesiumJS primary globe. Starfield uses Cesium skyBox (Three.js not required
 * for MVP galaxy backdrop). Continuum: galaxy → national → city → plot.
 */
export function GlobeView({
  plots,
  cadastreMode,
  flyTarget,
  onLevelChange,
  onPlotClick,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const plotsRef = useRef(plots);
  const onPlotClickRef = useRef(onPlotClick);
  const onLevelChangeRef = useRef(onLevelChange);

  plotsRef.current = plots;
  onPlotClickRef.current = onPlotClick;
  onLevelChangeRef.current = onLevelChange;

  useEffect(() => {
    let destroyed = false;
    let removeTick: (() => void) | undefined;
    let removeClick: (() => void) | undefined;

    async function boot() {
      if (!containerRef.current) return;

      (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
        "/cesium";

      const Cesium = await import("cesium");
      await import("cesium/Build/Cesium/Widgets/widgets.css");

      if (destroyed || !containerRef.current) return;

      // Prefer Ion-free boot: OSM + natural Earth-like ellipsoid shading.
      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: document.createElement("div"),
        terrainProvider: undefined,
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
          Promise.resolve(
            new Cesium.UrlTemplateImageryProvider({
              url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              credit: "© OpenStreetMap",
              maximumLevel: 19,
            }),
          ),
        ),
      });

      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.atmosphereLightIntensity = 5;
      viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#02040a");
      viewer.scene.globe.baseColor =
        Cesium.Color.fromCssColorString("#041018");
      viewer.scene.fog.enabled = true;
      viewer.scene.skyBox = new Cesium.SkyBox({
        sources: {
          positiveX: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
          negativeX: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
          positiveY: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
          negativeY: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
          positiveZ: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
          negativeZ: "/cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg",
        },
      });

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          RHODES.lon,
          RHODES.lat,
          CONTINUUM_HEIGHT.global,
        ),
      });

      const paintPlots = () => {
        viewer.entities.removeAll();
        for (const plot of plotsRef.current) {
          const positions = plot.ring.map((p) =>
            Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
          );
          viewer.entities.add({
            id: plot.id,
            name: plot.name,
            polygon: {
              hierarchy: positions,
              material: Cesium.Color.fromCssColorString(
                "rgba(77,240,255,0.28)",
              ),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString("#4df0ff"),
              outlineWidth: 2,
            },
            position: Cesium.Cartesian3.fromDegrees(
              plot.centroid.lon,
              plot.centroid.lat,
            ),
            label: {
              text: plot.name,
              font: "600 13px Orbitron, sans-serif",
              fillColor: Cesium.Color.fromCssColorString("#e8fbff"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              show: true,
            },
          });
        }
      };

      paintPlots();

      const clickHandler = new Cesium.ScreenSpaceEventHandler(
        viewer.scene.canvas,
      );
      clickHandler.setInputAction(
        (movement: { position: import("cesium").Cartesian2 }) => {
          const picked = viewer.scene.pick(movement.position);
          if (!Cesium.defined(picked) || !picked.id) return;
          const id = String(picked.id.id ?? picked.id);
          const plot = plotsRef.current.find((p) => p.id === id);
          if (plot) onPlotClickRef.current(plot);
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );
      removeClick = () => clickHandler.destroy();

      const onTick = () => {
        const carto = viewer.camera.positionCartographic;
        if (!carto) return;
        onLevelChangeRef.current(levelFromHeight(carto.height));
      };
      viewer.clock.onTick.addEventListener(onTick);
      removeTick = () => viewer.clock.onTick.removeEventListener(onTick);

      viewerRef.current = viewer;
      onLevelChangeRef.current(levelFromHeight(CONTINUUM_HEIGHT.global));
    }

    void boot().catch((err) => {
      console.error("Cesium boot failed", err);
    });

    return () => {
      destroyed = true;
      removeTick?.();
      removeClick?.();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    // Re-paint plot entities when list changes without rebuilding the viewer.
    void import("cesium").then((Cesium) => {
      viewer.entities.removeAll();
      for (const plot of plots) {
        const positions = plot.ring.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
        );
        viewer.entities.add({
          id: plot.id,
          name: plot.name,
          polygon: {
            hierarchy: positions,
            material: Cesium.Color.fromCssColorString("rgba(77,240,255,0.28)"),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#4df0ff"),
          },
          position: Cesium.Cartesian3.fromDegrees(
            plot.centroid.lon,
            plot.centroid.lat,
          ),
          label: {
            text: plot.name,
            font: "600 13px Orbitron, sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#e8fbff"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    });
  }, [plots]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flyTarget) return;
    void import("cesium").then((Cesium) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          flyTarget.lon,
          flyTarget.lat,
          flyTarget.height ?? CONTINUUM_HEIGHT.city,
        ),
        duration: 1.6,
      });
    });
  }, [flyTarget]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    // Cadastre WMS is stubbed — national framing fly only.
    if (cadastreMode === "rhodes") {
      void import("cesium").then((Cesium) => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            RHODES.lon,
            RHODES.lat,
            CONTINUUM_HEIGHT.national,
          ),
          duration: 1.2,
        });
      });
    } else if (cadastreMode === "greece") {
      void import("cesium").then((Cesium) => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            23.7,
            38.2,
            CONTINUUM_HEIGHT.national,
          ),
          duration: 1.2,
        });
      });
    }
  }, [cadastreMode]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 h-full w-full bg-[#02040a]"
      aria-label="Astranov globe"
    />
  );
}
