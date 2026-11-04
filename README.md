# 3色 링크데이 바이브코딩 체험실

**번호로 시작 → 대화하며 만들기 → `완성`으로 바로 업로드.**

학교명·이름·별명은 수집하지 않습니다. 작품은 `works/001/index.html`처럼 독립 폴더에 저장되고 `gallery.json`에는 번호·제목·설명만 담습니다.

## 체험 시작

1. 새 Codex 작업에서 `kalapui36/linkday`와 최신 `main`을 선택합니다.
2. `001` 또는 `002`처럼 원하는 번호만 입력합니다.
3. 만들고 싶은 프로그램을 이야기하고 수정합니다. ‘코딩 시작’이나 별도 운영자 승인은 필요 없습니다.
4. `완성`이라고 입력하면 Codex가 동작 확인 후 전시 목록에 등록하고 main에 커밋·푸시합니다. 추가 승인이나 PR 병합은 기본 절차에 없습니다.

이미 있는 번호는 해당 작품을 이어서 수정합니다. **관리자에서 삭제한 번호를 새 작업에서 다시 입력하면 그 번호로 새 작품을 만듭니다.** 참가자가 바뀌면 새 대화를 시작하세요. 동시 체험에는 서로 다른 번호를 사용하세요.

## 관리자에서 작품 삭제

1. 전시관 하단 **관리자**를 누르거나 `admin.html`을 엽니다.
2. 초기 비밀번호 **4021**을 입력합니다.
3. GitHub 쓰기 토큰을 입력하고 **GitHub 연결**을 누릅니다.
4. 원하는 작품의 **삭제**를 누릅니다. 해당 폴더 전체와 목록 항목이 같은 커밋에서 삭제됩니다. 다른 작품은 유지됩니다.
5. Pages 배포 후 전시관에서도 사라집니다. 새 Codex 작업에서 삭제한 번호를 바로 재사용할 수 있습니다. 배포 전까지 이전 화면이 잠시 보일 수 있습니다.

### 관리자용 GitHub 연결: 최초 준비

[GitHub fine-grained token 설정](https://github.com/settings/personal-access-tokens/new)에서 소유자 `kalapui36`, **Only select repositories → linkday**, **Repository permissions → Contents: Read and write**로 토큰을 만듭니다. 조직 저장소라면 토큰 승인 정책도 적용됩니다. 토큰 값은 관리자 페이지의 입력란에만 붙여 넣습니다. 채팅이나 저장소 파일에 넣지 않습니다.

토큰은 열린 페이지의 메모리에서만 사용하므로 새로고침하거나 로그아웃하면 다시 입력합니다. 관리자는 작품 코드를 실행하지 않고 GitHub API에서 목록을 읽습니다. 토큰은 `api.github.com`에만 보냅니다.

**4021은 관리 화면을 여는 간단한 화면 잠금입니다.** 정적 페이지 비밀번호만으로 GitHub 쓰기 권한을 만들 수는 없습니다. 실제 삭제에는 토큰 연결이 필요합니다. 브랜치 보호 규칙이 직접 수정을 막으면 관리자에서도 삭제가 거절됩니다.

목록을 보는 동안 원격 내용이 달라졌으면 삭제하지 않고 최신 목록을 다시 불러옵니다. 확인 후 다시 삭제를 누르세요. 목록이 불완전하거나 실패하면 삭제 버튼은 제공하지 않습니다. 삭제는 현재 main과 전시에서 제거하는 것으로 과거 커밋 기록까지 지우지는 않습니다.

## GitHub Pages: 한 번만 설정

[Pages 설정](https://github.com/kalapui36/linkday/settings/pages)에서 **Deploy from a branch → main → / (root)**를 선택하고 저장합니다. 이후 main 반영 시 자동 갱신됩니다.

기본 예상 주소:

- 전시관: `https://kalapui36.github.io/linkday/`
- 관리자: `https://kalapui36.github.io/linkday/admin.html`

실제 배포 완료와 주소는 Pages 설정에서 확인하세요. 비공개 저장소·계정 플랜에 따라 Pages 지원이 다를 수 있습니다.

## 파일과 개발

```text
index.html                    전시관과 작품 검색
admin.html / admin.js         관리자 화면과 GitHub 삭제 기능
gallery.json                  [{"id":"001","title":"제목","description":"설명"}]
works/001/index.html          참가자 작품 (삭제 번호 재사용 가능)
AGENTS.md                     번호 시작·완성 업로드 지침
scripts/validate_gallery.py   목록과 실행 파일 검사
.github/workflows/validate.yml main/PR 목록 구조 검사
```

추가 패키지 설치 없이 Python 3으로 실행합니다.

```sh
python3 scripts/validate_gallery.py
python3 -m unittest discover -s tests -p 'test_*.py'
python3 -m http.server 8000 --bind 127.0.0.1
```

HTTP로 전시관·작품·관리자를 확인합니다. `file://`로는 목록 로딩이 안 될 수 있습니다. 관리자는 연결 후 **실제 main을 변경**하므로 연습용 삭제를 누르지 마세요. 브라우저 자동 검증에는 별도의 가상 API 응답을 사용합니다.

관리자 브라우저 회귀 검사는 개발 도구 Playwright와 Chromium이 있는 환경에서 `node tests/admin.cjs`로 실행합니다. 기본 Chromium 경로는 `/usr/bin/chromium`이며 필요하면 `CHROMIUM_PATH`로 지정합니다. 사이트 실행에는 이 도구들이 필요하지 않습니다. 검사는 가상 토큰과 가상 GitHub API만 사용하며 실제 작품을 삭제하지 않습니다.

작품 링크는 `./works/001/`, 전시관 복귀는 `../../`처럼 상대 경로를 사용합니다. 비밀키·학생 개인정보를 코드에 넣지 않습니다. Cloud의 저장된 시작 지침도 새 방식으로 갱신한 후 게시해 사용하세요.
