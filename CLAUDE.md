# 베이스죽계산기 🍚

## 앱 설명
이유식 베이스죽을 만들 때 필요한 잡곡과 물의 양을 계산해주는 앱.
n배죽 방식으로 잡곡 합계 × n = 물의 양을 계산하고, 하루 끼니 수와 조리 일수를 입력하면 총 재료량을 알려준다.
레시피를 저장하고 이메일로 기기 간 데이터를 동기화할 수 있다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML / CSS / Vanilla JS (ES Module) |
| 폰트 | Gaegu (손글씨), Noto Sans KR |
| 백엔드/DB | Supabase (PostgreSQL) |
| 호스팅 | GitHub Pages (`kmyps777.github.io/baby_meal/`) |
| 앱 래핑 | Capacitor 8.3.0 |
| 배포 | App Store Connect (출시 완료) |

---

## Supabase 프로젝트
- **Project ID**: `zhqegcdhaqsblvzbpexe`
- **URL**: `https://zhqegcdhaqsblvzbpexe.supabase.co`

### 테이블 구조

**settings**
- `id` uuid PK
- `device_id` text UNIQUE
- `email` text
- `grains` jsonb
- `n` integer
- `meals` integer
- `days` integer
- `updated_at` timestamptz

**recipes**
- `id` text PK
- `device_id` text
- `email` text
- `name` text
- `memo` text
- `n` / `meals` / `days` integer
- `grains` jsonb
- `porridge1` / `grain_total_all` / `water_all` text
- `created_at` text
- `created_ts` bigint
- `updated_at` text

---

## 구현된 기능

### 계산하기 탭
- n배죽 / 하루 끼니 / 조리 일수 스테퍼 입력
- 잡곡 목록 추가 / 삭제 / g 수 조절 (1g 단위)
- 재료별 필요량 카드 (잡곡 개별 + 물)
- 합계 요약 (잡곡 합계 / 물 / 전체 재료)
- 설정 자동 저장 (debounce 800ms)

### 레시피 보관함 탭
- 레시피 저장 (이름 + 메모)
- 레시피 불러오기 (탭하면 계산 탭에 자동 적용)
- 레시피 수정 (하단 모달)
- 레시피 삭제

### 이메일 백업
- 이메일 입력 → 데이터와 연결
- 새 기기에서 같은 이메일 입력 → 설정 + 레시피 전체 복원
- 연결 해제 기능

### 데이터 저장 방식
- 로그인 없이 `device_id` (localStorage)로 기기별 저장
- 이메일 입력 시 이메일을 키로 기기 간 동기화

### PWA
- `manifest.json` / `sw.js` 적용
- 홈 화면 추가 시 앱 아이콘 (냄비 이미지) 표시
- 앱 이름: 베이스죽계산기

### iOS 앱 (Capacitor)
- Bundle ID: `com.miyun.porridgecalc`
- 아이콘: 냄비 일러스트 (1024×1024)
- iPhone 전용 (iPad 미지원)
- App Store Connect 업로드 완료, 심사 진행 중

---

## 앱스토어 심사 반려 이력

| 회차 | 반려 사유 | 상태 |
|------|-----------|------|
| 1차 | 4.8 Google 로그인만 있고 Apple 로그인 없음 / 2.1(a) 로그인 버튼 오류 / 1.5 지원 URL 부적합 | 수정 완료 (로그인 제거, Supabase 전환) |

---

## 파일 구조

```
base_meal/
├── index.html          # 앱 진입점
├── app.js              # 메인 로직 (Supabase 연동)
├── style.css           # 스타일
├── manifest.json       # PWA 설정
├── sw.js               # 서비스워커
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── public/             # Capacitor webDir (위 파일들 복사본)
├── ios/                # Capacitor iOS 프로젝트
├── capacitor.config.json
└── package.json
```

---

## 앞으로 할 것들

- [ ] 수익화 모델 결정 (허용 사용자 관리 or 유료 앱)
