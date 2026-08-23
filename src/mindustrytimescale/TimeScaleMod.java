package mindustrytimescale;

import arc.Core;
import arc.Events;
import arc.input.KeyCode;
import arc.math.Mathf;
import arc.scene.event.Touchable;
import arc.scene.ui.layout.Table;
import arc.util.Log;
import arc.util.Time;
import mindustry.Vars;
import mindustry.game.EventType.ClientLoadEvent;
import mindustry.game.EventType.Trigger;
import mindustry.gen.Tex;
import mindustry.mod.Mod;
import mindustry.ui.Styles;

/**
 * A single-player-only simulation speed controller.
 *
 * The game already centralizes simulation time in Time.delta. Replacing the
 * delta provider lets the normal Mindustry update loop advance faster or
 * slower without changing individual blocks, units, waves, or bullets.
 */
public class TimeScaleMod extends Mod {
    private static final String SETTING_SPEED = "mindustry-timescale-speed";
    private static final float[] SPEEDS = {0.5f, 1f, 2f, 4f};
    private static final float MIN_SPEED = SPEEDS[0];
    private static final float MAX_SPEED = SPEEDS[SPEEDS.length - 1];

    private float speed;
    private Table mobileControls;

    public TimeScaleMod() {
        speed = readSpeed();

        // ClientLauncher installs the normal provider before mods are loaded.
        // Keep its frame-time calculation and apply our multiplier only while
        // a local single-player world is actually running.
        Time.setDeltaProvider(() -> {
            float frameDelta = Core.graphics.getDeltaTime() * 60f;
            if (Float.isNaN(frameDelta) || Float.isInfinite(frameDelta)) {
                frameDelta = 1f;
            }

            boolean localWorld = Vars.state != null
                && Vars.state.isPlaying()
                && (Vars.net == null || !Vars.net.active());

            float multiplier = localWorld ? speed : 1f;
            return Mathf.clamp(frameDelta * multiplier, 0.0001f, Vars.maxDeltaClient);
        });

        Events.run(Trigger.update, this::handleInput);

        Events.on(ClientLoadEvent.class, event -> {
            Log.info("Time Scale loaded. Speed: @x", formatSpeed());
            buildMobileControls();
        });
    }

    private void buildMobileControls() {
        if (!Vars.mobile || Vars.ui == null || Vars.ui.hudGroup == null || mobileControls != null) return;

        mobileControls = new Table();
        mobileControls.name = "mindustry-timescale-controls";
        mobileControls.setFillParent(true);
        mobileControls.touchable = Touchable.childrenOnly;
        mobileControls.visible(() -> Vars.state != null
            && Vars.state.isGame()
            && Vars.net != null
            && !Vars.net.active());
        mobileControls.bottom().right();

        mobileControls.table(Tex.pane, controls -> {
            controls.defaults().size(64f);
            controls.button("−", Styles.clearTogglet, () -> changeSpeed(-1));
            controls.label(() -> formatSpeed() + "x").center();
            controls.button("+", Styles.clearTogglet, () -> changeSpeed(1));
        }).padRight(12f).padBottom(12f);

        Vars.ui.hudGroup.addChild(mobileControls);
    }

    private void handleInput() {
        if (Vars.state == null || !Vars.state.isPlaying()) return;

        // This first release deliberately refuses networked worlds.
        if (Vars.net != null && Vars.net.active()) {
            if (speed != 1f) {
                setSpeed(1f, false);
                Vars.ui.hudfrag.showToast("Time Scale is disabled in multiplayer");
            }
            return;
        }

        if (Core.input.keyTap(KeyCode.f6)) {
            changeSpeed(-1);
        } else if (Core.input.keyTap(KeyCode.f7)) {
            changeSpeed(1);
        } else if (Core.input.keyTap(KeyCode.f8)) {
            setSpeed(1f, true);
        }
    }

    private void changeSpeed(int direction) {
        int index = speedIndex();
        int next = Mathf.clamp(index + direction, 0, SPEEDS.length - 1);
        setSpeed(SPEEDS[next], true);
    }

    private void setSpeed(float value, boolean notify) {
        speed = Mathf.clamp(value, MIN_SPEED, MAX_SPEED);
        Core.settings.put(SETTING_SPEED, speed);

        if (notify && Vars.ui != null && Vars.ui.hudfrag != null) {
            Vars.ui.hudfrag.setHudText("[accent]Time Scale: " + formatSpeed() + "x[]");
            Vars.ui.hudfrag.showToast("Time Scale: " + formatSpeed() + "x");
        }
    }

    private float readSpeed() {
        float saved = Core.settings.getFloat(SETTING_SPEED, 1f);
        for (float candidate : SPEEDS) {
            if (Mathf.equal(saved, candidate)) return candidate;
        }
        return 1f;
    }

    private int speedIndex() {
        for (int i = 0; i < SPEEDS.length; i++) {
            if (Mathf.equal(speed, SPEEDS[i])) return i;
        }
        return 1;
    }

    private String formatSpeed() {
        return speed == (int)speed ? Integer.toString((int)speed) : Float.toString(speed);
    }
}
