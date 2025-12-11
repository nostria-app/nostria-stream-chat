import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NostrService, ChatMessage, ZapEvent } from '../services/nostr.service';

@Component({
  selector: 'app-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="chat-container">
      @if (!isConnected()) {
        <div class="loading">
          <div class="loading-spinner"></div>
          <p>Connecting to relays...</p>
        </div>
      } @else {
        <div class="chat-messages" #messagesContainer>
          @for (item of feed(); track item.data.id) {
            @if (item.type === 'message') {
              <div class="chat-message">
                <div class="avatar">
                  @if (asMessage(item.data).avatar) {
                    <img [src]="asMessage(item.data).avatar" [alt]="asMessage(item.data).displayName" />
                  } @else {
                    <div class="avatar-placeholder">{{ getInitials(asMessage(item.data).displayName) }}</div>
                  }
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <span class="username">{{ asMessage(item.data).displayName }}</span>
                    <span class="timestamp">{{ item.createdAt * 1000 | date:'shortTime' }}</span>
                  </div>
                  <div class="message-text">{{ asMessage(item.data).content }}</div>
                </div>
              </div>
            } @else {
              <div class="zap-message">
                <div class="zap-icon">⚡</div>
                <div class="zap-content">
                  <span class="zap-sender">{{ asZap(item.data).senderDisplayName }}</span>
                  <span class="zap-text">zapped</span>
                  <span class="zap-amount">{{ formatSats(asZap(item.data).amount) }} sats</span>
                  @if (asZap(item.data).content) {
                    <span class="zap-comment">{{ asZap(item.data).content }}</span>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: #1a1a2e;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 1rem;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: #9d4edd;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .chat-message {
      display: flex;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .chat-message:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }

    .avatar {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.125rem;
    }

    .username {
      font-weight: 600;
      color: #c8b6ff;
      font-size: 0.875rem;
    }

    .timestamp {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.4);
    }

    .message-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.9rem;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .zap-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      margin: 0.25rem 0;
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.15) 100%);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 8px;
    }

    .zap-icon {
      font-size: 1.25rem;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .zap-content {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
    }

    .zap-sender {
      font-weight: 600;
      color: #ffc107;
    }

    .zap-text {
      color: rgba(255, 255, 255, 0.7);
    }

    .zap-amount {
      font-weight: 700;
      color: #ff9800;
      background: rgba(255, 152, 0, 0.2);
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .zap-comment {
      width: 100%;
      color: rgba(255, 255, 255, 0.8);
      font-style: italic;
      margin-top: 0.25rem;
    }

    /* Scrollbar styling */
    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly nostrService = inject(NostrService);
  
  private readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  private readonly autoScroll = signal(true);

  readonly feed = this.nostrService.feed;
  readonly isConnected = this.nostrService.isConnected;

  constructor() {
    // Auto-scroll effect
    effect(() => {
      const items = this.feed();
      const container = this.messagesContainer();
      if (items.length > 0 && container && this.autoScroll()) {
        setTimeout(() => {
          container.nativeElement.scrollTop = container.nativeElement.scrollHeight;
        }, 0);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const naddr = params.get('naddr');
      if (naddr) {
        // Get additional relays from query params
        this.route.queryParamMap.subscribe((queryParams) => {
          const relaysParam = queryParams.get('relays');
          const additionalRelays = relaysParam ? relaysParam.split(',').map((r) => r.trim()) : [];
          this.nostrService.connect(naddr, additionalRelays);
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.nostrService.disconnect();
  }

  asMessage(data: ChatMessage | ZapEvent): ChatMessage {
    return data as ChatMessage;
  }

  asZap(data: ChatMessage | ZapEvent): ZapEvent {
    return data as ZapEvent;
  }

  getInitials(name?: string): string {
    if (!name) {
      return '?';
    }
    const parts = name.split(/[\s_-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  formatSats(sats: number): string {
    return this.nostrService.formatSats(sats);
  }

  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    this.autoScroll.set(isAtBottom);
  }
}
