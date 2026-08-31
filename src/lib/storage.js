/**
 * Storage Helper for LearnMate
 * Handles file uploads to Supabase Storage with size limits & compression considerations.
 */

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Uploads a file to Supabase Storage bucket.
 * @param {Object} supabaseClient - Authenticated Supabase client
 * @param {string} bucket - 'materials' | 'submissions' | 'class-thumbnails'
 * @param {string} path - Storage path e.g. `${classId}/${filename}`
 * @param {File} file - File object from input
 * @returns {Promise<{ publicUrl?: string, path: string }>}
 */
export const uploadFileToStorage = async (supabaseClient, bucket, path, file) => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Kích thước file vượt quá giới hạn ${MAX_FILE_SIZE_MB}MB.`);
  }

  // Sanitize filename
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const fullPath = `${path}/${timestamp}_${cleanFileName}`;

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(fullPath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  // Get public URL or signed URL depending on bucket
  if (bucket === 'class-thumbnails') {
    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(fullPath);
    return { publicUrl: urlData.publicUrl, path: fullPath };
  }

  return { path: fullPath };
};

/**
 * Gets a signed URL for private bucket downloads (materials, submissions)
 * @param {Object} supabaseClient 
 * @param {string} bucket 
 * @param {string} path 
 * @param {number} expiresIn - Expiry in seconds (default 3600s / 1h)
 */
export const getSignedDownloadUrl = async (supabaseClient, bucket, path, expiresIn = 3600) => {
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
};
