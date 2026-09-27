import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const STORAGE_KEY_FAVORITES = '@music_app_favorites';
const STORAGE_KEY_PLAYLISTS = '@music_app_playlists';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  const [currentSong, setCurrentSong] = useState(null);
  const [soundObject, setSoundObject] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Estados para a barra de progresso
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(1);

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('Gusttavo Lima');
  const [favorites, setFavorites] = useState([]);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    setupAudioMode();
    loadLocalData();
    searchDeezerData('Gusttavo Lima');

    return () => {
      if (soundObject) {
        soundObject.unloadAsync();
      }
    };
  }, []);

  const setupAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.log('Erro ao configurar modo de áudio:', e);
    }
  };

  const loadLocalData = async () => {
    try {
      const savedFavs = await AsyncStorage.getItem(STORAGE_KEY_FAVORITES);
      if (savedFavs !== null) setFavorites(JSON.parse(savedFavs));

      const savedPlaylists = await AsyncStorage.getItem(STORAGE_KEY_PLAYLISTS);
      if (savedPlaylists !== null) setPlaylists(JSON.parse(savedPlaylists));
    } catch (e) {
      console.log('Erro ao carregar dados locais:', e);
    }
  };

  const searchDeezerData = async (query) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const trackResponse = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
      const trackData = await trackResponse.json();

      if (trackData && trackData.data && trackData.data.length > 0) {
        const formattedSongs = trackData.data.map((item) => ({
          id: item.id.toString(),
          title: item.title,
          artist: item.artist.name,
          cover: item.album.cover_medium || item.artist.picture_medium,
          url: item.preview,
          album: item.album.title,
        }));
        setSongs(formattedSongs);
      } else {
        setSongs([
          {
            id: '1',
            title: `Sucesso de ${query}`,
            artist: query,
            cover: 'https://cdn-icons-png.flaticon.com/512/3258/3258497.png',
            url: '',
            album: 'Álbuns Oficiais',
          }
        ]);
      }

      const albumResponse = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(query)}`);
      const albumData = await albumResponse.json();

      if (albumData && albumData.data && albumData.data.length > 0) {
        const formattedAlbums = albumData.data.map((item) => ({
          id: item.id.toString(),
          title: item.title,
          cover: item.cover_medium,
          artist: item.artist.name,
        }));
        setAlbums(formattedAlbums);
      } else {
        setAlbums([
          {
            id: '101',
            title: `Melhores de ${query}`,
            cover: 'https://cdn-icons-png.flaticon.com/512/3258/3258497.png',
            artist: query,
          }
        ]);
      }
    } catch (error) {
      console.log('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const playSong = async (song) => {
    try {
      if (soundObject) {
        await soundObject.unloadAsync();
      }

      if (!song.url) {
        alert('Esta música não tem pré-visualização de áudio disponível.');
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.url },
        { shouldPlay: true }
      );

      setSoundObject(sound);
      setCurrentSong(song);
      setIsPlaying(true);
      setIsPlayerExpanded(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis);
          setPlaybackDuration(status.durationMillis || 1);

          if (status.didJustFinish) {
            if (isRepeat) {
              sound.replayAsync();
            } else {
              playNextSong();
            }
          }
        }
      });
    } catch (error) {
      console.log('Erro ao reproduzir áudio:', error);
    }
  };

  const togglePlayPause = async () => {
    if (!soundObject) {
      if (songs.length > 0) playSong(songs[0]);
      return;
    }

    if (isPlaying) {
      await soundObject.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundObject.playAsync();
      setIsPlaying(true);
    }
  };

  const playNextSong = () => {
    if (!currentSong) return;
    const currentList = activeTab === 'favorites' ? favorites : songs;
    if (currentList.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * currentList.length);
      playSong(currentList[randomIndex]);
    } else {
      const currentIndex = currentList.findIndex((s) => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % currentList.length;
      playSong(currentList[nextIndex]);
    }
  };

  const playPreviousSong = () => {
    if (!currentSong) return;
    const currentList = activeTab === 'favorites' ? favorites : songs;
    if (currentList.length === 0) return;

    const currentIndex = currentList.findIndex((s) => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + currentList.length) % currentList.length;
    playSong(currentList[prevIndex]);
  };

  const toggleFavorite = async (song) => {
    let updatedFavorites;
    const exists = favorites.some((f) => f.id === song.id);

    if (exists) {
      updatedFavorites = favorites.filter((f) => f.id !== song.id);
    } else {
      updatedFavorites = [...favorites, song];
    }

    setFavorites(updatedFavorites);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updatedFavorites));
    } catch (e) {
      console.log('Erro ao salvar favoritos:', e);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      searchDeezerData(searchQuery);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName,
      songs: [],
    };
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    setNewPlaylistName('');
    setIsPlaylistModalVisible(false);

    try {
      await AsyncStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(updatedPlaylists));
    } catch (e) {
      console.log('Erro ao salvar playlist:', e);
    }
  };

  const formatTime = (millis) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const displayList = activeTab === 'favorites' ? favorites : songs;
  const progressPercent = playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.headerContainer}>
        <Text style={styles.appHeaderTitle}>Música App</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="O que quer ouvir? (Artistas, Músicas...)"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'home' && styles.activeTabButton]}
          onPress={() => { setActiveTab('home'); setSelectedPlaylist(null); }}
        >
          <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>Músicas & Álbuns</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'favorites' && styles.activeTabButton]}
          onPress={() => { setActiveTab('favorites'); setSelectedPlaylist(null); }}
        >
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>Favoritas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'playlists' && styles.activeTabButton]}
          onPress={() => setActiveTab('playlists')}
        >
          <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>Playlists</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'playlists' && !selectedPlaylist ? (
        <View style={styles.listContainer}>
          <TouchableOpacity
            style={styles.createPlaylistButton}
            onPress={() => setIsPlaylistModalVisible(true)}
          >
            <Text style={styles.createPlaylistText}>+ Criar Nova Playlist</Text>
          </TouchableOpacity>

          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.playlistItem}
                onPress={() => setSelectedPlaylist(item)}
              >
                <Text style={styles.playlistName}>{item.name}</Text>
                <Text style={styles.playlistCount}>{item.songs.length} músicas</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <View style={styles.listContainer}>
          {selectedPlaylist && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedPlaylist(null)}
            >
              <Text style={styles.backButtonText}>← Voltar para Playlists</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#1DB954" />
              <Text style={styles.loaderText}>A pesquisar na plataforma...</Text>
            </View>
          ) : (
            <FlatList
              data={selectedPlaylist ? selectedPlaylist.songs : displayList}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={
                !selectedPlaylist && activeTab === 'home' && albums.length > 0 ? (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Álbuns Populares</Text>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={albums}
                      keyExtractor={(album) => album.id}
                      renderItem={({ item: album }) => (
                        <TouchableOpacity 
                          style={styles.albumCard}
                          onPress={() => searchDeezerData(album.title)}
                        >
                          <Image source={{ uri: album.cover }} style={styles.albumCover} />
                          <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
                          <Text style={styles.albumArtist} numberOfLines={1}>{album.artist}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Músicas Encontradas</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const isFav = favorites.some((f) => f.id === item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.songItem,
                      currentSong?.id === item.id && styles.activeSongItem,
                    ]}
                    onPress={() => playSong(item)}
                  >
                    <Image source={{ uri: item.cover }} style={styles.songCover} />
                    <View style={styles.songDetails}>
                      <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.songArtist} numberOfLines={1}>{item.artist} {item.album ? `• ${item.album}` : ''}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => toggleFavorite(item)}
                    >
                      <Text style={styles.iconText}>{isFav ? '♥' : '♡'}</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {currentSong && !isPlayerExpanded && (
        <TouchableOpacity
          style={styles.miniPlayer}
          onPress={() => setIsPlayerExpanded(true)}
        >
          <Image source={{ uri: currentSong.cover }} style={styles.miniCover} />
          <View style={styles.miniDetails}>
            <Text style={styles.miniTitle} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.miniArtist} numberOfLines={1}>{currentSong.artist}</Text>
          </View>

          <TouchableOpacity style={styles.miniControlButton} onPress={togglePlayPause}>
            <Text style={styles.miniControlIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <Modal
        visible={isPlayerExpanded}
        animationType="slide"
        onRequestClose={() => setIsPlayerExpanded(false)}
      >
        <SafeAreaView style={styles.expandedPlayerContainer}>
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setIsPlayerExpanded(false)}
          >
            <Text style={styles.closeModalText}>↓ Minimizar</Text>
          </TouchableOpacity>

          <Image source={{ uri: currentSong?.cover }} style={styles.expandedCover} />

          <View style={styles.expandedInfo}>
            <Text style={styles.expandedTitle}>{currentSong?.title}</Text>
            <Text style={styles.expandedArtist}>{currentSong?.artist}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(playbackPosition)}</Text>
              <Text style={styles.timeText}>{formatTime(playbackDuration)}</Text>
            </View>
          </View>

          <View style={styles.expandedControls}>
            <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)}>
              <Text style={[styles.secondaryControl, isShuffle && styles.activeControl]}>🔀</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={playPreviousSong}>
              <Text style={styles.mainControlIcon}>⏮</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playPauseCircle} onPress={togglePlayPause}>
              <Text style={styles.playPauseIcon}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={playNextSong}>
              <Text style={styles.mainControlIcon}>⏭</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRepeat(!isRepeat)}>
              <Text style={[styles.secondaryControl, isRepeat && styles.activeControl]}>🔁</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isPlaylistModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome da Playlist"
              placeholderTextColor="#888"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsPlaylistModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={createPlaylist}>
                <Text style={styles.modalButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerContainer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  appHeaderTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 8, paddingHorizontal: 4 },
  searchContainer: { width: '100%' },
  searchInput: {
    backgroundColor: '#222',
    color: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', marginTop: 8 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#1DB954' },
  tabText: { color: '#888', fontWeight: 'bold' },
  activeTabText: { color: '#1DB954' },
  listContainer: { flex: 1, padding: 12 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#AAA', marginTop: 10, fontSize: 14 },
  sectionContainer: { marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  albumCard: { width: 120, marginRight: 12 },
  albumCover: { width: 120, height: 120, borderRadius: 8 },
  albumTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', marginTop: 6 },
  albumArtist: { color: '#AAA', fontSize: 12, marginTop: 2 },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#1E1E1E',
  },
  activeSongItem: { backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#1DB954' },
  songCover: { width: 50, height: 50, borderRadius: 6 },
  songDetails: { flex: 1, marginLeft: 12 },
  songTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  songArtist: { color: '#AAA', fontSize: 14, marginTop: 2 },
  iconButton: { padding: 8 },
  iconText: { color: '#1DB954', fontSize: 20 },
  miniPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282828',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  miniCover: { width: 40, height: 40, borderRadius: 4 },
  miniDetails: { flex: 1, marginLeft: 10 },
  miniTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  miniArtist: { color: '#AAA', fontSize: 12 },
  miniControlButton: { padding: 10 },
  miniControlIcon: { color: '#FFF', fontSize: 20 },
  expandedPlayerContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  closeModalButton: { alignSelf: 'flex-start', padding: 10 },
  closeModalText: { color: '#1DB954', fontSize: 16, fontWeight: 'bold' },
  expandedCover: { width: 260, height: 260, borderRadius: 16, marginTop: 10 },
  expandedInfo: { alignItems: 'center', width: '100%', marginVertical: 10 },
  expandedTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  expandedArtist: { color: '#AAA', fontSize: 16, marginTop: 6 },
  progressContainer: { width: '100%', marginVertical: 10 },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: { color: '#888', fontSize: 12 },
  expandedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  mainControlIcon: { color: '#FFF', fontSize: 36 },
  secondaryControl: { color: '#888', fontSize: 24 },
  activeControl: { color: '#1DB954' },
  playPauseCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseIcon: { color: '#000', fontSize: 28 },
  createPlaylistButton: {
    backgroundColor: '#1DB954',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  createPlaylistText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  playlistItem: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  playlistName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  playlistCount: { color: '#AAA', fontSize: 14, marginTop: 4 },
  backButton: { paddingVertical: 10, marginBottom: 10 },
  backButtonText: { color: '#1DB954', fontSize: 14, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 14 },
  modalInput: {
    backgroundColor: '#333',
    color: '#FFF',
    borderRadius: 6,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalCancelButton: { padding: 10, marginRight: 10 },
  modalSaveButton: { backgroundColor: '#1DB954', padding: 10, borderRadius: 6 },
  modalButtonText: { color: '#FFF', fontWeight: 'bold' },
});
