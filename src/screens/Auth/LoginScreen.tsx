import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  Image,
  ToastAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Surface,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { login } from '../../redux/slices/AuthSlice';

export const LoginScreen = () => {
  const navigation = useNavigation();
  const [userLoginForm, setUserLoginForm] = useState({
    username: 'admin',
    password: 'Admin@123',
  });
  const [isLoading, setIsLoading] = useState(false);
  const userLogin = useAppSelector((state) => state.auth.userLogin);
  const dispatch = useAppDispatch();
  const handleLogin = async () => {
    try {
      if (!userLoginForm.username || !userLoginForm.password) {
        ToastAndroid.show('Vui lòng nhập đầy đủ email và mật khẩu', ToastAndroid.SHORT);
        return;
      }
      setIsLoading(true);
      await dispatch(login(userLoginForm));
      setIsLoading(false);
    } catch (error) {
      ToastAndroid.show((error as any).message || 'Vui lòng kiểm tra lại thông tin', ToastAndroid.SHORT);
      setIsLoading(false);
    }
  };
  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword' as never);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Login Card */}
            <Card style={styles.card} elevation={3}>
              {/* Card Header */}
              <Card.Content style={styles.cardHeader}>
                <Image
                  source={{ uri: 'https://i.imgur.com/logo_iuh.png' }}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text variant="headlineSmall" style={styles.title}>
                  ĐĂNG NHẬP HỆ THỐNG
                </Text>
                <Divider style={styles.divider} />
              </Card.Content>

              <Card.Content style={styles.form}>
                {/* Username Field */}
                <TextInput
                  label="Tên đăng nhập"
                  value={userLoginForm.username}
                  onChangeText={(text) => setUserLoginForm({ ...userLoginForm, username: text })}
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  defaultValue="admin"
                  left={<TextInput.Icon icon="account" />}
                  outlineStyle={styles.inputOutline}
                  contentStyle={styles.inputContent}
                />

                {/* Password Field */}
                <TextInput
                  label="Mật khẩu *"
                  value={userLoginForm.password}
                  onChangeText={(text) => setUserLoginForm({ ...userLoginForm, password: text })}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  defaultValue="Admin@123"
                  left={<TextInput.Icon icon="lock" />}
                  outlineStyle={styles.inputOutline}
                  contentStyle={styles.inputContent}
                />

                {/* Login Button */}
                <Button
                  mode="contained"
                  onPress={handleLogin}
                  disabled={isLoading}
                  style={styles.loginButton}
                  contentStyle={styles.buttonContent}
                  icon={isLoading ? () => <ActivityIndicator size="small" color="white" /> : undefined}
                >
                  {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>

                {/* Forgot Password Link */}
                <Button
                  mode="text"
                  onPress={handleForgotPassword}
                  style={styles.forgotPasswordButton}
                  textColor="#2563eb"
                >
                  Quên mật khẩu?
                </Button>
              </Card.Content>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 32,
  },
  logo: {
    height: 80,
    width: 240,
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 16,
    fontWeight: 'bold',
    fontSize: 20,
  },
  divider: {
    marginTop: 8,
    backgroundColor: '#1E40AF',
    height: 2,
    width: '60%',
  },
  form: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
  },
  inputOutline: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  inputContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  loginButton: {
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 12,
    color: 'white',
    backgroundColor: '#1E40AF',
    shadowColor: '#1E40AF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    color: 'white',
    paddingVertical: 2,
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    marginTop: 8,
    color: '#2563eb',
  },
  demoContainer: {
    marginTop: 8,
    marginHorizontal: 32,
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  demoTitle: {
    color: '#1E40AF',
    marginBottom: 12,
    fontWeight: '600',
    fontSize: 14,
  },
  demoAccounts: {
    gap: 6,
  },
  demoAccount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  demoLabel: {
    color: '#1E40AF',
    fontWeight: '500',
    fontSize: 12,
  },
  demoValue: {
    color: '#2563eb',
    fontSize: 12,
  },
});
