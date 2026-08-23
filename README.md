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

기존 Java 구현은 `src/mindustrytimescale/TimeScaleMod.java`에 보존되어 있으며, `v0.1.1` 릴리스는 데스크톱/Android용 Java 모드입니다. 현재 기본 브랜치는 iPad 사용을 위한 스크립트 버전입니다.
