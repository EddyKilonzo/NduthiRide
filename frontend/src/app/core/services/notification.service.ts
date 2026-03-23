import { Injectable, inject, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private messaging?: Messaging;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly token = signal<string | null>(null);
  readonly permission = signal<NotificationPermission>('default');

  constructor() {
    try {
      const app = initializeApp(environment.firebase);
      this.messaging = getMessaging(app);
      this.permission.set(Notification.permission);
    } catch (error) {
      console.error('Firebase initialization failed:', error);
    }
  }

  /**
   * Requests permission for push notifications and registers the FCM token.
   */
  async requestPermission(): Promise<void> {
    if (!this.messaging) return;

    try {
      const permission = await Notification.requestPermission();
      this.permission.set(permission);

      if (permission === 'granted') {
        const currentToken = await getToken(this.messaging, {
          vapidKey: environment.firebase.vapidKey,
        });

        if (currentToken) {
          this.token.set(currentToken);
          await this.saveToken(currentToken);
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }

  /**
   * Listens for incoming messages while the app is in the foreground.
   */
  listenForMessages(): void {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Message received. ', payload);
      // You can trigger a custom toast here or update global state
    });
  }

  private async saveToken(token: string): Promise<void> {
    if (!this.auth.isAuth()) return;

    try {
      await lastValueFrom(
        this.http.patch(`${environment.apiUrl}/users/fcm-token`, { token })
      );
      console.log('FCM token saved to backend');
    } catch (error) {
      console.error('Failed to save FCM token to backend:', error);
    }
  }
}
