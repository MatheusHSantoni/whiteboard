import "konva/lib/shapes/Image.js";
import "konva/lib/shapes/Transformer.js";
import { useEffect, useRef, useState } from "react";
import type { Image as KonvaImage } from "konva/lib/shapes/Image";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import { Image as CanvasImage, Transformer } from "react-konva/lib/ReactKonvaCore.js";
import { MAX_IMAGE_DIMENSION, type Shape } from "../../types/shapes";

type BoardImageProps = {
  shape: Extract<Shape, { type: "image" }>;
  selected?: boolean;
  onResize?: (id: string, width: number, height: number) => void;
};

export default function BoardImage({ shape, selected, onResize }: BoardImageProps) {
  const [image, setImage] = useState<HTMLImageElement>();
  const imageNode = useRef<KonvaImage>(null);
  const transformer = useRef<KonvaTransformer>(null);

  useEffect(() => {
    const bitmap = new Image();
    bitmap.onload = () => setImage(bitmap);
    bitmap.src = shape.src;
    return () => { bitmap.onload = null; };
  }, [shape.src]);

  useEffect(() => {
    if (selected && imageNode.current) transformer.current?.nodes([imageNode.current]);
  }, [selected, image]);

  return (
    <>
      <CanvasImage
        ref={imageNode}
        image={image}
        width={shape.width}
        height={shape.height}
        onTransformEnd={() => {
          const node = imageNode.current;
          if (!node) return;
          const width = Math.round(node.width() * node.scaleX());
          const height = Math.round(node.height() * node.scaleY());
          node.position({ x: 0, y: 0 });
          node.scale({ x: 1, y: 1 });
          if (width > 0 && height > 0 && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
            onResize?.(shape.id, width, height);
          }
          transformer.current?.forceUpdate();
        }}
      />
      {selected && (
        <Transformer
          ref={transformer}
          enabledAnchors={["bottom-right"]}
          rotateEnabled={false}
          flipEnabled={false}
          keepRatio
          onPointerDown={(event) => { event.cancelBubble = true; }}
        />
      )}
    </>
  );
}
