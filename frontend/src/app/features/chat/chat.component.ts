import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import type { ChatMessage, Conversation, ConversationPreview, MessageSenderRole } from '../../core/models/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="chat-page">
      <div class="chat-layout">

        <!-- ── Sidebar ── -->
        <aside class="chat-sidebar" [class.sidebar--hidden]="!!conversationId">
          <div class="sidebar-header">
            <h2>Messages</h2>
            @if (conversations().length > 0) {
              <span class="conv-count">{{ conversations().length }}</span>
            }
          </div>

          <div class="conversations-list">
            @if (loadingList()) {
              <div class="state-center"><app-spinner [size]="28" /></div>
            } @else if (conversations().length === 0) {
              <div class="state-center state-empty">
                <lucide-icon name="message-square" [size]="40"></lucide-icon>
                <p>No conversations yet</p>
              </div>
            } @else {
              @for (conv of conversations(); track conv.id) {
                <div class="conv-item" [class.conv-item--active]="isActiveConv(conv)"
                     (click)="openConversation(conv)" role="button" tabindex="0"
                     (keydown.enter)="openConversation(conv)">
                  <div class="conv-avatar-wrap">
                    @if (conv.otherPartyAvatar) {
                      <img class="conv-avatar" [src]="conv.otherPartyAvatar" [alt]="conv.otherPartyName" />
                    } @else {
                      <div class="conv-avatar conv-avatar--placeholder">{{ conv.otherPartyName.charAt(0).toUpperCase() }}</div>
                    }
                    @if (conv.unreadCount > 0) {
                      <span class="badge">{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</span>
                    }
                    <span class="status-dot" [class.status-dot--active]="conv.status === 'ACTIVE'"></span>
                  </div>

                  <div class="conv-body">
                    <div class="conv-top">
                      <span class="conv-name">{{ conv.otherPartyName }}</span>
                      <span class="conv-time">{{ conv.updatedAt | date:'shortTime' }}</span>
                    </div>
                    <span class="conv-tag">{{ conv.context }}</span>
                    <p class="conv-preview">{{ conv.lastMessage?.content || 'No messages yet' }}</p>
                  </div>

                  <button class="conv-delete-btn" type="button"
                          (click)="confirmDeleteConversation($event, conv)"
                          title="Delete conversation"
                          aria-label="Delete conversation">
                    <lucide-icon name="trash-2" [size]="14"></lucide-icon>
                  </button>
                </div>
              }
            }
          </div>
        </aside>

        <!-- ── Main Chat Area ── -->
        <main class="chat-main" [class.chat-main--visible]="!!conversationId || loading()">

          @if (!conversationId && !loading()) {
            <!-- Empty state -->
            <div class="empty-state">
              <div class="empty-icon">
                <lucide-icon name="message-circle" [size]="56"></lucide-icon>
              </div>
              <h3>Your messages</h3>
              <p>Select a conversation from the list to start chatting</p>
            </div>

          } @else {
            <!-- Chat Header -->
            <header class="chat-header">
              <button class="icon-btn back-btn" type="button" (click)="goBack()" aria-label="Back">
                <lucide-icon name="arrow-left" [size]="20"></lucide-icon>
              </button>

              <div class="header-avatar-wrap">
                @if (activeConvAvatar()) {
                  <img class="header-avatar" [src]="activeConvAvatar()!" [alt]="title()" />
                } @else {
                  <div class="header-avatar header-avatar--placeholder">{{ title().charAt(0) }}</div>
                }
                <span class="header-status-dot" [class.header-status-dot--active]="!isClosed()"></span>
              </div>

              <div class="header-info">
                <span class="header-name">{{ title() }}</span>
                <span class="header-sub">
                  @if (isClosed()) {
                    Conversation ended
                  } @else if (isTyping()) {
                    <em>typing…</em>
                  } @else {
                    Active now
                  }
                </span>
              </div>

              <div class="header-right">
                @if (loading()) {
                  <app-spinner [size]="18" />
                }
              </div>
            </header>

            <!-- Messages -->
            <div class="messages-area" #scrollMe>
              @if (loading() && messages().length === 0) {
                <div class="state-center"><app-spinner /></div>
              } @else if (messages().length === 0) {
                <div class="state-center state-empty">
                  <lucide-icon name="message-square" [size]="44"></lucide-icon>
                  <p>No messages yet. Say hello!</p>
                </div>
              } @else {
                @for (msg of messages(); track msg.id) {
                  <div class="msg-row"
                       [class.msg-row--own]="isOwnMessage(msg)"
                       [class.msg-row--system]="msg.type === 'SYSTEM'">

                    @if (msg.type !== 'SYSTEM' && !isOwnMessage(msg)) {
                      <div class="msg-avatar-wrap">
                        @if (msg.senderAvatar) {
                          <img class="msg-avatar" [src]="msg.senderAvatar" [alt]="msg.senderName" />
                        } @else {
                          <div class="msg-avatar msg-avatar--placeholder">{{ msg.senderName.charAt(0) }}</div>
                        }
                      </div>
                    }

                    <div class="msg-bubble-wrap">
                      @if (msg.type !== 'SYSTEM' && !isOwnMessage(msg)) {
                        <span class="msg-sender">{{ msg.senderName }}</span>
                      }
                      <div class="msg-bubble" [class.msg-bubble--system]="msg.type === 'SYSTEM'"
                           [class.msg-bubble--deleted]="msg.content === 'This message was deleted'">
                        <p class="msg-text">{{ msg.content }}</p>
                        @if (msg.type !== 'SYSTEM') {
                          <div class="msg-meta">
                            <span class="msg-time">{{ msg.createdAt | date:'shortTime' }}</span>
                            @if (isOwnMessage(msg)) {
                              <span class="msg-status"
                                    [class.msg-status--pending]="isPending(msg)"
                                    [class.msg-status--read]="!isPending(msg) && msg.isRead">
                                @if (isPending(msg)) {
                                  <lucide-icon name="clock" [size]="10"></lucide-icon>
                                } @else if (msg.isRead) {
                                  <lucide-icon name="check-check" [size]="12"></lucide-icon>
                                } @else {
                                  <lucide-icon name="check" [size]="12"></lucide-icon>
                                }
                              </span>
                            }
                            @if (isOwnMessage(msg) && !isPending(msg) && canDeleteMessage(msg)) {
                              <button class="msg-delete-btn" type="button"
                                      (click)="deleteMessage(msg)"
                                      title="Delete message">
                                <lucide-icon name="trash-2" [size]="10"></lucide-icon>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </div>

                    @if (msg.type !== 'SYSTEM' && isOwnMessage(msg)) {
                      <div class="msg-avatar-wrap">
                        @if (currentUserAvatar()) {
                          <img class="msg-avatar" [src]="currentUserAvatar()!" [alt]="currentUserName()" />
                        } @else {
                          <div class="msg-avatar msg-avatar--placeholder own">{{ currentUserName().charAt(0) }}</div>
                        }
                      </div>
                    }
                  </div>
                }
              }
            </div>

            <!-- Input -->
            <div class="input-area" [class.input-area--closed]="isClosed()">
              @if (isClosed()) {
                <div class="closed-notice">
                  <lucide-icon name="lock" [size]="14"></lucide-icon>
                  <span>This conversation has ended</span>
                </div>
              } @else {
                <form [formGroup]="chatForm" (ngSubmit)="sendMessage()" class="chat-form">
                  <input
                    #messageInput
                    class="chat-input"
                    type="text"
                    placeholder="Type a message…"
                    formControlName="content"
                    (input)="onTyping()"
                    autocomplete="off"
                  />
                  <button type="submit" class="send-btn"
                          [disabled]="chatForm.invalid || sending()"
                          aria-label="Send message">
                    @if (sending()) {
                      <app-spinner [size]="16" color="#fff" />
                    } @else {
                      <lucide-icon name="send" [size]="18"></lucide-icon>
                    }
                  </button>
                </form>
              }
            </div>
          }
        </main>
      </div>

      <!-- Delete Conversation Confirm Modal -->
      @if (deleteTarget()) {
        <div class="modal-backdrop" (click)="cancelDelete()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-icon">
              <lucide-icon name="trash-2" [size]="24"></lucide-icon>
            </div>
            <h3>Delete conversation?</h3>
            <p>This will permanently remove this chat from your list. The other party may still see it.</p>
            <div class="modal-actions">
              <button class="btn btn--ghost" type="button" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn--danger" type="button" (click)="executeDelete()" [disabled]="deleting()">
                @if (deleting()) { Deleting… } @else { Delete }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Layout ── */
    .chat-page {
      height: calc(100vh - 120px);
      padding: 0 0 20px;
      display: flex;
      flex-direction: column;
    }

    .chat-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      height: 100%;
      background: var(--clr-bg-card);
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--clr-border);
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    /* ── Sidebar ── */
    .chat-sidebar {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--clr-border);
      background: var(--clr-bg-elevated);
      overflow: hidden;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--clr-border);
      flex-shrink: 0;
    }
    .sidebar-header h2 {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      flex: 1;
    }
    .conv-count {
      background: var(--clr-primary);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      border-radius: 99px;
      padding: 2px 8px;
      min-width: 22px;
      text-align: center;
    }

    .conversations-list {
      flex: 1;
      overflow-y: auto;
    }

    /* ── Conversation Item ── */
    .conv-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--clr-border);
      cursor: pointer;
      transition: background 0.15s;
      position: relative;
    }
    .conv-item:hover { background: rgba(var(--clr-primary-rgb), 0.04); }
    .conv-item:hover .conv-delete-btn { opacity: 1; }
    .conv-item--active {
      background: rgba(var(--clr-primary-rgb), 0.08);
      border-left: 3px solid var(--clr-primary);
    }

    .conv-avatar-wrap {
      position: relative;
      flex-shrink: 0;
      width: 46px;
      height: 46px;
    }
    .conv-avatar {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      object-fit: cover;
    }
    .conv-avatar--placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--clr-primary-rgb), 0.12);
      color: var(--clr-primary);
      font-weight: 700;
      font-size: 17px;
    }
    .badge {
      position: absolute;
      top: -3px;
      right: -3px;
      min-width: 17px;
      height: 17px;
      border-radius: 99px;
      background: #dc2626;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid var(--clr-bg-elevated);
    }
    .status-dot {
      position: absolute;
      bottom: 1px;
      right: 1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--clr-text-dim);
      border: 2px solid var(--clr-bg-elevated);
    }
    .status-dot--active { background: #22c55e; }

    .conv-body {
      flex: 1;
      min-width: 0;
    }
    .conv-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2px;
    }
    .conv-name {
      font-size: 14px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .conv-time {
      font-size: 10px;
      color: var(--clr-text-dim);
      flex-shrink: 0;
      margin-left: 6px;
    }
    .conv-tag {
      display: block;
      font-size: 10px;
      font-weight: 600;
      color: var(--clr-primary);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .conv-preview {
      font-size: 12px;
      color: var(--clr-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
    }

    .conv-delete-btn {
      opacity: 0;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--clr-text-dim);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .conv-delete-btn:hover {
      background: rgba(220,38,38,0.1);
      border-color: rgba(220,38,38,0.2);
      color: #dc2626;
    }

    /* ── Main ── */
    .chat-main {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* ── Empty State ── */
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--clr-text-dim);
      padding: 40px;
      text-align: center;
    }
    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(var(--clr-primary-rgb), 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--clr-primary);
      opacity: 0.6;
    }
    .empty-state h3 { font-size: 18px; font-weight: 700; margin: 0; color: var(--clr-text); }
    .empty-state p { font-size: 14px; margin: 0; max-width: 260px; }

    /* ── Chat Header ── */
    .chat-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--clr-border);
      background: var(--clr-bg-elevated);
      flex-shrink: 0;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      color: var(--clr-text);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .icon-btn:hover { border-color: var(--clr-primary); color: var(--clr-primary); }

    .back-btn { display: none; }

    .header-avatar-wrap {
      position: relative;
      flex-shrink: 0;
    }
    .header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }
    .header-avatar--placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--clr-primary-rgb), 0.12);
      color: var(--clr-primary);
      font-weight: 700;
      font-size: 16px;
    }
    .header-status-dot {
      position: absolute;
      bottom: 1px;
      right: 1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--clr-text-dim);
      border: 2px solid var(--clr-bg-elevated);
    }
    .header-status-dot--active { background: #22c55e; }

    .header-info {
      flex: 1;
      min-width: 0;
    }
    .header-name {
      display: block;
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-sub {
      font-size: 12px;
      color: var(--clr-text-muted);
    }
    .header-sub em { color: #22c55e; font-style: normal; font-weight: 500; }

    .header-right {
      display: flex;
      align-items: center;
    }

    /* ── Messages ── */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--clr-bg-card);
    }

    .state-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    .state-empty {
      gap: 12px;
      color: var(--clr-text-dim);
      opacity: 0.6;
      text-align: center;
    }
    .state-empty p { font-size: 13px; margin: 0; }

    /* ── Message Row ── */
    .msg-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 100%;
    }
    .msg-row--own { flex-direction: row-reverse; }
    .msg-row--system { justify-content: center; }

    .msg-avatar-wrap { flex-shrink: 0; }
    .msg-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--clr-border);
    }
    .msg-avatar--placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--clr-primary-rgb), 0.12);
      color: var(--clr-primary);
      font-size: 12px;
      font-weight: 700;
    }
    .msg-avatar--placeholder.own {
      background: rgba(var(--clr-primary-rgb), 0.2);
    }

    .msg-bubble-wrap {
      display: flex;
      flex-direction: column;
      max-width: 68%;
    }
    .msg-row--own .msg-bubble-wrap { align-items: flex-end; }

    .msg-sender {
      font-size: 10px;
      font-weight: 700;
      color: var(--clr-primary);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
      padding-left: 4px;
    }

    .msg-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      background: var(--clr-bg-elevated);
      border: 1px solid var(--clr-border);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .msg-row:not(.msg-row--own):not(.msg-row--system) .msg-bubble {
      border-bottom-left-radius: 4px;
    }
    .msg-row--own .msg-bubble {
      background: var(--clr-primary);
      border-color: var(--clr-primary);
      border-bottom-right-radius: 4px;
    }
    .msg-bubble--system {
      background: rgba(var(--clr-primary-rgb), 0.06) !important;
      border: 1px solid rgba(var(--clr-primary-rgb), 0.12) !important;
      border-radius: 99px !important;
      padding: 5px 16px !important;
      text-align: center;
    }
    .msg-bubble--deleted {
      opacity: 0.55;
    }

    .msg-text {
      font-size: 14px;
      line-height: 1.45;
      word-break: break-word;
      margin: 0;
      color: var(--clr-text);
    }
    .msg-row--own .msg-text { color: #fff; }
    .msg-bubble--system .msg-text { font-style: italic; color: var(--clr-text-dim); font-size: 12px; }

    .msg-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 4px;
    }
    .msg-time {
      font-size: 9px;
      color: var(--clr-text-dim);
    }
    .msg-row--own .msg-time { color: rgba(255,255,255,0.65); }

    .msg-status { display: flex; align-items: center; color: rgba(255,255,255,0.6); }
    .msg-status--read { color: #86efac; }
    .msg-status--pending { color: rgba(255,255,255,0.4); }

    .msg-delete-btn {
      opacity: 0;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0;
      transition: opacity 0.15s, color 0.15s;
    }
    .msg-bubble:hover .msg-delete-btn { opacity: 1; }
    .msg-delete-btn:hover { color: #fca5a5; }

    /* ── Input ── */
    .input-area {
      padding: 16px 20px;
      border-top: 1px solid var(--clr-border);
      background: var(--clr-bg-elevated);
      flex-shrink: 0;
    }
    .input-area--closed {
      background: var(--clr-bg-card);
    }

    .closed-notice {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      color: var(--clr-text-dim);
      padding: 8px;
    }

    .chat-form {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .chat-input {
      flex: 1;
      padding: 11px 18px;
      border-radius: 99px;
      background: var(--clr-bg-card);
      border: 1.5px solid var(--clr-border);
      font-size: 14px;
      color: var(--clr-text);
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    .chat-input:focus {
      border-color: var(--clr-primary);
      box-shadow: 0 0 0 3px rgba(var(--clr-primary-rgb), 0.1);
    }
    .chat-input::placeholder { color: var(--clr-text-dim); }

    .send-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--clr-primary);
      color: #fff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: opacity 0.2s, transform 0.15s;
    }
    .send-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(1.05); }
    .send-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    /* ── Delete Confirm Modal ── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    .modal {
      background: var(--clr-bg-card);
      border-radius: var(--radius-lg);
      padding: 28px 32px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(220,38,38,0.1);
      color: #dc2626;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .modal h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .modal p { font-size: 14px; color: var(--clr-text-muted); margin: 0 0 24px; }
    .modal-actions { display: flex; gap: 10px; justify-content: center; }

    .btn {
      padding: 10px 22px;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .btn--ghost {
      background: var(--clr-bg-elevated);
      border: 1px solid var(--clr-border);
      color: var(--clr-text);
    }
    .btn--ghost:hover { border-color: var(--clr-primary); }
    .btn--danger {
      background: #dc2626;
      color: #fff;
    }
    .btn--danger:hover:not(:disabled) { background: #b91c1c; }
    .btn--danger:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .chat-layout { grid-template-columns: 72px 1fr; }
      .sidebar-header h2, .conv-count, .conv-body, .conv-delete-btn { display: none; }
      .conv-item { justify-content: center; padding: 12px 8px; }
      .conv-avatar-wrap { width: 42px; height: 42px; }
      .conv-avatar { width: 42px; height: 42px; }
    }

    @media (max-width: 640px) {
      .chat-layout { grid-template-columns: 1fr; }
      .chat-sidebar { display: flex; }
      .chat-sidebar.sidebar--hidden { display: none; }
      .chat-main { display: none; }
      .chat-main--visible { display: flex; }
      .back-btn { display: flex; }
    }
  `],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollMe') private scrollContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly chatForm = this.fb.group({
    content: ['', [Validators.required, Validators.maxLength(500)]],
  });

  protected readonly messages    = this.chatService.messages;
  protected readonly isTyping    = this.chatService.isTyping;
  protected readonly isClosed    = this.chatService.isClosed;
  protected readonly loading     = signal(false);
  protected readonly sending     = signal(false);
  protected readonly loadingList = signal(true);
  protected readonly deleting    = signal(false);
  protected readonly title       = signal('Chat');
  protected readonly conversations = signal<ConversationPreview[]>([]);
  protected readonly deleteTarget  = signal<ConversationPreview | null>(null);

  protected readonly currentUserAvatar = computed(() => this.auth.user()?.avatarUrl ?? null);
  protected readonly currentUserName   = computed(() => this.auth.user()?.fullName ?? 'Me');

  /** Avatar of the currently open conversation's other party */
  protected readonly activeConvAvatar = computed(() => {
    if (!this.conversationId) return null;
    return this.conversations().find(c => c.id === this.conversationId)?.otherPartyAvatar ?? null;
  });

  protected conversationId: string | null = null;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private routeSub?: Subscription;
  private shouldScroll = false;

  async ngOnInit(): Promise<void> {
    this.chatService.connect();
    await this.loadConversations();
    this.routeSub = this.route.paramMap.subscribe((params) => {
      void this.initChatFromRoute(
        params.get('rideId') ?? undefined,
        params.get('parcelId') ?? undefined,
      );
    });
  }

  private async loadConversations(): Promise<void> {
    try {
      this.loadingList.set(true);
      const list = await this.chatService.getMyConversations();
      // Sort: conversations with unread messages first, then by most recent activity
      const sorted = [...list].sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      this.conversations.set(sorted);
    } catch (error) {
      console.error('Failed to load chat list', error);
    } finally {
      this.loadingList.set(false);
    }
  }

  private async initChatFromRoute(rideId?: string, parcelId?: string): Promise<void> {
    if (!rideId && !parcelId) {
      this.conversationId = null;
      this.chatService.reset();
      return;
    }

    try {
      if (this.conversationId) this.chatService.leaveConversation(this.conversationId);

      this.loading.set(true);
      this.chatService.reset();

      let conversation: Conversation | null;
      if (rideId) {
        conversation = await this.chatService.getConversationByRide(rideId);
        this.title.set('Ride Chat');
      } else {
        conversation = await this.chatService.getConversationByParcel(parcelId!);
        this.title.set('Delivery Chat');
      }

      if (!conversation) {
        this.toast.error('No chat found for this booking');
        return;
      }

      this.conversationId = conversation.id;

      if (conversation.messages.length > 0) {
        this.chatService.loadHistory(conversation.messages);
      } else {
        const { messages } = await this.chatService.getMessages(conversation.id);
        this.chatService.loadHistory(messages);
      }

      this.chatService.joinConversation(this.conversationId);
      this.chatService.markRead(this.conversationId);

      const conv = this.conversations().find(c => c.id === this.conversationId);
      if (conv?.unreadCount) {
        this.chatService.totalUnread.update(n => Math.max(0, n - conv.unreadCount));
      }

      if (conversation.status === 'CLOSED') this.chatService.isClosed.set(true);

      this.shouldScroll = true;
    } catch (error) {
      console.error('Chat init failed:', error);
      this.toast.error('Could not load chat');
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    if (this.conversationId) this.chatService.leaveConversation(this.conversationId);
    this.chatService.disconnect();
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  protected openConversation(conv: ConversationPreview): void {
    const role = window.location.pathname.startsWith('/rider') ? 'rider' : 'user';
    if (conv.rideId) {
      void this.router.navigate([`/${role}/chat/ride`, conv.rideId]);
    } else {
      void this.router.navigate([`/${role}/chat/parcel`, conv.parcelId]);
    }
  }

  protected isActiveConv(conv: ConversationPreview): boolean {
    return conv.id === this.conversationId;
  }

  protected async sendMessage(): Promise<void> {
    if (this.chatForm.invalid || !this.conversationId || this.isClosed() || this.sending()) return;

    const content = this.chatForm.value.content?.trim();
    if (!content) return;

    const user = this.auth.user();
    if (!user) return;

    this.chatForm.reset();
    this.sending.set(true);
    this.shouldScroll = true;

    try {
      await this.chatService.sendMessage(
        this.conversationId,
        { content, type: 'TEXT' },
        { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl, role: user.role as MessageSenderRole },
      );
      this.messageInput?.nativeElement.focus();
    } catch {
      this.toast.error('Failed to send message. Please try again.');
    } finally {
      this.sending.set(false);
    }
  }

  protected onTyping(): void {
    if (!this.conversationId || this.isClosed()) return;
    this.chatService.emitTyping(this.conversationId, true);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      if (this.conversationId) this.chatService.emitTyping(this.conversationId, false);
    }, 2000);
  }

  protected isOwnMessage(msg: ChatMessage): boolean {
    return msg.senderAccountId === this.auth.user()?.id;
  }

  protected isPending(msg: ChatMessage): boolean {
    return msg.id.startsWith('pending_');
  }

  /** Only own messages sent within the last 5 minutes can be deleted */
  protected canDeleteMessage(msg: ChatMessage): boolean {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return new Date(msg.createdAt).getTime() > fiveMinAgo;
  }

  protected async deleteMessage(msg: ChatMessage): Promise<void> {
    try {
      await this.chatService.deleteMessage(msg.id);
      this.chatService.messages.update(prev =>
        prev.map(m => m.id === msg.id ? { ...m, content: 'This message was deleted' } : m)
      );
    } catch {
      this.toast.error('Could not delete message');
    }
  }

  protected confirmDeleteConversation(event: Event, conv: ConversationPreview): void {
    event.stopPropagation();
    this.deleteTarget.set(conv);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  protected async executeDelete(): Promise<void> {
    const conv = this.deleteTarget();
    if (!conv) return;

    this.deleting.set(true);
    try {
      await this.chatService.deleteConversation(conv.id);
      this.conversations.update(list => list.filter(c => c.id !== conv.id));
      if (this.conversationId === conv.id) {
        this.conversationId = null;
        this.chatService.reset();
        const role = window.location.pathname.startsWith('/rider') ? 'rider' : 'user';
        void this.router.navigate([`/${role}/chat`]);
      }
      this.toast.success('Conversation deleted');
    } catch {
      this.toast.error('Could not delete conversation');
    } finally {
      this.deleting.set(false);
      this.deleteTarget.set(null);
    }
  }

  protected goBack(): void {
    if (this.conversationId) this.chatService.leaveConversation(this.conversationId);
    this.conversationId = null;
    this.chatService.reset();
    const role = window.location.pathname.startsWith('/rider') ? 'rider' : 'user';
    void this.router.navigate([`/${role}/chat`]);
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }
}
