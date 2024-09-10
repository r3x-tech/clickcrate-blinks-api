export const supportedMediaFiles = [
  // "jpg",
  // "jpeg",
  "png",
  // "gif",
  "svg",
  // "mp4",
  // "mov",
  // "webm",
  // "mp3",
  // "wav",
  // "glb",
  // "gltf",
];

export const validateImageUri = (imageUri: string) => {
  const segments = imageUri.split("/");
  const lastSegment = segments[segments.length - 1];
  const fileParts = lastSegment.split(".");

  if (fileParts.length === 1) {
    throw new Error(`Wrong file type provided`);
  } else {
    const extension = fileParts[fileParts.length - 1].toLocaleLowerCase();
    if (!extension || !supportedMediaFiles.includes(extension)) {
      throw new Error(
        `Unsupported image type: ${
          extension ?? "undefined"
        }. Supported types are: ${supportedMediaFiles
          // .filter((ext) => ["jpg", "jpeg", "png", "gif", "svg"].includes(ext))
          .filter((ext) => ["png", "svg"].includes(ext))
          .join(", ")}`
      );
    }
    return extension;
  }
};

export function getMimeType(extension: string): string {
  switch (extension.toLowerCase()) {
    case "png":
      return "image/png";
    case "svg":
      return "image/svg";
    // Add more cases if you decide to support more file types in the future
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}
