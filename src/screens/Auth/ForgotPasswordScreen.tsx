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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import {
  Text,
  TextInput,
  Button,
  Card,
  Surface,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const { forgotPassword, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);

  useEffect(() => {
    if (error) {
      Alert.alert('Lỗi', error);
      clearError();
    }
  }, [error, clearError]);

  const handleSendResetEmail = async () => {
    if (!email) {
      Alert.alert('Lỗi', 'Vui lòng nhập email của bạn');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Lỗi', 'Vui lòng nhập email hợp lệ');
      return;
    }

    await forgotPassword(email);
    setIsEmailSent(true);
  };

  const handleBackToLogin = () => {
    navigation.goBack();
  };

  if (isEmailSent) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Card style={styles.successCard} elevation={3}>
            <Card.Content style={styles.successContent}>
              <Surface style={styles.successIconContainer} elevation={2}>
                <Text style={styles.successIcon}>✓</Text>
              </Surface>
              <Text variant="headlineSmall" style={styles.successTitle}>
                Yêu cầu đã được gửi!
              </Text>
              <Text variant="bodyMedium" style={styles.successMessage}>
                Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến email{' '}
                <Text style={styles.emailText}>{email}</Text>.
              </Text>
              <Text variant="bodySmall" style={styles.successSubMessage}>
                Vui lòng kiểm tra hộp thư và làm theo hướng dẫn để đặt lại mật khẩu.
              </Text>
              
              <Button
                mode="contained"
                onPress={handleBackToLogin}
                style={styles.backButton}
                contentStyle={styles.buttonContent}
                icon="arrow-left"
              >
                Quay lại đăng nhập
              </Button>
            </Card.Content>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Forgot Password Card */}
            <Card style={styles.card} elevation={3}>
              {/* Card Header */}
              <Card.Content style={styles.cardHeader}>
                <Image
                  source={require('../../../assets/bg/logo_iuh_main.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text variant="headlineSmall" style={styles.title}>
                  QUÊN MẬT KHẨU
                </Text>
                <Divider style={styles.divider} />
              </Card.Content>

              <Card.Content style={styles.form}>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  Nhập email của bạn để nhận hướng dẫn đặt lại mật khẩu
                </Text>
                
                {/* Email Field */}
                <TextInput
                  label="Email *"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  style={styles.input}
                  placeholder="example@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  left={<TextInput.Icon icon="email" />}
                  outlineStyle={styles.inputOutline}
                  contentStyle={styles.inputContent}
                />

                {/* Send Reset Button */}
                <Button
                  mode="contained"
                  onPress={handleSendResetEmail}
                  disabled={isLoading}
                  style={styles.sendButton}
                  contentStyle={styles.buttonContent}
                  icon={isLoading ? () => <ActivityIndicator size="small" color="white" /> : "send"}
                >
                  {isLoading ? 'Đang gửi...' : 'Gửi yêu cầu đặt lại'}
                </Button>

                {/* Back to Login Link */}
                <Button
                  mode="text"
                  onPress={handleBackToLogin}
                  style={styles.backToLoginButton}
                  textColor="#2563eb"
                  icon="arrow-left"
                >
                  Quay lại đăng nhập
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
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 22,
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
  sendButton: {
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 12,
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
    paddingVertical: 2,
  },
  backToLoginButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 4,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 40,
    color: '#16a34a',
  },
  successTitle: {
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 16,
    fontWeight: 'bold',
    fontSize: 18,
  },
  successMessage: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 22,
  },
  successSubMessage: {
    textAlign: 'center',
    color: '#9ca3af',
    marginBottom: 24,
    lineHeight: 20,
  },
  emailText: {
    fontWeight: '600',
    color: '#1E40AF',
  },
  backButton: {
    borderRadius: 12,
    width: '100%',
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
});
