import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Resizes and compresses an image URI for fast OCR upload.
 * Keeps aspect ratio with max width 1200px and JPEG quality 0.7.
 */
export async function compressReceiptImage(uri: string): Promise<string> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return manipResult.uri;
  } catch (error) {
    console.warn('Image compression fallback to original:', error);
    return uri;
  }
}