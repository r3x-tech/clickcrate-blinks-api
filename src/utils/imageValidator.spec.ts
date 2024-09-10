import { validateImageUri } from "./imageValidator"; // Adjust the import path as needed

describe("validateImageUri", () => {
  it("should return the correct file type for a supported image URL", () => {
    const imageUri = "https://example.com/path/to/image.jpg";
    expect(validateImageUri(imageUri)).toBe("jpg");
  });

  it("should return the correct file type for a supported video URL", () => {
    const videoUri = "https://example.com/path/to/video.mp4";
    expect(validateImageUri(videoUri)).toBe("mp4");
  });

  it("should throw an error if the URL has no extension", () => {
    const noExtensionUri = "https://example.com/path/to/image";
    expect(() => validateImageUri(noExtensionUri)).toThrow(
      "Wrong file type provided"
    );
  });

  it("should throw an error for an unsupported file type", () => {
    const unsupportedUri = "https://example.com/path/to/image.bmp";
    expect(() => validateImageUri(unsupportedUri)).toThrow(
      "Unsupported image type: bmp. Supported types are: jpg, jpeg, png, gif, svg"
    );
  });

  it("should throw an error if the extension is not in the supportedMediaFiles list", () => {
    const unsupportedUri = "https://example.com/path/to/file.xyz";
    expect(() => validateImageUri(unsupportedUri)).toThrow(
      "Unsupported image type: xyz. Supported types are: jpg, jpeg, png, gif, svg"
    );
  });

  it("should correctly handle uppercase extensions by returning them in lowercase", () => {
    const imageUri = "https://example.com/path/to/IMAGE.JPG";
    expect(validateImageUri(imageUri)).toBe("jpg");
  });

  it("should throw an error if the URL ends with a dot", () => {
    const invalidUri = "https://example.com/path/to/image.";
    expect(() => validateImageUri(invalidUri)).toThrow(
      "Unsupported image type: . Supported types are: jpg, jpeg, png, gif, svg"
    );
  });

  it("should handle URLs with multiple dots correctly by returning the correct file type", () => {
    const imageUri = "https://example.com/path/to/image.final.v2.jpg";
    expect(validateImageUri(imageUri)).toBe("jpg");
  });

  it("should throw an error if the file name contains only a dot", () => {
    const invalidUri = "https://example.com/path/to/.";
    expect(() => validateImageUri(invalidUri)).toThrow(
      "Unsupported image type: . Supported types are: jpg, jpeg, png, gif, svg"
    );
  });
});
