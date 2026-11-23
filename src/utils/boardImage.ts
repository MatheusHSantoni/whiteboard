import { IMAGE_TYPES, MAX_IMAGE_BYTES, type Shape } from "../types/shapes";

export async function readBoardImage(file: File): Promise<Extract<Shape, { type: "image" }>> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Escolha uma imagem PNG, JPEG ou WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter até 5 MB.");

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });

  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    throw new Error("Não foi possível abrir a imagem.");
  }

  const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
  return {
    id: crypto.randomUUID(), type: "image", x: 32, y: 32, src,
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  };
}
