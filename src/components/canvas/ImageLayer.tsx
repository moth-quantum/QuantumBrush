import { useRef, useEffect } from "react";
import { useStore } from "../../store";

export function ImageLayer() {
  const imgRef = useRef<HTMLImageElement>(null);
  const { currentImage, setImageDimensions } = useStore();

  useEffect(() => {
    if (imgRef.current && currentImage) {
      const img = imgRef.current;
      img.onload = () => {
        setImageDimensions(img.naturalWidth, img.naturalHeight);
      };
    }
  }, [currentImage, setImageDimensions]);

  if (!currentImage) return null;

  return (
    <img
      ref={imgRef}
      src={currentImage}
      alt="Canvas"
      className="pointer-events-none select-none"
      style={{ imageRendering: "auto" }}
      draggable={false}
    />
  );
}
