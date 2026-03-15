# 이유식 베이스죽 계산기

Firebase Firestore 기반의 이유식 베이스죽 재료 계산기입니다.
iPhone · MacBook 등 모든 기기에서 실시간 동기화됩니다.

## 기능

- 잡곡 목록 자유 편집 (추가 · 삭제 · 드래그 순서 변경)
- n배죽 기준 물 양 자동 계산
- 하루 끼니 수 × 조리 일수로 총 재료량 산출
- 레시피 저장 / 불러오기 / 삭제
- Firebase Firestore 실시간 동기화 (기기 간 공유)

## 계산 방식

```
잡곡 합계(g) × n = 물(g)
잡곡 합계 + 물 = 1회 베이스죽 재료량(g)
1회 재료량 × (하루 끼니 × 조리 일수) = 총 재료량
```

> 밥솥 죽 모드(60분)로 조리 시 실제 완성량은 약간 줄어듭니다.

## 배포 방법 (GitHub Pages)

### 1. 저장소 생성 및 푸시

```bash
git init
git add .
git commit -m "초기 커밋"
git remote add origin https://github.com/<계정>/<저장소명>.git
git push -u origin main
```

### 2. GitHub Pages 활성화

1. GitHub 저장소 → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)` 선택 후 **Save**
4. 잠시 후 `https://<계정>.github.io/<저장소명>/` 으로 접속

### 3. Firebase Firestore 보안 규칙 설정

Firebase Console → Firestore Database → **규칙** 탭:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> 개인 사용 앱이므로 위 규칙으로 충분합니다.
> 추후 인증이 필요하면 Firebase Authentication을 추가하세요.

## 파일 구조

```
baby-porridge/
├── index.html   # 앱 진입점 (HTML 마크업)
├── style.css    # 스타일 (다크모드 지원)
├── app.js       # 계산 로직 + Firebase 연동
└── README.md
```

## Firebase 프로젝트 정보

- Project ID: `baby-meal-4cecc`
- Firestore 컬렉션:
  - `settings/porridge_settings` — 잡곡 목록, 기본 설정
  - `porridge_recipes/{id}` — 저장된 레시피
