import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home-container">
      <div class="content">
        <h1>⚡ Nostria Stream Chat</h1>
        <p class="description">
          A real-time chat viewer for Nostr live streams. Display chat messages and zaps 
          from any live activity on the Nostr network.
        </p>
        
        <div class="instructions">
          <h2>How to Use</h2>
          <p>Add a <code>naddr</code> to the URL to view the chat for a live stream:</p>
          <div class="example">
            <code>{{ baseUrl }}/<span class="highlight">naddr1...</span></code>
          </div>
          
          <h3>What is naddr?</h3>
          <p>
            The <code>naddr</code> is a Nostr address that identifies a live activity event (NIP-53). 
            You can get this from any Nostr client that supports live streams.
          </p>
          
          <h3>Optional: Custom Relays</h3>
          <p>You can specify additional relays using the <code>relays</code> query parameter:</p>
          <div class="example">
            <code>{{ baseUrl }}/naddr1...?relays=wss://relay1.com,wss://relay2.com</code>
          </div>
        </div>
        
        <div class="features">
          <h2>Features</h2>
          <ul>
            <li>📝 Live chat messages (kind 1311)</li>
            <li>⚡ Zap receipts with amounts (kind 9735)</li>
            <li>👤 User profiles with avatars</li>
            <li>🔄 Auto-scroll with new messages</li>
            <li>🌐 Connects to 10+ popular Nostr relays by default</li>
          </ul>
        </div>

        <div class="footer">
          <p>
            Built for <a href="https://nostr.com" target="_blank" rel="noopener">Nostr</a> · 
            <a href="https://github.com/nostr-protocol/nips/blob/master/53.md" target="_blank" rel="noopener">NIP-53</a> · 
            <a href="https://github.com/nostr-protocol/nips/blob/master/57.md" target="_blank" rel="noopener">NIP-57</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }

    .home-container {
      min-height: 100%;
      background-color: #1a1a2e;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      padding: 2rem;
      overflow-y: auto;
    }

    .content {
      max-width: 700px;
      width: 100%;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #9d4edd 0%, #c77dff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    h2 {
      font-size: 1.5rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #c8b6ff;
    }

    h3 {
      font-size: 1.1rem;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      color: #e0aaff;
    }

    .description {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.8);
      line-height: 1.6;
    }

    .instructions {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 1.5rem;
      margin-top: 2rem;
    }

    .instructions p {
      color: rgba(255, 255, 255, 0.8);
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    code {
      background: rgba(157, 78, 221, 0.2);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      color: #c77dff;
    }

    .example {
      background: rgba(0, 0, 0, 0.3);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .example code {
      background: none;
      padding: 0;
      white-space: nowrap;
    }

    .highlight {
      color: #ffc107;
    }

    .features {
      margin-top: 2rem;
    }

    .features ul {
      list-style: none;
      padding: 0;
    }

    .features li {
      padding: 0.5rem 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1rem;
    }

    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
    }

    .footer p {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9rem;
    }

    .footer a {
      color: #9d4edd;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  `]
})
export class HomeComponent {
  get baseUrl(): string {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}${loc.pathname.replace(/\/$/, '')}`;
  }
}
