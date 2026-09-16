export interface UploadAdapter {
  uploadFile: (
    file: File,
    onProgress?: (progress: number) => void
  ) => Promise<{ url: string; publicId?: string }>;
  deleteFile: (id: string) => Promise<void>;
}

// S3-compatible mock adaptor
export class S3UploadAdapter implements UploadAdapter {
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        if (onProgress) onProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve({
            url: `https://s3.amazonaws.com/my-bucket/uploads/${Date.now()}-${file.name}`,
            publicId: `uploads/${Date.now()}-${file.name}`,
          });
        }
      }, 150);
    });
  }

  async deleteFile(id: string): Promise<void> {
    console.log(`[S3Adapter] Deleted file: ${id}`);
  }
}

// Cloudinary mock adaptor
export class CloudinaryUploadAdapter implements UploadAdapter {
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 25;
        if (onProgress) onProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve({
            url: `https://res.cloudinary.com/demo/image/upload/v12345/${Date.now()}-${file.name}`,
            publicId: `${Date.now()}-${file.name}`,
          });
        }
      }, 100);
    });
  }

  async deleteFile(id: string): Promise<void> {
    console.log(`[CloudinaryAdapter] Deleted file: ${id}`);
  }
}
