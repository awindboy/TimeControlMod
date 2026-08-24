import arc.Application;
import arc.Core;
import arc.Events;
import arc.Graphics;
import arc.Graphics.BufferFormat;
import arc.Graphics.Cursor;
import arc.graphics.GL20;
import arc.graphics.GL30;
import arc.graphics.Pixmap;
import arc.graphics.g2d.Font;
import arc.graphics.g2d.TextureRegion;
import arc.graphics.gl.GLVersion;
import arc.scene.Element;
import arc.scene.Scene;
import arc.scene.event.Touchable;
import arc.scene.style.BaseDrawable;
import arc.scene.ui.Button.ButtonStyle;
import arc.scene.ui.Label.LabelStyle;
import arc.scene.ui.Label;
import arc.scene.ui.TextButton.TextButtonStyle;
import arc.scene.ui.layout.Table;
import arc.util.Align;
import arc.util.Time;
import rhino.Context;
import rhino.ImporterTopLevel;
import rhino.NativeJavaClass;
import rhino.Scriptable;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.lang.reflect.Proxy;

/** Runs scripts/main.js with the exact interpreted Rhino mode used by Mindustry on iOS. */
public final class RhinoIosProbe {
    public static final class HostClientLoadEvent {
    }

    public static final class HostWorldLoadEvent {
    }

    public enum HostTrigger {
        frame,
        update
    }

    public static final class HostHud {
        public boolean shown = true;
        private final StringBuilder messages = new StringBuilder();

        public void showToast(String message) {
            if (messages.length() > 0) messages.append("|");
            messages.append(message);
        }

        public String messages() {
            return messages.toString();
        }
    }

    public static final class HostState {
        public boolean isPlaying() {
            return true;
        }

        public boolean isGame() {
            return true;
        }
    }

    public static final class HostNet {
        public boolean active() {
            return false;
        }
    }

    public static final class HostStyles {
        public final BaseDrawable black6;
        public final TextButtonStyle clearTogglet;
        public final LabelStyle outlineLabel;

        public HostStyles(BaseDrawable drawable, Font font) {
            black6 = drawable;
            clearTogglet = new TextButtonStyle();
            clearTogglet.up = drawable;
            clearTogglet.down = drawable;
            clearTogglet.font = font;
            outlineLabel = new LabelStyle();
            outlineLabel.font = font;
        }
    }

    public static final class HostGraphics extends Graphics {
        @Override public GL20 getGL20() { return null; }
        @Override public void setGL20(GL20 gl) { }
        @Override public GL30 getGL30() { return null; }
        @Override public void setGL30(GL30 gl) { }
        @Override public int getWidth() { return 2048; }
        @Override public int getHeight() { return 1536; }
        @Override public int getBackBufferWidth() { return 2048; }
        @Override public int getBackBufferHeight() { return 1536; }
        @Override public long getFrameId() { return 1L; }
        @Override public float getDeltaTime() { return 1f / 60f; }
        @Override public int getFramesPerSecond() { return 60; }
        @Override public GLVersion getGLVersion() { return null; }
        @Override public float getPpiX() { return 160f; }
        @Override public float getPpiY() { return 160f; }
        @Override public float getPpcX() { return 63f; }
        @Override public float getPpcY() { return 63f; }
        @Override public float getDensity() { return 1f; }
        @Override public void setTitle(String title) { }
        @Override public void setVSync(boolean vsync) { }
        @Override public BufferFormat getBufferFormat() { return null; }
        @Override public boolean supportsExtension(String extension) { return false; }
        @Override public boolean isContinuousRendering() { return true; }
        @Override public void setContinuousRendering(boolean continuous) { }
        @Override public void requestRendering() { }
        @Override public boolean isFullscreen() { return false; }
        @Override public Cursor newCursor(Pixmap pixmap, int xHotspot, int yHotspot) { return null; }
        @Override protected void setCursor(Cursor cursor) { }
        @Override protected void setSystemCursor(Cursor.SystemCursor cursor) { }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static Application createIosApplication() {
        return (Application)Proxy.newProxyInstance(
            RhinoIosProbe.class.getClassLoader(),
            new Class<?>[]{Application.class},
            (proxy, method, args) -> {
                if (method.getName().equals("getType")) return Application.ApplicationType.iOS;
                if (method.getName().equals("isIOS") || method.getName().equals("isMobile")) return true;
                // Keep Scl at 1 without requiring a graphics backend in this headless probe.
                if (method.getName().equals("isDesktop")) return true;
                if (method.getName().equals("getClipboardText")) return "";
                if (method.getName().equals("post")) {
                    ((Runnable)args[0]).run();
                    return null;
                }
                Class<?> result = method.getReturnType();
                if (result == boolean.class) return false;
                if (result == int.class) return 0;
                if (result == long.class) return 0L;
                if (result == float.class) return 0f;
                return null;
            });
    }

    private static GL20 createGl() {
        return (GL20)Proxy.newProxyInstance(
            RhinoIosProbe.class.getClassLoader(),
            new Class<?>[]{GL20.class},
            (proxy, method, args) -> {
                Class<?> result = method.getReturnType();
                if (result == boolean.class) return false;
                if (result == int.class) return 0;
                if (result == long.class) return 0L;
                if (result == float.class) return 0f;
                return null;
            });
    }

