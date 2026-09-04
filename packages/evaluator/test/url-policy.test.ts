import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UrlPolicyError, isLocalHostname, resolveUrl } from '../src/url-policy';

const permissive = { allowLocalNetwork: true, allowFileProtocol: false, localhostAlias: null };

describe('resolveUrl', () => {
  it('aceita URL http valida', () => {
    const result = resolveUrl('https://example.com/x?y=1', permissive);
    assert.equal(result.resolvedUrl, 'https://example.com/x?y=1');
    assert.equal(result.rewritten, false);
    assert.equal(result.isLocal, false);
  });

  it('assume http:// quando o esquema e omitido', () => {
    assert.equal(resolveUrl('localhost:5173', permissive).resolvedUrl, 'http://localhost:5173/');
  });

  it('reconhece localhost e enderecos privados como rede local', () => {
    for (const host of ['localhost', '127.0.0.1', '192.168.0.10', '10.1.2.3', '172.16.0.1', 'app.localhost']) {
      assert.equal(isLocalHostname(host), true, host);
    }
    assert.equal(isLocalHostname('example.com'), false);
    assert.equal(isLocalHostname('172.32.0.1'), false);
  });

  it('rejeita URL vazia', () => {
    assert.throws(() => resolveUrl('   ', permissive), (error: unknown) => {
      assert.ok(error instanceof UrlPolicyError);
      assert.equal(error.kind, 'invalid-url');
      return true;
    });
  });

  it('bloqueia javascript: e data:', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<h1>x</h1>']) {
      assert.throws(() => resolveUrl(url, permissive), (error: unknown) => {
        assert.ok(error instanceof UrlPolicyError);
        assert.equal(error.kind, 'blocked-url');
        return true;
      }, url);
    }
  });

  it('bloqueia file: por padrao e libera com a flag', () => {
    assert.throws(() => resolveUrl('file:///etc/passwd', permissive));
    const allowed = resolveUrl('file:///tmp/a.html', { ...permissive, allowFileProtocol: true });
    assert.equal(allowed.resolvedUrl, 'file:///tmp/a.html');
  });

  it('bloqueia rede local quando ALLOW_LOCAL_NETWORK=false', () => {
    assert.throws(
      () => resolveUrl('http://192.168.1.5:8080', { ...permissive, allowLocalNetwork: false }),
      (error: unknown) => {
        assert.ok(error instanceof UrlPolicyError);
        assert.equal(error.kind, 'blocked-url');
        return true;
      },
    );
  });

  it('reescreve localhost para o alias do host mantendo porta e caminho', () => {
    const result = resolveUrl('http://localhost:5173/app', { ...permissive, localhostAlias: 'host.docker.internal' });
    assert.equal(result.inputUrl, 'http://localhost:5173/app');
    assert.equal(result.resolvedUrl, 'http://host.docker.internal:5173/app');
    assert.equal(result.rewritten, true);
  });

  it('nao reescreve hosts que nao sao locais', () => {
    const result = resolveUrl('https://example.com', { ...permissive, localhostAlias: 'host.docker.internal' });
    assert.equal(result.rewritten, false);
    assert.equal(result.resolvedUrl, 'https://example.com/');
  });

  it('nao reescreve enderecos de rede privada (apenas loopback)', () => {
    // 192.168.x.y ja e alcancavel do container; reescrever quebraria o alvo.
    const result = resolveUrl('http://192.168.0.9:3000', { ...permissive, localhostAlias: 'host.docker.internal' });
    assert.equal(result.rewritten, false);
  });
});
