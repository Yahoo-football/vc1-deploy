const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to compress image'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const getScaledSize = (width, height, maxWidth, maxHeight) => {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
};

export const compressImageForUpload = async (file, options = {}) => {
  if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) {
    return file;
  }

  const {
    maxWidth = 1280,
    maxHeight = 1280,
    targetMaxBytes = 700 * 1024,
    minCompressBytes = 200 * 1024,
    outputType = 'image/webp',
    initialQuality = 0.82,
    minQuality = 0.6,
    maxAttempts = 5
  } = options;

  if (file.size <= minCompressBytes) {
    return file;
  }

  try {
    const src = await fileToDataUrl(file);
    const image = await loadImageElement(src);
    const scaled = getScaledSize(image.width, image.height, maxWidth, maxHeight);

    const canvas = document.createElement('canvas');
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.drawImage(image, 0, 0, scaled.width, scaled.height);

    let quality = clamp(initialQuality, minQuality, 0.95);
    let blob = await canvasToBlob(canvas, outputType, quality);
    let attempt = 1;

    while (blob.size > targetMaxBytes && attempt < maxAttempts && quality > minQuality) {
      quality = clamp(quality - 0.08, minQuality, 0.95);
      blob = await canvasToBlob(canvas, outputType, quality);
      attempt += 1;
    }

    if (blob.size >= file.size) {
      return file;
    }

    const baseName = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '');
    const compressedName = `${baseName}.webp`;

    return new File([blob], compressedName, {
      type: outputType,
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
};

export const compressImagesForUpload = async (files, options = {}) => {
  const list = Array.from(files || []).filter(
    (file) => file instanceof File && String(file.type || '').startsWith('image/')
  );
  const maxCount = Number.isInteger(options.maxCount) ? options.maxCount : list.length;
  const limited = maxCount > 0 ? list.slice(0, maxCount) : list;

  return Promise.all(limited.map((file) => compressImageForUpload(file, options)));
};
