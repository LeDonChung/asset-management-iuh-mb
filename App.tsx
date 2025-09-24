import 'react-native-gesture-handler';
import { AppNavigation } from './src/navigations/AppNavigation';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import { AuthProvider } from './src/contexts/AuthContext';

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <AppNavigation />
      </AuthProvider>
    </Provider>
  );
}

export default App;
