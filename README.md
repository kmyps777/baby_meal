# 베이스죽계산기

이유식 베이스죽을 만들 때 필요한 잡곡과 물의 양을 계산해주는 앱입니다.

[App Store에서 다운로드](https://apps.apple.com/app/id6761471556)

## 기능

- n배죽 기준 물 양 자동 계산
- 잡곡 목록 자유 편집 (추가 · 삭제 · g 수 조절)
- 하루 끼니 수 × 조리 일수로 총 재료량 산출
- 레시피 저장 / 불러오기 / 수정 / 삭제
- 이메일로 기기 간 데이터 동기화

## 계산 방식

```
잡곡 합계(g) × n = 물(g)
잡곡 합계 + 물 = 1회 베이스죽 재료량(g)
1회 재료량 × (하루 끼니 × 조리 일수) = 총 재료량
```

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML / CSS / Vanilla JS |
| 백엔드/DB | Supabase (PostgreSQL) |
| 호스팅 | GitHub Pages |
| 앱 래핑 | Capacitor 8.3.0 |
| 배포 | App Store (iPhone 전용) |

## 파일 구조

```
base_meal/
├── index.html          # 앱 진입점
├── app.js              # 메인 로직 (Supabase 연동)
├── style.css           # 스타일
├── manifest.json       # PWA 설정
├── sw.js               # 서비스워커
├── icons/              # 앱 아이콘
├── public/             # Capacitor webDir
└── ios/                # Capacitor iOS 프로젝트
```
