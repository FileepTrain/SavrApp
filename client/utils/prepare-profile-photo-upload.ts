import type { ImagePickerAsset } from "expo-image-picker";
import { copyAsync, cacheDirectory } from "expo-file-system/legacy";
import { Platform } from "react-native";

/**
 * ImagePicker often returns content:// or ph:// URIs (e.g. Google Photos on Android) that fail
 * in FormData or break when allowsEditing runs the crop UI. Copy to a file:// cache path first.
 */
export async function prepareProfilePhotoForUpload(
  asset: ImagePickerAsset,
): Promise<{ uri: string; name: string; type: string }> {
  const uri = asset.uri;
  if (!uri) {
    throw new Error("No image URI returned from picker.");
  }

  const { mimeType, fileName } = asset;

  const extFromName = fileName?.includes(".")
    ? fileName.split(".").pop()?.toLowerCase()
    : undefined;
  const extFromMime =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/heic" || mimeType === "image/heif"
          ? "heic"
          : "jpg";

  const ext =
    extFromName && ["png", "webp", "jpg", "jpeg", "heic", "heif"].includes(extFromName)
      ? extFromName === "jpeg"
        ? "jpg"
        : extFromName
      : extFromMime;

  const type =
    mimeType ||
    (ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "heic" || ext === "heif"
          ? "image/heic"
          : "image/jpeg");

  const safeName =
    fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || `profile_${Date.now()}.${ext}`;

  const needsLocalCopy =
    uri.startsWith("content://") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library://");

  if (
    !needsLocalCopy &&
    (uri.startsWith("file://") || (Platform.OS === "ios" && uri.startsWith("/")))
  ) {
    return { uri, name: safeName, type };
  }

  if (Platform.OS === "web" || !cacheDirectory) {
    return { uri, name: safeName, type };
  }

  const dest = `${cacheDirectory}profile_upload_${Date.now()}.${ext}`;
  try {
    await copyAsync({ from: uri, to: dest });
    const uploadName = /\.[a-z0-9]+$/i.test(safeName) ? safeName : `upload.${ext}`;
    return { uri: dest, name: uploadName, type };
  } catch {
    return { uri, name: safeName, type };
  }
}
