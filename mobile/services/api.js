import axios from 'axios';

const API_URL = 'http://10.0.2.2:5000/api/photos';

export const uploadPhoto = async (photoUri) => {
  try {
    const formData = new FormData();

    const filename = photoUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    formData.append('photo', {
      uri: photoUri,
      name: filename,
      type,
    });

    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        // Note: Do NOT set Content-Type header manually when using fetch with FormData
        // Fetch will automatically set the correct boundary.
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Lỗi API tải ảnh:', error);
    throw error;
  }
};
