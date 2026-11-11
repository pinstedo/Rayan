import { Platform } from 'react-native';

// Current machine Wi-Fi IP for physical mobile devices
const LOCAL_IP = '192.168.1.14';

const getApiUrl = () => {
    // When running in a web browser
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000/api';
        }
        if (hostname) {
            return `http://${hostname}:5000/api`;
        }
    }
    // For physical mobile devices on the same Wi-Fi network:
    return `http://${LOCAL_IP}:5000/api`;
};

export const API_URL = getApiUrl();
