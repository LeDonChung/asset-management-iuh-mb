/* eslint-disable react-native/no-inline-styles */
import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';

const lstPower = [5, 15, 25, 33];

export const IdentificationScreen = () => {
    const [isSavePowerSetting, setIsSavePowerSetting] = useState(false);
    const [isSaveAsset, setIsSaveAsset] = useState(false);

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View
                style={{
                    justifyContent: 'center',
                    paddingHorizontal: 10,
                    flex: 1,
                    backgroundColor: '#fff',
                }}
            >
                <Text
                    style={{
                        fontSize: 20,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        marginVertical: 10,
                    }}
                >
                    Asset Identification
                </Text>

                <View
                    style={{
                        flex: 1,
                        width: '100%',
                        alignSelf: 'center',
                        marginTop: 20,
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        paddingHorizontal: 10,
                        paddingVertical: 20,
                        borderRadius: 10,
                    }}
                >
                    <Text
                        style={{
                            fontWeight: 'bold',
                            fontSize: 16,
                            marginBottom: 15,
                            marginRight: 'auto',
                        }}
                    >
                        Power Setup
                    </Text>

                    <View style={{ width: '100%' }}>
                        <View>
                            <Text style={{ marginBottom: 10 }}>Power(dbm)</Text>
                            <Picker
                                style={{
                                    width: '100%',
                                    backgroundColor: '#fff',
                                    elevation: 1,
                                    shadowOffset: {
                                        width: 0,
                                        height: 1,
                                    },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                }}
                            >
                                {lstPower.map(dbm => (
                                    <Picker.Item key={dbm} label={`${dbm} dBm`} value={dbm} />
                                ))}
                            </Picker>
                        </View>

                        <TouchableOpacity
                            style={{
                                width: '100%',
                                padding: 10,
                                backgroundColor: '#4f46e5',
                                marginTop: 20,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                borderRadius: 10,
                            }}
                            onPress={() => { }}
                        >
                            {isSavePowerSetting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Text style={{ color: '#fff', textAlign: 'center' }}>
                                        Save Power Settings
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <View
                    style={{
                        flex: 1,
                        width: '100%',
                        alignSelf: 'center',
                        marginTop: 20,
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        paddingHorizontal: 10,
                        paddingVertical: 20,
                        borderRadius: 10,
                    }}
                >
                    <Text
                        style={{
                            fontWeight: 'bold',
                            fontSize: 16,
                            marginBottom: 15,
                            marginRight: 'auto',
                        }}
                    >
                        RFID Scanning
                    </Text>

                    <View style={{ width: '100%' }}>
                        <Text style={{ marginBottom: 10 }}>RFID Tag</Text>
                        <View
                            style={{
                                flexDirection: 'row',
                                borderWidth: 1,
                                borderColor: '#ccc',
                                borderRadius: 10,
                                overflow: 'hidden',
                                backgroundColor: '#fff',
                            }}
                        >
                            <TextInput
                                placeholder="RFID tag number"
                                placeholderTextColor="#999"
                                style={{
                                    flex: 1,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                }}
                            />

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#4f46e5',
                                    paddingHorizontal: 16,
                                    justifyContent: 'center',
                                }}
                                onPress={() => {}}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Scan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View
                    style={{
                        flex: 1,
                        width: '100%',
                        alignSelf: 'center',
                        marginTop: 20,
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        paddingHorizontal: 10,
                        paddingVertical: 20,
                        borderRadius: 10,
                    }}
                >
                    <Text
                        style={{
                            fontWeight: 'bold',
                            fontSize: 16,
                            marginBottom: 15,
                            marginRight: 'auto',
                        }}
                    >
                        Asset Identification
                    </Text>

                    <View style={{ width: '100%' }}>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ marginBottom: 10 }}>Asset Name</Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    borderWidth: 1,
                                    borderColor: '#ccc',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    backgroundColor: '#fff',
                                }}
                            >
                                <TextInput
                                    placeholder="RFID tag number"
                                    placeholderTextColor="#999"
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                    }}
                                />
                            </View>
                        </View>

                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ marginBottom: 10 }}>Asset Name</Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    borderWidth: 1,
                                    borderColor: '#ccc',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    backgroundColor: '#fff',
                                }}
                            >
                                <TextInput
                                    placeholder="Enter asset name"
                                    placeholderTextColor="#999"
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                    }}
                                />
                            </View>
                        </View>

                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ marginBottom: 10 }}>RFID Tag</Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    borderWidth: 1,
                                    borderColor: '#ccc',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    backgroundColor: '#fff',
                                }}
                            >
                                <TextInput
                                    placeholder="Scanned RFID tag"
                                    placeholderTextColor="#999"
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                    }}
                                />
                            </View>
                        </View>

                    </View>

                    <TouchableOpacity
                        style={{
                            width: '100%',
                            padding: 10,
                            backgroundColor: '#16a34a',
                            marginTop: 20,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            borderRadius: 10,
                        }}
                        onPress={() => { }}
                    >
                        {isSavePowerSetting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={{ color: '#fff', textAlign: 'center' }}>
                                    Save Asset
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};
