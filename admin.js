'use strict';

// 정적 페이지의 간단한 화면 잠금. 실제 쓰기 권한은 GitHub에서 확인한다.
const ADMIN_PASSWORD = '4021';
const API = 'https://api.github.com/repos/kalapui36/linkday';
const $ = id => document.getElementById(id);
let token = '';
let snapshot = null;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

function busy(value) {
  document.querySelectorAll('button, input').forEach(element => { element.disabled = value; });
  $('manage-panel').setAttribute('aria-busy', String(value));
}

function validId(id) {
  const number = Number(id);
  return typeof id === 'string' && /^[0-9]{3,}$/.test(id) && Number.isSafeInteger(number) && number > 0 && String(number).padStart(3, '0') === id;
}

async function request(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    throw new Error('GitHub 연결이 끊겼습니다. 변경 결과가 불확실하면 목록을 새로고침해 확인하세요.');
  }
  if (!response.ok) {
    const messages = {
      401: 'GitHub 토큰을 확인해 주세요. 토큰이 만료되었을 수 있습니다.',
      403: 'GitHub 권한 또는 API 사용 한도를 확인해 주세요. Contents 쓰기 권한이 필요합니다.',
      404: '저장소 또는 main에 접근할 수 없습니다. 토큰의 저장소 선택을 확인해 주세요.',
      409: '다른 작업이 반영되었습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.',
      422: '변경을 반영하지 못했습니다. 최신 목록과 main 브랜치의 직접 쓰기 허용 여부를 확인해 주세요.'
    };
    throw new Error(messages[response.status] || `GitHub 요청에 실패했습니다 (${response.status}).`);
  }
  try { return await response.json(); }
  catch { throw new Error('GitHub 응답을 읽지 못했습니다. 목록을 새로고침해 주세요.'); }
}

