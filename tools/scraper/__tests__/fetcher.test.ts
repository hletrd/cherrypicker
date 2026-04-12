import { describe, expect, test } from 'bun:test';
import { cleanHTML } from '../src/fetcher.js';

describe('cleanHTML', () => {
  test('keeps main content while stripping obvious chrome and scripts', () => {
    const html = `
      <html>
        <body>
          <header>header chrome</header>
          <main>
            <h1>주요 혜택</h1>
            <p>대중교통 10% 할인</p>
          </main>
          <script>window.__secret = 'x'</script>
          <footer>footer chrome</footer>
        </body>
      </html>
    `;

    const cleaned = cleanHTML(html);

    expect(cleaned).toContain('주요 혜택');
    expect(cleaned).toContain('대중교통 10% 할인');
    expect(cleaned).not.toContain('header chrome');
    expect(cleaned).not.toContain('footer chrome');
    expect(cleaned).not.toContain('__secret');
  });
});
