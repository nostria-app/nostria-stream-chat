import { Injectable, signal, computed } from '@angular/core';
import { nip19, SimplePool, type Event, type Filter } from 'nostr-tools';

export interface ChatMessage {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  displayName?: string;
  avatar?: string;
}

export interface ZapEvent {
  id: string;
  senderPubkey: string;
  recipientPubkey: string;
  amount: number; // in sats
  content: string;
  createdAt: number;
  senderDisplayName?: string;
  senderAvatar?: string;
}

export interface Profile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  nip05?: string;
}

export interface DecodedNaddr {
  kind: number;
  pubkey: string;
  identifier: string;
  relays: string[];
}

@Injectable({
  providedIn: 'root',
})
export class NostrService {
  private pool = new SimplePool();
  private subscriptions: { close: () => void }[] = [];
  
  // Default popular Nostr relays
  readonly defaultRelays: string[] = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.primal.net',
    'wss://nostr.wine',
    'wss://relay.nostr.bg',
    'wss://nostr-pub.wellorder.net',
    'wss://offchain.pub',
    'wss://relay.current.fyi',
  ];

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _zaps = signal<ZapEvent[]>([]);
  private readonly _profiles = signal<Map<string, Profile>>(new Map());
  private readonly _isConnected = signal(false);
  private readonly _currentActivity = signal<Event | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly zaps = this._zaps.asReadonly();
  readonly profiles = this._profiles.asReadonly();
  readonly isConnected = this._isConnected.asReadonly();
  readonly currentActivity = this._currentActivity.asReadonly();

  // Combined feed of messages and zaps sorted by time
  readonly feed = computed(() => {
    const messages = this._messages();
    const zaps = this._zaps();
    const profiles = this._profiles();

    const feedItems: Array<{ type: 'message' | 'zap'; data: ChatMessage | ZapEvent; createdAt: number }> = [];

    for (const msg of messages) {
      const profile = profiles.get(msg.pubkey);
      feedItems.push({
        type: 'message',
        data: {
          ...msg,
          displayName: profile?.displayName || profile?.name || this.shortenPubkey(msg.pubkey),
          avatar: profile?.picture,
        },
        createdAt: msg.createdAt,
      });
    }

    for (const zap of zaps) {
      const profile = profiles.get(zap.senderPubkey);
      feedItems.push({
        type: 'zap',
        data: {
          ...zap,
          senderDisplayName: profile?.displayName || profile?.name || this.shortenPubkey(zap.senderPubkey),
          senderAvatar: profile?.picture,
        },
        createdAt: zap.createdAt,
      });
    }

    return feedItems.sort((a, b) => a.createdAt - b.createdAt);
  });

  decodeNaddr(naddr: string): DecodedNaddr | null {
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type === 'naddr') {
        return {
          kind: decoded.data.kind,
          pubkey: decoded.data.pubkey,
          identifier: decoded.data.identifier,
          relays: decoded.data.relays || [],
        };
      }
      return null;
    } catch (e) {
      console.error('Failed to decode naddr:', e);
      return null;
    }
  }

  async connect(naddr: string, additionalRelays: string[] = []): Promise<void> {
    // Cleanup existing subscriptions
    this.disconnect();

    const decoded = this.decodeNaddr(naddr);
    if (!decoded) {
      console.error('Invalid naddr');
      return;
    }

    // Combine relays from naddr, additional relays, and defaults
    const relays = [...new Set([
      ...decoded.relays,
      ...additionalRelays,
      ...this.defaultRelays,
    ])];

    console.log('Connecting to relays:', relays);
    console.log('Decoded naddr:', decoded);

    // Create the 'a' tag for the live activity
    const aTag = `${decoded.kind}:${decoded.pubkey}:${decoded.identifier}`;
    
    // Subscribe to the live activity event (kind 30311)
    const activityFilter: Filter = { kinds: [decoded.kind], authors: [decoded.pubkey], '#d': [decoded.identifier] };
    const activitySub = this.pool.subscribeMany(
      relays,
      activityFilter,
      {
        onevent: (event) => {
          console.log('Live activity event:', event);
          this._currentActivity.set(event);
          this._isConnected.set(true);
        },
        oneose: () => {
          console.log('Activity subscription EOSE');
        },
      }
    );
    this.subscriptions.push(activitySub);

    // Subscribe to chat messages (kind 1311)
    const chatFilter: Filter = { kinds: [1311], '#a': [aTag] };
    const chatSub = this.pool.subscribeMany(
      relays,
      chatFilter,
      {
        onevent: (event) => {
          this.handleChatMessage(event);
          this.fetchProfileIfNeeded(event.pubkey, relays);
        },
        oneose: () => {
          console.log('Chat subscription EOSE');
        },
      }
    );
    this.subscriptions.push(chatSub);

    // Subscribe to zap receipts (kind 9735)
    const zapFilter: Filter = { kinds: [9735], '#a': [aTag] };
    const zapSub = this.pool.subscribeMany(
      relays,
      zapFilter,
      {
        onevent: (event) => {
          this.handleZapEvent(event, relays);
        },
        oneose: () => {
          console.log('Zap subscription EOSE');
        },
      }
    );
    this.subscriptions.push(zapSub);

    this._isConnected.set(true);
  }

  private handleChatMessage(event: Event): void {
    const existing = this._messages();
    if (existing.some((m) => m.id === event.id)) {
      return;
    }

    const message: ChatMessage = {
      id: event.id,
      pubkey: event.pubkey,
      content: event.content,
      createdAt: event.created_at,
    };

    this._messages.update((msgs) => [...msgs, message]);
  }

  private handleZapEvent(event: Event, relays: string[]): void {
    const existing = this._zaps();
    if (existing.some((z) => z.id === event.id)) {
      return;
    }

    // Parse the zap receipt
    const descriptionTag = event.tags.find((t) => t[0] === 'description');
    if (!descriptionTag?.[1]) {
      return;
    }

    let zapRequest: Event;
    try {
      zapRequest = JSON.parse(descriptionTag[1]);
    } catch {
      console.error('Failed to parse zap request');
      return;
    }

    // Extract amount from bolt11 invoice
    const bolt11Tag = event.tags.find((t) => t[0] === 'bolt11');
    const amount = this.parseAmountFromBolt11(bolt11Tag?.[1] || '');

    // Get recipient pubkey
    const pTag = event.tags.find((t) => t[0] === 'p');
    const recipientPubkey = pTag?.[1] || '';

    const zap: ZapEvent = {
      id: event.id,
      senderPubkey: zapRequest.pubkey,
      recipientPubkey,
      amount,
      content: zapRequest.content || '',
      createdAt: event.created_at,
    };

    this._zaps.update((zaps) => [...zaps, zap]);
    this.fetchProfileIfNeeded(zapRequest.pubkey, relays);
  }

  private parseAmountFromBolt11(bolt11: string): number {
    // Simple bolt11 amount parser
    // Format: lnbc<amount><multiplier>...
    const match = bolt11.match(/lnbc(\d+)([munp]?)/i);
    if (!match) {
      return 0;
    }

    const amount = parseInt(match[1], 10);
    const multiplier = match[2];

    switch (multiplier) {
      case 'm':
        return amount * 100000; // milli-bitcoin = 0.001 BTC = 100,000 sats
      case 'u':
        return amount * 100; // micro-bitcoin = 0.000001 BTC = 100 sats
      case 'n':
        return Math.floor(amount / 10); // nano-bitcoin = 0.1 sats
      case 'p':
        return Math.floor(amount / 10000); // pico-bitcoin = 0.0001 sats
      default:
        return amount * 100000000; // full bitcoin
    }
  }

  private async fetchProfileIfNeeded(pubkey: string, relays: string[]): Promise<void> {
    const profiles = this._profiles();
    if (profiles.has(pubkey)) {
      return;
    }

    // Mark as fetching to prevent duplicate requests
    this._profiles.update((p) => {
      const newMap = new Map(p);
      newMap.set(pubkey, { pubkey });
      return newMap;
    });

    try {
      const event = await this.pool.get(relays, { kinds: [0], authors: [pubkey] });
      if (event) {
        const content = JSON.parse(event.content);
        const profile: Profile = {
          pubkey,
          name: content.name,
          displayName: content.display_name || content.displayName,
          picture: content.picture,
          nip05: content.nip05,
        };
        this._profiles.update((p) => {
          const newMap = new Map(p);
          newMap.set(pubkey, profile);
          return newMap;
        });
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  }

  disconnect(): void {
    for (const sub of this.subscriptions) {
      sub.close();
    }
    this.subscriptions = [];
    this._isConnected.set(false);
    this._messages.set([]);
    this._zaps.set([]);
  }

  private shortenPubkey(pubkey: string): string {
    if (pubkey.length <= 12) {
      return pubkey;
    }
    return `${pubkey.slice(0, 6)}...${pubkey.slice(-6)}`;
  }

  formatSats(sats: number): string {
    if (sats >= 1000000) {
      return `${(sats / 1000000).toFixed(1)}M`;
    }
    if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}k`;
    }
    return sats.toString();
  }
}