async function readSnapshot() {
  const ref = await request('/git/ref/heads/main');
  const head = ref.object?.sha;
  if (typeof head !== 'string') throw new Error('main 정보를 읽지 못했습니다.');
  const commit = await request(`/git/commits/${encodeURIComponent(head)}`);
  const treeSha = commit.tree?.sha;
  if (typeof treeSha !== 'string') throw new Error('파일 목록의 기준을 확인할 수 없습니다.');
  const tree = await request(`/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (tree.truncated !== false || !Array.isArray(tree.tree)) throw new Error('파일 목록이 불완전하여 삭제할 수 없습니다.');
  const galleryFile = tree.tree.find(entry => entry.path === 'gallery.json' && entry.type === 'blob');
  if (!galleryFile) throw new Error('gallery.json을 찾을 수 없습니다.');
  const blob = await request(`/git/blobs/${encodeURIComponent(galleryFile.sha)}`);
  if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new Error('목록 파일을 읽을 수 없습니다.');
  let gallery;
  try {
    const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    gallery = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw new Error('작품 목록 JSON을 읽을 수 없습니다.'); }
  if (!Array.isArray(gallery)) throw new Error('작품 목록 형식이 올바르지 않습니다.');
  const ids = new Set();
  for (const work of gallery) {
    if (!work || !validId(work.id) || ids.has(work.id) ||
        Object.keys(work).some(key => !['id', 'title', 'description'].includes(key)) ||
        typeof work.title !== 'string' || !work.title.trim() ||
        typeof work.description !== 'string' || !work.description.trim()) {
      throw new Error('작품 목록 형식이나 중복 번호를 확인해 주세요.');
    }
    ids.add(work.id);
  }
  // 목록에서 빠진 작품 폴더도 정리할 수 있도록 실제 Git 트리를 함께 확인한다.
  const works = new Map(gallery.map(work => [work.id, work]));
  for (const entry of tree.tree) {
    const match = /^works\/([0-9]+)(?:\/|$)/.exec(entry.path);
    if (match && validId(match[1]) && !works.has(match[1])) {
      works.set(match[1], { id: match[1], title: '목록에 없는 작품', description: '작품 폴더가 남아 있습니다.' });
    }
  }
  return { head, treeSha, entries: tree.tree, gallery, works: [...works.values()].sort((a, b) => Number(a.id) - Number(b.id)) };
}

function render() {
  $('work-list').replaceChildren();
  if (!snapshot) return;
  if (!snapshot.works.length) {
    const empty = document.createElement('p');
    empty.textContent = '등록된 작품이 없습니다. Codex에서 번호를 입력해 시작하세요.';
    $('work-list').append(empty);
    return;
  }
  for (const work of snapshot.works) {
    const article = document.createElement('article');
    article.className = 'work';
    const content = document.createElement('div');
    const number = document.createElement('span');
    number.className = 'tag';
    number.textContent = `WORK ${work.id}`;
    const title = document.createElement('h3');
    title.textContent = work.title;
    const description = document.createElement('p');
    description.textContent = work.description;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'delete';
    button.textContent = '삭제';
    button.setAttribute('aria-label', `${work.id}번 작품 삭제`);
    button.addEventListener('click', () => deleteWork(work.id));
    content.append(number, title, description);
    article.append(content, button);
    $('work-list').append(article);
  }
}

async function refresh() {
  snapshot = null;
  render();
  snapshot = await readSnapshot();
  render();
}

async function deleteWork(id) {
  if (!token || !snapshot || !validId(id) || !snapshot.works.some(work => work.id === id)) return;
  const expectedHead = snapshot.head;
  busy(true);
  status(`${id}번 작품을 삭제하고 있습니다…`);
  let published = false;
  try {
    const current = await readSnapshot();
    if (current.head !== expectedHead) {
      snapshot = current;
      render();
      throw new Error('목록이 바뀌어 삭제하지 않았습니다. 최신 목록을 확인한 뒤 다시 선택해 주세요.');
    }
    // Rebuild only the immediate works tree, omitting the selected child.
    // Referencing all other child SHAs preserves their full nested contents,
    // and removes the selected directory itself rather than leaving an empty tree.
    const changes = [];
    if (current.entries.some(entry => entry.path === `works/${id}`)) {
      const children = current.entries.filter(entry => /^works\/[^/]+$/.test(entry.path) && entry.path !== `works/${id}`);
      const worksTree = await request('/git/trees', 'POST', {
        tree: children.map(entry => ({ path: entry.path.slice('works/'.length), mode: entry.mode, type: entry.type, sha: entry.sha }))
      });
      changes.push({ path: 'works', mode: '040000', type: 'tree', sha: worksTree.sha });
    }
    changes.push({ path: 'gallery.json', mode: '100644', type: 'blob', content: JSON.stringify(current.gallery.filter(work => work.id !== id), null, 2) + '\n' });
    const tree = await request('/git/trees', 'POST', { base_tree: current.treeSha, tree: changes });
    const commit = await request('/git/commits', 'POST', { message: `Remove work ${id} for reuse`, tree: tree.sha, parents: [current.head] });
    // force:false keeps concurrent main updates intact: a stale parent cannot replace them.
    await request('/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false });
    published = true;
    snapshot = null;
    render();
    await refresh();
    status(`${id}번 삭제 업로드 완료. 새 Codex 작업에서 ${id}을 입력하면 새 작품을 시작합니다.\n전시관에는 Pages 배포 후 반영됩니다.`);
  } catch (error) {
    if (published) status(`${id}번 삭제 업로드는 완료되었습니다. 목록을 다시 불러오려면 새로고침을 눌러 주세요.`);
    else status(error.message, true);
  } finally { busy(false); }
}

$('lock-form').addEventListener('submit', event => {
  event.preventDefault();
  const correct = $('password').value === ADMIN_PASSWORD;
  $('password').value = '';
  if (!correct) { status('비밀번호가 맞지 않습니다.', true); return; }
  $('lock-panel').hidden = true;
  $('connect-panel').hidden = false;
  status('');
  $('token').focus();
});

$('connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  token = $('token').value.trim();
  $('token').value = '';
  if (!token) return;
  busy(true);
  status('GitHub에서 최신 작품을 불러오고 있습니다…');
  try {
    await refresh();
    $('connect-panel').hidden = true;
    $('manage-panel').hidden = false;
    status('GitHub 연결 완료. 삭제할 작품을 선택하세요.');
  } catch (error) { token = ''; snapshot = null; render(); status(error.message, true); }
  finally { busy(false); }
});

$('refresh').addEventListener('click', async () => {
  busy(true);
  try { await refresh(); status('최신 작품 목록입니다.'); }
  catch (error) { status(error.message, true); }
  finally { busy(false); }
});

$('logout').addEventListener('click', () => {
  token = '';
  snapshot = null;
  render();
  $('manage-panel').hidden = true;
  $('connect-panel').hidden = true;
  $('lock-panel').hidden = false;
  status('로그아웃했습니다.');
  $('password').focus();
});
