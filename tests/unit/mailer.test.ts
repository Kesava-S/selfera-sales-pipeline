import { describe, it, expect } from 'vitest';
import { renderEmailTemplate } from '@/lib/mailer';

describe('email HTML template rendering & sanitization (src/lib/mailer.ts)', () => {
  it('renders default email template with escaped title, preheader, and paragraphs', () => {
    const html = renderEmailTemplate({
      pageTitle: 'Exclusive Opportunity & Offers',
      preheader: 'Quick update regarding <Selfera>',
      body: 'Hello John,\n\nWe would love to discuss your website.\nNext step details inside.',
      unsubscribeUrl: 'https://sales.selfera.co.uk/opt-out?e=test&s=abc',
    });

    expect(html).toContain('Exclusive Opportunity &amp; Offers');
    expect(html).toContain('Quick update regarding &lt;Selfera&gt;');
    expect(html).toContain('Hello John,');
    expect(html).toContain('We would love to discuss your website.<br />Next step details inside.');
    expect(html).toContain('https://sales.selfera.co.uk/opt-out?e=test&amp;s=abc');
  });

  it('escapes dangerous HTML tags in body to prevent injection', () => {
    const maliciousBody =
      'Normal paragraph.\n\n<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const html = renderEmailTemplate({
      pageTitle: 'Security Check',
      preheader: 'Check',
      body: maliciousBody,
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('supports client-branded template rendering', () => {
    const html = renderEmailTemplate({
      pageTitle: 'Update from Partner',
      preheader: 'Important notice',
      body: 'This is sent on behalf of our client.',
      client: 'The Grand London Hotel',
    });

    expect(html).toContain('The Grand London Hotel');
  });

  it('falls back to mailto unsubscribe when no custom unsubscribeUrl is provided', () => {
    const html = renderEmailTemplate({
      pageTitle: 'Direct Outreach',
      preheader: 'Intro',
      body: 'Hello there.',
    });

    expect(html).toContain('mailto:support@selfera.co.uk');
  });
});

