import { Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { COMMANDS } from './Command';
import { SERVICE_UUID, CHARACTERISTIC_UUID } from './BLE';

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface CommandPayload {
  command: string;
  value?: any;
}

export class DeviceCommandManager {
  private static instance: DeviceCommandManager;
  private regexTag = /^E2[0-9A-F]{22}$/;
  private lastProcessTime = 0; // Throttling state
  private packetQueue: any[] = []; // Queue để lưu JSON packets
  private isProcessingQueue = false; // Flag để tránh concurrent processing

  private constructor() {}

  public static getInstance(): DeviceCommandManager {
    if (!DeviceCommandManager.instance) {
      DeviceCommandManager.instance = new DeviceCommandManager();
    }
    return DeviceCommandManager.instance;
  }

  /**
   * Send a command to the device
   */
  public async sendCommand(
    device: Device,
    command: string,
    value?: any
  ): Promise<CommandResult> {
    try {
      const jsonPayload: CommandPayload = { command, value };
      const jsonString = JSON.stringify(jsonPayload);
      const base64Data = Buffer.from(jsonString, 'utf-8').toString('base64');

      const services = await device.services();
      const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID);
      
      if (!service) {
        return {
          success: false,
          error: 'Service UUID not found',
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      const characteristics = await service.characteristics();
      const characteristic = characteristics.find(
        c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID,
      );
      
      if (!characteristic) {
        return {
          success: false,
          error: 'Characteristic UUID not found',
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      await characteristic.writeWithResponse(base64Data);
      
      return {
        success: true,
        data: jsonPayload,
        timestamp: new Date().toLocaleTimeString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleTimeString(),
      };
    }
  }

  /**
   * Setup monitoring for device responses with throttling
   */
  public async setupMonitoring(
    device: Device,
    onResponse: (response: any) => void,
    onError?: (error: any) => void
  ): Promise<boolean> {
    try {
      const services = await device.services();
      const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID);
      
      if (!service) {
        onError?.('Service UUID not found');
        return false;
      }

      const characteristics = await service.characteristics();
      const characteristic = characteristics.find(
        c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID,
      );
      
      if (!characteristic) {
        onError?.('Characteristic UUID not found');
        return false;
      }

      const THROTTLE_INTERVAL = 50; // Throttle 50ms

      characteristic.monitor((error, characteristic) => {
        if (error) {
          console.error('❌ Lỗi khi nhận phản hồi:', error?.message || 'Unknown error');
          onError?.(error);
          return;
        }

        if (characteristic?.value) {
          const currentTime = Date.now();
          
          // NHẬN JSON HOÀN CHỈNH - không cần chunk
          const jsonString = Buffer.from(characteristic.value, 'base64').toString();
          console.log('📦 Nhận JSON:', jsonString);
          
          // Thêm vào queue để xử lý với throttling
          this.packetQueue.push({
            jsonString,
            timestamp: currentTime
          });
          
          console.log('📋 Queue size:', this.packetQueue.length);
          
          // Xử lý queue với throttling
          this.processQueueWithThrottling(onResponse, THROTTLE_INTERVAL);
        }
      });

      return true;
    } catch (error: any) {
      onError?.(error);
      return false;
    }
  }

  /**
   * Get device information commands
   */
  public async getDeviceInformation(device: Device): Promise<CommandResult[]> {
    const commands = [
      COMMANDS.getReaderIdentifier,
      COMMANDS.cmdGetFirmwareVersion,
      COMMANDS.cmdGetOutputPower,
      COMMANDS.cmdGetReaderTemperature,
      COMMANDS.cmdGetRfLinkProfile,
    ];

    const results = await Promise.all(
      commands.map(command => this.sendCommand(device, command))
    );

    return results;
  }

  /**
   * Set device power
   */
  public async setPower(device: Device, power: number): Promise<CommandResult> {
    return this.sendCommand(device, COMMANDS.cmdSetOutputPower, power);
  }

  /**
   * Set device mode
   */
  public async setMode(device: Device, modeCode: string): Promise<CommandResult> {
    return this.sendCommand(device, COMMANDS.cmdSetRfLinkProfile, modeCode);
  }

  /**
   * Start inventory với reset throttling state
   */
  public async startInventory(device: Device): Promise<CommandResult> {
    // Reset throttling state cho session mới
    this.resetThrottlingState();
    return this.sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStart);
  }

  /**
   * Stop inventory với double stop command
   */
  public async stopInventory(device: Device): Promise<CommandResult> {
    return this.forceStopInventory(device, 2);
  }

  /**
   * Force stop inventory với số lần gửi command tùy chỉnh
   */
  public async forceStopInventory(device: Device, attempts: number = 2): Promise<CommandResult> {
    console.log(`🛑 Force stopping inventory with ${attempts} attempts...`);
    
    let lastResult: CommandResult = { success: false, timestamp: Date.now().toString() };
    
    for (let i = 0; i < attempts; i++) {
      try {
        console.log(`🛑 Sending stop command ${i + 1}/${attempts}...`);
        lastResult = await this.sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStop);
        
        // Đợi giữa các lần gửi (trừ lần cuối)
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn(`⚠️ Stop command ${i + 1} failed:`, error);
      }
    }
    
    // Reset throttling state sau khi stop
    setTimeout(() => {
      this.resetThrottlingState();
    }, 1000); // Delay để cho phép final responses
    
    console.log(`✅ Force stop completed with ${attempts} attempts`);
    return lastResult;
  }

  /**
   * Emergency stop - gửi nhiều lần command để đảm bảo dừng
   */
  public async emergencyStop(device: Device): Promise<CommandResult> {
    console.log('🚨 Emergency stop - sending multiple stop commands...');
    return this.forceStopInventory(device, 3); // Gửi 3 lần
  }

  /**
   * Start alert
   */
  public async startAlert(device: Device): Promise<CommandResult> {
    return this.sendCommand(device, COMMANDS.cmdSendAlertStart);
  }

  /**
   * Stop alert
   */
  public async stopAlert(device: Device): Promise<CommandResult> {
    return this.sendCommand(device, COMMANDS.cmdSendAlertStop);
  }

  /**
   * Set alert settings
   */
  public async setAlertSettings(device: Device, settings: any): Promise<CommandResult> {
    return this.sendCommand(device, COMMANDS.cmdSendSettingAlert, settings);
  }

  /**
   * Process inventory tags
   */
  public processInventoryTags(tags: string[], existingTags: string[]): string[] {
    if (!tags || tags.length === 0) return [];

    const validTags: string[] = tags
      .map((tag: string) => {
        if (!this.regexTag.test(tag) || existingTags.includes(tag)) {
          return null;
        }
        return tag;
      })
      .filter((tag: string | null): tag is string => tag !== null);

    return validTags;
  }


  /**
   * Clear packet queue
   */
  public clearPacketQueue(): void {
    this.packetQueue = [];
    console.log('🧹 Packet queue cleared');
  }

  /**
   * Debug queue state
   */
  public debugQueueState(): void {
    console.log('🔍 Queue Debug:', {
      queueSize: this.packetQueue.length,
      packets: this.packetQueue.map(p => ({
        jsonPreview: p.jsonString.substring(0, 50) + '...',
        timestamp: p.timestamp
      }))
    });
  }

  /**
   * Reset throttling state - quan trọng cho session mới
   */
  public resetThrottlingState(): void {
    this.lastProcessTime = 0;
    this.packetQueue = [];
    this.isProcessingQueue = false;
    console.log('🔄 Throttling state reset for new session');
  }

  /**
   * Xử lý queue với throttling - nhận hết nhưng xử lý ngầm
   */
  private processQueueWithThrottling(onResponse: (response: any) => void, throttleInterval: number): void {
    const currentTime = Date.now();
    
    // Throttle processing
    if (currentTime - this.lastProcessTime < throttleInterval) {
      return;
    }
    
    // Tránh concurrent processing
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    this.lastProcessTime = currentTime;
    
    // Process queue trong background
    setTimeout(() => {
      this.processQueue(onResponse);
      this.isProcessingQueue = false;
    }, 0);
  }

  /**
   * Xử lý queue packets - đơn giản vì JSON đã hoàn chỉnh
   */
  private processQueue(onResponse: (response: any) => void): void {
    if (this.packetQueue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing queue: ${this.packetQueue.length} JSON packets`);
    
    // Xử lý từng JSON packet trong queue
    for (const packet of this.packetQueue) {
      try {
        console.log('🔍 Processing JSON:', packet.jsonString);
        
        // Parse JSON trực tiếp vì đã hoàn chỉnh
        const json = JSON.parse(packet.jsonString);
        console.log('✅ Processed JSON:', json);
        onResponse(json);
        
        // Chỉ xử lý packet đầu tiên để tránh duplicate
        break;
      } catch (err) {
        console.warn('⚠️ JSON parsing error:', err);
        console.log('🔍 Problematic JSON:', packet.jsonString);
      }
    }
    
    // Clear queue sau khi xử lý
    this.packetQueue = [];
  }

}

// Export singleton instance
export const deviceCommandManager = DeviceCommandManager.getInstance();
