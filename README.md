# Mindustry Time Scale

싱글플레이에서 Mindustry 시뮬레이션 배속을 조절하는 iOS 호환 JavaScript 모드입니다.

## 기능

- 데스크톱: `F6` 배속 감소, `F7` 배속 증가, `F8` `1x` 초기화
- 모바일: HUD 오른쪽 아래의 `− / 배속 / +` 버튼 사용
- 지원 배속: `0.5x`, `1x`, `2x`, `4x`
- 현재 배속을 HUD와 알림으로 표시
- 설정값 저장
- 멀티플레이에서는 자동 비활성화

## iPad 설치

Mindustry의 모드 메뉴에서 `Import From GitHub`를 선택하고 아래 저장소를 입력합니다.

```text
awindboy/TimeControlMod
```

이 버전은 Java JAR가 아니라 `scripts/main.js`를 사용하는 스크립트 모드입니다. iOS에서는 `extend()`와 `JavaAdapter`를 사용하지 않는 스크립트만 호환 대상으로 표시할 수 있습니다.

## 개발 기준

- Mindustry `v8 Build 159.7`
- Mindustry JavaScript scripting API

## 구조

```text
mod.hjson
scripts/main.js
```

기존 Java 모드는 `v0.1.1` 릴리스에 남아 있으며, 현재 기본 브랜치는 iPad 사용을 위한 스크립트 버전입니다. 저장소의 Java 소스는 GitHub의 자동 언어 판별이 Java 모드로 오인하지 않도록 기본 브랜치에서 제외했습니다. `v0.2.2`부터 UI 오버레이를 HUD 자식이 아닌 씬 최상위에 추가하며, `v0.2.3`에서는 배속 프리셋을 문자열로 저장해 데스크톱 설정 저장 오류를 수정했습니다.
