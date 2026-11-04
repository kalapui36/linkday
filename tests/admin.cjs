// Run with Node + Playwright and an installed Chromium. All GitHub API calls
// are intercepted. This test never uses a real token or modifies GitHub.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer(async (req, res) => {
    const filename = new URL(req.url, 'http://localhost').pathname.replace(/^\/linkday\//, '') || 'index.html';
    if (!['index.html', 'admin.html', 'admin.js', 'gallery.json', 'works/001/index.html'].includes(filename)) { res.writeHead(404); res.end(); return; }
    const type = filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.json') ? 'application/json' : 'text/html';
    try { res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(await fs.readFile(path.join(root, filename))); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    const base = `http://127.0.0.1:${server.address().port}/linkday/`;
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    let head = 'head-1';
    let gallery = [
      { id: '001', title: '기존 작품', description: '반드시 보존' },
      { id: '002', title: '<img src=x onerror=alert(1)>', description: '삭제·재사용 검증' }
    ];
    let files = ['gallery.json', 'index.html', 'works/001/index.html', 'works/002/index.html', 'works/002/assets/helper.js', 'works/0020/index.html'];
    let changes = null;
    let preservedWorks = null;
    let parent = null;
    let writes = 0;
    let rejectAuth = false;
    let truncated = false;
    let malformed = false;
    let race = false;
    const deleted = [];
    await page.route('https://api.github.com/**', async route => {
      const request = route.request();
      assert(request.url().startsWith('https://api.github.com/repos/kalapui36/linkday/'));
      assert.equal(request.headers().authorization, 'Bearer test-only-not-a-real-token');
      const url = new URL(request.url());
      const endpoint = url.pathname.replace('/repos/kalapui36/linkday', '');
      const method = request.method();
      const respond = (json, status = 200) => route.fulfill({ status, json, headers: { 'Access-Control-Allow-Origin': '*' } });
      if (rejectAuth) return respond({ message: 'bad credentials' }, 401);
      if (method === 'GET') {
        if (endpoint === '/git/ref/heads/main') return respond({ object: { sha: head } });
        if (endpoint.startsWith('/git/commits/')) return respond({ tree: { sha: 'root-tree' } });
        if (endpoint.startsWith('/git/trees/')) {
          const directories = new Set();
          for (const filename of files) {
            const parts = filename.split('/');
            for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
          }
          return respond({ truncated, tree: [
            ...[...directories].map(directory => ({ path: directory, type: 'tree', mode: '040000', sha: `tree-${directory}` })),
            ...files.map((filename, i) => ({ path: filename, type: 'blob', mode: '100644', sha: filename === 'gallery.json' ? 'gallery-blob' : `file-${i}` }))
          ] });
        }
        if (endpoint.startsWith('/git/blobs/')) return respond({ encoding: 'base64', content: Buffer.from(malformed ? '{bad' : JSON.stringify(gallery)).toString('base64') });
      }
      const data = request.postDataJSON();
      writes++;
      if (endpoint === '/git/trees' && method === 'POST') {
        if (!data.base_tree) {
          preservedWorks = data.tree.map(entry => entry.path);
          assert(!preservedWorks.includes('002'));
          assert(preservedWorks.includes('001'));
          assert(preservedWorks.includes('0020'));
          return respond({ sha: 'new-works-tree' }, 201);
        }
        assert.equal(data.base_tree, 'root-tree');
        changes = data.tree;
        return respond({ sha: 'new-tree' }, 201);
      }
      if (endpoint === '/git/commits' && method === 'POST') {
        parent = data.parents[0];
        assert.equal(data.tree, 'new-tree');
        if (race) head = 'concurrent-head';
        return respond({ sha: 'delete-commit' }, 201);
      }
      if (endpoint === '/git/refs/heads/main' && method === 'PATCH') {
        assert.equal(data.force, false);
        if (parent !== head) return respond({ message: 'not fast forward' }, 422);
        assert.equal(data.sha, 'delete-commit');
        for (const change of changes) {
          if (change.path === 'works') {
            assert.equal(change.sha, 'new-works-tree');
            for (const filename of files) {
              if (filename.startsWith('works/') && !preservedWorks.includes(filename.split('/')[1])) deleted.push(filename);
            }
            files = files.filter(filename => !filename.startsWith('works/') || preservedWorks.includes(filename.split('/')[1]));
          } else {
            assert.equal(change.path, 'gallery.json');
            gallery = JSON.parse(change.content);
          }
        }
        head = 'delete-commit';
        return respond({ object: { sha: head } });
      }
      throw new Error(`Unexpected API call: ${method} ${endpoint}`);
    });
    let checks = 0;
    const pass = name => { checks++; console.log(`PASS: ${name}`); };
    await page.goto(base);
    await page.locator('.card').waitFor();
    assert.equal(await page.locator('.creator').count(), 0);
    await page.locator('#search').fill('001');
    assert.equal(await page.locator('.card').count(), 1);
    await page.getByRole('link', { name: '관리자', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/linkday/admin.html');
    pass('gallery has no personal metadata; number search and admin link work');
    await page.locator('#password').fill('wrong');
    await page.getByRole('button', { name: '입장', exact: true }).click();
    await page.getByText('비밀번호가 맞지 않습니다.', { exact: true }).waitFor();
    assert.equal(await page.locator('#connect-panel').isVisible(), false);
    await page.locator('#password').fill('4021');
    await page.getByRole('button', { name: '입장', exact: true }).click();
    await page.locator('#token').waitFor();
    pass('4021 screen lock and incorrect-password handling');
    const connect = async () => {
      await page.locator('#token').fill('test-only-not-a-real-token');
      await page.getByRole('button', { name: 'GitHub 연결', exact: true }).click();
    };
    rejectAuth = true;
    await connect();
    await page.getByText('GitHub 토큰을 확인해 주세요. 토큰이 만료되었을 수 있습니다.', { exact: true }).waitFor();
    assert.equal(writes, 0);
    rejectAuth = false;
    await connect();
    await page.getByRole('button', { name: '002번 작품 삭제', exact: true }).waitFor();
    assert.equal(await page.locator('#token').inputValue(), '');
    assert.equal(await page.locator('.work img').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    pass('GitHub auth failure, mobile layout, literal titles and memory-only credentials');
    await page.getByRole('button', { name: '002번 작품 삭제', exact: true }).click();
    await page.getByText(/002번 삭제 업로드 완료/).waitFor();
    assert.deepEqual(deleted.sort(), ['works/002/assets/helper.js', 'works/002/index.html']);
    assert(files.includes('works/001/index.html'));
    assert(files.includes('works/0020/index.html'));
    assert.deepEqual(gallery.map(work => work.id), ['001']);
    assert.equal(await page.getByRole('button', { name: '002번 작품 삭제', exact: true }).count(), 0);
    pass('atomic folder + gallery deletion preserves other works and similar prefixes');
    // Simulate a later Codex upload with the same number, not a real GitHub write.
    head = 'recreated-head';
    gallery.push({ id: '002', title: '새 002 작품', description: '이전 작품과 다른 새 프로그램' });
    files.push('works/002/index.html');
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByText('새 002 작품', { exact: true }).waitFor();
    pass('deleted 002 can be registered again and appears normally');
    const beforeConflict = writes;
    head = 'other-edit-head';
    await page.getByRole('button', { name: '002번 작품 삭제', exact: true }).click();
    await page.getByText(/목록이 바뀌어 삭제하지 않았습니다/).waitFor();
    assert.equal(writes, beforeConflict);
    assert(gallery.some(work => work.id === '002'));
    pass('remote changes after listing cause refresh without mutation');
    race = true;
    await page.getByRole('button', { name: '002번 작품 삭제', exact: true }).click();
    await page.getByText(/변경을 반영하지 못했습니다/).waitFor();
    assert.equal(head, 'concurrent-head');
    assert(gallery.some(work => work.id === '002'));
    race = false;
    pass('concurrent commit cannot be overwritten by force push');
    truncated = true;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByText(/파일 목록이 불완전/).waitFor();
    assert.equal(await page.locator('.delete').count(), 0);
    truncated = false;
    malformed = true;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByText('작품 목록 JSON을 읽을 수 없습니다.', { exact: true }).waitFor();
    assert.equal(await page.locator('.delete').count(), 0);
    pass('incomplete tree and malformed gallery cannot enable deletion');
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    assert(await page.locator('#lock-panel').isVisible());
    assert.equal(await page.locator('#manage-panel').isVisible(), false);
    assert.deepEqual(browserErrors, []);
    pass('logout clears UI and no uncaught browser errors');
    console.log(`${checks} browser checks passed (mock GitHub only).`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