    public static void main(String[] args) throws Exception {
        Context context = Context.enter();
        context.setOptimizationLevel(-1);

        try {
            Events.clear();
            Core.app = createIosApplication();
            Core.graphics = new HostGraphics();
            Core.gl = createGl();
            Core.gl20 = Core.gl;
            Core.scene = new Scene();
            Core.scene.marginTop = 12f;
            Core.scene.marginLeft = 8f;
            BaseDrawable drawable = new BaseDrawable();
            Font font = new Font(new Font.FontData(), new TextureRegion(), false);
            HostStyles styles = new HostStyles(drawable, font);
            Core.scene.addStyle(ButtonStyle.class, new ButtonStyle());
            Core.scene.addStyle(LabelStyle.class, styles.outlineLabel);
            Scriptable scope = new ImporterTopLevel(context);
            HostHud hud = new HostHud();

            scope.put("Events", scope, new NativeJavaClass(scope, Events.class));
            scope.put("Time", scope, new NativeJavaClass(scope, Time.class));
            scope.put("ClientLoadEvent", scope, new NativeJavaClass(scope, HostClientLoadEvent.class));
            scope.put("WorldLoadEvent", scope, new NativeJavaClass(scope, HostWorldLoadEvent.class));
            scope.put("TestTrigger", scope, new NativeJavaClass(scope, HostTrigger.class));
            scope.put("TestHud", scope, Context.javaToJS(hud, scope));
            scope.put("TestState", scope, Context.javaToJS(new HostState(), scope));
            scope.put("TestNet", scope, Context.javaToJS(new HostNet(), scope));
            scope.put("TestStyles", scope, Context.javaToJS(styles, scope));
            scope.put("Core", scope, new NativeJavaClass(scope, Core.class));
            scope.put("Table", scope, new NativeJavaClass(scope, Table.class));
            scope.put("Touchable", scope, new NativeJavaClass(scope, Touchable.class));
            scope.put("Align", scope, new NativeJavaClass(scope, Align.class));

            context.evaluateString(scope,
                "var Vars={ios:true,mobile:true,headless:false,ui:{hudfrag:TestHud}," +
                "state:TestState,net:TestNet};" +
                "var Styles=TestStyles;" +
                "var Trigger={beforeGameUpdate:TestTrigger.frame,update:TestTrigger.update};",
                "ios-host.js", 1);

            String script = Files.readString(Path.of("scripts", "main.js"), StandardCharsets.UTF_8);
            context.evaluateString(scope, "(function(){'use strict';\n" + script + "\n})();",
                "mindustry-timescale/main.js", 1);

            Events.fire(new HostClientLoadEvent());
            Events.fire(new HostWorldLoadEvent());

            Element controlsElement = Core.scene.find("mindustry-timescale-mobile-controls");
            require(controlsElement instanceof Table, "Mobile controls were not added to Core.scene");
            Table controls = (Table)controlsElement;
            require(controls.getMarginTop() == 0f,
                "Controls should stay on the native toolbar row, marginTop=" + controls.getMarginTop());
            require(controls.getMarginLeft() == 329f,
                "Expected controls right of the 329-unit mobile toolbar, marginLeft=" + controls.getMarginLeft());
            Element left = controls.find("mindustry-timescale-left");
            Element right = controls.find("mindustry-timescale-right");
            Element value = controls.find("mindustry-timescale-value");
            require(left != null && right != null && value != null, "Missing mobile control element");
            require(controls.touchable == Touchable.childrenOnly, "Overlay should only intercept button touches");
            controls.updateVisibility();
            require(controls.visible, "Controls should be visible while the HUD is shown in game");
            hud.shown = false;
            controls.updateVisibility();
            require(!controls.visible, "Controls should hide with the mobile HUD");
            hud.shown = true;
            controls.updateVisibility();

            right.fireClick();
            Time.delta = 1f;
            Events.fire(HostTrigger.frame);
            require(Time.delta == 2f, "Right arrow did not advance 1x to 2x");
            right.fireClick();
            Time.delta = 1f;
            Events.fire(HostTrigger.frame);
            require(Time.delta == 4f, "Right arrow did not advance 2x to 4x");
            right.fireClick();
            Time.delta = 1f;
            Events.fire(HostTrigger.frame);
            require(Time.delta == 10f, "Right arrow did not advance 4x to 10x");
            require(value instanceof Label, "Center speed value is not a Label");
            require(((Label)value).getLabelAlign() == Align.center,
                "Center speed value is not center-aligned");
            value.act(0f);
            require(((Label)value).getText().toString().startsWith("10"),
                "Center label did not update to 10x: " + ((Label)value).getText());
            right.fireClick();
            Time.delta = 1f;
            Events.fire(HostTrigger.frame);
            require(Time.delta == 0.5f, "Right arrow did not wrap 10x to 0.5x");
            left.fireClick();
            Time.delta = 1f;
            Events.fire(HostTrigger.frame);
            require(Time.delta == 10f, "Left arrow did not wrap 0.5x to 10x");

            require(hud.messages().contains("v0.6.1"), "Missing client-load toast: " + hud.messages());
            require(hud.messages().contains("ready"), "Missing world-load toast: " + hud.messages());
            System.out.println("iOS UI probe passed: marginLeft=329, centered label, Time.delta=" + Time.delta);
            System.out.println("Toasts: " + hud.messages());
        } finally {
            Events.clear();
            Context.exit();
        }
    }
}
