
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error('FileReader did not return a string.'));
      }
      // The result includes the mime type and encoding, e.g., "data:image/png;base64,iVBORw0KGgo..."
      // We only want the data part after the comma.
      const base64String = reader.result.split(',')[1];
      if (!base64String) {
        return reject(new Error('Could not extract base64 string from file data.'));
      }
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};
