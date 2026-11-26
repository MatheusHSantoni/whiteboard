import type { Layer } from "konva/lib/Layer";

const MAX_PNG_DIMENSION = 4096;

export async function downloadBoardPng(layer: Layer, background: string) {
  const copy = layer.clone({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  try {
    const bounds = copy.getClientRect();
    const x = Math.floor(bounds.x);
    const y = Math.floor(bounds.y);
    const width = Math.ceil(bounds.x + bounds.width) - x || layer.getStage()?.width() || 1;
    const height = Math.ceil(bounds.y + bounds.height) - y || layer.getStage()?.height() || 1;
    const pixelRatio = Math.min(1, MAX_PNG_DIMENSION / width, MAX_PNG_DIMENSION / height);
    const drawing = copy.toCanvas({ x, y, width, height, pixelRatio });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, drawing.width);
    canvas.height = Math.max(1, drawing.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (drawing.width && drawing.height) context.drawImage(drawing, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG indisponível.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "board.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } finally {
    copy.destroy();
  }
}
