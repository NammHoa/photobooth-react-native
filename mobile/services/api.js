import axios from 'axios';

const API_URL = 'http://10.0.2.2:5000/api/photos';

export const uploadPhoto = async (photoUri) => {
  try {
    const formData = new FormData();

    const filename = photoUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    formData.append('photo', {
      uri: photoUri,
      name: filename,
      type,
    });

    const response = await axios.post(`${API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Lỗi API tải ảnh:', error);
    throw error;
  }
};
