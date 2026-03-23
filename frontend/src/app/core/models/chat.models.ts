export type MessageType = 'TEXT' | 'LOCATION' | 'SYSTEM';
export type MessageSenderRole = 'USER' | 'RIDER' | 'SYSTEM';
export type ConversationStatus = 'ACTIVE' | 'CLOSED';

export interface LocationPin {
  lat: number;
  lng: number;
  address: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  type: MessageType;
  locationPin: LocationPin | null;
  senderRole: MessageSenderRole;
  senderName: string;
  senderAvatar: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  rideId: string | null;
  parcelId: string | null;
  status: ConversationStatus;
  messages: ChatMessage[];
  createdAt: string;
  closedAt: string | null;
}

export interface SendMessageDto {
  content: string;
  type?: MessageType;
  locationPin?: LocationPin;
}
