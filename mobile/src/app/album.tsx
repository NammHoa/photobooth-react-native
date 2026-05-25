import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, FlatList, SafeAreaView, Dimensions, ActivityIndicator, useWindowDimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const COLUMN_COUNT = 3;

export default function AlbumScreen() {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const windowWidth = useWindowDimensions().width;
  const ITEM_SIZE = windowWidth / COLUMN_COUNT;
  
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAlbum();
  }, []);

  const loadAlbum = async () => {
    try {
      const albumPath = FileSystem.documentDirectory + 'my-album/';
      const dirInfo = await FileSystem.getInfoAsync(albumPath);
      
      if (!dirInfo.exists) {
        setAssets([]);
        setLoading(false);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(albumPath);
      
      const imageFiles = files
        .filter(file => file.endsWith('.jpg'))
        .map((file, index) => ({
          id: index.toString(),
          uri: albumPath + file
        }));

      setAssets(imageFiles.reverse());
      
    } catch (err) {
      console.error(err);
      setError('Lỗi lấy ảnh: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.imageContainer, { width: ITEM_SIZE, height: ITEM_SIZE }]}>
      <Image source={{ uri: item.uri }} style={styles.image} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photobooth Album</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4AF2C1" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAlbum}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={60} color="#CCC" />
          <Text style={styles.emptyText}>Chưa có bức ảnh nào!</Text>
          <Text style={styles.emptySubText}>Hãy chụp một dải ảnh mới để hiển thị tại đây.</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF0F4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    padding: 1,
  },
  image: {
    flex: 1,
    backgroundColor: '#CCC',
  }
});
