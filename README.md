# Mindustry Time Scale

싱글플레이에서 Mindustry 시뮬레이션 배속을 조절하는 Java 모드입니다.

## 기능

- `F6`: 배속 한 단계 감소
- `F7`: 배속 한 단계 증가
- `F8`: `1x`로 초기화
- 모바일: HUD 오른쪽 아래의 `− / 배속 / +` 버튼 사용
- 지원 배속: `0.5x`, `1x`, `2x`, `4x`
- 현재 배속을 HUD와 알림으로 표시
- 설정값 저장
- 멀티플레이에서는 자동 비활성화

## 개발 기준

- Mindustry `v8 Build 159.7`
- Java 17
- 공식 Java mod template 방식

## 빌드

```powershell
gradle jar
```

생성 파일:

```text
build/libs/mindustry-timescale.jar
```

JAR 파일을 Mindustry의 모드 메뉴에서 가져오면 됩니다. GitHub 배포 시에는 이 JAR를 GitHub Release에 업로드해야 게임 내 GitHub 모드 로더가 받을 수 있습니다.
