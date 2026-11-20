import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { badRequest, notFound, ok, parseId, requireLogin, requireSection, serverError } from "@/lib/api";
import { PRODUCT_IMAGE_MAX_BYTES } from "@/lib/catalog";
import { deleteProductImage, getProductImage, setProductImage } from "@/lib/catalogDb";

type Params = { params: Promise<{ id: string }> };

// The file's own first bytes, so only real images are stored.
function imageType(b: Buffer): string | null {
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  return null;
}

// GET ?v=… → the photo. Anyone signed in to the shop (the checkout shows it).
// Each version has its own address, so it may be kept for a year.
export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireLogin();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    const image = await getProductImage(id);
    if (!image) return notFound();
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "Content-Type": image.mime,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return serverError("load a product photo", err);
  }
}

// PUT (the image file as the body: WebP, JPEG or PNG) → { imageVersion }.
export async function PUT(request: NextRequest, { params }: Params) {
  const { error } = await requireSection("products");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > PRODUCT_IMAGE_MAX_BYTES) return badRequest();
  let data: Buffer;
  try {
    data = Buffer.from(await request.arrayBuffer());
  } catch {
    return badRequest();
  }
  const mime = imageType(data);
  if (!mime || data.length > PRODUCT_IMAGE_MAX_BYTES) return badRequest();
  try {
    const version = await setProductImage(id, mime, data);
    return version === null ? notFound() : ok({ imageVersion: version });
  } catch (err) {
    return serverError("save a product photo", err);
  }
}

// DELETE → removes the photo.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireSection("products");
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return (await deleteProductImage(id)) ? ok({ imageVersion: 0 }) : notFound();
  } catch (err) {
    return serverError("remove a product photo", err);
  }
}
